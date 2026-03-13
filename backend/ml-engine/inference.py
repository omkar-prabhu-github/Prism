import joblib
import pandas as pd
import numpy as np
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ClusteringInference:
    def __init__(self, model_dir="outputs"):
        self.model_dir = model_dir
        self.scaler = None
        self.model = None
        self.label_mapping = None
        self.feature_cols = [
            "visits", "ctr", "time_on_page", "scroll_depth", 
            "add_to_cart_rate", "conversion_rate", "title_quality", 
            "description_length", "keyword_score", "rating", "reviews"
        ]
        self.load_models()
        
    def load_models(self):
        try:
            self.scaler = joblib.load(os.path.join(self.model_dir, "scaler.pkl"))
            self.model = joblib.load(os.path.join(self.model_dir, "trained_model.pkl"))
            self.label_mapping = joblib.load(os.path.join(self.model_dir, "label_mapping.pkl"))
            logging.info("Models loaded successfully for inference.")
        except Exception as e:
            logging.error(f"Error loading models. Have you run the training pipeline? Error: {e}")

    def predict_cluster(self, new_row_dict):
        """Predicts the cluster for a single new row dictionary."""
        if not self.model or not self.scaler:
            return {"error": "Models not loaded."}
            
        try:
            # Extract features in the correct order
            vec = [[new_row_dict.get(col, 0.0) for col in self.feature_cols]]
            scaled_vec = self.scaler.transform(vec)
            
            cluster_id = self.model.predict(scaled_vec)[0]
            cluster_label = self.label_mapping.get(cluster_id, f"Cluster {cluster_id}")
            
            return {
                "cluster_id": int(cluster_id),
                "cluster_label": cluster_label
            }
        except Exception as e:
            logging.error(f"Prediction error: {e}")
            return {"error": str(e)}

    def get_cluster_centroid(self, cluster_id):
        """Returns the average metric values for a given cluster ID based on the summary."""
        try:
            summary_df = pd.read_csv(os.path.join(self.model_dir, "cluster_summary.csv"))
            # Ensure cluster_id is correct type
            centroid = summary_df[summary_df['cluster_id'] == int(cluster_id)]
            if not centroid.empty:
                return centroid.to_dict('records')[0]
            return {"error": "Cluster ID not found in summary"}
        except Exception as e:
            return {"error": str(e)}

    def get_graph_coordinates(self, new_row_dict=None):
        """Returns 2D PCA coordinates. If new_row_dict is provided, calculates coords for that point."""
        from sklearn.decomposition import PCA
        try:
            # In production, you would pre-fit this PCA during training. 
            # For simplicity here, we load existing data or a pre-fit PCA if saved.
            df = pd.read_csv(os.path.join(self.model_dir, "cluster_labels.csv"))
            scaled_data = self.scaler.transform(df[self.feature_cols])
            
            pca = PCA(n_components=2, random_state=42)
            pca.fit(scaled_data)
            
            if new_row_dict:
                vec = [[new_row_dict.get(col, 0.0) for col in self.feature_cols]]
                scaled_vec = self.scaler.transform(vec)
                coords = pca.transform(scaled_vec)[0]
                return {"x": float(coords[0]), "y": float(coords[1])}
            else:
                return {"error": "Provide new_row_dict to get coordinates"}
        except Exception as e:
            return {"error": str(e)}
   