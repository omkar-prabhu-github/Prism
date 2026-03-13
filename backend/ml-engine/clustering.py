import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import pickle
import os

def train_clustering_model():
    data_path = "outputs/synthetic_data.csv"
    if not os.path.exists(data_path):
        print("Data not found. Please run generate_data.py first.")
        return
        
    df = pd.read_csv(data_path)
    
    # 1. Normalize all numeric columns
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(df)
    
    # 2. KMeans clustering (3 clusters)
    # Using random_state for reproducibility
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(scaled_data)
    
    # Assign cluster labels based on characteristics
    # We need to figure out which cluster is which by analyzing the centroids
    centroids = scaler.inverse_transform(kmeans.cluster_centers_)
    centroid_df = pd.DataFrame(centroids, columns=df.columns)
    
    # Identify "High Performer" (Highest CVR/ATC)
    high_perf_idx = centroid_df['conversion_rate'].idxmax()
    
    # Identify "Attract but Don't Convert" (High CTR, Low CVR)
    # We can rank by CTR/CVR ratio
    centroid_df['ctr_cvr_ratio'] = centroid_df['ctr'] / (centroid_df['conversion_rate'] + 0.0001)
    
    # Exclude high_perf_idx from the remaining checks
    remaining_indices = [i for i in range(3) if i != high_perf_idx]
    
    # The one with higher CTR/CVR ratio among remaining is Attract but Don't Convert
    if centroid_df.loc[remaining_indices[0], 'ctr_cvr_ratio'] > centroid_df.loc[remaining_indices[1], 'ctr_cvr_ratio']:
        attract_idx = remaining_indices[0]
        invisible_idx = remaining_indices[1]
    else:
        attract_idx = remaining_indices[1]
        invisible_idx = remaining_indices[0]
        
    label_mapping = {
        high_perf_idx: "High Performer",
        attract_idx: "Attract but Don't Convert",
        invisible_idx: "Invisible Product"
    }
    
    print("Cluster Mapping based on Centroids:")
    print(f"Cluster {high_perf_idx} -> High Performer (CVR: {centroid_df.loc[high_perf_idx, 'conversion_rate']:.4f})")
    print(f"Cluster {attract_idx} -> Attract but Don't Convert (CTR: {centroid_df.loc[attract_idx, 'ctr']:.4f}, CVR: {centroid_df.loc[attract_idx, 'conversion_rate']:.4f})")
    print(f"Cluster {invisible_idx} -> Invisible Product (CTR: {centroid_df.loc[invisible_idx, 'ctr']:.4f})")
    
    # Save the model, scaler, and label mapping
    os.makedirs("outputs", exist_ok=True)
    with open("outputs/scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
        
    with open("outputs/kmeans.pkl", "wb") as f:
        pickle.dump(kmeans, f)
        
    with open("outputs/label_mapping.pkl", "wb") as f:
        pickle.dump(label_mapping, f)
        
    # Save cluster assignments
    df['cluster_id'] = clusters
    df['cluster_label'] = df['cluster_id'].map(label_mapping)
    df.to_csv("outputs/clustered_data.csv", index=False)
    
    print("\nModels and clustered data saved to outputs/")

if __name__ == "__main__":
    train_clustering_model()
  