import pandas as pd
import numpy as np
import logging
from sklearn.preprocessing import StandardScaler
import joblib
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class DataPreprocessor:
    def __init__(self, data_path, output_dir="outputs"):
        self.data_path = data_path
        self.output_dir = output_dir
        self.scaler = StandardScaler()
        self.feature_cols = [
            "visits", "ctr", "time_on_page", "scroll_depth", 
            "add_to_cart_rate", "conversion_rate", "title_quality", 
            "description_length", "keyword_score", "rating", "reviews"
        ]
        
    def load_data(self):
        logging.info(f"Loading data from {self.data_path}")
        df = pd.read_csv(self.data_path)
        logging.info(f"Initial shape: {df.shape}")
        
        # Drop duplicates
        initial_len = len(df)
        df = df.drop_duplicates()
        if len(df) < initial_len:
            logging.info(f"Dropped {initial_len - len(df)} duplicate rows")
            
        # Handle missing values
        if df.isnull().sum().sum() > 0:
            logging.info("Filling missing values with median")
            df = df.fillna(df.median())
            
        return df
        
    def handle_outliers(self, df):
        """Cap outliers using IQR method to avoid dropping data"""
        logging.info("Capping outliers using IQR method")
        df_capped = df.copy()
        
        for col in self.feature_cols:
            Q1 = df_capped[col].quantile(0.25)
            Q3 = df_capped[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            # Cap the values
            df_capped[col] = np.where(df_capped[col] > upper_bound, upper_bound, df_capped[col])
            df_capped[col] = np.where(df_capped[col] < lower_bound, lower_bound, df_capped[col])
            
        return df_capped
        
    def preprocess(self):
        os.makedirs(self.output_dir, exist_ok=True)
        
        df = self.load_data()
        df_clean = self.handle_outliers(df)
        
        logging.info("Standardizing features")
        scaled_features = self.scaler.fit_transform(df_clean[self.feature_cols])
        
        # Save scaler
        scaler_path = os.path.join(self.output_dir, "scaler.pkl")
        joblib.dump(self.scaler, scaler_path)
        logging.info(f"Scaler saved to {scaler_path}")
        
        return df_clean, scaled_features

if __name__ == "__main__":
    preprocessor = DataPreprocessor("outputs/synthetic_data.csv")
    df, scaled = preprocessor.preprocess()
    print("Preprocessing successful.")
   