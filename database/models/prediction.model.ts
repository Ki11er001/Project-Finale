import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface StockPrediction extends Document {
  symbol: string;
  predictionDate: Date;
  generatedAt: Date;
  forecastedPrice: number;
  confidenceScore: number;
  priceRange: {
    low: number;
    high: number;
  };
  changePercent: number;
  modelType: 'ARIMA' | 'LINEAR_REGRESSION' | 'AI_SENTIMENT' | 'ENSEMBLE';
  modelParameters: {
    [key: string]: any;
  };
  historicalDataPoints: number;
  rsiScore?: number;
  macdSignal?: string;
  movingAverages: {
    ma20: number;
    ma50: number;
    ma200: number;
  };
}

const StockPredictionSchema = new Schema<StockPrediction>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    predictionDate: { type: Date, required: true },
    generatedAt: { type: Date, required: true, default: Date.now, index: true },
    forecastedPrice: { type: Number, required: true },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
    priceRange: {
      low: { type: Number, required: true },
      high: { type: Number, required: true },
    },
    changePercent: { type: Number, required: true },
    modelType: { 
      type: String, 
      enum: ['ARIMA', 'LINEAR_REGRESSION', 'AI_SENTIMENT', 'ENSEMBLE'], 
      required: true 
    },
    modelParameters: { type: Schema.Types.Mixed, required: true },
    historicalDataPoints: { type: Number, required: true },
    rsiScore: { type: Number, min: 0, max: 100 },
    macdSignal: { type: String, enum: ['BUY', 'SELL', 'NEUTRAL'] },
    movingAverages: {
      ma20: { type: Number, required: true },
      ma50: { type: Number, required: true },
      ma200: { type: Number, required: true },
    },
  },
  { timestamps: false }
);

// Create indexes for efficient queries
StockPredictionSchema.index({ symbol: 1, predictionDate: -1 });
StockPredictionSchema.index({ symbol: 1, generatedAt: -1 });
StockPredictionSchema.index({ generatedAt: -1 });

export const StockPredictionModel: Model<StockPrediction> =
  (models?.StockPrediction as Model<StockPrediction>) || model<StockPrediction>('StockPrediction', StockPredictionSchema);
