import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface StockPrice extends Document {
  symbol: string;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

const StockPriceSchema = new Schema<StockPrice>(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true, index: true },
    date: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true, default: 0 },
    timestamp: { type: Number, required: true, index: true },
  },
  { timestamps: false }
);

// Create compound index for efficient queries
StockPriceSchema.index({ symbol: 1, date: -1 });
StockPriceSchema.index({ symbol: 1, timestamp: -1 });

// Prevent duplicate prices per day
StockPriceSchema.index({ symbol: 1, date: 1 }, { unique: true });

export const StockPriceModel: Model<StockPrice> =
  (models?.StockPrice as Model<StockPrice>) || model<StockPrice>('StockPrice', StockPriceSchema);
