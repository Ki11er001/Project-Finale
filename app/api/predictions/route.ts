import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { StockPriceModel } from '@/database/models/stockPrice.model';
import { getModelMetadata, predictWithModel } from '@/lib/ml/modelTrainer';
import { fetchAndStoreHistoricalData, predictStockPrice } from '@/lib/actions/prediction.actions';

interface PredictionRequestBody {
  symbol?: string;
  daysInFuture?: number;
}

async function buildPredictionResponse(symbol: string, daysInFuture: number) {
  await connectToDatabase();

  const fallbackPrediction = async (reason: string) => {
    try {
      const fallback = await predictStockPrice(symbol, daysInFuture);
      const latestClose = await StockPriceModel.findOne(
        { symbol },
        { close: 1, date: 1 },
        { sort: { date: -1 } }
      ).lean();

      const currentPrice = latestClose?.close ?? fallback.forecastedPrice;

      return NextResponse.json({
        success: true,
        source: 'fallback-statistical-model',
        notice: reason,
        data: {
          symbol,
          currentPrice: Math.round(currentPrice * 100) / 100,
          predictedPrice: fallback.forecastedPrice,
          changePercent: fallback.changePercent,
          r2Score: fallback.modelParameters?.rSquared ?? 0,
          rmse: 0,
          confidence:
            fallback.confidenceScore > 80
              ? 'High'
              : fallback.confidenceScore > 60
                ? 'Medium'
                : 'Low',
          daysAhead: daysInFuture,
          modelStatus: 'trained',
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (fallbackError) {
      console.error('[Prediction API] Fallback prediction failed:', fallbackError);
      const latestClose = await StockPriceModel.findOne(
        { symbol },
        { close: 1, date: 1 },
        { sort: { date: -1 } }
      ).lean();

      const currentPrice = latestClose?.close ?? 0;

      return NextResponse.json({
        success: true,
        source: 'fallback-unavailable',
        notice:
          'Prediction unavailable. LSTM model is missing and fallback model could not run. Ensure price history is imported and try again.',
        data: {
          symbol,
          currentPrice: Math.round(currentPrice * 100) / 100,
          predictedPrice: Math.round(currentPrice * 100) / 100,
          changePercent: 0,
          r2Score: 0,
          rmse: 0,
          confidence: 'Low',
          daysAhead: daysInFuture,
          modelStatus: 'pending',
          lastUpdated: new Date().toISOString(),
        },
      });
    }
  };

  const metadata = getModelMetadata(symbol);
  if (!metadata) {
    return await fallbackPrediction(
      `No trained LSTM model found for ${symbol}. Served fallback statistical prediction instead.`
    );
  }

  let latestPrice = await StockPriceModel.findOne(
    { symbol },
    { close: 1, date: 1 },
    { sort: { date: -1 } }
  ).lean();

  if (!latestPrice) {
    try {
      await fetchAndStoreHistoricalData(symbol, 'D', 365);
    } catch (importError) {
      console.warn(`[Prediction API] Could not auto-import candles for ${symbol}:`, importError);
    }

    const refreshedPrice = await StockPriceModel.findOne(
      { symbol },
      { close: 1, date: 1 },
      { sort: { date: -1 } }
    ).lean();

    if (!refreshedPrice) {
      return await fallbackPrediction(
        `No local historical candles found for ${symbol}. Attempted fallback prediction.`
      );
    }

    latestPrice = refreshedPrice;
  }

  const predictedPrice = await predictWithModel(symbol, metadata.lookbackPeriod ?? 30);
  if (predictedPrice === null) {
    return await fallbackPrediction(
      `Could not generate LSTM prediction for ${symbol}. Served fallback statistical prediction instead.`
    );
  }

  const currentPrice = latestPrice.close as number;
  const roundedPredictedPrice = Math.round(predictedPrice * 100) / 100;
  const changePercent = ((roundedPredictedPrice - currentPrice) / currentPrice) * 100;

  return NextResponse.json({
    success: true,
    data: {
      symbol,
      currentPrice: Math.round(currentPrice * 100) / 100,
      predictedPrice: roundedPredictedPrice,
      changePercent,
      r2Score: metadata.r2Score ?? 0,
      rmse: metadata.testRMSE ?? 0,
      confidence:
        (metadata.r2Score ?? 0) > 0.8
          ? 'High'
          : (metadata.r2Score ?? 0) > 0.6
            ? 'Medium'
            : 'Low',
      daysAhead: daysInFuture,
      modelStatus: 'trained',
      lastUpdated: new Date().toISOString(),
    },
  });
}

/**
 * POST /api/predictions
 * Generate a prediction for a stock
 * Body: { symbol: string, daysInFuture?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PredictionRequestBody;

    if (!body.symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: symbol' },
        { status: 400 }
      );
    }

    const symbol = body.symbol.toUpperCase();
    const daysInFuture = body.daysInFuture ?? 1;

    return await buildPredictionResponse(symbol, daysInFuture);
  } catch (error) {
    console.error('[Prediction API] Request error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request format or server error',
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/predictions?symbol=AAPL&daysInFuture=1
 * Get latest prediction for a symbol
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const daysInFuture = Number(searchParams.get('daysInFuture') ?? '1');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: symbol' },
        { status: 400 }
      );
    }

    return await buildPredictionResponse(symbol.toUpperCase(), Number.isFinite(daysInFuture) ? daysInFuture : 1);
  } catch (error) {
    console.error('[Prediction API] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch prediction',
      },
      { status: 500 }
    );
  }
}
