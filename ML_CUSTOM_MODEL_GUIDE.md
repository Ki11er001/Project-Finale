# Custom Machine Learning Model Training - Complete Guide

## What is an LSTM Model?

**LSTM** = Long Short-Term Memory - A type of neural network designed for **time-series data** like stock prices.

### Why LSTM for Stock Prices?
- Remembers long-term patterns
- Good at capturing trends
- Handles sequences naturally
- Better than simple linear regression

## Getting Started

### Step 1: Install Dependencies

```bash
npm install
```

This installs TensorFlow.js which you need for training. The dependencies are already in package.json.

### Step 2: Fetch Historical Data

Before training, you need historical price data in MongoDB:

```typescript
import { fetchAndStoreHistoricalData } from '@/lib/actions/prediction.actions';

// Fetch 1 year of daily data for Apple
await fetchAndStoreHistoricalData('AAPL', 'D', 365);
```

Or via API:
```bash
curl -X POST http://localhost:3000/api/predictions/predict \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL", "daysInFuture": 30}'
```

### Step 3: Train Your Model

**Option A: Command Line (Easiest)**

```bash
# Train AAPL with default settings
npm run train:model AAPL

# With custom parameters
node scripts/train-model.mjs AAPL --epochs 100 --lookback 60

# Train multiple stocks
node scripts/train-model.mjs --symbols "AAPL,MSFT,GOOGL"

# List all trained models
npm run train:model:list
```

**Option B: API Call**

```bash
curl -X POST http://localhost:3000/api/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "epochs": 50,
    "batchSize": 32,
    "lookbackPeriod": 30,
    "testSplit": 0.2,
    "learningRate": 0.001
  }'
```

**Option C: Code**

```typescript
import { trainModel } from '@/lib/ml/modelTrainer';

const metrics = await trainModel({
  symbol: 'AAPL',
  epochs: 50,
  batchSize: 32,
  lookbackPeriod: 30,
  testSplit: 0.2,
  learningRate: 0.001
});

console.log(`Training complete! R² = ${metrics.r2Score}`);
```

## Understanding Training

### The Training Process

```
1. Load Data
   └─> Get last 365 days of prices from MongoDB
   
2. Prepare Sequences
   └─> Convert [p1, p2, ..., p30] → p31 (30-day input, predict day 31)
   
3. Split Data
   └─> 80% for training, 20% for testing
   
4. Normalize
   └─> Scale prices 0-1 so model learns better
   
5. Build LSTM
   └─> Create 2-layer LSTM with dropout
   
6. Train Model
   └─> Feed sequences, let model learn patterns
   
7. Evaluate
   └─> Test on unseen 20% of data
   
8. Save
   └─> Store model to /ml-models/ folder
```

### Configuration Parameters Explained

```
{
  "symbol": "AAPL",           // Stock to train on
  "epochs": 50,               // How many times to go through data (50-100 typical)
  "batchSize": 32,            // How many sequences at a time (16-64)
  "lookbackPeriod": 30,       // How many days of history (20-90)
  "testSplit": 0.2,           // 20% test, 80% train
  "learningRate": 0.001       // Speed of learning (leave at 0.001)
}
```

### Training Times

Approximate training times on standard hardware:

| Epochs | Lookback | Time |
|--------|----------|------|
| 30     | 20       | 10s  |
| 50     | 30       | 30s  |
| 100    | 60       | 2min |
| 150    | 90       | 5min |

## Example Walkthroughs

### Example 1: Your First Model

```bash
# Step 1: Ensure data exists
node scripts/test-db.mjs

# Step 2: Train the model
npm run train:model AAPL

# Step 3: View results
npm run train:model:list
```

**Output:**
```
╔════════════════════════════════════════════════════╗
║     ML Model Trainer - Stock Price Prediction      ║
║         Using TensorFlow.js & LSTM Networks        ║
╚════════════════════════════════════════════════════╝

► Training model for AAPL
  Epochs: 50
  Lookback: 30 days
  Batch Size: 32
  Test Split: 20%

✅ Training Complete!
   Symbol: AAPL
   Train MSE: 0.000150
   Test MSE: 0.000180
   Test RMSE: 0.0424
   Test MAE: 0.0312
   R² Score: 0.8743
   Time: 45.23s
```

