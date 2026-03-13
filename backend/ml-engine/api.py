from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import os
import math
import joblib

app = FastAPI(title="Production ML Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProductFeatures(BaseModel):
    visits: int
    ctr: float
    time_on_page: float
    scroll_depth: float
    add_to_cart_rate: float
    conversion_rate: float
    title_quality: float
    description_length: int
    keyword_score: float
    rating: float
    reviews: int
    cluster_label: str = None

# Global ML models + normalization ranges
scaler = None
model = None
label_mapping = None
norm_ranges = None  # min/max for each feature for our custom projection

# ─── FEATURE NORMALIZATION RANGES ───────────────────────────────────
# These define realistic min/max for each feature so we can normalize to [0,1]
DEFAULT_RANGES = {
    "visits":          (0, 10000),
    "ctr":             (0, 0.20),
    "time_on_page":    (0, 300),
    "scroll_depth":    (0, 100),
    "add_to_cart_rate": (0, 0.30),
    "conversion_rate": (0, 0.15),
    "title_quality":   (1, 10),
    "description_length": (0, 2000),
    "keyword_score":   (1, 10),
    "rating":          (1, 5),
    "reviews":         (0, 2000),
}

def _normalize(value, feat_name):
    """Normalize a single feature value to [0, 1] using known ranges."""
    lo, hi = DEFAULT_RANGES.get(feat_name, (0, 1))
    if hi == lo:
        return 0.5
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))

def _log_review_score(reviews):
    """Logarithmic review scaling: 10->20 matters, 500->510 barely matters."""
    return math.log(1 + reviews) / math.log(1 + 2000)

def _compute_visibility(p_dict):
    """X-axis: Visibility / Attraction score.
    visits=20%, ctr=30%, title_quality=25%, keyword_score=25%
    """
    return (
        _normalize(p_dict.get("visits", 0), "visits") * 0.20 +
        _normalize(p_dict.get("ctr", 0), "ctr") * 0.30 +
        _normalize(p_dict.get("title_quality", 5), "title_quality") * 0.25 +
        _normalize(p_dict.get("keyword_score", 5), "keyword_score") * 0.25
    )

def _compute_confidence(p_dict):
    """Y-axis: Buyer Confidence / Conversion Strength.
    conversion_rate=30%, add_to_cart_rate=20%, rating=20%,
    log(reviews)=10%, time_on_page=10%, scroll_depth=10%
    """
    review_score = _log_review_score(p_dict.get("reviews", 0))
    return (
        _normalize(p_dict.get("conversion_rate", 0), "conversion_rate") * 0.30 +
        _normalize(p_dict.get("add_to_cart_rate", 0), "add_to_cart_rate") * 0.20 +
        _normalize(p_dict.get("rating", 3), "rating") * 0.20 +
        review_score * 0.10 +
        _normalize(p_dict.get("time_on_page", 60), "time_on_page") * 0.10 +
        _normalize(p_dict.get("scroll_depth", 50), "scroll_depth") * 0.10
    )

def _get_coords(p_dict):
    """Compute custom 2-axis projection: X=Visibility, Y=Confidence."""
    return {
        "x": float(_compute_visibility(p_dict)),
        "y": float(_compute_confidence(p_dict))
    }

def _compute_sim_visibility(p_dict):
    """Simulation-only X: 100% slider-controlled.
    title_quality=50%, keyword_score=50%
    This guarantees slider movement has full control over horizontal position.
    """
    return (
        _normalize(p_dict.get("title_quality", 5), "title_quality") * 0.50 +
        _normalize(p_dict.get("keyword_score", 5), "keyword_score") * 0.50
    )

def _compute_sim_confidence(p_dict):
    """Simulation-only Y: 100% slider-controlled.
    rating=65%, log(reviews)=35%
    This guarantees slider movement has full control over vertical position.
    """
    return (
        _normalize(p_dict.get("rating", 3), "rating") * 0.65 +
        _log_review_score(p_dict.get("reviews", 0)) * 0.35
    )

def _get_sim_coords(p_dict):
    """Simulation-specific coordinates driven purely by the 4 sliders."""
    return {
        "x": float(_compute_sim_visibility(p_dict)),
        "y": float(_compute_sim_confidence(p_dict))
    }

def _compute_trust_score(p_dict):
    """Trust score: rating dominates (70%), reviews support (30%) with log scaling."""
    rating_norm = _normalize(p_dict.get("rating", 3), "rating")
    review_score = _log_review_score(p_dict.get("reviews", 0))
    return rating_norm * 0.70 + review_score * 0.30

