# Custom ML Model Training Guide

## Overview

Create and train your own **LSTM neural networks** on stock price data. The system:
- Fetches historical data from Finnhub
- Prepares time-series sequences
- Trains deep learning models
- Saves trained models to disk
- Makes predictions with your trained model

## Architecture

### Model Type: LSTM (Long Short-Term Memory)
- **Why LSTM?** Perfect for time-series data like stock prices
- **Layers**: 2 LSTM layers + 3 dense layers + dropout for regularization
- **Loss Function**: Mean Squared Error (MSE)
- **Optimizer**: Adam with learning rate 0.001

```
Input (30 days of prices)
    ↓
LSTM Layer 1 (64 units)
    ↓ Dropout (0.2)
LSTM Layer 2 (32 units)
    ↓ Dropout (0.2)
Dense Layer 1 (16 units, ReLU)
    ↓
Dense Layer 2 (8 units, ReLU)
    ↓
Output Layer (1 unit, Sigmoid)
    ↓
Predicted Price (0-1, then denormalized)
```

## Installation

Install TensorFlow.js for Node.js:

```bash
npm install @tensorflow/tfjs-node
```

## Quick Start

### 1. Train a Model

**Via CLI:**
```bash
# Train AAPL with default settings
node scripts/train-model.mjs AAPL

# Train with custom parameters
node scripts/train-model.mjs AAPL --epochs 100 --lookback 60 --batch 16

# Train multiple stocks in parallel
node scripts/train-model.mjs --symbols "AAPL,MSFT,GOOGL" --parallel

# List all trained models
node scripts/train-model.mjs --list
```

**Via API:**
```bash
curl -X POST http://localhost:3000/api/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "epochs": 50,
    "batchSize": 32,
    "lookbackPeriod": 30,
    "testSplit": 0.2
  }'
```

### 2. Get Model Metadata

**Via CLI:**
```bash
# List all trained models
node scripts/train-model.mjs --list
```

**Via API:**
```bash
# Get specific model metrics
GET http://localhost:3000/api/ml/train?symbol=AAPL

# List all trained models
GET http://localhost:3000/api/ml/train?list=true
```

### 3. Use Trained Model for Predictions

```typescript
import { predictWithModel } from '@/lib/ml/modelTrainer';

const prediction = await predictWithModel('AAPL', 30);
console.log(`AAPL Predicted Price: $${prediction}`);
```

## Training Configuration

```typescript
interface TrainingConfig {
  symbol: string;              // Stock ticker
  epochs: number;              // Default: 50, Range: 10-200
  batchSize: number;           // Default: 32, Typical: 16-128
  lookbackPeriod: number;      // Default: 30, Range: 5-365 days
  testSplit: number;           // Default: 0.2 (20% test, 80% train)
  learningRate: number;        // Default: 0.001
}
```

### Parameter Tuning

| Parameter | Effect | Recommendation |
|-----------|--------|-----------------|
| **epochs** | More = Better training (slower) | 50-100 for most cases |
| **batchSize** | Larger = Faster but less precise | 16-64 for time-series |
| **lookbackPeriod** | More history = Better pattern recognition | 30 for daily, 60 for trends |
| **testSplit** | 0.2 = 80% train, 20% validate | 0.15-0.3 |
| **learningRate** | Speed of weight updates | Keep at 0.001 (default) |

## Output Metrics Explained

When training completes, you get:

```json
{
  "symbol": "AAPL",
  "trainMSE": 0.0015,          // Training error
  "testMSE": 0.0018,           // Test error
  "testRMSE": 0.0424,          // Root mean squared error
  "testMAE": 0.0312,           // Mean absolute error
  "r2Score": 0.8743,           // How well model explains variance (0-1)
  "trainedAt": "2024-01-20T15:30:00Z",
  "trainingTime": 45000        // Milliseconds
}
```

### Interpreting Metrics

- **RMSE (Root Mean Squared Error)**: Average prediction error in normalized units
  - Lower = Better
  - 0.04 = Good, 0.02 = Excellent

- **MAE (Mean Absolute Error)**: Average absolute deviation
  - More interpretable than RMSE
  - 0.03 = Good

- **R² Score (Coefficient of Determination)**: How well model fits data
  - Range: 0 to 1 (can be negative if model is very bad)
  - 0.8+ = Excellent
  - 0.6-0.8 = Good
  - <0.6 = Needs improvement

## File Structure

After training, models are saved in `/ml-models/`:

```
ml-models/
├── AAPL-model.json              # Model architecture
├── AAPL-model.weights.bin       # Model weights
└── AAPL-metadata.json           # Training metrics
```

## Usage Examples

### Example 1: Train and Evaluate

```typescript
import { trainModel, getModelMetadata } from '@/lib/ml/modelTrainer';

// Train model
const metrics = await trainModel({
  symbol: 'AAPL',
  epochs: 75,
  batchSize: 32,
  lookbackPeriod: 45,
  testSplit: 0.2,
  learningRate: 0.001,
});

console.log(`Model trained!`);
console.log(`R² Score: ${metrics.r2Score}`);
console.log(`RMSE: ${metrics.testRMSE}`);

// Later: Get metadata without retraining
const metadata = getModelMetadata('AAPL');
```

