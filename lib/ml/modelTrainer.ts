import * as tf from '@tensorflow/tfjs';
import { StockPriceModel } from '@/database/models/stockPrice.model';
import { StockPredictionModel } from '@/database/models/prediction.model';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ML Model Trainer - Create and train custom neural networks
 * Uses TensorFlow.js with historical price data from MongoDB
 */

export interface TrainingConfig {
  symbol: string;
  epochs: number;
  batchSize: number;
  lookbackPeriod: number; // How many days to look back for features
  testSplit: number; // 0.2 = 80% train, 20% test
  learningRate: number;
}

export interface ModelMetrics {
  symbol: string;
  trainMSE: number;
  testMSE: number;
  testRMSE: number;
  testMAE: number;
  r2Score: number;
  trainedAt: Date;
  trainingTime: number; // milliseconds
}

/**
 * Prepare training data from historical prices
 * Creates sequences of prices as input and next price as target
 */
async function prepareTrainingData(
  symbol: string,
  lookbackPeriod: number = 30
): Promise<{ X: number[][]; y: number[] }> {
  const prices = await StockPriceModel.find(
    { symbol: symbol.toUpperCase() },
    { close: 1 }
  )
    .sort({ date: 1 })
    .lean();

  if (prices.length < lookbackPeriod + 1) {
    throw new Error(
      `Insufficient data for ${symbol}. Need at least ${lookbackPeriod + 1} data points, got ${prices.length}`
    );
  }

  const closePrices = prices.map((p) => (p.close as unknown as number));

  // Normalize prices (0-1 scale)
  const min = Math.min(...closePrices);
  const max = Math.max(...closePrices);
  const normalized = closePrices.map((p) => (p - min) / (max - min));

  // Create sequences: [p1, p2, ..., p30] -> p31
  const X: number[][] = [];
  const y: number[] = [];

  for (let i = 0; i < normalized.length - lookbackPeriod; i++) {
    X.push(normalized.slice(i, i + lookbackPeriod));
    y.push(normalized[i + lookbackPeriod]);
  }

  return { X, y };
}

/**
 * Build a neural network model
 * LSTM is good for time-series data
 */
