import pandas as pd
from sklearn.decomposition import PCA
import joblib
import os

def generate_graph_data():
    """
    Loads clustered data, applies PCA to reduce to 2D coordinates,
    and returns a list of points with cluster labels.
    """
    if not os.path.exists("outputs/clustered_data.csv"):
        return {"error": "Clustered data not found."}
        
    df = pd.read_csv("outputs/clustered_data.csv")
    
    # Feature columns
    feature_cols = [
        "visits", "ctr", "time_on_page", "scroll_depth", 
        "add_to_cart_rate", "conversion_rate", "title_quality", 
        "description_length", "keyword_score", "rating", "reviews"
    ]
    
    # Reduce dimensionality to 2D for visualization
    # We should normalize first before PCA
    try:
        with open("outputs/scaler.pkl", "rb") as f:
            scaler = pickle.load(f)
            
        scaled_data = scaler.transform(df[feature_cols])
        pca = PCA(n_components=2, random_state=42)
        coords = pca.fit_transform(scaled_data)
        
        # Build response
        graph_data = []
        # Return a subset (e.g. 500 points) so the frontend doesn't crash rendering 5000 points
        sample_df = df.sample(n=min(500, len(df)), random_state=42)
        sample_indices = sample_df.index
        
        for idx in sample_indices:
            graph_data.append({
                "id": int(idx),
                "x": float(coords[idx][0]),
                "y": float(coords[idx][1]),
                "cluster": df.loc[idx, 'cluster_label']
            })
            
        # Also need to save PCA to transform new points
        joblib.dump(pca, "outputs/pca.pkl")
            
        return {"points": graph_data}
        
    except Exception as e:
        return {"error": str(e)}

def get_point_coordinates(feature_dict):
    """
    Takes a feature dict, normalizes, applies PCA and returns (x,y)
    """
    try:
        scaler = joblib.load("outputs/scaler.pkl")
        pca = joblib.load("outputs/pca.pkl")
            
        feature_cols = [
            "visits", "ctr", "time_on_page", "scroll_depth", 
            "add_to_cart_rate", "conversion_rate", "title_quality", 
            "description_length", "keyword_score", "rating", "reviews"
        ]
        
        # Extract features in exact order
        vec = [[feature_dict.get(c, 0) for c in feature_cols]]
        scaled_vec = scaler.transform(vec)
        coords = pca.transform(scaled_vec)
        
        return {"x": float(coords[0][0]), "y": float(coords[0][1])}
    except Exception as e:
        print("Error calculating coordinates:", e)
        return {"x": 0, "y": 0}
 