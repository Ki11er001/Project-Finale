# Stock Price Prediction ML/AI Model Documentation

## Overview

A comprehensive machine learning model for stock price predictions using statistical forecasting and technical analysis. The system uses ensemble methods combining Linear Regression and Exponential Moving Average (EMA) predictions with technical indicators (RSI, MACD).

## Architecture

### 1. **Data Models**

#### StockPrice Model
- Stores historical OHLCV (Open, High, Low, Close, Volume) data
- Fetches from Finnhub API
- Indexed for efficient queries by symbol and date

**File**: `database/models/stockPrice.model.ts`

#### StockPrediction Model
- Stores generated predictions with confidence scores
- Technical indicators and model parameters
- Indexed for quick retrieval

**File**: `database/models/prediction.model.ts`

### 2. **Prediction Actions**

**File**: `lib/actions/prediction.actions.ts`

#### Core Functions:

**`fetchAndStoreHistoricalData(symbol, resolution, daysBack)`**
- Fetches historical candle data from Finnhub
- Stores in MongoDB for analysis
- Parameters:
  - `symbol`: Stock ticker (e.g., "AAPL")
  - `resolution`: 'D' (daily), 'W' (weekly), 'M' (monthly)
  - `daysBack`: Historical days to fetch (default: 365)

**`predictStockPrice(symbol, daysInFuture)`**
- Main prediction function
- Returns: `StockPredictionData` with forecasted price and confidence
- Parameters:
  - `symbol`: Stock ticker
  - `daysInFuture`: Prediction horizon (default: 30 days)

### 3. **Prediction Algorithms**

#### Linear Regression
- Fits a trend line to historical prices
- Extrapolates trend forward
- Calculates R-squared for model quality

#### Exponential Moving Average (EMA)
- Smoothed price with recent bias
- Projects forward using recent trend
- Better captures momentum

#### Ensemble Method
- Combines Linear Regression + EMA predictions
- Averages both approaches for robust forecast

#### Technical Indicators

**RSI (Relative Strength Index)**
- 14-period momentum oscillator
- Values: 0-100
- Buy signal: RSI < 30
- Sell signal: RSI > 70

**MACD (Moving Average Convergence Divergence)**
- Uses 12, 26, and 9-period EMAs
- Generates BUY, SELL, or NEUTRAL signals
- Based on MACD line vs signal line crossover

**Moving Averages**
- 20-day MA: Short-term trend
- 50-day MA: Medium-term trend
- 200-day MA: Long-term trend

### 4. **Confidence Scoring**

Confidence score (0-100) is calculated based on:
- Model quality (R-squared value)
- RSI health (30-70 range considered healthy)
- Data quality (number of data points)

## API Endpoints

### Generate/Update Prediction
```
POST /api/predictions/predict
Content-Type: application/json

{
  "symbol": "AAPL",
  "daysInFuture": 30
}

Response:
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "forecastedPrice": 185.50,
    "confidenceScore": 75,
    "changePercent": 5.25,
    "priceRange": {
      "low": 180.20,
      "high": 190.80
    },
    "rsiScore": 45,
    "macdSignal": "BUY",
    "movingAverages": {
      "ma20": 182.30,
      "ma50": 180.15,
      "ma200": 175.80
    },
    ...
  }
}
```

### Get Latest Prediction
```
GET /api/predictions?symbol=AAPL

Query Parameters:
- symbol: Single stock ticker
- symbols: Comma-separated multiple tickers (e.g., "AAPL,MSFT,GOOGL")

Response:
{
  "success": true,
  "data": [...]
}
```

## Inngest Integration

### Scheduled Tasks

**1. Daily Prediction Updates** (`updateStockPredictions`)
- Runs at 3:00 AM UTC daily (after market close)
- Fetches latest data for all user watchlists
- Generates predictions for all symbols
- Updates database

**2. On-Demand Prediction** (`generatePredictionOnWatchlistAdd`)
- Triggered when user adds stock to watchlist
- Fetches historical data
- Generates initial prediction
- Provides immediate insight to user

## React Component

**File**: `components/PredictionCard.tsx`

Display prediction data with:
- Forecasted price and expected change
- Confidence score visualization
- Price range (95% confidence interval)
- Technical indicators display
- Action buttons to refresh

