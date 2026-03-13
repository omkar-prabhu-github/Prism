import logging
from preprocessing import DataPreprocessor
from model_training import ClusteringTrainer
from visualizations import VisualizationGenerator
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def main():
    logging.info("="*50)
    logging.info("Starting Production ML Clustering Pipeline")
    logging.info("="*50)
    
    data_path = "outputs/synthetic_data.csv"
    if not os.path.exists(data_path):
        logging.error(f"Input data {data_path} not found. Please run generate_data.py first.")
        sys.exit(1)
        
    # Step 1: Preprocessing
    logging.info("\n--- STEP 1: Preprocessing ---")
    preprocessor = DataPreprocessor(data_path)
    df_clean, scaled_features = preprocessor.preprocess()
    
    # Step 2: Model Training & Hyperparameter Search
    logging.info("\n--- STEP 2: Model Search & Training ---")
    trainer = ClusteringTrainer(scaled_features, df_clean)
    best_model_info = trainer.train_and_evaluate()
    
    # Step 3: Generate Visualizations
    logging.info("\n--- STEP 3: Visualizations ---")
    vis_gen = VisualizationGenerator()
    vis_gen.generate_all()
    
    logging.info("="*50)
    logging.info("PIPELINE COMPLETED SUCCESSFULLY!")
    logging.info("Check the 'outputs/' directory for:")
    logging.info("- trained_model.pkl")
    logging.info("- scaler.pkl")
    logging.info("- metrics_report.json")
    logging.info("- Interactive HTML and PNG visualizations")
    logging.info("="*50)

if __name__ == "__main__":
    main()
  