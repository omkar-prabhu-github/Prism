import joblib
import numpy as np

# Load models safely
def load_models():
    try:
        scaler = joblib.load("outputs/scaler.pkl")
        kmeans = joblib.load("outputs/trained_model.pkl")
        label_mapping = joblib.load("outputs/label_mapping.pkl")
        return scaler, kmeans, label_mapping
    except Exception as e:
        print(f"Error loading models: {e}")
        return None, None, None

def simulate_improvements(product_dict):
    """
    Takes a product dictionary, calculates the improvement factor,
    recalculates CVR, normalizes, predicts new cluster.
    """
    scaler, kmeans, label_mapping = load_models()
    if not scaler:
        raise ValueError("Models not loaded. Run clustering.py first.")
        
    # Extract edited metrics (or assume defaults if missing)
    old_cvr = product_dict.get('conversion_rate', 0.0)
    
    title_qual = product_dict.get('title_quality', 5.0)
    keyword_score = product_dict.get('keyword_score', 5.0)
    rating = product_dict.get('rating', 3.0)
    reviews = product_dict.get('reviews', 0)
    
    # Calculate improvement factors based on a baseline (assuming an average product)
    # The higher these values are above baseline, the more the improvement
    
    # 1. Title & Keyword improvement (affects CTR primarily, but has knock-on effect to CVR)
    title_imp = max(0, title_qual - 5.0) * 0.001
    key_imp = max(0, keyword_score - 5.0) * 0.001
    
    # 2. Trust increase (Rating and Reviews)
    trust_imp = (rating / 5.0) * min(reviews / 1000.0, 1.0) * 0.02
    
    # 3. Add to Cart Rate (if provided)
    atc = product_dict.get('add_to_cart_rate', 0.05)
    atc_imp = max(0, atc - 0.05) * 0.1
    
    total_improvement_factor = title_imp + key_imp + trust_imp + atc_imp
    
    new_conversion_rate = old_cvr + total_improvement_factor
    # Clamp between 0 and 1
    new_conversion_rate = max(0.0, min(1.0, new_conversion_rate))
    
    # Update dictionary for prediction
    new_product_dict = product_dict.copy()
    new_product_dict['conversion_rate'] = new_conversion_rate
    
    # Prepare feature vector in the right order
    feature_order = [
        "visits", "ctr", "time_on_page", "scroll_depth", 
        "add_to_cart_rate", "conversion_rate", "title_quality", 
        "description_length", "keyword_score", "rating", "reviews"
    ]
    
    feature_vector = np.array([[new_product_dict.get(f, 0) for f in feature_order]])
    
    # Re-normalize row
    scaled_vector = scaler.transform(feature_vector)
    
    # Predict cluster again
    cluster_id = kmeans.predict(scaled_vector)[0]
    new_cluster = label_mapping[cluster_id]
    
    return {
        "new_conversion_rate": round(new_conversion_rate, 4),
        "score_change": round(new_conversion_rate - old_cvr, 4),
        "new_cluster": new_cluster,
        "new_features": new_product_dict
    }