def _project_cvr(p_dict, old_cvr):
    """Project new CVR based on weighted trust, engagement, and SEO signals.
    Uses diminishing returns so each +1% improvement gets harder.
    """
    # Compute improvement components
    trust = _compute_trust_score(p_dict)
    atc_norm = _normalize(p_dict.get("add_to_cart_rate", 0), "add_to_cart_rate")
    ctr_norm = _normalize(p_dict.get("ctr", 0), "ctr")
    time_norm = _normalize(p_dict.get("time_on_page", 60), "time_on_page")
    title_norm = _normalize(p_dict.get("title_quality", 5), "title_quality")
    kw_norm = _normalize(p_dict.get("keyword_score", 5), "keyword_score")

    # Composite improvement signal (0 to 1 range)
    composite = (
        atc_norm * 0.25 +
        trust * 0.25 +
        ctr_norm * 0.15 +
        time_norm * 0.10 +
        title_norm * 0.15 +
        kw_norm * 0.10
    )

    # Target CVR based on composite signal (realistic e-commerce range: 0.5% to 12%)
    target_cvr = 0.005 + composite * 0.115  # 0.5% to 12%

    # Blend: move old_cvr toward target with diminishing returns
    # The further from target, the stronger the pull
    blend_factor = 0.6  # 60% weight to composite model, 40% to original
    new_cvr = old_cvr * (1 - blend_factor) + target_cvr * blend_factor

    return max(0.001, min(0.15, new_cvr))


@app.on_event("startup")
def load_models():
    global scaler, model, label_mapping
    try:
        scaler = joblib.load("outputs/scaler.pkl")
        model = joblib.load("outputs/trained_model.pkl")
        label_mapping = joblib.load("outputs/label_mapping.pkl")
        print("Models loaded successfully.")
    except Exception as e:
        print(f"Error loading models: {e}")


@app.get("/cluster-graph-data")
def get_cluster_graph_data():
    """Return all product dots with custom Visibility/Confidence projection."""
    try:
        df = pd.read_csv("outputs/cluster_labels.csv")
        sample_df = df.sample(n=min(500, len(df)), random_state=42)
        
        points = []
        for idx in sample_df.index:
            row = df.loc[idx].to_dict()
            coords = _get_coords(row)
            points.append({
                "id": int(idx),
                "x": coords["x"],
                "y": coords["y"],
                "cluster": df.loc[idx, 'cluster_label'],
                "cvr": float(df.loc[idx, 'conversion_rate']),
                "ctr": float(df.loc[idx, 'ctr']),
                "rating": float(df.loc[idx, 'rating'])
            })
        return {"points": points}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict-cluster")
def predict_cluster(product: ProductFeatures):
    if not model:
        raise HTTPException(status_code=500, detail="Models not loaded")
    
    p_dict = product.dict()
    feature_cols = ["visits", "ctr", "time_on_page", "scroll_depth", "add_to_cart_rate", "conversion_rate", "title_quality", "description_length", "keyword_score", "rating", "reviews"]
    vec = [[p_dict.get(c, 0.0) for c in feature_cols]]
    scaled = scaler.transform(vec)
    cluster_id = model.predict(scaled)[0]
    
    return {
        "cluster": label_mapping.get(str(cluster_id), label_mapping.get(int(cluster_id), "Unknown")),
        "coordinates": _get_coords(p_dict)
    }


@app.post("/simulate-product")
def simulate_product(product: ProductFeatures):
    """Simulate product performance with rebalanced feature weights."""
    if not model:
        raise HTTPException(status_code=500, detail="Models not loaded")
        
    p_dict = product.dict()
    old_cvr = p_dict.get('conversion_rate', 0.0)
    
    # Project new CVR using the balanced model
    new_cvr = _project_cvr(p_dict, old_cvr)
    p_dict['conversion_rate'] = new_cvr
    
    # Use simulation-specific coordinates (100% slider-controlled)
    # so that the 4 sliders have complete, predictable control over
    # which quadrant the dot lands in.
    sim_coords = _get_sim_coords(p_dict)
    sx, sy = sim_coords["x"], sim_coords["y"]

    # Cluster classification based purely on slider quadrant
    if sx >= 0.50 and sy >= 0.50:
        new_cluster = "High Performer"
    elif sx >= 0.50 and sy < 0.50:
        new_cluster = "Attract but Don't Convert"
    elif sx < 0.50 and sy >= 0.50:
        new_cluster = "Trust Issue Product"
    else:
        if sx < 0.30 and sy < 0.30:
            new_cluster = "Invisible Product"
        else:
            new_cluster = "Low Engagement Product"

    # Graph visual coords still use all features (blended for smooth movement)
    full_coords = _get_coords(p_dict)
    # Blend: 60% slider-driven, 40% full model — ensures dot moves visibly
    coords = {
        "x": round(sim_coords["x"] * 0.6 + full_coords["x"] * 0.4, 4),
        "y": round(sim_coords["y"] * 0.6 + full_coords["y"] * 0.4, 4)
    }
    
    return {
        "old_cluster": product.cluster_label or "Unknown",
        "new_cluster": new_cluster,
        "old_conversion_rate": old_cvr,
        "new_conversion_rate": new_cvr,
        "score_change": new_cvr - old_cvr,
        "graph_coordinates": coords,
        "visibility_score": round(coords["x"], 4),
        "confidence_score": round(coords["y"], 4)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
