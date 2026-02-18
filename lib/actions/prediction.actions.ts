'use server';

import { StockPriceModel } from '@/database/models/stockPrice.model';
import { StockPredictionModel, type StockPrediction } from '@/database/models/prediction.model';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

/**
 * Fetch historical candle data from Finnhub and store in database
 */
export async function fetchAndStoreHistoricalData(
  symbol: string,
  resolution: 'D' | 'W' | 'M' = 'D',
  daysBack: number = 365
): Promise<void> {
  if (!FINNHUB_API_KEY) {
    throw new Error('FINNHUB API key is not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const from = now - daysBack * 24 * 60 * 60;

  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.statusText}`);
    }

    const data = await response.json() as {
      c: number[];
      h: number[];
      l: number[];
      o: number[];
      v: number[];
      t: number[];
      s: string;
    };

    if (data.s === 'no_data') {
      console.warn(`No historical data available for ${symbol}`);
      return;
    }

    if (!data.c || data.c.length === 0) {
      return;
    }

    // Prepare documents for bulk insert
    const documents = data.c.map((close, idx) => ({
      symbol: symbol.toUpperCase(),
      date: new Date(data.t[idx] * 1000),
      open: data.o[idx],
      high: data.h[idx],
      low: data.l[idx],
      close,
      volume: data.v[idx] || 0,
      timestamp: data.t[idx],
    }));

    // Use updateOne with upsert to avoid duplicate errors
    await Promise.all(
      documents.map((doc) =>
        StockPriceModel.updateOne(
          { symbol: doc.symbol, date: doc.date },
          { $set: doc },
          { upsert: true }
        )
      )
    );

    console.log(`Stored ${documents.length} candles for ${symbol}`);
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get historical closing prices for a symbol
 */
export async function getHistoricalPrices(
  symbol: string,
  daysBack: number = 365
): Promise<Array<{ date: Date; close: number }>> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const prices = await StockPriceModel.find(
    {
      symbol: symbol.toUpperCase(),
      date: { $gte: cutoffDate },
    },
    { date: 1, close: 1 }
  )
    .sort({ date: 1 })
    .lean();

  return prices as Array<{ date: Date; close: number }>;
}

/**
 * Calculate technical indicators
 */
function calculateTechnicalIndicators(prices: number[]) {
  if (prices.length < 20) {
    console.warn('Very limited data for technical indicators; using neutral defaults where needed');
  }

  // Calculate Simple Moving Averages
  const sma = (data: number[], period: number) => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  const ma20 = sma(prices, 20);
  const ma50 = sma(prices, 50);
  const ma200 = sma(prices, 200);

  // Calculate RSI (Relative Strength Index)
  const rsi = calculateRSI(prices);

  // Calculate MACD (Moving Average Convergence Divergence)
  const macd = calculateMACD(prices);

  return {
    ma20: ma20 ?? 0,
    ma50: ma50 ?? 0,
    ma200: ma200 ?? 0,
    rsi,
    macd,
  };
}

/**
 * Calculate RSI indicator
 */
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Neutral when insufficient data

  const deltas = [];
  for (let i = 1; i < prices.length; i++) {
    deltas.push(prices[i] - prices[i - 1]);
  }

  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Math.round(rsi);
}

/**
 * Calculate MACD indicator
 */
function calculateMACD(prices: number[]): { signal: string; value: number } {
  if (prices.length < 26) {
    return { signal: 'NEUTRAL', value: 0 };
  }

  const ema = (data: number[], period: number) => {
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * multiplier + ema * (1 - multiplier);
    }
    return ema;
  };

  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macdLine = ema12 - ema26;

  // Signal line is 9-period EMA of MACD
  const recentPrices = prices.slice(-9);
  const signalLine = ema(recentPrices, 9);
  const histogram = macdLine - signalLine;

  let signal = 'NEUTRAL';
  if (histogram > 0 && macdLine > signalLine) {
    signal = 'BUY';
  } else if (histogram < 0 && macdLine < signalLine) {
    signal = 'SELL';
  }

  return { signal, value: macdLine };
}

/**
 * Predict stock price using statistical methods
 */
export async function predictStockPrice(
  symbol: string,
  daysInFuture: number = 30
): Promise<StockPredictionData> {
  // Fetch historical data
  const historicalPrices = await getHistoricalPrices(symbol, 365);

  if (historicalPrices.length < 20) {
    throw new Error(`Insufficient historical data for ${symbol}. Need at least 20 data points.`);
  }

  const closingPrices = historicalPrices.map((p) => p.close);
  const currentPrice = closingPrices[closingPrices.length - 1];

  // Calculate technical indicators
  const indicators = calculateTechnicalIndicators(closingPrices);

  // Perform linear regression prediction
  const { predictedPrice: linRegPrice, trend, rSquared } = linearRegressionPredict(
    closingPrices,
    daysInFuture
  );

  // Perform exponential moving average prediction
  const emaPrice = exponentialMovingAveragePredict(closingPrices, daysInFuture);

  // Ensemble: average the predictions
  const forecastedPrice = (linRegPrice + emaPrice) / 2;
  const changePercent = ((forecastedPrice - currentPrice) / currentPrice) * 100;

  // Calculate confidence score based on R-squared and data quality
  const confidenceScore = Math.min(
    95,
    Math.max(20, (rSquared * 100 + 30 + (indicators.rsi >= 30 && indicators.rsi <= 70 ? 20 : 10)))
  );

  // Calculate price range (95% confidence interval)
  const stdDev = calculateStandardDeviation(closingPrices);
  const margin = stdDev * 2; // ~95% confidence
  const priceRange = {
    low: Math.max(0, forecastedPrice - margin),
    high: forecastedPrice + margin,
  };

  const prediction = {
    symbol: symbol.toUpperCase(),
    predictionDate: new Date(Date.now() + daysInFuture * 24 * 60 * 60 * 1000),
    generatedAt: new Date(),
    forecastedPrice: Math.round(forecastedPrice * 100) / 100,
    confidenceScore: Math.round(confidenceScore),
    priceRange: {
      low: Math.round(priceRange.low * 100) / 100,
      high: Math.round(priceRange.high * 100) / 100,
    },
    changePercent: Math.round(changePercent * 100) / 100,
    modelType: 'ENSEMBLE' as const,
    modelParameters: {
      method: 'LINEAR_REGRESSION + EMA',
      daysInFuture,
      trend,
      rSquared: Math.round(rSquared * 10000) / 10000,
    },
    historicalDataPoints: closingPrices.length,
    rsiScore: indicators.rsi,
    macdSignal: indicators.macd.signal as 'BUY' | 'SELL' | 'NEUTRAL',
    movingAverages: {
      ma20: Math.round(indicators.ma20 * 100) / 100,
      ma50: Math.round(indicators.ma50 * 100) / 100,
      ma200: Math.round(indicators.ma200 * 100) / 100,
    },
  };

  // Save to database
  await StockPredictionModel.updateOne(
    { symbol: symbol.toUpperCase(), predictionDate: prediction.predictionDate },
    { $set: prediction },
    { upsert: true }
  );

  return prediction as StockPredictionData;
}

/**
 * Linear Regression prediction
 */
function linearRegressionPredict(
  prices: number[],
  daysInFuture: number
): { predictedPrice: number; trend: string; rSquared: number } {
  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = prices;

  // Calculate means
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += (x[i] - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Predict future price
  const futureX = n + daysInFuture - 1;
  const predictedPrice = intercept + slope * futureX;

  // Calculate R-squared
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * x[i];
    ssRes += (y[i] - predicted) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  const trend = slope > 0 ? 'UPTREND' : slope < 0 ? 'DOWNTREND' : 'NEUTRAL';

  return { predictedPrice: Math.max(0, predictedPrice), trend, rSquared };
}

/**
 * Exponential Moving Average prediction
 */
function exponentialMovingAveragePredict(prices: number[], daysInFuture: number): number {
  const period = Math.min(12, Math.floor(prices.length / 5));
  const multiplier = 2 / (period + 1);

  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
  }

  // Project EMA forward (assumes constant trend)
  const recentTrend = (ema - prices[prices.length - period]) / period;
  return ema + recentTrend * daysInFuture;
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const squaredDiffs = data.map((x) => (x - mean) ** 2);
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Get latest prediction for a symbol
 */
export async function getLatestPrediction(symbol: string): Promise<StockPrediction | null> {
  const prediction = await StockPredictionModel.findOne(
    { symbol: symbol.toUpperCase() },
    {},
    { sort: { generatedAt: -1 } }
  ).lean();

  return prediction as StockPrediction | null;
}

/**
 * Get predictions for multiple symbols
 */
export async function getPredictions(symbols: string[]): Promise<StockPrediction[]> {
  const predictions = await StockPredictionModel.find(
    { symbol: { $in: symbols.map((s) => s.toUpperCase()) } },
    {},
    { sort: { generatedAt: -1 } }
  ).lean();

  return predictions as StockPrediction[];
}
