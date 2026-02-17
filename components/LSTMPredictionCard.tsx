'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, AlertCircle, Loader } from 'lucide-react';

interface LSTMPredictionCardProps {
  symbol: string;
}

interface PredictionData {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  change: number;
  changePercent: number;
  r2Score: number;
  rmse: number;
  confidence: 'High' | 'Medium' | 'Low';
  daysAhead: number;
  modelStatus: 'trained' | 'training' | 'pending';
  lastUpdated: string;
}

export function LSTMPredictionCard({ symbol }: LSTMPredictionCardProps) {
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/predictions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, daysInFuture: 1 }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success || !data?.data) {
          const errorMessage =
            data?.error ||
            data?.notice ||
            'Prediction service returned no data. Verify API credentials and historical candles.';
          throw new Error(errorMessage);
        }

        // Transform API response to our format
        const pred = data.data;
        setPrediction({
          symbol,
          currentPrice: pred.currentPrice || 0,
          predictedPrice: pred.predictedPrice || 0,
          change: (pred.predictedPrice || 0) - (pred.currentPrice || 0),
          changePercent: pred.changePercent || 0,
          r2Score: pred.r2Score || 0,
          rmse: pred.rmse || 0,
          confidence: pred.r2Score > 0.8 ? 'High' : pred.r2Score > 0.6 ? 'Medium' : 'Low',
          daysAhead: pred.daysAhead || 1,
          modelStatus: pred.modelStatus || 'trained',
          lastUpdated: pred.lastUpdated || new Date().toLocaleString(),
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`Prediction warning for ${symbol}:`, errorMsg);
        setError(errorMsg);
        setPrediction(null);
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchPrediction();
    }
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center gap-2">
          <Loader className="w-4 h-4 animate-spin" />
          <p className="text-gray-600">Loading LSTM prediction...</p>
        </div>
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-red-900">Prediction Unavailable</h3>
            <p className="text-sm text-red-700 mt-1">
              {error || 'Model is training. Try again soon.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isPositive = prediction.changePercent >= 0;
  const confidenceColor =
    prediction.confidence === 'High'
      ? 'text-green-600'
      : prediction.confidence === 'Medium'
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">LSTM Price Prediction</h3>
          <p className="text-xs text-gray-500 mt-1">{symbol} • Next 1 day</p>
        </div>
        <TrendingUp className="w-5 h-5 text-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Current Price */}
        <div className="bg-gray-50 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Current Price</p>
          <p className="text-lg font-bold text-gray-900">
            ${prediction.currentPrice.toFixed(2)}
          </p>
        </div>

        {/* Predicted Price */}
        <div className="bg-blue-50 rounded p-3">
          <p className="text-xs text-gray-600 mb-1">Predicted Price</p>
          <p className="text-lg font-bold text-blue-600">
            ${prediction.predictedPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Change */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Expected Change</span>
          <span
            className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}
          >
            {isPositive ? '+' : ''}
            ${prediction.change.toFixed(2)} ({prediction.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Model Metrics */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded p-3 mb-4">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-xs text-gray-600 mb-1">R² Score</p>
            <p className="font-bold text-gray-900">{(prediction.r2Score * 100).toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Accuracy</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">RMSE</p>
            <p className="font-bold text-gray-900">${prediction.rmse.toFixed(3)}</p>
            <p className="text-xs text-gray-500">Error</p>
          </div>
          <div>
            <p className={`text-xs font-semibold mb-1 ${confidenceColor}`}>
              {prediction.confidence}
            </p>
            <p className="text-xs text-gray-600">Confidence</p>
            <p className={`text-xs ${confidenceColor}`}>{prediction.modelStatus}</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-right">
        Updated: {prediction.lastUpdated}
      </p>
    </div>
  );
}
