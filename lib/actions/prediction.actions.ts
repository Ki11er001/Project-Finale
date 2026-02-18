import { StockPriceModel } from '@/database/models/stockPrice.model';
import { StockPredictionModel, type StockPrediction } from '@/database/models/prediction.model';

const YAHOO_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

type YahooChartResponse = {
  chart?: {
    error?: { code?: string; description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

/**
 * Fetch historical candle data from Yahoo Finance and store in database
 */
export async function fetchAndStoreHistoricalData(
  symbol: string,
  resolution: 'D' | 'W' | 'M' = 'D',
  daysBack: number = 365
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - daysBack * 24 * 60 * 60;
  const interval = resolution === 'D' ? '1d' : resolution === 'W' ? '1wk' : '1mo';

  try {
    const response = await fetch(
      `${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol.toUpperCase())}?period1=${from}&period2=${now}&interval=${interval}&includePrePost=false&events=div%2Csplit`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch historical data: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp ?? [];

    if (data.chart?.error) {
      throw new Error(data.chart.error.description ?? 'Unknown Yahoo Finance API error');
    }

    if (!quote || timestamps.length === 0) {
      console.warn(`No historical data available for ${symbol}`);
      return;
    }

    const documents = timestamps
      .map((ts, idx) => {
        const open = quote.open?.[idx] ?? null;
        const high = quote.high?.[idx] ?? null;
        const low = quote.low?.[idx] ?? null;
        const close = quote.close?.[idx] ?? null;
        const volume = quote.volume?.[idx] ?? null;

        if (
          !Number.isFinite(open) ||
          !Number.isFinite(high) ||
          !Number.isFinite(low) ||
          !Number.isFinite(close) ||
          (close ?? 0) <= 0
        ) {
          return null;
        }

        return {
          symbol: symbol.toUpperCase(),
          date: new Date(ts * 1000),
          open: open as number,
          high: high as number,
          low: low as number,
          close: close as number,
          volume: Number.isFinite(volume) ? (volume as number) : 0,
          timestamp: ts,
        };
      })
      .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

    if (documents.length === 0) {
      console.warn(`No valid candle points available for ${symbol}`);
      return;
    }

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

  const sma = (data: number[], period: number) => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  };

  const ma20 = sma(prices, 20);
  const ma50 = sma(prices, 50);
  const ma200 = sma(prices, 200);

  return {
    ma20: ma20 ?? 0,
    ma50: ma50 ?? 0,
    ma200: ma200 ?? 0,
    rsi: calculateRSI(prices),
    macd: calculateMACD(prices),
  };
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  const deltas = prices.slice(1).map((price, idx) => price - prices[idx]);
  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Math.round(rsi);
}

function calculateMACD(prices: number[]): { signal: string; value: number } {
  if (prices.length < 26) {
    return { signal: 'NEUTRAL', value: 0 };
  }

  const ema = (data: number[], period: number) => {
    const multiplier = 2 / (period + 1);
    let currentEma = data[0];
    for (let i = 1; i < data.length; i++) {
      currentEma = data[i] * multiplier + currentEma * (1 - multiplier);
    }
    return currentEma;
  };

  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macdLine = ema12 - ema26;

  const signalLine = ema(prices.slice(-9), 9);
  const histogram = macdLine - signalLine;

  if (histogram > 0 && macdLine > signalLine) {
    return { signal: 'BUY', value: macdLine };
  }

  if (histogram < 0 && macdLine < signalLine) {
    return { signal: 'SELL', value: macdLine };
  }

  return { signal: 'NEUTRAL', value: macdLine };
}

/**
 * Predict stock price using an ensemble of trend, drift, and mean-reversion forecasts.
 */
export async function predictStockPrice(
  symbol: string,
  daysInFuture: number = 30
): Promise<StockPredictionData> {
  const historicalPrices = await getHistoricalPrices(symbol, 730);

  if (historicalPrices.length < 30) {
    throw new Error(`Insufficient historical data for ${symbol}. Need at least 30 data points.`);
  }

  const closingPrices = historicalPrices.map((p) => p.close).filter((price) => Number.isFinite(price));

  if (closingPrices.length < 30) {
    throw new Error(`Historical price data quality is too low for ${symbol}.`);
  }

  const currentPrice = closingPrices[closingPrices.length - 1];
  const indicators = calculateTechnicalIndicators(closingPrices);

  const trendForecast = holtLinearForecast(closingPrices, daysInFuture);
  const driftForecast = geometricDriftForecast(closingPrices, daysInFuture);
  const reversionForecast = meanReversionForecast(closingPrices, daysInFuture);

  const trendStrength = Math.min(1, Math.abs(trendForecast.trendSlope) * 100);
  const wTrend = 0.35 + 0.3 * trendStrength;
  const wDrift = 0.35;
  const wReversion = Math.max(0.15, 1 - (wTrend + wDrift));
  const weightTotal = wTrend + wDrift + wReversion;

  const forecastedPriceRaw =
    (trendForecast.price * wTrend + driftForecast * wDrift + reversionForecast * wReversion) /
    weightTotal;
  const forecastedPrice = Math.max(0, forecastedPriceRaw);
  const changePercent = ((forecastedPrice - currentPrice) / currentPrice) * 100;

  const volatility = calculateVolatility(closingPrices);
  const dispersion = calculateForecastDispersion([trendForecast.price, driftForecast, reversionForecast]);
  const confidenceScore = buildConfidenceScore({
    volatility,
    dispersion,
    historySize: closingPrices.length,
  });

  const rangeMultiplier = 1.96 * Math.sqrt(Math.max(1, daysInFuture / 30));
  const margin = Math.max(currentPrice * volatility * rangeMultiplier, currentPrice * 0.02);

  const prediction = {
    symbol: symbol.toUpperCase(),
    predictionDate: new Date(Date.now() + daysInFuture * 24 * 60 * 60 * 1000),
    generatedAt: new Date(),
    forecastedPrice: round2(forecastedPrice),
    confidenceScore: Math.round(confidenceScore),
    priceRange: {
      low: round2(Math.max(0, forecastedPrice - margin)),
      high: round2(forecastedPrice + margin),
    },
    changePercent: round2(changePercent),
    modelType: 'ENSEMBLE' as const,
    modelParameters: {
      method: 'HOLT_LINEAR + GEOMETRIC_DRIFT + MEAN_REVERSION',
      daysInFuture,
      trendSlope: round4(trendForecast.trendSlope),
      trendStrength: round4(trendStrength),
      volatility: round4(volatility),
      forecastComponents: {
        holtLinear: round2(trendForecast.price),
        geometricDrift: round2(driftForecast),
        meanReversion: round2(reversionForecast),
      },
      weights: {
        trend: round4(wTrend / weightTotal),
        drift: round4(wDrift / weightTotal),
        reversion: round4(wReversion / weightTotal),
      },
    },
    historicalDataPoints: closingPrices.length,
    rsiScore: indicators.rsi,
    macdSignal: indicators.macd.signal as 'BUY' | 'SELL' | 'NEUTRAL',
    movingAverages: {
      ma20: round2(indicators.ma20),
      ma50: round2(indicators.ma50),
      ma200: round2(indicators.ma200),
    },
  };

  await StockPredictionModel.updateOne(
    { symbol: symbol.toUpperCase(), predictionDate: prediction.predictionDate },
    { $set: prediction },
    { upsert: true }
  );

  return prediction as StockPredictionData;
}

function holtLinearForecast(prices: number[], daysInFuture: number): { price: number; trendSlope: number } {
  const alpha = 0.35;
  const beta = 0.15;

  let level = prices[0];
  let trend = prices[1] - prices[0];

  for (let i = 1; i < prices.length; i++) {
    const value = prices[i];
    const prevLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const forecast = level + daysInFuture * trend;
  const slope = level === 0 ? 0 : trend / level;

  return { price: Math.max(0, forecast), trendSlope: slope };
}

function geometricDriftForecast(prices: number[], daysInFuture: number): number {
  const returns = calculateLogReturns(prices);
  const meanReturn = returns.length === 0 ? 0 : returns.reduce((a, b) => a + b, 0) / returns.length;
  const lastPrice = prices[prices.length - 1];
  return Math.max(0, lastPrice * Math.exp(meanReturn * daysInFuture));
}

function meanReversionForecast(prices: number[], daysInFuture: number): number {
  const lookback = Math.min(90, prices.length);
  const mean = prices.slice(-lookback).reduce((a, b) => a + b, 0) / lookback;
  const last = prices[prices.length - 1];

  const reversionSpeed = 0.12;
  const weight = 1 - Math.exp(-reversionSpeed * daysInFuture);

  return Math.max(0, last + (mean - last) * weight);
}

function calculateLogReturns(prices: number[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      result.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return result;
}

function calculateVolatility(prices: number[]): number {
  const returns = calculateLogReturns(prices);
  if (returns.length < 2) return 0.15;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (returns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(252);
}

function calculateForecastDispersion(forecasts: number[]): number {
  if (forecasts.length <= 1) return 0;
  const mean = forecasts.reduce((a, b) => a + b, 0) / forecasts.length;
  if (mean === 0) return 0;
  const variance = forecasts.reduce((acc, value) => acc + (value - mean) ** 2, 0) / forecasts.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

function buildConfidenceScore(input: {
  volatility: number;
  dispersion: number;
  historySize: number;
}): number {
  const historyFactor = Math.min(1, input.historySize / 365);
  const stabilityFactor = Math.max(0, 1 - input.volatility);
  const agreementFactor = Math.max(0, 1 - input.dispersion * 2);

  const rawScore = 20 + 35 * historyFactor + 25 * stabilityFactor + 20 * agreementFactor;
  return Math.max(20, Math.min(95, rawScore));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
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
