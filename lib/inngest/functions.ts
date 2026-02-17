import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendWelcomeEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail, getAllUniqueWatchlistSymbols } from "@/lib/actions/watchlist.actions";
import { getNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { fetchAndStoreHistoricalData, predictStockPrice, getLatestPrediction } from "@/lib/actions/prediction.actions";
import { trainModel } from "@/lib/ml/modelTrainer";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }]
            }
        })

        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) ||'Thanks for joining Signalist. You now have the tools to track markets and make smarter moves.'

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        // Step #1: Get all users for news delivery
        const users = await step.run('get-all-users', getAllUsersForNewsEmail)

        if(!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        // Step #2: For each user, get watchlist symbols -> fetch news (fallback to general)
        const results = await step.run('fetch-user-news', async () => {
            const perUser: Array<{ user: UserForNewsEmail; articles: MarketNewsArticle[] }> = [];
            for (const user of users as UserForNewsEmail[]) {
                try {
                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    let articles = await getNews(symbols);
                    // Enforce max 6 articles per user
                    articles = (articles || []).slice(0, 6);
                    // If still empty, fallback to general
                    if (!articles || articles.length === 0) {
                        articles = await getNews();
                        articles = (articles || []).slice(0, 6);
                    }
                    perUser.push({ user, articles });
                } catch (e) {
                    console.error('daily-news: error preparing user news', user.email, e);
                    perUser.push({ user, articles: [] });
                }
            }
            return perUser;
        });

        // Step #3: (placeholder) Summarize news via AI
        const userNewsSummaries: { user: UserForNewsEmail; newsContent: string | null }[] = [];

        for (const { user, articles } of results) {
                try {
                    const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

                    const response = await step.ai.infer(`summarize-news-${user.email}`, {
                        model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                        body: {
                            contents: [{ role: 'user', parts: [{ text:prompt }]}]
                        }
                    });

                    const part = response.candidates?.[0]?.content?.parts?.[0];
                    const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.'

                    userNewsSummaries.push({ user, newsContent });
                } catch (e) {
                    console.error('Failed to summarize news for : ', user.email);
                    userNewsSummaries.push({ user, newsContent: null });
                }
            }

        // Step #4: (placeholder) Send the emails
        await step.run('send-news-emails', async () => {
                await Promise.all(
                    userNewsSummaries.map(async ({ user, newsContent}) => {
                        if(!newsContent) return false;

                        return await sendNewsSummaryEmail({ email: user.email, date: getFormattedTodayDate(), newsContent })
                    })
                )
            })

        return { success: true, message: 'Daily news summary emails sent successfully' }
    }
)

/**
 * Update historic data and generate predictions for all watched stocks
 * Runs daily at 3:00 AM UTC (after market closes)
 */
export const updateStockPredictions = inngest.createFunction(
    { id: 'update-stock-predictions' },
    [ { event: 'app/update.predictions' }, { cron: '0 3 * * *' } ],
    async ({ step }) => {
        // Step #1: Get all unique symbols from user watchlists
        const users = await step.run('get-all-users-for-predictions', getAllUsersForNewsEmail)

        if (!users || users.length === 0) {
            return { success: false, message: 'No users found for predictions' };
        }

        // Step #2: Fetch all unique watchlist symbols
        const allSymbols = await step.run('fetch-all-watchlist-symbols', async () => {
            const symbolSet = new Set<string>();
            for (const user of users) {
                try {
                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    symbols.forEach((s) => symbolSet.add(s.toUpperCase()));
                } catch (e) {
                    console.error('Error fetching watchlist for', user.email, e);
                }
            }
            return Array.from(symbolSet);
        });

        if (allSymbols.length === 0) {
            return { success: false, message: 'No symbols to predict' };
        }

        // Step #3: Fetch historical data for each symbol
        await step.run('fetch-historical-data', async () => {
            const results = await Promise.allSettled(
                allSymbols.map((symbol) =>
                    fetchAndStoreHistoricalData(symbol, 'D', 365)
                )
            );

            const failed = results.filter((r) => r.status === 'rejected').length;
            console.log(`Historical data fetched: ${allSymbols.length - failed}/${allSymbols.length}`);
        });

        // Step #4: Generate predictions for each symbol
        const predictions = await step.run('generate-predictions', async () => {
            const results: { symbol: string; success: boolean; prediction?: any; error?: string }[] = [];

            for (const symbol of allSymbols) {
                try {
                    const prediction = await predictStockPrice(symbol, 30);
                    results.push({
                        symbol,
                        success: true,
                        prediction,
                    });
                } catch (error) {
                    console.error(`Failed to predict ${symbol}:`, error);
                    results.push({
                        symbol,
                        success: false,
                        error: String(error),
                    });
                }
            }

            return results;
        });

        const successCount = predictions.filter((p) => p.success).length;

        return {
            success: true,
            message: `Predictions generated for ${successCount}/${allSymbols.length} symbols`,
            predictions,
        };
    }
)

