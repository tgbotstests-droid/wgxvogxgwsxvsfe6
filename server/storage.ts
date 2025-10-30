import { 
  users, 
  botConfig, 
  botStatus, 
  ledgerStatus, 
  safeTransactions, 
  arbitrageTransactions,
  connectedWallets,
  activityLogs,
  telegramMessages,
  openPositions,
  flashLoanRequests,
  tokenWhitelist,
  performanceMetrics,
  alertRules,
  webhookConfigs,
  webhookLogs,
  circuitBreakerEvents,
  riskLimitsTracking,
  type User, 
  type UpsertUser,
  type BotConfig,
  type InsertBotConfig,
  type BotStatus,
  type LedgerStatus,
  type SafeTransaction,
  type InsertSafeTransaction,
  type ArbitrageTransaction,
  type ConnectedWallet,
  type ActivityLog,
  type InsertActivityLog,
  type TelegramMessage,
  type InsertTelegramMessage,
  type OpenPosition,
  type InsertOpenPosition,
  type FlashLoanRequest,
  type InsertFlashLoanRequest,
  type TokenWhitelist,
  type InsertTokenWhitelist,
  type PerformanceMetrics,
  type AlertRule,
  type InsertAlertRule,
  type WebhookConfig,
  type InsertWebhookConfig,
  type WebhookLog,
  type CircuitBreakerEvent,
  type InsertCircuitBreakerEvent,
  type RiskLimitsTracking,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Bot Config
  getBotConfig(userId: string): Promise<BotConfig | undefined>;
  upsertBotConfig(userId: string, config: Partial<InsertBotConfig>): Promise<BotConfig>;

  // Bot Status
  getBotStatus(userId: string): Promise<BotStatus | undefined>;
  updateBotStatus(userId: string, status: Partial<BotStatus>): Promise<BotStatus>;

  // Ledger Status
  getLedgerStatus(userId: string): Promise<LedgerStatus | undefined>;
  updateLedgerStatus(userId: string, status: Partial<LedgerStatus>): Promise<LedgerStatus>;

  // Safe Transactions
  getSafeTransactions(userId: string): Promise<SafeTransaction[]>;
  createSafeTransaction(userId: string, transaction: Omit<InsertSafeTransaction, 'userId'>): Promise<SafeTransaction>;
  updateSafeTransaction(safeTxHash: string, updates: Partial<SafeTransaction>): Promise<SafeTransaction>;

  // Arbitrage Transactions
  getArbitrageTransactions(userId: string, limit?: number): Promise<ArbitrageTransaction[]>;
  createArbitrageTransaction(userId: string, transaction: Omit<Partial<ArbitrageTransaction>, 'id' | 'userId' | 'createdAt'>): Promise<ArbitrageTransaction>;

  // Connected Wallets
  getConnectedWallets(userId: string): Promise<ConnectedWallet[]>;
  connectWallet(userId: string, wallet: Omit<Partial<ConnectedWallet>, 'id' | 'userId'>): Promise<ConnectedWallet>;
  disconnectWallet(userId: string, walletId: number): Promise<void>;

  // Activity Logs
  getActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(userId: string, log: Omit<InsertActivityLog, 'userId'>): Promise<ActivityLog>;
  clearOldLogs(userId: string, daysToKeep?: number): Promise<void>;

  // Telegram Messages
  getTelegramMessages(userId: string, limit?: number): Promise<TelegramMessage[]>;
  createTelegramMessage(userId: string, message: Omit<InsertTelegramMessage, 'userId'>): Promise<TelegramMessage>;

  // Open Positions
  getOpenPositions(userId: string): Promise<OpenPosition[]>;
  createOpenPosition(userId: string, position: Omit<InsertOpenPosition, 'userId'>): Promise<OpenPosition>;
  updateOpenPosition(userId: string, positionId: number, updates: Partial<OpenPosition>): Promise<OpenPosition>;
  closePosition(userId: string, positionId: number): Promise<void>;

  // Flash Loan Requests
  getFlashLoanRequests(userId: string, limit?: number): Promise<FlashLoanRequest[]>;
  createFlashLoanRequest(userId: string, request: Omit<InsertFlashLoanRequest, 'userId'>): Promise<FlashLoanRequest>;
  updateFlashLoanRequest(userId: string, requestId: number, updates: Partial<FlashLoanRequest>): Promise<FlashLoanRequest>;

  // Token Whitelist
  getTokenWhitelist(userId: string): Promise<TokenWhitelist[]>;
  addTokenToWhitelist(userId: string, token: Omit<InsertTokenWhitelist, 'userId'>): Promise<TokenWhitelist>;
  removeTokenFromWhitelist(userId: string, tokenId: number): Promise<void>;
  updateTokenWhitelist(userId: string, tokenId: number, updates: Partial<TokenWhitelist>): Promise<TokenWhitelist>;

  // Performance Metrics
  getPerformanceMetrics(userId: string, period?: string): Promise<PerformanceMetrics[]>;
  createPerformanceMetric(userId: string, metric: Omit<Partial<PerformanceMetrics>, 'id' | 'userId'>): Promise<PerformanceMetrics>;
  updatePerformanceMetric(userId: string, metricId: number, updates: Partial<PerformanceMetrics>): Promise<PerformanceMetrics>;

  // Alert Rules
  getAlertRules(userId: string): Promise<AlertRule[]>;
  createAlertRule(userId: string, rule: Omit<InsertAlertRule, 'userId'>): Promise<AlertRule>;
  updateAlertRule(userId: string, ruleId: number, updates: Partial<AlertRule>): Promise<AlertRule>;
  deleteAlertRule(userId: string, ruleId: number): Promise<void>;

  // Webhook Configs
  getWebhookConfigs(userId: string): Promise<WebhookConfig[]>;
  createWebhookConfig(userId: string, config: Omit<InsertWebhookConfig, 'userId'>): Promise<WebhookConfig>;
  updateWebhookConfig(userId: string, configId: number, updates: Partial<WebhookConfig>): Promise<WebhookConfig>;
  deleteWebhookConfig(userId: string, configId: number): Promise<void>;

  // Webhook Logs
  getWebhookLogs(userId: string, webhookConfigId?: number, limit?: number): Promise<WebhookLog[]>;
  createWebhookLog(userId: string, log: Omit<Partial<WebhookLog>, 'id' | 'userId'>): Promise<WebhookLog>;

  // Circuit Breaker Events
  getCircuitBreakerEvents(userId: string, resolved?: boolean, limit?: number): Promise<CircuitBreakerEvent[]>;
  createCircuitBreakerEvent(userId: string, event: Omit<InsertCircuitBreakerEvent, 'userId'>): Promise<CircuitBreakerEvent>;
  resolveCircuitBreakerEvent(userId: string, eventId: number, resolvedBy: string, notes?: string): Promise<CircuitBreakerEvent>;

  // Risk Limits Tracking
  getRiskLimitsTracking(userId: string): Promise<RiskLimitsTracking | undefined>;
  updateRiskLimitsTracking(userId: string, updates: Partial<RiskLimitsTracking>): Promise<RiskLimitsTracking>;
  resetDailyRiskLimits(userId: string): Promise<RiskLimitsTracking>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async upsertUser(insertUser: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: insertUser.firstName,
          lastName: insertUser.lastName,
          profileImageUrl: insertUser.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Bot Config
  async getBotConfig(userId: string): Promise<BotConfig | undefined> {
    const [config] = await db
      .select()
      .from(botConfig)
      .where(eq(botConfig.userId, userId))
      .limit(1);
    
    if (!config) {
      const [newConfig] = await db
        .insert(botConfig)
        .values({ userId })
        .returning();
      return newConfig;
    }
    
    return config;
  }

  async upsertBotConfig(userId: string, configData: Partial<InsertBotConfig>): Promise<BotConfig> {
    const existing = await this.getBotConfig(userId);
    
    if (existing) {
      const [updated] = await db
        .update(botConfig)
        .set({ ...configData, updatedAt: new Date() })
        .where(eq(botConfig.id, existing.id))
        .returning();
      return updated;
    }

    const [newConfig] = await db
      .insert(botConfig)
      .values({ ...configData, userId })
      .returning();
    return newConfig;
  }

  // Bot Status
  async getBotStatus(userId: string): Promise<BotStatus | undefined> {
    const [status] = await db
      .select()
      .from(botStatus)
      .where(eq(botStatus.userId, userId))
      .limit(1);
    
    if (!status) {
      const [newStatus] = await db
        .insert(botStatus)
        .values({ userId })
        .returning();
      return newStatus;
    }
    
    return status;
  }

  async updateBotStatus(userId: string, statusData: Partial<BotStatus>): Promise<BotStatus> {
    const existing = await this.getBotStatus(userId);
    
    if (existing) {
      const [updated] = await db
        .update(botStatus)
        .set({ ...statusData, updatedAt: new Date() })
        .where(eq(botStatus.id, existing.id))
        .returning();
      return updated;
    }

    const [newStatus] = await db
      .insert(botStatus)
      .values({ ...statusData, userId })
      .returning();
    return newStatus;
  }

  // Ledger Status
  async getLedgerStatus(userId: string): Promise<LedgerStatus | undefined> {
    const [status] = await db
      .select()
      .from(ledgerStatus)
      .where(eq(ledgerStatus.userId, userId))
      .limit(1);
    
    if (!status) {
      const [newStatus] = await db
        .insert(ledgerStatus)
        .values({ userId })
        .returning();
      return newStatus;
    }
    
    return status;
  }

  async updateLedgerStatus(userId: string, statusData: Partial<LedgerStatus>): Promise<LedgerStatus> {
    const existing = await this.getLedgerStatus(userId);
    
    if (existing) {
      const [updated] = await db
        .update(ledgerStatus)
        .set({ ...statusData, updatedAt: new Date() })
        .where(eq(ledgerStatus.id, existing.id))
        .returning();
      return updated;
    }

    const [newStatus] = await db
      .insert(ledgerStatus)
      .values({ ...statusData, userId })
      .returning();
    return newStatus;
  }

  // Safe Transactions
  async getSafeTransactions(userId: string): Promise<SafeTransaction[]> {
    const transactions = await db
      .select()
      .from(safeTransactions)
      .where(eq(safeTransactions.userId, userId))
      .orderBy(desc(safeTransactions.createdAt))
      .limit(100);
    return transactions;
  }

  async createSafeTransaction(
    userId: string, 
    transaction: Omit<InsertSafeTransaction, 'userId'>
  ): Promise<SafeTransaction> {
    const [newTransaction] = await db
      .insert(safeTransactions)
      .values({ ...transaction, userId })
      .returning();
    return newTransaction;
  }

  async updateSafeTransaction(
    safeTxHash: string,
    updates: Partial<SafeTransaction>
  ): Promise<SafeTransaction> {
    const [updated] = await db
      .update(safeTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(safeTransactions.safeTxHash, safeTxHash))
      .returning();
    return updated;
  }

  // Arbitrage Transactions
  async getArbitrageTransactions(userId: string, limit: number = 100): Promise<ArbitrageTransaction[]> {
    const transactions = await db
      .select()
      .from(arbitrageTransactions)
      .where(eq(arbitrageTransactions.userId, userId))
      .orderBy(desc(arbitrageTransactions.createdAt))
      .limit(limit);
    return transactions;
  }

  async createArbitrageTransaction(
    userId: string,
    transaction: Omit<Partial<ArbitrageTransaction>, 'id' | 'userId' | 'createdAt'>
  ): Promise<ArbitrageTransaction> {
    const txData: any = { ...transaction, userId };
    // Ensure required fields have defaults
    if (!txData.status) txData.status = 'PENDING';
    if (!txData.txHash) txData.txHash = '0x' + Math.random().toString(16).substring(2, 66);
    
    const [newTransaction] = await db
      .insert(arbitrageTransactions)
      .values(txData)
      .returning();
    return newTransaction;
  }

  // Connected Wallets
  async getConnectedWallets(userId: string): Promise<ConnectedWallet[]> {
    const wallets = await db
      .select()
      .from(connectedWallets)
      .where(eq(connectedWallets.userId, userId))
      .orderBy(desc(connectedWallets.lastConnectedAt));
    return wallets;
  }

  async connectWallet(
    userId: string,
    wallet: Omit<Partial<ConnectedWallet>, 'id' | 'userId'>
  ): Promise<ConnectedWallet> {
    // Check if wallet already exists
    const existing = await db
      .select()
      .from(connectedWallets)
      .where(eq(connectedWallets.address, wallet.address || ''))
      .limit(1);

    if (existing.length > 0) {
      // Update existing wallet
      const [updated] = await db
        .update(connectedWallets)
        .set({ 
          isConnected: true, 
          lastConnectedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(connectedWallets.id, existing[0].id))
        .returning();
      return updated;
    }

    // Create new wallet with required fields
    const walletData: any = { ...wallet, userId };
    if (!walletData.address) walletData.address = '';
    if (!walletData.walletType) walletData.walletType = 'unknown';
    if (!walletData.chainId) walletData.chainId = 137;
    
    const [newWallet] = await db
      .insert(connectedWallets)
      .values(walletData)
      .returning();
    return newWallet;
  }

  async disconnectWallet(userId: string, walletId: number): Promise<void> {
    await db
      .update(connectedWallets)
      .set({ isConnected: false, updatedAt: new Date() })
      .where(eq(connectedWallets.id, walletId));
  }

  // Activity Logs
  async getActivityLogs(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    return logs;
  }

  async createActivityLog(
    userId: string,
    log: Omit<InsertActivityLog, 'userId'>
  ): Promise<ActivityLog> {
    const [newLog] = await db
      .insert(activityLogs)
      .values({ ...log, userId })
      .returning();
    return newLog;
  }

  async clearOldLogs(userId: string, daysToKeep: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    await db
      .delete(activityLogs)
      .where(eq(activityLogs.userId, userId));
  }

  // Telegram Messages
  async getTelegramMessages(userId: string, limit: number = 50): Promise<TelegramMessage[]> {
    const messages = await db
      .select()
      .from(telegramMessages)
      .where(eq(telegramMessages.userId, userId))
      .orderBy(desc(telegramMessages.createdAt))
      .limit(limit);
    return messages;
  }

  async createTelegramMessage(
    userId: string,
    message: Omit<InsertTelegramMessage, 'userId'>
  ): Promise<TelegramMessage> {
    const [newMessage] = await db
      .insert(telegramMessages)
      .values({ ...message, userId })
      .returning();
    return newMessage;
  }

  // Open Positions
  async getOpenPositions(userId: string): Promise<OpenPosition[]> {
    const positions = await db
      .select()
      .from(openPositions)
      .where(eq(openPositions.userId, userId))
      .orderBy(desc(openPositions.openedAt));
    return positions;
  }

  async createOpenPosition(
    userId: string,
    position: Omit<InsertOpenPosition, 'userId'>
  ): Promise<OpenPosition> {
    const [newPosition] = await db
      .insert(openPositions)
      .values({ ...position, userId })
      .returning();
    return newPosition;
  }

  async updateOpenPosition(
    userId: string,
    positionId: number,
    updates: Partial<OpenPosition>
  ): Promise<OpenPosition> {
    const [updated] = await db
      .update(openPositions)
      .set({ ...updates, lastUpdatedAt: new Date() })
      .where(eq(openPositions.id, positionId))
      .returning();
    return updated;
  }

  async closePosition(userId: string, positionId: number): Promise<void> {
    await db
      .update(openPositions)
      .set({ 
        status: 'CLOSED', 
        closedAt: new Date(),
        lastUpdatedAt: new Date() 
      })
      .where(eq(openPositions.id, positionId));
  }

  // Flash Loan Requests
  async getFlashLoanRequests(userId: string, limit: number = 50): Promise<FlashLoanRequest[]> {
    const requests = await db
      .select()
      .from(flashLoanRequests)
      .where(eq(flashLoanRequests.userId, userId))
      .orderBy(desc(flashLoanRequests.createdAt))
      .limit(limit);
    return requests;
  }

  async createFlashLoanRequest(
    userId: string,
    request: Omit<InsertFlashLoanRequest, 'userId'>
  ): Promise<FlashLoanRequest> {
    const [newRequest] = await db
      .insert(flashLoanRequests)
      .values({ ...request, userId })
      .returning();
    return newRequest;
  }

  async updateFlashLoanRequest(
    userId: string,
    requestId: number,
    updates: Partial<FlashLoanRequest>
  ): Promise<FlashLoanRequest> {
    const [updated] = await db
      .update(flashLoanRequests)
      .set(updates)
      .where(eq(flashLoanRequests.id, requestId))
      .returning();
    return updated;
  }

  // Token Whitelist
  async getTokenWhitelist(userId: string): Promise<TokenWhitelist[]> {
    const tokens = await db
      .select()
      .from(tokenWhitelist)
      .where(eq(tokenWhitelist.userId, userId))
      .orderBy(desc(tokenWhitelist.addedAt));
    return tokens;
  }

  async addTokenToWhitelist(
    userId: string,
    token: Omit<InsertTokenWhitelist, 'userId'>
  ): Promise<TokenWhitelist> {
    const [newToken] = await db
      .insert(tokenWhitelist)
      .values({ ...token, userId })
      .returning();
    return newToken;
  }

  async removeTokenFromWhitelist(userId: string, tokenId: number): Promise<void> {
    await db
      .delete(tokenWhitelist)
      .where(eq(tokenWhitelist.id, tokenId));
  }

  async updateTokenWhitelist(
    userId: string,
    tokenId: number,
    updates: Partial<TokenWhitelist>
  ): Promise<TokenWhitelist> {
    const [updated] = await db
      .update(tokenWhitelist)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tokenWhitelist.id, tokenId))
      .returning();
    return updated;
  }

  // Performance Metrics
  async getPerformanceMetrics(userId: string, period?: string): Promise<PerformanceMetrics[]> {
    let query = db.select().from(performanceMetrics).where(eq(performanceMetrics.userId, userId));
    
    if (period) {
      query = query.where(eq(performanceMetrics.period, period));
    }
    
    const metrics = await query.orderBy(desc(performanceMetrics.periodStart));
    return metrics;
  }

  async createPerformanceMetric(
    userId: string,
    metric: Omit<Partial<PerformanceMetrics>, 'id' | 'userId'>
  ): Promise<PerformanceMetrics> {
    const [newMetric] = await db
      .insert(performanceMetrics)
      .values({ ...metric, userId })
      .returning();
    return newMetric;
  }

  async updatePerformanceMetric(
    userId: string,
    metricId: number,
    updates: Partial<PerformanceMetrics>
  ): Promise<PerformanceMetrics> {
    const [updated] = await db
      .update(performanceMetrics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(performanceMetrics.id, metricId))
      .returning();
    return updated;
  }

  // Alert Rules
  async getAlertRules(userId: string): Promise<AlertRule[]> {
    const rules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.userId, userId))
      .orderBy(desc(alertRules.createdAt));
    return rules;
  }

  async createAlertRule(
    userId: string,
    rule: Omit<InsertAlertRule, 'userId'>
  ): Promise<AlertRule> {
    const [newRule] = await db
      .insert(alertRules)
      .values({ ...rule, userId })
      .returning();
    return newRule;
  }

  async updateAlertRule(
    userId: string,
    ruleId: number,
    updates: Partial<AlertRule>
  ): Promise<AlertRule> {
    const [updated] = await db
      .update(alertRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(alertRules.id, ruleId))
      .returning();
    return updated;
  }

  async deleteAlertRule(userId: string, ruleId: number): Promise<void> {
    await db
      .delete(alertRules)
      .where(eq(alertRules.id, ruleId));
  }

  // Webhook Configs
  async getWebhookConfigs(userId: string): Promise<WebhookConfig[]> {
    const configs = await db
      .select()
      .from(webhookConfigs)
      .where(eq(webhookConfigs.userId, userId))
      .orderBy(desc(webhookConfigs.createdAt));
    return configs;
  }

  async createWebhookConfig(
    userId: string,
    config: Omit<InsertWebhookConfig, 'userId'>
  ): Promise<WebhookConfig> {
    const [newConfig] = await db
      .insert(webhookConfigs)
      .values({ ...config, userId })
      .returning();
    return newConfig;
  }

  async updateWebhookConfig(
    userId: string,
    configId: number,
    updates: Partial<WebhookConfig>
  ): Promise<WebhookConfig> {
    const [updated] = await db
      .update(webhookConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhookConfigs.id, configId))
      .returning();
    return updated;
  }

  async deleteWebhookConfig(userId: string, configId: number): Promise<void> {
    await db
      .delete(webhookConfigs)
      .where(eq(webhookConfigs.id, configId));
  }

  // Webhook Logs
  async getWebhookLogs(
    userId: string,
    webhookConfigId?: number,
    limit: number = 100
  ): Promise<WebhookLog[]> {
    let query = db.select().from(webhookLogs).where(eq(webhookLogs.userId, userId));
    
    if (webhookConfigId) {
      query = query.where(eq(webhookLogs.webhookConfigId, webhookConfigId));
    }
    
    const logs = await query
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit);
    return logs;
  }

  async createWebhookLog(
    userId: string,
    log: Omit<Partial<WebhookLog>, 'id' | 'userId'>
  ): Promise<WebhookLog> {
    const [newLog] = await db
      .insert(webhookLogs)
      .values({ ...log, userId })
      .returning();
    return newLog;
  }

  // Circuit Breaker Events
  async getCircuitBreakerEvents(
    userId: string,
    resolved?: boolean,
    limit: number = 50
  ): Promise<CircuitBreakerEvent[]> {
    let query = db.select().from(circuitBreakerEvents).where(eq(circuitBreakerEvents.userId, userId));
    
    if (resolved !== undefined) {
      query = query.where(eq(circuitBreakerEvents.resolved, resolved));
    }
    
    const events = await query
      .orderBy(desc(circuitBreakerEvents.createdAt))
      .limit(limit);
    return events;
  }

  async createCircuitBreakerEvent(
    userId: string,
    event: Omit<InsertCircuitBreakerEvent, 'userId'>
  ): Promise<CircuitBreakerEvent> {
    const [newEvent] = await db
      .insert(circuitBreakerEvents)
      .values({ ...event, userId })
      .returning();
    return newEvent;
  }

  async resolveCircuitBreakerEvent(
    userId: string,
    eventId: number,
    resolvedBy: string,
    notes?: string
  ): Promise<CircuitBreakerEvent> {
    const [resolved] = await db
      .update(circuitBreakerEvents)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes: notes || null,
      })
      .where(eq(circuitBreakerEvents.id, eventId))
      .returning();
    return resolved;
  }

  // Risk Limits Tracking
  async getRiskLimitsTracking(userId: string): Promise<RiskLimitsTracking | undefined> {
    const [tracking] = await db
      .select()
      .from(riskLimitsTracking)
      .where(eq(riskLimitsTracking.userId, userId))
      .limit(1);
    
    if (!tracking) {
      // Get limits from config
      const config = await this.getBotConfig(userId);
      
      // Create initial tracking record
      const [newTracking] = await db
        .insert(riskLimitsTracking)
        .values({
          userId,
          dailyLossLimit: config?.dailyLossLimit || "500.0",
          maxPositionSizeUsd: config?.maxLoanUsd ? config.maxLoanUsd.toString() : "50000.0",
          maxSingleLossUsd: config?.maxSingleLossUsd || "100.0",
        })
        .returning();
      return newTracking;
    }
    
    return tracking;
  }

  async updateRiskLimitsTracking(
    userId: string,
    updates: Partial<RiskLimitsTracking>
  ): Promise<RiskLimitsTracking> {
    const existing = await this.getRiskLimitsTracking(userId);
    
    if (!existing) {
      throw new Error('Risk limits tracking not found');
    }
    
    const [updated] = await db
      .update(riskLimitsTracking)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(riskLimitsTracking.id, existing.id))
      .returning();
    return updated;
  }

  async resetDailyRiskLimits(userId: string): Promise<RiskLimitsTracking> {
    const existing = await this.getRiskLimitsTracking(userId);
    
    if (!existing) {
      throw new Error('Risk limits tracking not found');
    }
    
    const [reset] = await db
      .update(riskLimitsTracking)
      .set({
        dailyLossUsd: "0.0",
        dailyProfitUsd: "0.0",
        dailyTradeCount: 0,
        dailyGasUsedUsd: "0.0",
        dailyLossUtilization: "0.0",
        largestPositionUtilization: "0.0",
        lastResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(riskLimitsTracking.id, existing.id))
      .returning();
    return reset;
  }
}

export const storage = new DatabaseStorage();