function buildModel(lookbackPeriod: number): tf.LayersModel {
  const model = tf.sequential({
    layers: [
      // Input layer
      tf.layers.lstm({
        units: 64,
        returnSequences: true,
        inputShape: [lookbackPeriod, 1],
        activation: 'relu',
      }),
      tf.layers.dropout({ rate: 0.2 }),

      // Hidden layer
      tf.layers.lstm({
        units: 32,
        returnSequences: false,
        activation: 'relu',
      }),
      tf.layers.dropout({ rate: 0.2 }),

      // Dense layers
      tf.layers.dense({ units: 16, activation: 'relu' }),
      tf.layers.dense({ units: 8, activation: 'relu' }),

      // Output layer
      tf.layers.dense({ units: 1, activation: 'sigmoid' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
}

/**
 * Alternative: Simple model (faster, for comparison)
 */
function buildSimpleModel(lookbackPeriod: number): tf.LayersModel {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        inputShape: [lookbackPeriod],
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 16, activation: 'relu' }),
      tf.layers.dense({ units: 8, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['mae'],
  });

  return model;
}

/**
 * Train a model on stock data
 */
export async function trainModel(config: TrainingConfig): Promise<ModelMetrics> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting training for ${config.symbol}...`);

    // 1. Prepare data
    console.log(`📊 Preparing training data (lookback: ${config.lookbackPeriod} days)...`);
    const { X, y } = await prepareTrainingData(config.symbol, config.lookbackPeriod);

    if (X.length < 10) {
      throw new Error(`Not enough sequences. Got ${X.length}, need at least 10`);
    }

    // 2. Split data into training and testing
    const trainSize = Math.floor(X.length * (1 - config.testSplit));
    const trainX = X.slice(0, trainSize);
    const trainY = y.slice(0, trainSize);
    const testX = X.slice(trainSize);
    const testY = y.slice(trainSize);

    console.log(`📈 Data split: ${trainX.length} train, ${testX.length} test`);

    // 3. Convert to tensors
    const trainXTensor = tf.tensor2d(trainX);
    const trainYTensor = tf.tensor2d(trainY, [trainY.length, 1]);
    const testXTensor = tf.tensor2d(testX);
    const testYTensor = tf.tensor2d(testY, [testY.length, 1]);

    // 4. Build model (LSTM for sequence data)
    console.log(`🧠 Building LSTM neural network...`);
    // Reshape for LSTM [samples, timeSteps, features]
    const trainXReshaped = trainXTensor.reshape([trainXTensor.shape[0], config.lookbackPeriod, 1]);
    const testXReshaped = testXTensor.reshape([testXTensor.shape[0], config.lookbackPeriod, 1]);

    const model = buildModel(config.lookbackPeriod);

    // 5. Train model
    console.log(`⚙️ Training model (${config.epochs} epochs)...`);
    const history = await model.fit(trainXReshaped, trainYTensor, {
      epochs: config.epochs,
      batchSize: config.batchSize,
      validationData: [testXReshaped, testYTensor],
      verbose: 0,
    });

    // 6. Evaluate on test set
    console.log(`📊 Evaluating model...`);
    const evaluation = model.evaluate(testXReshaped, testYTensor) as tf.Tensor[];
    const testMSE = (await evaluation[0].data())[0];
    const testMAE = (await evaluation[1].data())[0];

    // Calculate R² score
    const predictions = model.predict(testXReshaped) as tf.Tensor;
    const predValues = await predictions.data();
    const testYValues = testY;

    const yMean = testYValues.reduce((a, b) => a + b) / testYValues.length;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < testYValues.length; i++) {
      ssRes += Math.pow(testYValues[i] - predValues[i], 2);
      ssTot += Math.pow(testYValues[i] - yMean, 2);
    }
    const r2Score = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    // 7. Calculate RMSE
    const testRMSE = Math.sqrt(testMSE);

    // 8. Save model
    const modelPath = `file://./ml-models/${config.symbol.toUpperCase()}-model`;
    console.log(`💾 Saving model to ${modelPath}...`);

    // Ensure directory exists
    const modelDir = path.join(process.cwd(), 'ml-models');
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }

    await model.save(modelPath);

    // 9. Save metadata
    const metadata = {
      symbol: config.symbol.toUpperCase(),
      trainMSE: (await model.evaluate(trainXReshaped, trainYTensor)[0].data())[0],
      testMSE,
      testRMSE,
      testMAE,
      r2Score,
      lookbackPeriod: config.lookbackPeriod,
      epochs: config.epochs,
      batchSize: config.batchSize,
      dataPoints: X.length,
      trainSize,
      testSize: testX.length,
      trainedAt: new Date(),
    };

    const metadataPath = path.join(process.cwd(), `ml-models/${config.symbol.toUpperCase()}-metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // 10. Cleanup
    trainXTensor.dispose();
    trainYTensor.dispose();
    testXTensor.dispose();
    testYTensor.dispose();
    trainXReshaped.dispose();
    testXReshaped.dispose();
    predictions.dispose();
    evaluation.forEach((t) => t.dispose());
    model.dispose();

    const trainingTime = Date.now() - startTime;

    const metrics: ModelMetrics = {
      symbol: config.symbol.toUpperCase(),
      trainMSE: metadata.trainMSE,
      testMSE,
      testRMSE,
      testMAE,
      r2Score,
      trainedAt: new Date(),
      trainingTime,
    };

    console.log(`✅ Training complete!`);
    console.log(`   Test RMSE: ${testRMSE.toFixed(4)}`);
    console.log(`   Test MAE: ${testMAE.toFixed(4)}`);
    console.log(`   R² Score: ${r2Score.toFixed(4)}`);
    console.log(`   Time: ${trainingTime}ms`);

    return metrics;
  } catch (error) {
    console.error(`❌ Training failed for ${config.symbol}:`, error);
    throw error;
  }
}

/**
 * Load a trained model from disk
 */
export async function loadTrainedModel(symbol: string): Promise<tf.LayersModel | null> {
  try {
    // Models are saved to a directory (e.g. ./ml-models/AAPL-model/model.json)
    const modelPath = `file://./ml-models/${symbol.toUpperCase()}-model/model.json`;
    const model = await tf.loadLayersModel(modelPath);
    return model;
  } catch (error) {
    console.warn(`Could not load model for ${symbol}:`, error);
    return null;
  }
}

/**
 * Make a prediction using trained model
 */
export async function predictWithModel(
  symbol: string,
  lookbackPeriod: number = 30
): Promise<number | null> {
  try {
    const model = await loadTrainedModel(symbol);
    if (!model) return null;

    // Get last lookbackPeriod prices
    const prices = await StockPriceModel.find(
      { symbol: symbol.toUpperCase() },
      { close: 1 }
    )
      .sort({ date: -1 })
      .limit(lookbackPeriod)
      .lean();

    if (prices.length < lookbackPeriod) {
      console.warn(`Insufficient data for prediction. Have ${prices.length}, need ${lookbackPeriod}`);
      return null;
    }

    const closePrices = prices.reverse().map((p) => (p.close as unknown as number));

    // Normalize
    const allPrices = await StockPriceModel.find(
      { symbol: symbol.toUpperCase() },
      { close: 1 }
    ).lean();
    const allClose = allPrices.map((p) => (p.close as unknown as number));
    const min = Math.min(...allClose);
    const max = Math.max(...allClose);
    const normalized = closePrices.map((p) => (p - min) / (max - min));

    // Predict
    const input = tf.tensor2d([normalized]).reshape([1, lookbackPeriod, 1]);
    const prediction = model.predict(input) as tf.Tensor;
    const predValue = (await prediction.data())[0];

    // Denormalize
    const actualPrice = predValue * (max - min) + min;

    input.dispose();
    prediction.dispose();
    model.dispose();

    return actualPrice;
  } catch (error) {
    console.error(`Error making prediction for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get training metadata
 */
export function getModelMetadata(symbol: string): any {
  try {
    const metadataPath = path.join(process.cwd(), `ml-models/${symbol.toUpperCase()}-metadata.json`);
    const data = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * List all trained models
 */
export function listTrainedModels(): string[] {
  try {
    const modelDir = path.join(process.cwd(), 'ml-models');
    const files = fs.readdirSync(modelDir);
    const symbols = new Set<string>();

    files.forEach((file) => {
      const match = file.match(/^([A-Z]+)-model/);
      if (match) {
        symbols.add(match[1]);
      }
    });

    return Array.from(symbols);
  } catch {
    return [];
  }
}
