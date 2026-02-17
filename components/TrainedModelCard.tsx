'use client';

import { useState } from 'react';
import { Loader2, Activity, TrendingUp } from 'lucide-react';

interface TrainedModelCardProps {
  symbol: string;
  onTrainingComplete?: () => void;
}

export function TrainedModelCard({ symbol, onTrainingComplete }: TrainedModelCardProps) {
  const [metadata, setMetadata] = useState<any>(null);
  const [training, setTraining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load existing model metadata on mount
  async function loadMetadata() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ml/train?symbol=${symbol.toUpperCase()}`);
      const data = await response.json();

      if (data.success && data.data) {
        setMetadata(data.data);
      } else {
        setMetadata(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metadata');
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }

  // Train the model
  async function handleTrain() {
    setTraining(true);
    setError(null);

    try {
      const response = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          epochs: 50,
          batchSize: 32,
          lookbackPeriod: 30,
          testSplit: 0.2,
          learningRate: 0.001,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMetadata(data.data);
        onTrainingComplete?.();
      } else {
        setError(data.error || 'Training failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training error');
    } finally {
      setTraining(false);
    }
  }

  // Reload metadata
  async function handleReload() {
    await loadMetadata();
  }

  // Quality indicator
  function getQualityIndicator(r2Score: number) {
    if (r2Score >= 0.8) return { text: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (r2Score >= 0.6) return { text: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (r2Score >= 0.4) return { text: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { text: 'Poor', color: 'text-red-600', bg: 'bg-red-50' };
  }

  // Initial load
  if (loading && !metadata) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm text-gray-600">Loading model metadata...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !metadata) {
    return (
      <div className="p-6 border rounded-lg bg-red-50 border-red-200">
        <p className="text-sm text-red-700 mb-4">{error}</p>
        <button
          onClick={handleTrain}
          disabled={training}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {training ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Training...
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              Train Model for {symbol}
            </>
          )}
        </button>
      </div>
    );
  }

  // No metadata - offer to train
  if (!metadata) {
    return (
      <div className="p-6 border rounded-lg bg-blue-50 border-blue-200">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Trained Model for {symbol}
          </h3>
          <p className="text-sm text-gray-600">
            Train an LSTM neural network using historical price data. Takes 1-2 minutes depending on data size.
          </p>
        </div>

        <button
          onClick={handleTrain}
          disabled={training}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {training ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Training in progress...
            </>
          ) : (
            <>
              <Activity className="w-4 h-4" />
              Train LSTM Model
            </>
          )}
        </button>
      </div>
    );
  }

  // Show model metadata
  const quality = getQualityIndicator(metadata.r2Score);
  const trainedDate = new Date(metadata.trainedAt).toLocaleDateString();
  const trainedTime = new Date(metadata.trainedAt).toLocaleTimeString();

  return (
    <div className="p-6 border rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Trained LSTM Model - {symbol}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Trained: {trainedDate} at {trainedTime}
          </p>
        </div>

        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${quality.color} ${quality.bg}`}>
          {quality.text}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* R² Score */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
          <p className="text-xs text-blue-700 font-medium mb-1">R² Score</p>
          <p className="text-2xl font-bold text-blue-900">{metadata.r2Score.toFixed(4)}</p>
          <p className="text-xs text-blue-600 mt-1">Model fit quality</p>
        </div>

        {/* RMSE */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
          <p className="text-xs text-green-700 font-medium mb-1">Test RMSE</p>
          <p className="text-2xl font-bold text-green-900">{metadata.testRMSE.toFixed(4)}</p>
          <p className="text-xs text-green-600 mt-1">
            {metadata.testRMSE < 0.05 ? 'Excellent' : 'Low error'}
          </p>
        </div>

        {/* MAE */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
          <p className="text-xs text-purple-700 font-medium mb-1">Test MAE</p>
          <p className="text-2xl font-bold text-purple-900">{metadata.testMAE.toFixed(4)}</p>
          <p className="text-xs text-purple-600 mt-1">Average deviation</p>
        </div>

        {/* MSE */}
        <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
          <p className="text-xs text-orange-700 font-medium mb-1">Test MSE</p>
          <p className="text-2xl font-bold text-orange-900">{metadata.testMSE.toFixed(6)}</p>
          <p className="text-xs text-orange-600 mt-1">Error variance</p>
        </div>
      </div>

      {/* Training Details */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-xs text-gray-600 mb-1">Data Points</p>
          <p className="font-semibold text-gray-900">{metadata.dataPoints}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Lookback Period</p>
          <p className="font-semibold text-gray-900">{metadata.lookbackPeriod} days</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Training Size</p>
          <p className="font-semibold text-gray-900">{metadata.trainSize}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Test Size</p>
          <p className="font-semibold text-gray-900">{metadata.testSize}</p>
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-4 bg-blue-50 rounded-lg mb-6">
        <p className="text-sm font-semibold text-blue-900 mb-2">📊 Metrics Guide:</p>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>R²:</strong> How well model explains variance (0-1, higher is better)</li>
          <li>• <strong>RMSE:</strong> Root mean squared error (lower is better)</li>
          <li>• <strong>MAE:</strong> Mean absolute error in normalized units</li>
          <li>• <strong>MSE:</strong> Mean squared error (penalizes larger errors)</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleReload}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
        >
          Reload
        </button>
        <button
          onClick={handleTrain}
          disabled={training}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {training ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Retraining...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              Retrain Model
            </>
          )}
        </button>
      </div>
    </div>
  );
}
