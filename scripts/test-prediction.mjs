#!/usr/bin/env node

/**
 * ML/AI Stock Prediction System - Example Usage
 * This script demonstrates how to use the prediction system
 * 
 * Usage: 
 * - Node.js: node scripts/test-prediction.mjs
 * - Or import functions in your code
 */

// Example 1: Using the prediction system via API
async function exampleAPIUsage() {
  console.log('=== Example 1: Using Prediction API ===\n');

  try {
    // Generate a prediction for Apple stock
    const response = await fetch('http://localhost:3000/api/predictions/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: 'AAPL',
        daysInFuture: 30,
      }),
    });

    const data = await response.json();

    if (data.success) {
      const pred = data.data;
      console.log(`Stock: ${pred.symbol}`);
      console.log(`Predicted Price (30 days): $${pred.forecastedPrice.toFixed(2)}`);
      console.log(`Expected Change: ${pred.changePercent > 0 ? '+' : ''}${pred.changePercent.toFixed(2)}%`);
      console.log(`Confidence: ${pred.confidenceScore}%`);
      console.log(`Price Range: $${pred.priceRange.low.toFixed(2)} - $${pred.priceRange.high.toFixed(2)}`);
      console.log(`MACD Signal: ${pred.macdSignal}`);
      console.log(`RSI: ${pred.rsiScore}`);
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('API call failed:', error);
  }

  console.log('\n');
}

// Example 2: Getting predictions for multiple stocks
async function exampleMultipleStocks() {
  console.log('=== Example 2: Multiple Stock Predictions ===\n');

  try {
    const symbols = 'AAPL,MSFT,GOOGL';
    const response = await fetch(`http://localhost:3000/api/predictions?symbols=${symbols}`);
    const data = await response.json();

    if (data.success && data.data) {
      const predictions = Array.isArray(data.data) ? data.data : [data.data];
      
      console.log(`Found ${predictions.length} predictions:\n`);
      
      predictions.forEach((pred) => {
        console.log(`${pred.symbol}:`);
        console.log(`  Forecast: $${pred.forecastedPrice.toFixed(2)}`);
        console.log(`  Change: ${pred.changePercent > 0 ? '+' : ''}${pred.changePercent.toFixed(2)}%`);
        console.log(`  Confidence: ${pred.confidenceScore}%`);
        console.log();
      });
    }
  } catch (error) {
    console.error('Failed to fetch predictions:', error);
  }

  console.log('\n');
}

// Example 3: Understanding Technical Indicators
function exampleTechnicalIndicators() {
  console.log('=== Example 3: Understanding Technical Indicators ===\n');

  console.log('RSI (Relative Strength Index):');
  console.log('  - Range: 0-100');
  console.log('  - Below 30: Oversold (potential BUY)');
  console.log('  - 30-70: Neutral');
  console.log('  - Above 70: Overbought (potential SELL)');
  console.log();

  console.log('MACD (Moving Average Convergence Divergence):');
  console.log('  - BUY Signal: When MACD crosses above signal line');
  console.log('  - SELL Signal: When MACD crosses below signal line');
  console.log('  - NEUTRAL: No clear signal');
  console.log();

  console.log('Moving Averages:');
  console.log('  - 20-day: Short-term trend (recent momentum)');
  console.log('  - 50-day: Medium-term trend (6-10 weeks)');
  console.log('  - 200-day: Long-term trend (strength of primary trend)');
  console.log();

  console.log('Interpretation:');
  console.log('  - Price above MA200: Strong uptrend');
  console.log('  - Price below MA200: Strong downtrend');
  console.log('  - Price between MA20 and MA50: Consolidation/reversal');
  console.log();
}

// Example 4: Interpreting Confidence Scores
function exampleConfidenceScores() {
  console.log('=== Example 4: Confidence Score Interpretation ===\n');

  const scenarios = [
    { score: 80, interpretation: 'High confidence - Model fits well, healthy RSI, sufficient data' },
    {
      score: 60,
      interpretation: 'Moderate confidence - Decent data, some uncertainty, watch indicators',
    },
    {
      score: 35,
      interpretation: 'Low confidence - Limited data, high volatility, or poor model fit',
    },
  ];

  scenarios.forEach((s) => {
    console.log(`Score ${s.score}%: ${s.interpretation}`);
  });

  console.log();
}

// Example 5: Using predictions in your watchlist
async function exampleWatchlistIntegration() {
  console.log('=== Example 5: Watchlist Integration ===\n');

  const watchlistStocks = [
    { symbol: 'AAPL', company: 'Apple Inc.' },
    { symbol: 'MSFT', company: 'Microsoft Corporation' },
    { symbol: 'TSLA', company: 'Tesla Inc.' },
  ];

  console.log('Watchlist with Predictions:');
  console.log('Stock     Current  Forecast  Change   Confidence  Signal');
  console.log('-'.repeat(65));

  // Simulate getting predictions (in real code, fetch from API)
  const predictions = [
    {
      symbol: 'AAPL',
      currentPrice: 176.54,
      forecastedPrice: 185.20,
      changePercent: 4.87,
      confidenceScore: 72,
      macdSignal: 'BUY',
    },
    {
      symbol: 'MSFT',
      currentPrice: 418.71,
      forecastedPrice: 425.30,
      changePercent: 1.58,
      confidenceScore: 68,
      macdSignal: 'NEUTRAL',
    },
    {
      symbol: 'TSLA',
      currentPrice: 245.89,
      forecastedPrice: 235.40,
      changePercent: -4.27,
      confidenceScore: 55,
      macdSignal: 'SELL',
    },
  ];

  predictions.forEach((p) => {
    const symbol = p.symbol.padEnd(5);
    const current = `$${p.currentPrice.toFixed(2)}`.padEnd(8);
    const forecast = `$${p.forecastedPrice.toFixed(2)}`.padEnd(9);
    const change = `${p.changePercent > 0 ? '+' : ''}${p.changePercent.toFixed(2)}%`.padEnd(8);
    const confidence = `${p.confidenceScore}%`.padEnd(12);
    const signal = p.macdSignal;

    console.log(`${symbol}  ${current} ${forecast} ${change} ${confidence} ${signal}`);
  });

  console.log();
  console.log('Strategy Tips:');
  console.log('- BUY signals with 70%+ confidence are strong entry points');
  console.log('- SELL signals help identify exit opportunities');
  console.log('- Use moving averages to confirm signals');
  console.log('- Consider RSI for overbought/oversold conditions');
  console.log();
}

// Run all examples
async function runExamples() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Stock Price Prediction System - Usage Examples          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Only run API examples if server is running
  const isServerRunning = await checkServerRunning();

  if (isServerRunning) {
    await exampleAPIUsage();
    await exampleMultipleStocks();
  } else {
    console.log('Note: Server not running, skipping API examples');
    console.log('Start server with: npm run dev\n');
  }

  exampleTechnicalIndicators();
  exampleConfidenceScores();
  await exampleWatchlistIntegration();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  For more information, see ML_AI_MODEL_DOCUMENTATION.md  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

// Helper function to check if server is running
async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:3000', { method: 'HEAD' });
    return response.ok || response.status === 404; // Either OK or 404 means server is running
  } catch {
    return false;
  }
}

// Run examples
runExamples().catch(console.error);
