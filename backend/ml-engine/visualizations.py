import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
from sklearn.decomposition import PCA
import joblib
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class VisualizationGenerator:
    def __init__(self, data_path="outputs/cluster_labels.csv", output_dir="outputs"):
        self.data_path = data_path
        self.output_dir = output_dir
        
        feature_cols = [
            "visits", "ctr", "time_on_page", "scroll_depth", 
            "add_to_cart_rate", "conversion_rate", "title_quality", 
            "description_length", "keyword_score", "rating", "reviews"
        ]
        self.feature_cols = feature_cols
        
    def generate_all(self):
        if not os.path.exists(self.data_path):
            logging.error(f"Data not found at {self.data_path}. Run training first.")
            return
            
        logging.info("Loading data for visualizations...")
        self.df = pd.read_csv(self.data_path)
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        self._plot_correlation_heatmap()
        self._plot_pca_2d()
        self._plot_tsne_interactive()
        self._plot_centroid_comparison()
        logging.info("All visualizations generated successfully.")
        
    def _plot_correlation_heatmap(self):
        logging.info("Generating Correlation Heatmap...")
        plt.figure(figsize=(12, 10))
        corr = self.df[self.feature_cols].corr()
        sns.heatmap(corr, annot=True, cmap='coolwarm', fmt=".2f", linewidths=0.5)
        plt.title('Feature Correlation Heatmap', fontsize=16)
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, 'correlation_heatmap.png'), dpi=300)
        plt.close()
        
    def _plot_pca_2d(self):
        logging.info("Generating PCA 2D Scatter Plot...")
        
        scaler = joblib.load(os.path.join(self.output_dir, "scaler.pkl"))
        scaled_features = scaler.transform(self.df[self.feature_cols])
        
        pca = PCA(n_components=2, random_state=42)
        pca_coords = pca.fit_transform(scaled_features)
        
        plt.figure(figsize=(12, 8))
        sns.scatterplot(
            x=pca_coords[:, 0], 
            y=pca_coords[:, 1], 
            hue=self.df['cluster_label'], 
            palette='viridis', 
            alpha=0.6,
            s=50
        )
        plt.title('PCA 2D Cluster Separation', fontsize=16)
        plt.xlabel(f'Principal Component 1 ({pca.explained_variance_ratio_[0]:.2%} variance)')
        plt.ylabel(f'Principal Component 2 ({pca.explained_variance_ratio_[1]:.2%} variance)')
        plt.legend(title='Cluster', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, 'pca_clusters.png'), dpi=300)
        plt.close()
        
    def _plot_tsne_interactive(self):
        logging.info("Generating Interactive PCA/TSNE Graph (Plotly)...")
        # For performance on 5000 rows in browser, PCA is often faster than TSNE for interactive plots,
        # but we'll use a subset if we strictly wanted TSNE. We'll stick to PCA for stability.
        scaler = joblib.load(os.path.join(self.output_dir, "scaler.pkl"))
        scaled_features = scaler.transform(self.df[self.feature_cols])
        
        pca = PCA(n_components=2, random_state=42)
        pca_coords = pca.fit_transform(scaled_features)
        
        plot_df = pd.DataFrame({
            'x': pca_coords[:, 0],
            'y': pca_coords[:, 1],
            'Cluster': self.df['cluster_label'],
            'Visits': self.df['visits'],
            'CVR': self.df['conversion_rate']
        })
        
        # Sample for HTML size
        sample_df = plot_df.sample(n=min(2000, len(plot_df)), random_state=42)
        
        fig = px.scatter(
            sample_df, x='x', y='y', color='Cluster',
            hover_data=['Visits', 'CVR'],
            title='Interactive Cluster Visualization',
            color_discrete_sequence=px.colors.qualitative.Bold
        )
        fig.update_layout(template='plotly_white')
        fig.write_html(os.path.join(self.output_dir, 'interactive_clusters.html'))
        
    def _plot_centroid_comparison(self):
        logging.info("Generating Centroid Comparison Radar/Bar Chart...")
        
        centroids = self.df.groupby('cluster_label')[self.feature_cols].mean()
        
        # Normalize centroids (0 to 1) just for visualization comparisons
        centroids_norm = (centroids - centroids.min()) / (centroids.max() - centroids.min() + 1e-5)
        
        centroids_norm.T.plot(kind='bar', figsize=(14, 6), colormap='viridis')
        plt.title('Normalized Feature Importance by Cluster', fontsize=16)
        plt.ylabel('Normalized Value (0-1)')
        plt.xticks(rotation=45, ha='right')
        plt.legend(title='Cluster', bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, 'centroid_comparison.png'), dpi=300)
        plt.close()

if __name__ == "__main__":
    vg = VisualizationGenerator()
    vg.generate_all()
  