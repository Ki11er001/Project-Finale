import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { StockPriceModel } from '@/database/models/stockPrice.model';
import { getModelMetadata, predictWithModel } from '@/lib/ml/modelTrainer';

interface PredictionRequestBody {
  symbol?: string;
  daysInFuture?: number;
}

async function buildPredictionResponse(symbol: string, daysInFuture: number) {
  await connectToDatabase();

  const metadata = getModelMetadata(symbol);
  if (!metadata) {
    return NextResponse.json(
      {
        success: false,
        code: 'MODEL_NOT_TRAINED',
        error: `No trained LSTM model found for ${symbol}. Train the model first via /api/ml/train.`,
      },
      { status: 200 }
    );
  }

  const latestPrice = await StockPriceModel.findOne(
    { symbol },
    { close: 1, date: 1 },
    { sort: { date: -1 } }
  ).lean();

  if (!latestPrice) {
    return NextResponse.json(
      {
        success: false,
        code: 'NO_PRICE_DATA',
        error: `No historical price data found for ${symbol}. Import stock candles first.`,
      },
      { status: 200 }
    );
  }

  const predictedPrice = await predictWithModel(symbol, metadata.lookbackPeriod ?? 30);
  if (predictedPrice === null) {
    return NextResponse.json(
      {
        success: false,
        error: `Could not generate LSTM prediction for ${symbol}. Ensure the trained model files are present and valid.`,
      },
      { status: 500 }
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
