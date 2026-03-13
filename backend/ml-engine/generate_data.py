import pandas as pd
import numpy as np
import os

def generate_synthetic_data(num_rows=5000, seed=42):
    np.random.seed(seed)
    
    # 1. Base independent variables
    visits = np.random.randint(100, 50000, size=num_rows)
    title_quality = np.clip(np.random.normal(loc=6.0, scale=2.0, size=num_rows), 1, 10)
    description_length = np.random.randint(20, 1000, size=num_rows)
    keyword_score = np.clip(np.random.normal(loc=5.0, scale=2.5, size=num_rows), 1, 10)
    
    # Randomly assign quality tiers to create clusters naturally
    quality_tier = np.random.choice(['high', 'med', 'low'], size=num_rows, p=[0.2, 0.5, 0.3])
    
    for i in range(num_rows):
        if quality_tier[i] == 'high':
            title_quality[i] = np.random.uniform(7, 10)
            keyword_score[i] = np.random.uniform(7, 10)
        elif quality_tier[i] == 'low':
            title_quality[i] = np.random.uniform(1, 4)
            keyword_score[i] = np.random.uniform(1, 4)

    # 2. Derived variables based on rules + noise
    
    # Rule 1: Higher title_quality + keyword_score -> higher ctr
    # Let's say CTR is max 15% (0.15) for normal items, could be up to 0.30
    base_ctr = (title_quality + keyword_score) / 20.0 * 0.15
    noise_ctr = np.random.normal(0, 0.02, size=num_rows)
    ctr = np.clip(base_ctr + noise_ctr, 0.001, 0.35)
    
    # Engagement metrics
    # Description length affects time on page and scroll depth
    time_on_page = description_length * 0.5 + np.random.normal(30, 20, size=num_rows)
    time_on_page = np.clip(time_on_page, 10, 600) # seconds
    
    scroll_depth = (description_length / 1000.0) * 80 + np.random.normal(10, 5, size=num_rows)
    scroll_depth = np.clip(scroll_depth, 10, 100) # percentage
    
    # Ratings and Reviews
    for i in range(num_rows):
        if quality_tier[i] == 'high':
            rating = np.random.uniform(4.0, 5.0)
            reviews = np.random.randint(50, 2000)
        elif quality_tier[i] == 'med':
            rating = np.random.uniform(3.0, 4.5)
            reviews = np.random.randint(10, 500)
        else:
            rating = np.random.uniform(1.0, 3.5)
            reviews = np.random.randint(0, 50)
            
    # Vectorize Rating/Reviews creation based on tier for speed
    rating = np.zeros(num_rows)
    reviews = np.zeros(num_rows)
    
    high_mask = quality_tier == 'high'
    med_mask = quality_tier == 'med'
    low_mask = quality_tier == 'low'
    
    rating[high_mask] = np.random.uniform(4.0, 5.0, size=high_mask.sum())
    reviews[high_mask] = np.random.randint(50, 2000, size=high_mask.sum())
    
    rating[med_mask] = np.random.uniform(3.0, 4.5, size=med_mask.sum())
    reviews[med_mask] = np.random.randint(10, 500, size=med_mask.sum())
    
    rating[low_mask] = np.random.uniform(1.0, 3.5, size=low_mask.sum())
    reviews[low_mask] = np.random.randint(0, 50, size=low_mask.sum())
    
    # Rule 2: Higher ctr + better rating -> higher add_to_cart_rate
    # Normalize rating to 0-1
    norm_rating = rating / 5.0
    # ATC is usually 5-15% (0.05 - 0.15)
    base_atc = (ctr * 0.5 + norm_rating * 0.5) * 0.20
    noise_atc = np.random.normal(0, 0.02, size=num_rows)
    add_to_cart_rate = np.clip(base_atc + noise_atc, 0.001, 0.40)
    
    # Create some "Attract but Don't Convert" products specifically
    # High CTR, but low ATC and Conversion
    attract_mask = np.random.choice([True, False], size=num_rows, p=[0.1, 0.9])
    ctr[attract_mask] = np.random.uniform(0.15, 0.30, size=attract_mask.sum())
    add_to_cart_rate[attract_mask] = np.random.uniform(0.01, 0.04, size=attract_mask.sum())
    rating[attract_mask] = np.random.uniform(2.0, 3.5, size=attract_mask.sum())
    
    # Rule 3 & 4: Higher add_to_cart_rate + trust signals -> higher conversion_rate
    # Trust is a factor of rating and log(reviews)
    trust_signal = (rating / 5.0) * np.clip(np.log1p(reviews) / np.log1p(2000), 0, 1)
    
    # CVR is usually 1-5% (0.01 - 0.05), mostly constrained by ATC
    base_cvr = add_to_cart_rate * (0.3 + trust_signal * 0.5)
    noise_cvr = np.random.normal(0, 0.005, size=num_rows)
    conversion_rate = np.clip(base_cvr + noise_cvr, 0.0001, 0.15)
    
    # Enforce CVR <= ATC
    conversion_rate = np.minimum(conversion_rate, add_to_cart_rate * 0.95)
    
    # Rule 5: Low scroll_depth + low time_on_page -> weak engagement
    weak_engagement = (scroll_depth < 30) & (time_on_page < 30)
    conversion_rate[weak_engagement] *= 0.5

    df = pd.DataFrame({
        "visits": visits.astype(int),
        "ctr": np.round(ctr, 4),
        "time_on_page": np.round(time_on_page, 2),
        "scroll_depth": np.round(scroll_depth, 2),
        "add_to_cart_rate": np.round(add_to_cart_rate, 4),
        "conversion_rate": np.round(conversion_rate, 4),
        "title_quality": np.round(title_quality, 2),
        "description_length": description_length.astype(int),
        "keyword_score": np.round(keyword_score, 2),
        "rating": np.round(rating, 2),
        "reviews": reviews.astype(int)
    })
    
    return df

if __name__ == "__main__":
    print("Generating synthetic data...")
    df = generate_synthetic_data(5000, seed=42)
    os.makedirs("outputs", exist_ok=True)
    df.to_csv("outputs/synthetic_data.csv", index=False)
    print(f"Generated {len(df)} rows. Saved to outputs/synthetic_data.csv")
    print(df.head())
 