/**
 * Generate prediction for a specific stock when user adds it to watchlist
 */
export const generatePredictionOnWatchlistAdd = inngest.createFunction(
    { id: 'prediction-on-watchlist-add' },
    { event: 'app/watchlist.added' },
    async ({ event, step }) => {
        const { symbol } = event.data;

        // Step #1: Fetch historical data
        await step.run('fetch-historical-data', async () => {
            try {
                await fetchAndStoreHistoricalData(symbol, 'D', 365);
            } catch (error) {
                console.error(`Failed to fetch historical data for ${symbol}:`, error);
                // Continue even if this fails
            }
        });

        // Step #2: Generate prediction
        const prediction = await step.run('generate-prediction', async () => {
            try {
                return await predictStockPrice(symbol, 30);
            } catch (error) {
                console.error(`Failed to predict ${symbol}:`, error);
                // Try to get existing prediction
                return getLatestPrediction(symbol);
            }
        });

        return {
            success: true,
            symbol,
            prediction,
        };
    }
)

/**
 * Automatically train LSTM models for all watched stocks on a schedule
 * Runs daily to keep models updated with latest data
 * Dynamically trains for all unique stocks in user watchlists
 */
export const autoTrainLSTMModels = inngest.createFunction(
    { id: 'auto-train-lstm-models' },
    { cron: '0 2 * * *' }, // 2 AM UTC daily
    async ({ step }) => {
        // Get all unique symbols from all user watchlists
        const symbols = await step.run('get-all-symbols', async () => {
            try {
                const watchedSymbols = await getAllUniqueWatchlistSymbols();
                
                // If no watched symbols, use popular ones as fallback
                if (!watchedSymbols || watchedSymbols.length === 0) {
                    return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ'];
                }
                
                return watchedSymbols;
            } catch (error) {
                console.error('Failed to get watched symbols:', error);
                // Fallback to popular stocks
                return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
            }
        });

        const results = await step.run('train-models', async () => {
            const trainedModels = [];
            
            for (const symbol of symbols) {
                try {
                    // Fetch latest historical data
                    await fetchAndStoreHistoricalData(symbol, 'D', 365);
                    
                    // Train LSTM model
                    const metrics = await trainModel({
                        symbol,
                        epochs: 50,
                        batchSize: 32,
                        lookbackPeriod: 30,
                        testSplit: 0.2,
                        learningRate: 0.001,
                    });

                    trainedModels.push({
                        symbol,
                        success: true,
                        r2Score: metrics.r2Score,
                        trainingTime: metrics.trainingTime,
                    });
                } catch (error) {
                    console.error(`Failed to train model for ${symbol}:`, error);
                    trainedModels.push({
                        symbol,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }

            return trainedModels;
        });

        return {
            success: true,
            totalSymbols: symbols.length,
            trainedModels: results,
            timestamp: new Date().toISOString(),
        };
    }
)
