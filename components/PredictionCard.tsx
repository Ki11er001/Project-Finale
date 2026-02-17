'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PredictionCardProps {
  symbol: string;
  showFetchButton?: boolean;
}

export function PredictionCard({ symbol, showFetchButton = true }: PredictionCardProps) {
  const [prediction, setPrediction] = useState<StockPredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch prediction on mount
    fetchPrediction();
  }, [symbol]);

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/predictions?symbol=${symbol.toUpperCase()}`);
      const data = (await response.json()) as PredictionResponse;

      if (!data.success) {
        setError(data.error || 'Failed to fetch prediction');
        return;
      }

      const pred = Array.isArray(data.data) ? data.data[0] : data.data;
      if (pred) {
        setPrediction(pred);
      } else {
        setError('No prediction available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction');
    } finally {
      setLoading(false);
    }
  };

  const generatePrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), daysInFuture: 30 }),
      });

      const data = (await response.json()) as PredictionResponse;

      if (!data.success) {
        setError(data.error || 'Failed to generate prediction');
        return;
      }

      const pred = Array.isArray(data.data) ? data.data[0] : data.data;
      if (pred) {
        setPrediction(pred);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prediction');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !prediction) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error && !prediction) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 text-sm">{error}</p>
        {showFetchButton && (
          <button
            onClick={generatePrediction}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Generate Prediction
          </button>
        )}
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600 text-sm mb-2">No prediction available</p>
        {showFetchButton && (
          <button
            onClick={generatePrediction}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Generate Prediction
          </button>
        )}
      </div>
    );
  }

  const isPositive = prediction.changePercent >= 0;
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-green-50' : 'bg-red-50';
  const borderColor = isPositive ? 'border-green-200' : 'border-red-200';

  return (
    <div className={`p-6 border rounded-lg ${bgColor} ${borderColor}`}>
      <div className="grid grid-cols-2 gap-4">
        {/* Forecast Price */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Predicted Price (30 days)</p>
          <p className="text-2xl font-bold text-gray-900">
            ${prediction.forecastedPrice.toFixed(2)}
          </p>
        </div>

        {/* Change Percent */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Expected Change</p>
          <p className={`text-2xl font-bold ${changeColor}`}>
            {isPositive ? '+' : ''}{prediction.changePercent.toFixed(2)}%
          </p>
        </div>

        {/* Confidence Score */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Confidence Score</p>
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{prediction.confidenceScore}%</span>
            </div>
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${prediction.confidenceScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Predicted Range (95% CI)</p>
          <p className="text-sm font-semibold text-gray-900">
            ${prediction.priceRange.low.toFixed(2)} - ${prediction.priceRange.high.toFixed(2)}
          </p>
        </div>

        {/* Moving Averages */}
        <div className="col-span-2">
          <p className="text-sm text-gray-600 mb-2">Moving Averages</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">20-day MA</span>
              <span className="font-semibold text-gray-900">${prediction.movingAverages.ma20.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">50-day MA</span>
              <span className="font-semibold text-gray-900">${prediction.movingAverages.ma50.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">200-day MA</span>
              <span className="font-semibold text-gray-900">${prediction.movingAverages.ma200.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Technical Indicators */}
        <div className="col-span-2">
          <p className="text-sm text-gray-600 mb-2">Technical Indicators</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">RSI (14)</span>
              <span className="font-semibold text-gray-900">{prediction.rsiScore ?? 'N/A'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">MACD Signal</span>
              <span className="font-semibold">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    prediction.macdSignal === 'BUY'
                      ? 'bg-green-200 text-green-800'
                      : prediction.macdSignal === 'SELL'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {prediction.macdSignal ?? 'NEUTRAL'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Model Info */}
        <div className="col-span-2 pt-4 border-t border-gray-300">
          <p className="text-xs text-gray-600 mb-1">
            Model: {prediction.modelType} | Data Points: {prediction.historicalDataPoints} | Updated:{' '}
            {new Date(prediction.generatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {showFetchButton && (
        <button
          onClick={generatePrediction}
          disabled={loading}
          className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Refresh Prediction'}
        </button>
      )}
    </div>
  );
}
