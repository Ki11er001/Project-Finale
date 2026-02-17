import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/predictions/predict
 * Generate a prediction for a stock
 * Body: { symbol: string, daysInFuture?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { symbol?: string; daysInFuture?: number };
    
    if (!body.symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: symbol' },
        { status: 400 }
      );
    }

    const symbol = body.symbol.toUpperCase();

    console.log(`[Prediction API] Generating mock prediction for ${symbol}...`);

    // Generate mock prediction for now
    // TODO: Replace with actual predictStockPrice function once DB issues are resolved
    const mockPrediction = {
      symbol,
      currentPrice: 150.25,
      predictedPrice: 152.45,
      changePercent: 1.46,
      r2Score: 0.87,
      rmse: 0.042,
      mae: 0.031,
      confidence: 'High',
      forecast: 'Based on historical trend analysis',
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: mockPrediction,
    });
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
 * GET /api/predictions?symbol=AAPL
 * Get latest prediction for a symbol
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: symbol' },
        { status: 400 }
      );
    }

    // Generate mock prediction
    const mockPrediction = {
      symbol: symbol.toUpperCase(),
      currentPrice: 150.25,
      predictedPrice: 152.45,
      changePercent: 1.46,
      r2Score: 0.87,
      rmse: 0.042,
      mae: 0.031,
      confidence: 'High',
      forecast: 'Based on historical trend analysis',
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: [mockPrediction],
    });
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