### Usage:
```tsx
<PredictionCard symbol="AAPL" showFetchButton={true} />
```

## Data Requirements

Minimum 20 data points required for prediction. The model works best with:
- At least 365 days of historical data
- Active, frequently-traded stocks
- Liquid markets (NASDAQ, NYSE)

## Model Limitations

1. **Historical Data Dependent**: Works best with sufficient historical data
2. **No Real-time Events**: Cannot account for earnings, FDA approvals, etc.
3. **Market Regime Changes**: May underperform during unprecedented market conditions
4. **Momentum Based**: Assumes historical patterns continue

## Performance Metrics

The model calculates:
- **R-squared**: How well the trend fits historical data (0-1)
- **Confidence Score**: Overall prediction reliability (0-100)
- **Standard Deviation**: Volatility for price range

## Environment Variables

```env
FINNHUB_API_KEY=your_finnhub_api_key
NEXT_PUBLIC_FINNHUB_API_KEY=your_finnhub_api_key
MONGODB_URI=your_mongodb_connection_string
```

## Database Queries

### Get Historical Prices
```typescript
import { getHistoricalPrices } from '@/lib/actions/prediction.actions';

const prices = await getHistoricalPrices('AAPL', 365);
// Returns: [{ date: Date, close: number }, ...]
```

### Get All Predictions for User's Watchlist
```typescript
import { getPredictions } from '@/lib/actions/prediction.actions';

const symbols = ['AAPL', 'MSFT', 'GOOGL'];
const predictions = await getPredictions(symbols);
```

### Get Latest Prediction
```typescript
import { getLatestPrediction } from '@/lib/actions/prediction.actions';

const prediction = await getLatestPrediction('AAPL');
```

## Integration Examples

### In Stock Details Page
```tsx
import { PredictionCard } from '@/components/PredictionCard';

export default function StockDetailsPage({ symbol }: { symbol: string }) {
  return (
    <div>
      <h1>{symbol}</h1>
      <PredictionCard symbol={symbol} />
    </div>
  );
}
```

### In Watchlist Display
```tsx
const predictions = await getPredictions(watchlist.map(w => w.symbol));

predictions.forEach(pred => {
  console.log(`${pred.symbol}: ${pred.forecastedPrice} (${pred.changePercent}%)`);
});
```

## Future Enhancements

1. **ARIMA Model**: Seasonal autoregressive model for better accuracy
2. **Neural Networks**: LSTM for time-series prediction
3. **Sentiment Analysis**: Integrate news/social media sentiment
4. **Multi-timeframe**: Support for hourly, 4-hour, weekly predictions
5. **Ensemble**: Add more models (SVM, Random Forest)
6. **Backtesting**: Historical performance validation
7. **Risk Metrics**: VaR, Sharpe ratio calculations
8. **Alert System**: Notify users on prediction milestones

## Testing

### Test Database Connection
```bash
npm run test:db
```

### Generate Test Predictions
```typescript
import { predictStockPrice, fetchAndStoreHistoricalData } from '@/lib/actions/prediction.actions';

// Fetch data for AAPL
await fetchAndStoreHistoricalData('AAPL');

// Generate 30-day prediction
const pred = await predictStockPrice('AAPL', 30);
console.log(pred);
```

## Troubleshooting

**Issue: "Insufficient historical data"**
- Solution: Ensure Finnhub API key is configured and has access
- Ensure stock symbol exists and is actively traded

**Issue: Very low confidence scores**
- Solution: More historical data needed (wait for more data to accumulate)
- May indicate volatile or unpredictable stock

**Issue: No predictions returned**
- Solution: Check MongoDB connection
- Verify Inngest scheduled tasks are running
- Check API endpoint logs

## Performance Optimization

1. **Caching**: Predictions cached in database, refreshed daily
2. **Indexes**: Database indexes on symbol + date for quick queries
3. **Batch Processing**: Inngest handles batch updates efficiently
4. **Lazy Loading**: Predictions generated on-demand for new watchlist items

## Security Notes

- Predictions are educational only
- Not financial advice
- User responsible for investment decisions
- API keys stored securely in environment variables
- No user data shared with third parties

---

**Last Updated**: February 17, 2026
**Model Version**: 1.0 (Ensemble)
