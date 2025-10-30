import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { testTelegramConnection, sendTelegramMessage } from "./telegram";
import { web3Provider, POLYGON_TOKENS } from "./web3Provider";
import { dexAggregator, DexAggregator } from "./dexAggregator";
import { aaveFlashLoan } from "./aaveFlashLoan";
import { aaveFlashLoanV3 } from "./aaveFlashLoanV3";
import { opportunityScanner } from "./opportunityScanner";
import { 
  insertOpenPositionSchema, 
  insertFlashLoanRequestSchema 
} from "@shared/schema";
import { z } from "zod";

// Telegram Module Configuration
let telegramEnabled = false;

function isTelegramEnabled(): boolean {
  return telegramEnabled;
}

function setTelegramEnabled(enabled: boolean): void {
  telegramEnabled = enabled;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const DEMO_USER_ID = "demo-user-1";

  // Helper function to get DexAggregator with user's API key
  async function getDexAggregatorForUser(userId: string): Promise<DexAggregator> {
    const config = await storage.getBotConfig(userId);
    const apiKey = config?.oneinchApiKey?.trim() || undefined;
    return new DexAggregator(apiKey);
  }

  // Bot Config Routes
  app.get("/api/bot/config", async (req, res) => {
    try {
      const config = await storage.getBotConfig(DEMO_USER_ID);
      res.json(config);
    } catch (error) {
      console.error("Error getting bot config:", error);
      res.status(500).json({ error: "Failed to get bot config" });
    }
  });

  app.post("/api/bot/config", async (req, res) => {
    try {
      // Exclude server-managed fields
      const { id, userId, createdAt, updatedAt, ...configData } = req.body;
      const config = await storage.upsertBotConfig(DEMO_USER_ID, configData);
      res.json(config);
    } catch (error) {
      console.error("Error updating bot config:", error);
      res.status(500).json({ error: "Failed to update bot config" });
    }
  });

  // Bot Status Routes
  app.get("/api/bot/status", async (req, res) => {
    try {
      const status = await storage.getBotStatus(DEMO_USER_ID);
      res.json(status);
    } catch (error) {
      console.error("Error getting bot status:", error);
      res.status(500).json({ error: "Failed to get bot status" });
    }
  });

  app.post("/api/bot/start", async (req, res) => {
    try {
      console.log("🚀 Starting bot...");

      // Update status in database
      const status = await storage.updateBotStatus(DEMO_USER_ID, {
        isRunning: true,
        isPaused: false,
        lastStartedAt: new Date(),
      });

      // START OPPORTUNITY SCANNER - THIS IS THE CRITICAL FIX!
      await opportunityScanner.startScanning(DEMO_USER_ID);
      console.log("✅ Opportunity scanner started successfully");

      // Create activity log
      await storage.createActivityLog(DEMO_USER_ID, {
        type: 'bot_control',
        level: 'success',
        message: 'Бот запущен - сканер арбитражных возможностей активирован',
        metadata: { isRunning: true },
      });

      // Broadcast status update via WebSocket (after httpServer is created)
      setImmediate(() => {
        const broadcast = (req as any).app.locals.wsBroadcast;
        if (broadcast) {
          broadcast('botStatusUpdate', { isRunning: true, isPaused: false });
        }
      });

      res.json(status);
    } catch (error) {
      console.error("Error starting bot:", error);

      // Log error
      await storage.createActivityLog(DEMO_USER_ID, {
        type: 'bot_control',
        level: 'error',
        message: `Ошибка запуска бота: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      });

      res.status(500).json({ error: "Failed to start bot" });
    }
  });

  app.post("/api/bot/stop", async (req, res) => {
    try {
      console.log("🛑 Stopping bot...");

      // STOP OPPORTUNITY SCANNER - THIS IS THE CRITICAL FIX!
      await opportunityScanner.stopScanning(DEMO_USER_ID);
      console.log("✅ Opportunity scanner stopped successfully");

      // Update status in database
      const status = await storage.updateBotStatus(DEMO_USER_ID, {
        isRunning: false,
        lastStoppedAt: new Date(),
      });

      // Create activity log
      await storage.createActivityLog(DEMO_USER_ID, {
        type: 'bot_control',
        level: 'info',
        message: 'Бот остановлен - сканер арбитражных возможностей деактивирован',
        metadata: { isRunning: false },
      });

      // Broadcast status update via WebSocket
      setImmediate(() => {
        const broadcast = (req as any).app.locals.wsBroadcast;
        if (broadcast) {
          broadcast('botStatusUpdate', { isRunning: false });
        }
      });

      res.json(status);
    } catch (error) {
      console.error("Error stopping bot:", error);

      // Log error
      await storage.createActivityLog(DEMO_USER_ID, {
        type: 'bot_control',
        level: 'error',
        message: `Ошибка остановки бота: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      });

      res.status(500).json({ error: "Failed to stop bot" });
    }
  });

  // Ledger Status Routes
  app.get("/api/ledger/status", async (req, res) => {
    try {
      const status = await storage.getLedgerStatus(DEMO_USER_ID);
      res.json(status);
    } catch (error) {
      console.error("Error getting ledger status:", error);
      res.status(500).json({ error: "Failed to get ledger status" });
    }
  });

  app.post("/api/ledger/status", async (req, res) => {
    try {
      const status = await storage.updateLedgerStatus(DEMO_USER_ID, req.body);
      res.json(status);
    } catch (error) {
      console.error("Error updating ledger status:", error);
      res.status(500).json({ error: "Failed to update ledger status" });
    }
  });

  // Safe Transaction Routes
  app.get("/api/safe/transactions", async (req, res) => {
    try {
      const transactions = await storage.getSafeTransactions(DEMO_USER_ID);
      res.json(transactions);
    } catch (error) {
      console.error("Error getting safe transactions:", error);
      res.status(500).json({ error: "Failed to get safe transactions" });
    }
  });

  app.post("/api/safe/transactions", async (req, res) => {
    try {
      const transaction = await storage.createSafeTransaction(DEMO_USER_ID, req.body);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating safe transaction:", error);
      res.status(500).json({ error: "Failed to create safe transaction" });
    }
  });

  // Arbitrage Transaction Routes
  app.get("/api/arbitrage/transactions", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const transactions = await storage.getArbitrageTransactions(DEMO_USER_ID, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error getting arbitrage transactions:", error);
      res.status(500).json({ error: "Failed to get arbitrage transactions" });
    }
  });

  app.post("/api/arbitrage/transactions", async (req, res) => {
    try {
      const transaction = await storage.createArbitrageTransaction(DEMO_USER_ID, req.body);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating arbitrage transaction:", error);
      res.status(500).json({ error: "Failed to create arbitrage transaction" });
    }
  });

  // Connected Wallets Routes
  app.get("/api/wallets", async (req, res) => {
    try {
      const wallets = await storage.getConnectedWallets(DEMO_USER_ID);
      res.json(wallets);
    } catch (error) {
      console.error("Error getting connected wallets:", error);
      res.status(500).json({ error: "Failed to get connected wallets" });
    }
  });

  app.post("/api/wallets/connect", async (req, res) => {
    try {
      const wallet = await storage.connectWallet(DEMO_USER_ID, req.body);
      res.json(wallet);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      res.status(500).json({ error: "Failed to connect wallet" });
    }
  });

  app.post("/api/wallets/:id/disconnect", async (req, res) => {
    try {
      const walletId = parseInt(req.params.id);
      await storage.disconnectWallet(DEMO_USER_ID, walletId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      res.status(500).json({ error: "Failed to disconnect wallet" });
    }
  });

  // Telegram settings
  app.get("/api/telegram/status", async (req, res) => {
    // No authentication needed for status check
    res.json({ enabled: isTelegramEnabled() });
  });

  app.post("/api/telegram/toggle", async (req, res) => {
    // Assuming authentication is handled elsewhere or not required for this toggle
    const { enabled } = req.body;
    setTelegramEnabled(enabled === true);
    res.json({ 
      success: true, 
      enabled: isTelegramEnabled() 
    });
  });

  // Telegram routes
  app.post("/api/telegram/test", async (req, res) => {
    if (!isTelegramEnabled()) {
      return res.status(400).json({ error: "Telegram module is disabled" });
    }
    try {
      const result = await testTelegramConnection(DEMO_USER_ID);
      res.json(result);
    } catch (error) {
      console.error("Error testing Telegram:", error);
      res.status(500).json({ error: "Failed to test Telegram connection" });
    }
  });

  app.post("/api/telegram/send", async (req, res) => {
    if (!isTelegramEnabled()) {
      return res.status(400).json({ error: "Telegram module is disabled" });
    }
    try {
      const { message } = req.body;
      const result = await sendTelegramMessage(DEMO_USER_ID, message);
      res.json(result);
    } catch (error) {
      console.error("Error sending Telegram message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // User Route (required by useAuth hook)
  app.get("/api/user", async (req, res) => {
    try {
      let user = await storage.getUser(DEMO_USER_ID);

      if (!user) {
        user = await storage.upsertUser({
          id: DEMO_USER_ID,
          email: "demo@example.com",
          firstName: "Demo",
          lastName: "User",
        });
      }

      res.json(user);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Web3 / Polygon Integration Routes
  app.get("/api/web3/balance/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : 137;

      if (!web3Provider.isValidAddress(address)) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      const balance = await web3Provider.getNativeBalance(address, chainId);
      res.json(balance);
    } catch (error) {
      console.error("Error getting native balance:", error);
      res.status(500).json({ error: "Failed to get balance" });
    }
  });

  app.get("/api/web3/wallet/:address/balances", async (req, res) => {
    try {
      const { address } = req.params;
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : 137;

      if (!web3Provider.isValidAddress(address)) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      const balances = await web3Provider.getWalletBalances(address, chainId);
      res.json(balances);
    } catch (error) {
      console.error("Error getting wallet balances:", error);
      res.status(500).json({ error: "Failed to get wallet balances" });
    }
  });

  app.get("/api/web3/gas-price", async (req, res) => {
    try {
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : 137;
      const gasPrice = await web3Provider.getGasPrice(chainId);
      res.json(gasPrice);
    } catch (error) {
      console.error("Error getting gas price:", error);
      res.status(500).json({ error: "Failed to get gas price" });
    }
  });

  app.get("/api/web3/block-number", async (req, res) => {
    try {
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : 137;
      const blockNumber = await web3Provider.getBlockNumber(chainId);
      res.json({ blockNumber });
    } catch (error) {
      console.error("Error getting block number:", error);
      res.status(500).json({ error: "Failed to get block number" });
    }
  });

  app.get("/api/web3/transaction/:txHash", async (req, res) => {
    try {
      const { txHash } = req.params;
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : 137;
      const tx = await web3Provider.getTransaction(txHash, chainId);
      res.json(tx);
    } catch (error) {
      console.error("Error getting transaction:", error);
      res.status(500).json({ error: "Failed to get transaction" });
    }
  });

  app.get("/api/web3/token-addresses", (req, res) => {
    res.json(POLYGON_TOKENS);
  });

  // DEX / Trading Routes
  app.get("/api/dex/tokens", (req, res) => {
    try {
      const tokens = dexAggregator.getSupportedTokens();
      res.json(tokens);
    } catch (error) {
      console.error("Error getting supported tokens:", error);
      res.status(500).json({ error: "Failed to get tokens" });
    }
  });

  app.get("/api/dex/quote", async (req, res) => {
    try {
      const { src, dst, amount, from } = req.query;

      if (!src || !dst || !amount) {
        return res.status(400).json({ error: "Missing required parameters: src, dst, amount" });
      }

      const aggregator = await getDexAggregatorForUser(DEMO_USER_ID);
      const quote = await aggregator.getQuote({
        src: src as string,
        dst: dst as string,
        amount: amount as string,
        from: from as string,
      });

      res.json(quote);
    } catch (error) {
      console.error("Error getting quote:", error);
      res.status(500).json({ error: "Failed to get quote" });
    }
  });

  app.post("/api/dex/swap", async (req, res) => {
    try {
      const { src, dst, amount, from } = req.body;

      if (!src || !dst || !amount) {
        return res.status(400).json({ error: "Missing required parameters: src, dst, amount" });
      }

      // Execute simulated swap
      const aggregator = await getDexAggregatorForUser(DEMO_USER_ID);
      const result = await aggregator.executeSwap({ src, dst, amount, from });

      // Create arbitrage transaction record
      await storage.createArbitrageTransaction(DEMO_USER_ID, {
        txHash: result.txHash,
        tokenIn: src,
        tokenOut: dst,
        amountIn: amount,
        amountOut: '0', // Would be filled in real transaction
        profit: 0,
        gasCost: 0,
        status: 'demo',
        timestamp: new Date(),
      });

      // Create activity log
      const log = await storage.createActivityLog(DEMO_USER_ID, {
        type: 'swap',
        level: 'success',
        message: `Swap выполнен: ${amount} ${src.slice(0, 6)}... → ${dst.slice(0, 6)}...`,
        metadata: {
          txHash: result.txHash,
          tokenIn: src,
          tokenOut: dst,
          amountIn: amount,
        },
      });

      // Broadcast swap event and log via WebSocket
      if (app.locals.wsBroadcast) {
        app.locals.wsBroadcast('swap_executed', {
          txHash: result.txHash,
          tokenIn: src,
          tokenOut: dst,
          amountIn: amount,
          timestamp: new Date().toISOString(),
        });
        app.locals.wsBroadcast('activity_log', log);
      }

      res.json(result);
    } catch (error) {
      console.error("Error executing swap:", error);

      // Log error
      await storage.createActivityLog(DEMO_USER_ID, {
        type: 'swap',
        level: 'error',
        message: `Ошибка swap: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { error: String(error) },
      });

      res.status(500).json({ error: "Failed to execute swap" });
    }
  });

  app.get("/api/dex/prices", async (req, res) => {
    try {
      const addresses = req.query.addresses as string;
      if (!addresses) {
        return res.status(400).json({ error: "Missing addresses parameter" });
      }

      const tokenAddresses = addresses.split(',');
      const aggregator = await getDexAggregatorForUser(DEMO_USER_ID);
      const prices = await aggregator.getTokenPrices(tokenAddresses);
      res.json(prices);
    } catch (error) {
      console.error("Error getting token prices:", error);
      res.status(500).json({ error: "Failed to get prices" });
    }
  });

  app.get("/api/dex/arbitrage-opportunities", async (req, res) => {
    try {
      const aggregator = await getDexAggregatorForUser(DEMO_USER_ID);
      const opportunities = await aggregator.getArbitrageOpportunities();
      res.json(opportunities);
    } catch (error) {
      console.error("Error getting arbitrage opportunities:", error);
      res.status(500).json({ error: "Failed to get arbitrage opportunities" });
    }
  });

  // Activity Logs Routes
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getActivityLogs(DEMO_USER_ID, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting activity logs:", error);
      res.status(500).json({ error: "Failed to get activity logs" });
    }
  });

  app.post("/api/activity-logs", async (req, res) => {
    try {
      const log = await storage.createActivityLog(DEMO_USER_ID, req.body);

      // Broadcast log via WebSocket
      if (app.locals.wsBroadcast) {
        app.locals.wsBroadcast('activity_log', log);
      }

      res.json(log);
    } catch (error) {
      console.error("Error creating activity log:", error);
      res.status(500).json({ error: "Failed to create activity log" });
    }
  });

  app.delete("/api/activity-logs", async (req, res) => {
    try {
      const daysToKeep = req.query.daysToKeep ? parseInt(req.query.daysToKeep as string) : 7;
      await storage.clearOldLogs(DEMO_USER_ID, daysToKeep);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing old logs:", error);
      res.status(500).json({ error: "Failed to clear old logs" });
    }
  });

  // Telegram Messages Routes
  app.get("/api/telegram/messages", async (req, res) => {
    if (!isTelegramEnabled()) {
      return res.status(400).json({ error: "Telegram module is disabled" });
    }
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const messages = await storage.getTelegramMessages(DEMO_USER_ID, limit);
      res.json(messages);
    } catch (error) {
      console.error("Error getting telegram messages:", error);
      res.status(500).json({ error: "Failed to get telegram messages" });
    }
  });

  // Open Positions Routes
  app.get("/api/positions/open", async (req, res) => {
    try {
      const positions = await storage.getOpenPositions(DEMO_USER_ID);
      res.json(positions);
    } catch (error) {
      console.error("Error getting open positions:", error);
      res.status(500).json({ error: "Failed to get open positions" });
    }
  });

  app.post("/api/positions/open", async (req, res) => {
    try {
      // Validate request body
      const validatedData = insertOpenPositionSchema.omit({ userId: true }).parse(req.body);
      const position = await storage.createOpenPosition(DEMO_USER_ID, validatedData);

      // Broadcast new position via WebSocket
      if (app.locals.wsBroadcast) {
        app.locals.wsBroadcast('position_opened', position);
      }

      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error creating open position:", error);
      res.status(500).json({ error: "Failed to create open position" });
    }
  });

  app.patch("/api/positions/open/:id", async (req, res) => {
    try {
      const positionId = parseInt(req.params.id);
      if (isNaN(positionId)) {
        return res.status(400).json({ error: "Invalid position ID" });
      }

      // Validate request body - allow partial updates
      const updateSchema = insertOpenPositionSchema.omit({ userId: true }).partial();
      const validatedData = updateSchema.parse(req.body);

      const position = await storage.updateOpenPosition(DEMO_USER_ID, positionId, validatedData);

      // Broadcast position update via WebSocket
      if (app.locals.wsBroadcast) {
        app.locals.wsBroadcast('position_updated', position);
      }

      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error updating open position:", error);
      res.status(500).json({ error: "Failed to update open position" });
    }
  });

  app.post("/api/positions/close/:id", async (req, res) => {
    try {
      const positionId = parseInt(req.params.id);
      await storage.closePosition(DEMO_USER_ID, positionId);

      // Broadcast position closed via WebSocket
      if (app.locals.wsBroadcast) {
        app.locals.wsBroadcast('position_closed', { positionId });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error closing position:", error);
      res.status(500).json({ error: "Failed to close position" });
    }
  });

  // Safe Transactions Routes (database only - frontend handles Safe SDK)
  app.get("/api/safe/transactions", async (req, res) => {
    try {
      const transactions = await storage.getSafeTransactions(DEMO_USER_ID);
      res.json(transactions);
    } catch (error) {
      console.error("Error getting Safe transactions:", error);
      res.status(500).json({ error: "Failed to get Safe transactions" });
    }
  });

  app.post("/api/safe/transactions", async (req, res) => {
    try {
      const transaction = await storage.createSafeTransaction(DEMO_USER_ID, req.body);
      res.json(transaction);
    } catch (error) {
      console.error("Error creating Safe transaction:", error);
      res.status(500).json({ error: "Failed to create Safe transaction" });
    }
  });

  // Opportunity Scanner Routes
  app.post("/api/scanner/start", async (req, res) => {
    try {
      if (opportunityScanner.isRunning()) {
        return res.status(400).json({ error: "Scanner already running" });
      }

      const config = req.body || {};

      // Set broadcast callback
      opportunityScanner.setBroadcastCallback((type, data) => {
        if (app.locals.wsBroadcast) {
          app.locals.wsBroadcast(type, data);
        }
      });

      await opportunityScanner.startScanning(DEMO_USER_ID, config);

      res.json({ success: true, message: "Scanner started" });
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      res.status(500).json({ error: error.message || "Failed to start scanner" });
    }
  });

  app.post("/api/scanner/stop", async (req, res) => {
    try {
      opportunityScanner.stopScanning();
      res.json({ success: true, message: "Scanner stopped" });
    } catch (error: any) {
      console.error("Error stopping scanner:", error);
      res.status(500).json({ error: error.message || "Failed to stop scanner" });
    }
  });

  app.get("/api/scanner/opportunities", async (req, res) => {
    try {
      const opportunities = opportunityScanner.getOpportunities();
      res.json(opportunities);
    } catch (error: any) {
      console.error("Error getting opportunities:", error);
      res.status(500).json({ error: error.message || "Failed to get opportunities" });
    }
  });

  // Execute Arbitrage Trade Manually
  app.post("/api/arbitrage/execute", async (req, res) => {
    try {
      const { opportunityId } = req.body;

      if (!opportunityId) {
        return res.status(400).json({ error: "Missing opportunityId" });
      }

      // Find the opportunity
      const opportunities = opportunityScanner.getOpportunities();
      const opportunity = opportunities.find(o => o.id === opportunityId);

      if (!opportunity) {
        return res.status(404).json({ 
          success: false, 
          error: "Opportunity not found or expired" 
        });
      }

      // Get bot config to check mode
      const config = await storage.getBotConfig(DEMO_USER_ID);
      const isSimulation = config?.useSimulation !== false;

      // Import tradeExecutor dynamically to avoid circular dependency
      const { tradeExecutor } = await import('./tradeExecutor');

      // Execute the trade
      const result = await tradeExecutor.executeArbitrageTrade(
        DEMO_USER_ID,
        opportunity,
        isSimulation
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error executing arbitrage trade:", error);
      res.status(500).json({ 
        success: false,
        error: error.message || "Failed to execute trade" 
      });
    }
  });

  app.get("/api/scanner/status", async (req, res) => {
    try {
      const isRunning = opportunityScanner.isRunning();
      const opportunities = opportunityScanner.getOpportunities();
      res.json({
        isRunning,
        opportunityCount: opportunities.length,
        opportunities: opportunities.slice(0, 5), // Top 5
      });
    } catch (error: any) {
      console.error("Error getting scanner status:", error);
      res.status(500).json({ error: error.message || "Failed to get scanner status" });
    }
  });

  // Flash Loan Routes
  app.get("/api/flashloan/assets", async (req, res) => {
    try {
      const assets = aaveFlashLoan.getAvailableAssets();
      res.json(assets);
    } catch (error) {
      console.error("Error getting flash loan assets:", error);
      res.status(500).json({ error: "Failed to get flash loan assets" });
    }
  });

  app.post("/api/flashloan/calculate-fee", async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount) {
        return res.status(400).json({ error: "Missing amount parameter" });
      }

      const result = aaveFlashLoan.calculateFee(amount);
      res.json(result);
    } catch (error) {
      console.error("Error calculating flash loan fee:", error);
      res.status(500).json({ error: "Failed to calculate fee" });
    }
  });

  app.post("/api/flashloan/execute", async (req, res) => {
    try {
      // Validate flash loan execution parameters
      const flashLoanExecuteSchema = z.object({
        asset: z.string().min(1, "Asset address required"),
        amount: z.string().min(1, "Amount required"),
        receiverAddress: z.string().min(1, "Receiver address required"),
        params: z.string().optional(),
      });

      const validatedData = flashLoanExecuteSchema.parse(req.body);

      const result = await aaveFlashLoan.executeFlashLoan(DEMO_USER_ID, {
        asset: validatedData.asset,
        amount: validatedData.amount,
        receiverAddress: validatedData.receiverAddress,
        params: validatedData.params,
      });

      // Broadcast flash loan executed via WebSocket
      if (app.locals.wsBroadcast) {
        app.locals.wsBroadcast('flashloan_executed', {
          success: result.success,
          txHash: result.txHash,
          asset: validatedData.asset, // Use validatedData.asset here
          amount: validatedData.amount, // Use validatedData.amount here
          timestamp: new Date().toISOString(),
        });
      }

      // Send Telegram notification
      if (result.success && isTelegramEnabled()) {
        await sendTelegramMessage(
          DEMO_USER_ID,
          `🔥 <b>Flash Loan выполнен</b>\n\nАктив: ${validatedData.asset}\nСумма: ${result.loanAmount}\nКомиссия: ${result.fee}\nTX: ${result.txHash}`,
          'flashloan',
          { asset: validatedData.asset, amount: validatedData.amount, txHash: result.txHash }
        );
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error executing flash loan:", error);
      res.status(500).json({ error: "Failed to execute flash loan" });
    }
  });

  app.get("/api/flashloan/requests", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const requests = await storage.getFlashLoanRequests(DEMO_USER_ID, limit);
      res.json(requests);
    } catch (error) {
      console.error("Error getting flash loan requests:", error);
      res.status(500).json({ error: "Failed to get flash loan requests" });
    }
  });

  // ==================== RISK MANAGEMENT ROUTES ====================

  // Get Risk Limits Tracking
  app.get("/api/risk/tracking", async (req, res) => {
    try {
      const tracking = await storage.getRiskLimitsTracking(DEMO_USER_ID);
      res.json(tracking);
    } catch (error) {
      console.error("Error getting risk limits tracking:", error);
      res.status(500).json({ error: "Failed to get risk limits tracking" });
    }
  });

  // Update Risk Limits Tracking
  app.post("/api/risk/tracking", async (req, res) => {
    try {
      const tracking = await storage.updateRiskLimitsTracking(DEMO_USER_ID, req.body);
      res.json(tracking);
    } catch (error) {
      console.error("Error updating risk limits tracking:", error);
      res.status(500).json({ error: "Failed to update risk limits tracking" });
    }
  });

  // Reset Daily Risk Limits
  app.post("/api/risk/tracking/reset", async (req, res) => {
    try {
      const tracking = await storage.resetDailyRiskLimits(DEMO_USER_ID);
      res.json(tracking);
    } catch (error) {
      console.error("Error resetting daily risk limits:", error);
      res.status(500).json({ error: "Failed to reset daily risk limits" });
    }
  });

  // Get Circuit Breaker Events
  app.get("/api/risk/circuit-breaker-events", async (req, res) => {
    try {
      const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const events = await storage.getCircuitBreakerEvents(DEMO_USER_ID, resolved, limit);
      res.json(events);
    } catch (error) {
      console.error("Error getting circuit breaker events:", error);
      res.status(500).json({ error: "Failed to get circuit breaker events" });
    }
  });

  // Create Circuit Breaker Event
  app.post("/api/risk/circuit-breaker-events", async (req, res) => {
    try {
      const event = await storage.createCircuitBreakerEvent(DEMO_USER_ID, req.body);
      res.json(event);
    } catch (error) {
      console.error("Error creating circuit breaker event:", error);
      res.status(500).json({ error: "Failed to create circuit breaker event" });
    }
  });

  // Resolve Circuit Breaker Event
  app.post("/api/risk/circuit-breaker-events/:id/resolve", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { resolvedBy, notes } = req.body;
      const event = await storage.resolveCircuitBreakerEvent(DEMO_USER_ID, eventId, resolvedBy, notes);
      res.json(event);
    } catch (error) {
      console.error("Error resolving circuit breaker event:", error);
      res.status(500).json({ error: "Failed to resolve circuit breaker event" });
    }
  });

  // ==================== TOKEN WHITELIST ROUTES ====================

  // Get Token Whitelist
  app.get("/api/whitelist", async (req, res) => {
    try {
      const tokens = await storage.getTokenWhitelist(DEMO_USER_ID);
      res.json(tokens);
    } catch (error) {
      console.error("Error getting token whitelist:", error);
      res.status(500).json({ error: "Failed to get token whitelist" });
    }
  });

  // Add Token to Whitelist
  app.post("/api/whitelist", async (req, res) => {
    try {
      const token = await storage.addTokenToWhitelist(DEMO_USER_ID, req.body);
      res.json(token);
    } catch (error) {
      console.error("Error adding token to whitelist:", error);
      res.status(500).json({ error: "Failed to add token to whitelist" });
    }
  });

  // Remove Token from Whitelist
  app.delete("/api/whitelist/:id", async (req, res) => {
    try {
      const tokenId = parseInt(req.params.id);
      await storage.removeTokenFromWhitelist(DEMO_USER_ID, tokenId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing token from whitelist:", error);
      res.status(500).json({ error: "Failed to remove token from whitelist" });
    }
  });

  // Update Token in Whitelist
  app.put("/api/whitelist/:id", async (req, res) => {
    try {
      const tokenId = parseInt(req.params.id);
      const token = await storage.updateTokenWhitelist(DEMO_USER_ID, tokenId, req.body);
      res.json(token);
    } catch (error) {
      console.error("Error updating token in whitelist:", error);
      res.status(500).json({ error: "Failed to update token in whitelist" });
    }
  });

  // ==================== ALERT RULES ROUTES ====================

  // Get Alert Rules
  app.get("/api/alerts", async (req, res) => {
    try {
      const rules = await storage.getAlertRules(DEMO_USER_ID);
      res.json(rules);
    } catch (error) {
      console.error("Error getting alert rules:", error);
      res.status(500).json({ error: "Failed to get alert rules" });
    }
  });

  // Create Alert Rule
  app.post("/api/alerts", async (req, res) => {
    try {
      const rule = await storage.createAlertRule(DEMO_USER_ID, req.body);
      res.json(rule);
    } catch (error) {
      console.error("Error creating alert rule:", error);
      res.status(500).json({ error: "Failed to create alert rule" });
    }
  });

  // Update Alert Rule
  app.put("/api/alerts/:id", async (req, res) => {
    try {
      const ruleId = parseInt(req.params.id);
      const rule = await storage.updateAlertRule(DEMO_USER_ID, ruleId, req.body);
      res.json(rule);
    } catch (error) {
      console.error("Error updating alert rule:", error);
      res.status(500).json({ error: "Failed to update alert rule" });
    }
  });

  // Delete Alert Rule
  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const ruleId = parseInt(req.params.id);
      await storage.deleteAlertRule(DEMO_USER_ID, ruleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting alert rule:", error);
      res.status(500).json({ error: "Failed to delete alert rule" });
    }
  });

  // ==================== WEBHOOK ROUTES ====================

  // Get Webhook Configs
  app.get("/api/webhooks", async (req, res) => {
    try {
      const configs = await storage.getWebhookConfigs(DEMO_USER_ID);
      res.json(configs);
    } catch (error) {
      console.error("Error getting webhook configs:", error);
      res.status(500).json({ error: "Failed to get webhook configs" });
    }
  });

  // Create Webhook Config
  app.post("/api/webhooks", async (req, res) => {
    try {
      const config = await storage.createWebhookConfig(DEMO_USER_ID, req.body);
      res.json(config);
    } catch (error) {
      console.error("Error creating webhook config:", error);
      res.status(500).json({ error: "Failed to create webhook config" });
    }
  });

  // Update Webhook Config
  app.put("/api/webhooks/:id", async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      const config = await storage.updateWebhookConfig(DEMO_USER_ID, configId, req.body);
      res.json(config);
    } catch (error) {
      console.error("Error updating webhook config:", error);
      res.status(500).json({ error: "Failed to update webhook config" });
    }
  });

  // Delete Webhook Config
  app.delete("/api/webhooks/:id", async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      await storage.deleteWebhookConfig(DEMO_USER_ID, configId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting webhook config:", error);
      res.status(500).json({ error: "Failed to delete webhook config" });
    }
  });

  // Test Webhook
  app.post("/api/webhooks/:id/test", async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      const configs = await storage.getWebhookConfigs(DEMO_USER_ID);
      const config = configs.find(c => c.id === configId);

      if (!config) {
        return res.status(404).json({ error: "Webhook config not found" });
      }

      // Send test webhook
      const axios = require('axios');
      const testPayload = {
        event: "test",
        message: "Test webhook from Flash Loan Arbitrage Bot",
        timestamp: new Date().toISOString(),
        userId: DEMO_USER_ID
      };

      const startTime = Date.now();
      try {
        const response = await axios.post(config.url, testPayload, {
          headers: config.headers ? JSON.parse(config.headers as any) : {},
          timeout: 10000
        });
        const responseTime = Date.now() - startTime;

        // Log the test
        await storage.createWebhookLog(DEMO_USER_ID, {
          webhookConfigId: configId,
          eventType: "test",
          url: config.url,
          method: "POST",
          requestBody: testPayload,
          requestHeaders: config.headers ? JSON.parse(config.headers as any) : {},
          statusCode: response.status,
          responseBody: JSON.stringify(response.data).substring(0, 1000),
          responseTime,
          success: true,
          retryAttempt: 0
        });

        // Update webhook stats
        await storage.updateWebhookConfig(DEMO_USER_ID, configId, {
          totalCalls: (config.totalCalls || 0) + 1,
          successfulCalls: (config.successfulCalls || 0) + 1,
          lastCalledAt: new Date(),
          lastSuccessAt: new Date()
        });

        res.json({
          success: true,
          statusCode: response.status,
          responseTime,
          response: response.data
        });
      } catch (error: any) {
        const responseTime = Date.now() - startTime;

        // Log the failed test
        await storage.createWebhookLog(DEMO_USER_ID, {
          webhookConfigId: configId,
          eventType: "test",
          url: config.url,
          method: "POST",
          requestBody: testPayload,
          statusCode: error.response?.status,
          responseTime,
          success: false,
          error: error.message,
          retryAttempt: 0
        });

        // Update webhook stats
        await storage.updateWebhookConfig(DEMO_USER_ID, configId, {
          totalCalls: (config.totalCalls || 0) + 1,
          failedCalls: (config.failedCalls || 0) + 1,
          lastCalledAt: new Date(),
          lastErrorAt: new Date(),
          lastError: error.message
        });

        res.status(500).json({
          success: false,
          error: error.message,
          responseTime
        });
      }
    } catch (error) {
      console.error("Error testing webhook:", error);
      res.status(500).json({ error: "Failed to test webhook" });
    }
  });

  // Get Webhook Logs
  app.get("/api/webhooks/logs", async (req, res) => {
    try {
      const webhookConfigId = req.query.webhookConfigId ? parseInt(req.query.webhookConfigId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getWebhookLogs(DEMO_USER_ID, webhookConfigId, limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting webhook logs:", error);
      res.status(500).json({ error: "Failed to get webhook logs" });
    }
  });

  // ==================== PERFORMANCE ANALYTICS ROUTES ====================

  // Get Performance Metrics
  app.get("/api/analytics/performance", async (req, res) => {
    try {
      const period = req.query.period as string | undefined;
      const metrics = await storage.getPerformanceMetrics(DEMO_USER_ID, period);
      res.json(metrics);
    } catch (error) {
      console.error("Error getting performance metrics:", error);
      res.status(500).json({ error: "Failed to get performance metrics" });
    }
  });

  // Create Performance Metric
  app.post("/api/analytics/performance", async (req, res) => {
    try {
      const metric = await storage.createPerformanceMetric(DEMO_USER_ID, req.body);
      res.json(metric);
    } catch (error) {
      console.error("Error creating performance metric:", error);
      res.status(500).json({ error: "Failed to create performance metric" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates (ref: blueprint:javascript_websocket)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Track connected clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected, total clients:', clients.size + 1);
    clients.add(ws);

    // Send initial connection confirmation
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
      } catch (error) {
        console.error('Invalid WebSocket message:', message.toString());
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected, remaining clients:', clients.size);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast function for real-time updates
  const broadcast = (type: string, data: any) => {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    let successCount = 0;
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          successCount++;
        } catch (error) {
          console.error('Failed to send to client:', error);
        }
      }
    });

    console.log(`Broadcast ${type} to ${successCount}/${clients.size} clients`);
  };

  // Store broadcast function for use in routes
  app.locals.wsBroadcast = broadcast;
  (httpServer as any).wsBroadcast = broadcast;

  return httpServer;
}