### Example 2: Use Trained Model for Predictions

```typescript
import { predictWithModel } from '@/lib/ml/modelTrainer';

// Get prediction
const price = await predictWithModel('AAPL', 30);

// Denormalized to actual price
console.log(`AAPL predicted: $${price.toFixed(2)}`);

// Compare with ensemble prediction
import { predictStockPrice } from '@/lib/actions/prediction.actions';

const ensemble = await predictStockPrice('AAPL', 30);
const lstmPred = await predictWithModel('AAPL', 30);

const average = (ensemble.forecastedPrice + lstmPred) / 2;
console.log(`Ensemble average: $${average.toFixed(2)}`);
```

### Example 3: Display in React Component

```tsx
import { TrainedModelCard } from '@/components/TrainedModelCard';

export default function StockPage({ symbol }: { symbol: string }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <TrainedModelCard 
        symbol={symbol}
        onTrainingComplete={() => console.log('Done!')}
      />
    </div>
  );
}
```

### Example 4: Train Multiple Stocks in Parallel

```bash
# All at once (10 min for 3 stocks)
npm run train:model -- --symbols "AAPL,MSFT,GOOGL" --parallel

# One by one (20 min for 3 stocks, but uses less memory)
npm run train:model -- --symbols "AAPL,MSFT,GOOGL"
```

### Example 5: Retrain Daily with Inngest

```typescript
// In lib/inngest/functions.ts

import { trainModel } from '@/lib/ml/modelTrainer';

export const dailyModelRetrain = inngest.createFunction(
  { id: 'daily-model-retrain' },
  { cron: '0 2 * * *' }, // 2 AM daily
  async ({ step }) => {
    const users = await step.run('get-users', getAllUsersForNewsEmail);
    const symbols = new Set<string>();

    for (const user of users) {
      const watchlist = await getWatchlistSymbolsByEmail(user.email);
      watchlist.forEach(s => symbols.add(s));
    }

    // Retrain each model
    for (const symbol of symbols) {
      await step.run(`retrain-${symbol}`, () => 
        trainModel({
          symbol,
          epochs: 30,  // Shorter retraining
          lookbackPeriod: 30,
          batchSize: 32,
          testSplit: 0.2,
          learningRate: 0.001
        })
      );
    }

    return { success: true, trained: symbols.size };
  }
);
```

## Monitoring Training

### Live Console Output

During training, you'll see:
```
🚀 Starting training for AAPL...
📊 Preparing training data (lookback: 30 days)...
[████████░░] 50% - Training...
🧠 Building LSTM neural network...
⚙️  Training model (50 epochs)...
[████████████] 100% - Complete
📊 Evaluating model...
💾 Saving model to file://./ml-models/AAPL-model
✅ Training complete!
```

### Check Model Files

```bash
# Linux/Mac
ls -lh ml-models/

# Windows PowerShell
Get-ChildItem ml-models/

# Expected files:
ml-models/AAPL-model.json            (architecture)
ml-models/AAPL-model.weights.bin     (weights)
ml-models/AAPL-metadata.json         (metrics)
```

## Interpreting Results

### Good Results
```json
{
  "r2Score": 0.85,    ✅ Excellent (0.8+)
  "testRMSE": 0.042,  ✅ Good (<0.05)
  "testMAE": 0.031,   ✅ Good (<0.04)
}
```

### Mediocre Results
```json
{
  "r2Score": 0.55,    ⚠️ Needs improvement (0.4-0.6)
  "testRMSE": 0.12,   ⚠️ Could be better (0.08-0.15)
  "testMAE": 0.09,    ⚠️ Moderate error (0.05-0.10)
}
```

### Poor Results
```json
{
  "r2Score": 0.20,    ❌ Very poor (<0.4)
  "testRMSE": 0.25,   ❌ High error (>0.2)
  "testMAE": 0.20,    ❌ Large deviation (>0.15)
}
```

