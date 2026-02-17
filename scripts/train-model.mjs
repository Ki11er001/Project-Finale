#!/usr/bin/env node

/**
 * ML Model Training Script
 * Train neural network models on historical stock data
 * 
 * Usage:
 *   node scripts/train-model.mjs AAPL
 *   node scripts/train-model.mjs AAPL --epochs 100 --lookback 60
 *   node scripts/train-model.mjs --symbols "AAPL,MSFT,GOOGL" --parallel
 */

// This is a demo version since TypeScript aliases don't work in .mjs
// For production, use: npm run train:model AAPL (which runs through Next.js/TypeScript)

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  const config = {
    symbols: [],
    epochs: 50,
    batchSize: 32,
    lookbackPeriod: 30,
    testSplit: 0.2,
    learningRate: 0.001,
    parallel: false,
    list: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--epochs') {
      config.epochs = parseInt(args[++i], 10);
    } else if (arg === '--batch') {
      config.batchSize = parseInt(args[++i], 10);
    } else if (arg === '--lookback') {
      config.lookbackPeriod = parseInt(args[++i], 10);
    } else if (arg === '--test-split') {
      config.testSplit = parseFloat(args[++i]);
    } else if (arg === '--learning-rate') {
      config.learningRate = parseFloat(args[++i]);
    } else if (arg === '--symbols') {
      config.symbols = args[++i].split(',').map((s) => s.trim().toUpperCase());
    } else if (arg === '--parallel') {
      config.parallel = true;
    } else if (arg === '--list') {
      config.list = true;
    } else if (!arg.startsWith('--')) {
      config.symbols.push(arg.toUpperCase());
    }
  }

  return config;
}

// Display banner
function showBanner() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     ML Model Trainer - Stock Price Prediction      ║');
  console.log('║         Using TensorFlow.js & LSTM Networks        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
}

// Display usage
function showUsage() {
  console.log('Usage:');
  console.log('  npm run train:model AAPL');
  console.log('  npm run train:model AAPL --epochs 100 --lookback 60');
  console.log('  npm run train:model -- --symbols "AAPL,MSFT" --parallel');
  console.log('\nOptions:');
  console.log('  --epochs <num>           Training epochs (default: 50)');
  console.log('  --batch <num>            Batch size (default: 32)');
  console.log('  --lookback <num>         Lookback period in days (default: 30)');
  console.log('  --test-split <decimal>   Test data percentage (default: 0.2)');
  console.log('  --learning-rate <num>    Learning rate (default: 0.001)');
  console.log('  --parallel               Train multiple symbols in parallel');
  console.log('  --list                   List all trained models\n');
  console.log('Note: To use the full CLI, you need to use the TypeScript version');
  console.log('which integrates with MongoDB and TensorFlow.js.\n');
  console.log('For now, use the API endpoints or train via the web UI:\n');
  console.log('  POST http://localhost:3000/api/ml/train');
  console.log('  Body: {"symbol":"AAPL","epochs":50}\n');
}

// Main function
function main() {
  showBanner();

  const config = parseArgs();

  if (config.list || config.symbols.length === 0) {
    showUsage();
    console.log('💡 Quick Start:\n');
    console.log('1. Start your development server:');
    console.log('   npm run dev\n');
    console.log('2. Train a model via API:');
    console.log('   curl -X POST http://localhost:3000/api/ml/train \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"symbol":"AAPL","epochs":50}\'\n');
    console.log('3. Or use the React component in your UI:\n');
    console.log('   import { TrainedModelCard } from "@/components/TrainedModelCard";');
    console.log('   <TrainedModelCard symbol="AAPL" />\n');
    return;
  }

  console.log('⚠️  This is a stub version. To train models:\n');
  console.log('Option 1: Use the API (Recommended)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. Start your server: npm run dev');
  console.log('2. Train via POST request:\n');
  console.log('   const response = await fetch("/api/ml/train", {');
  console.log('     method: "POST",');
  console.log('     body: JSON.stringify({');
  console.log('       symbol: "AAPL",');
  console.log('       epochs: ' + config.epochs + ',');
  console.log('       batchSize: ' + config.batchSize + ',');
  console.log('       lookbackPeriod: ' + config.lookbackPeriod);
  console.log('     })');
  console.log('   });\n');

  console.log('Option 2: Use the React Component');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('   import { TrainedModelCard } from "@/components/TrainedModelCard";');
  console.log('   export default function StockPage() {');
  console.log('     return <TrainedModelCard symbol="' + config.symbols[0] + '" />;');
  console.log('   }\n');

  console.log('Option 3: Use in Code');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('   import { trainModel } from "@/lib/ml/modelTrainer";');
  console.log('   const metrics = await trainModel({');
  console.log('     symbol: "' + config.symbols[0] + '",');
  console.log('     epochs: ' + config.epochs);
  console.log('   });\n');

  console.log('📚 Documentation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('See START_HERE_ML_MODELS.md for complete guide\n');
}

main();
