import { NextRequest, NextResponse } from 'next/server';
import { trainModel, getModelMetadata, listTrainedModels, type TrainingConfig } from '@/lib/ml/modelTrainer';

/**
 * POST /api/ml/train
 * Train a neural network model for stock price prediction
 * 
 * Body: {
 *   "symbol": "AAPL",
 *   "epochs": 50,
 *   "batchSize": 32,
 *   "lookbackPeriod": 30,
 *   "testSplit": 0.2,
 *   "learningRate": 0.001
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<TrainingConfig>;

    if (!body.symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 });
    }

    const config: TrainingConfig = {
      symbol: body.symbol.toUpperCase(),
      epochs: body.epochs ?? 50,
      batchSize: body.batchSize ?? 32,
      lookbackPeriod: body.lookbackPeriod ?? 30,
      testSplit: body.testSplit ?? 0.2,
      learningRate: body.learningRate ?? 0.001,
    };

    console.log(`Starting model training for ${config.symbol}...`);

    const metrics = await trainModel(config);

    return NextResponse.json({
      success: true,
      data: metrics,
      message: `Model trained successfully for ${config.symbol}`,
    });
  } catch (error) {
    console.error('Training error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Training failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ml/train?symbol=AAPL
 * Get training metrics/metadata for a trained model
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const list = searchParams.get('list');

    if (list === 'true') {
      const models = listTrainedModels();
      return NextResponse.json({
        success: true,
        data: models,
        message: `Found ${models.length} trained models`,
      });
    }

    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
    }

    const metadata = getModelMetadata(symbol.toUpperCase());

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Model not found. Train it first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metadata',
      },
      { status: 500 }
    );
  }
}