### Example 2: Make Predictions

```typescript
import { predictWithModel } from '@/lib/ml/modelTrainer';

// Get latest 30-day prediction
const price = await predictWithModel('AAPL', 30);
console.log(`Predicted: $${price.toFixed(2)}`);
```

### Example 3: Compare Multiple Models

```typescript
import { listTrainedModels, getModelMetadata } from '@/lib/ml/modelTrainer';

const models = listTrainedModels();

console.log('Model Performance:');
models.forEach(symbol => {
  const meta = getModelMetadata(symbol);
  console.log(`${symbol}: R²=${meta.r2Score.toFixed(3)}, RMSE=${meta.testRMSE.toFixed(4)}`);
});
```

## Data Requirements

**Minimum Data:**
- 50+ historical price points
- At least (lookbackPeriod + 1) data points

**Optimal Data:**
- 365+ days of historical data
- Active, frequently-traded stocks
- Continuous price data (no gaps)

## Common Issues and Solutions

### Issue: "Insufficient data for [symbol]"
**Solution:**
- Ensure you've fetched historical data first:
```typescript
import { fetchAndStoreHistoricalData } from '@/lib/actions/prediction.actions';
await fetchAndStoreHistoricalData('AAPL', 'D', 365);
```

### Issue: Very low R² score (<0.4)
**Solutions:**
- Increase `lookbackPeriod` (use 60+ days)
- Increase `epochs` (100-150)
- Check data quality (gaps, missing values)
- Try more stable stocks (less volatile)

### Issue: Training takes too long
**Solutions:**
- Reduce `epochs` (start with 30)
- Increase `batchSize` (64 or 128)
- Reduce `lookbackPeriod` (use 20)
- Use original (non-LSTM) model

### Issue: Out of memory
**Solutions:**
- Reduce `batchSize` to 16
- Reduce `lookbackPeriod` to 20
- Train fewer symbols at once

## Advanced: Custom Models

You can modify `lib/ml/modelTrainer.ts` to experiment with:

```typescript
// Different architecture
function buildCustomModel(lookbackPeriod: number): tf.LayersModel {
  return tf.sequential({
    layers: [
      tf.layers.conv1d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        inputShape: [lookbackPeriod, 1]
      }),
      tf.layers.maxPooling1d({ poolSize: 2 }),
      tf.layers.flatten(),
      tf.layers.dense({ units: 32, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });
}
```

## Training Strategies

### Strategy 1: Daily Retraining
Retrain every day with new data:
```typescript
// In Inngest function
export const dailyModelRetrain = inngest.createFunction(
  { id: 'daily-model-retrain' },
  { cron: '0 2 * * *' },
  async ({ step }) => {
    const symbols = await step.run('get-symbols', getAllWatchlistSymbols);
    
    for (const symbol of symbols) {
      await step.run(`train-${symbol}`, () => 
        trainModel({ symbol, epochs: 30, ... })
      );
    }
  }
);
```

### Strategy 2: Periodic Full Retraining
Comprehensive retraining monthly:
```typescript
// 1st of every month, full retraining with more epochs
await trainModel({
  symbol: 'AAPL',
  epochs: 150,
  lookbackPeriod: 365,
  batchSize: 32
});
```

### Strategy 3: Ensemble with Statistical Models
Combine LSTM predictions with technical analysis:
```typescript
const lstmPred = await predictWithModel('AAPL', 30);
const techPred = await predictStockPrice('AAPL', 30);
const ensemble = (lstmPred + techPred.forecastedPrice) / 2;
```

## Performance Tips

1. **Use appropriate lookbackPeriod**
   - 30 days for short-term (1 month forecast)
   - 60 days for medium-term (2-3 month)
   - 90-180 days for long-term trend identification

2. **Monitor overfitting**
   - If trainMSE << testMSE, model is overfitting
   - Increase dropout rate or add more regularization

3. **Steady learning**
   - R² score should improve with more data
   - Keep learning rate at 0.001

4. **Batch processing**
   - Train multiple symbols in parallel for efficiency
   - Use `--parallel` flag:
   ```bash
   node scripts/train-model.mjs --symbols "AAPL,MSFT,GOOGL" --parallel
   ```

## Next Steps

1. **Train your first model:**
   ```bash
   node scripts/train-model.mjs AAPL
   ```

2. **Check results:**
   ```bash
   node scripts/train-model.mjs --list
   ```

3. **Integrate into UI:**
   ```tsx
   <TrainedModelCard symbol="AAPL" />
   ```

4. **Use for predictions:**
   ```typescript
   const price = await predictWithModel('AAPL');
   ```

## References

- [TensorFlow.js Docs](https://js.tensorflow.org/)
- [LSTM Explained](https://colah.github.io/posts/2015-08-Understanding-LSTMs/)
- [Time Series Forecasting](https://developers.google.com/machine-learning/crash-course)

---

**Last Updated**: February 17, 2026