**Solutions if results are poor:**
1. Increase `epochs` (more training)
2. Increase `lookbackPeriod` (more history)
3. Choose more stable stocks
4. Check data quality in MongoDB

## Troubleshooting

### Problem: "Insufficient data"
```
Error: Need at least 50 data points, got 10
```

**Solution:** Fetch more data first
```typescript
import { fetchAndStoreHistoricalData } from '@/lib/actions/prediction.actions';

// Fetch 2 years of data
await fetchAndStoreHistoricalData('AAPL', 'D', 730);
```

### Problem: "Out of memory"
```
Error: Failed to allocate memory
```

**Solution:** Reduce batch size or epochs
```bash
node scripts/train-model.mjs AAPL --batch 16 --epochs 30
```

### Problem: "Model file not found"
```
Error: Cannot load model
```

**Solution:** Retrain the model
```bash
npm run train:model AAPL
```

### Problem: Training too slow
**Solutions:**
1. Reduce `epochs` (e.g., 30 instead of 100)
2. Reduce `lookbackPeriod` (e.g., 20 instead of 60)
3. Use smaller `batchSize` (trade-off: slower training)

## Advanced: Customizing the Model Architecture

Edit `lib/ml/modelTrainer.ts` to modify the neural network:

```typescript
function buildModel(lookbackPeriod: number): tf.LayersModel {
  return tf.sequential({
    layers: [
      // Try different configurations:
      
      // Option 1: Deeper network (slower but more powerful)
      tf.layers.lstm({
        units: 128,      // Increase from 64
        returnSequences: true,
        inputShape: [lookbackPeriod, 1],
        activation: 'relu',
      }),
      tf.layers.dropout({ rate: 0.3 }),  // More dropout
      
      tf.layers.lstm({
        units: 64,       // Add another LSTM
        returnSequences: true,
        activation: 'relu',
      }),
      tf.layers.dropout({ rate: 0.3 }),
      
      // Option 2: Different activation functions
      tf.layers.dense({ units: 32, activation: 'elu' }),  // ELU instead of ReLU
      tf.layers.dense({ units: 16, activation: 'elu' }),
      
      // Output
      tf.layers.dense({ units: 1, activation: 'sigmoid' }),
    ]
  });
}
```

## Best Practices

### ✅ DO

- **Train on liquid assets** (AAPL, MSFT, GOOGL)
- **Use 30+ day lookback** for daily predictions
- **Retrain monthly** with new data
- **Monitor R² score** (should be >0.6)
- **Start with 50 epochs**, increase if needed
- **Use parallel training** for multiple stocks

### ❌ DON'T

- Train on penny stocks (too volatile, noisy data)
- Use very small epochs (10-20), model won't learn
- Use lookbackPeriod > 90 (too much history)
- Train without enough data (<100 points)
- Ignore R² score (it tells you model quality)
- Use predictions as sole investment signal

## Next Steps

1. **Train your first model:**
   ```bash
   npm run train:model AAPL
   ```

2. **Check results:**
   ```bash
   npm run train:model:list
   ```

3. **Make predictions:**
   ```typescript
   const price = await predictWithModel('AAPL');
   ```

4. **Display in UI:**
   ```tsx
   <TrainedModelCard symbol="AAPL" />
   ```

5. **Set up automatic retraining:**
   - Add Inngest function
   - Run daily or weekly

## File Reference

| File | Purpose |
|------|---------|
| `lib/ml/modelTrainer.ts` | Model training logic |
| `app/api/ml/train/route.ts` | Training API endpoints |
| `scripts/train-model.mjs` | CLI training script |
| `components/TrainedModelCard.tsx` | UI component |
| `ml-models/` | Saved models directory |

## Performance Metrics Summary

| Metric | Good | Acceptable | Poor |
|--------|------|-----------|------|
| R² Score | >0.8 | 0.6-0.8 | <0.6 |
| RMSE | <0.05 | 0.05-0.15 | >0.15 |
| MAE | <0.04 | 0.04-0.10 | >0.10 |
| MSE | <0.003 | 0.003-0.02 | >0.02 |

---

**Happy training! 🚀**

For questions, check the main documentation in `ML_AI_MODEL_DOCUMENTATION.md`
