import logging
import json
import joblib
import pandas as pd
import numpy as np
import os
from sklearn.cluster import KMeans, MiniBatchKMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class ClusteringTrainer:
    def __init__(self, scaled_features, original_df, output_dir="outputs"):
        self.X = scaled_features
        self.df = original_df
        self.output_dir = output_dir
        self.results = []
        self.best_model = None
        self.best_k = None
        
    def train_and_evaluate(self):
        k_range = range(2, 6) # Test 2 to 5 clusters
        logging.info(f"Starting hyperparameter search for k in {list(k_range)}")
        
        models_to_test = {
            "KMeans": lambda k: KMeans(n_clusters=k, random_state=42, n_init=10),
            "MiniBatchKMeans": lambda k: MiniBatchKMeans(n_clusters=k, random_state=42, n_init=10),
            "GMM": lambda k: GaussianMixture(n_components=k, random_state=42),
            "Agglomerative": lambda k: AgglomerativeClustering(n_clusters=k)
        }
        
        for name, model_func in models_to_test.items():
            for k in k_range:
                try:
                    logging.info(f"Training {name} with k={k}")
                    model = model_func(k)
                    
                    if name == "GMM":
                        labels = model.fit_predict(self.X)
                    else:
                        labels = model.fit_predict(self.X)
                    
                    # Evaluation Metrics
                    sil_score = silhouette_score(self.X, labels)
                    ch_score = calinski_harabasz_score(self.X, labels)
                    db_score = davies_bouldin_score(self.X, labels)
                    
                    self.results.append({
                        "model": name,
                        "k": k,
                        "silhouette": float(sil_score),
                        "calinski_harabasz": float(ch_score),
                        "davies_bouldin": float(db_score),
                        "model_obj": model,
                        "labels": labels
                    })
                    logging.info(f"  --> Sil: {sil_score:.3f}, DB: {db_score:.3f}")
                    
                except Exception as e:
                    logging.error(f"Failed training {name} with k={k}: {e}")
                    
        return self._select_best_model()

    def _select_best_model(self):
        logging.info("Selecting the best model based on Silhouette and Davies-Bouldin scores...")
        
        # We want high Silhouette and low Davies-Bouldin
        # Create a combined score for ranking
        # Maximize: silhouette + (1 / davies_bouldin)
        
        for res in self.results:
            res['combined_score'] = res['silhouette'] + (1.0 / (res['davies_bouldin'] + 1e-5))
            
        # Sort by combined score descending
        sorted_results = sorted(self.results, key=lambda x: x['combined_score'], reverse=True)
        best = sorted_results[0]
        
        self.best_model = best['model_obj']
        self.best_k = best['k']
        
        logging.info(f"Best Model Selected: {best['model']} with k={best['k']}")
        logging.info(f"Metrics: Silhouette={best['silhouette']:.4f}, DB={best['davies_bouldin']:.4f}")
        
        # Map labels to business meaning
        self._map_and_save_clusters(best)
        
        return best

    def _map_and_save_clusters(self, best_res):
        labels = best_res['labels']
        self.df['cluster_id'] = labels
        
        # Calculate centroids on original data
        feature_cols = [
            "visits", "ctr", "time_on_page", "scroll_depth", 
            "add_to_cart_rate", "conversion_rate", "title_quality", 
            "description_length", "keyword_score", "rating", "reviews"
        ]
        
        centroids = self.df.groupby('cluster_id')[feature_cols].mean()
        
        # Business logic for mapping:
        # Sort clusters by Conversion Rate
        cvr_sorted = centroids.sort_values(by='conversion_rate', ascending=False)
        
        label_mapping = {}
        names = ["High Performer", "Attract but Don't Convert", "Low Engagement Product", "Invisible Product", "Trust Issue Product"]
        
        # Simple heuristic mapping for demo
        for idx, (cluster_id, row) in enumerate(cvr_sorted.iterrows()):
            if idx < len(names):
                label_mapping[cluster_id] = names[idx]
            else:
                label_mapping[cluster_id] = f"Cluster {cluster_id}"
                
        logging.info(f"Label Mapping: {label_mapping}")
        
        self.df['cluster_label'] = self.df['cluster_id'].map(label_mapping)
        
        # Save Outputs
        os.makedirs(self.output_dir, exist_ok=True)
        
        joblib.dump(self.best_model, os.path.join(self.output_dir, "trained_model.pkl"))
        joblib.dump(label_mapping, os.path.join(self.output_dir, "label_mapping.pkl"))
        
        self.df.to_csv(os.path.join(self.output_dir, "cluster_labels.csv"), index=False)
        centroids.to_csv(os.path.join(self.output_dir, "cluster_summary.csv"))
        
        # Save metrics report
        metrics = {
            "best_model": best_res['model'],
            "optimal_k": best_res['k'],
            "silhouette_score": best_res['silhouette'],
            "calinski_harabasz": best_res['calinski_harabasz'],
            "davies_bouldin": best_res['davies_bouldin'],
            "label_mapping": {str(k): v for k, v in label_mapping.items()}
        }
        with open(os.path.join(self.output_dir, "metrics_report.json"), "w") as f:
            json.dump(metrics, f, indent=4)
            
        logging.info("Model, labels, and metrics successfully saved.")
    