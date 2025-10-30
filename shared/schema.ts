import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Bot Configuration - все переменные окружения хранятся в БД
export const botConfig = pgTable("bot_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Network & RPC
  networkMode: varchar("network_mode", { length: 20 }).notNull().default("testnet"),
  polygonRpcUrl: text("polygon_rpc_url").notNull().default("https://polygon-rpc.com"),
  polygonTestnetRpcUrl: text("polygon_testnet_rpc_url").notNull().default("https://rpc.ankr.com/polygon_amoy"),

  // Wallets (encrypted)
  privateKey: text("private_key"),
  safeSigner2Key: text("safe_signer2_key"),

  // Trading Parameters
  minProfitPercent: numeric("min_profit_percent", { precision: 10, scale: 2 }).default("0.3"),
  minNetProfitPercent: numeric("min_net_profit_percent", { precision: 10, scale: 2 }).default("0.15"),
  flashLoanAmount: integer("flash_loan_amount").default(10000),
  scanInterval: integer("scan_interval").default(30),

  // Contracts
  flashLoanContract: text("flash_loan_contract"),

  // API Keys
  oneinchApiKey: varchar("oneinch_api_key", { length: 255 }),
  privateKey: varchar("private_key", { length: 255 }),
  polygonscanApiKey: varchar("polygonscan_api_key", { length: 255 }),
  geckoTerminalEnabled: boolean("gecko_terminal_enabled").default(true),
  geckoTerminalRateLimit: integer("gecko_terminal_rate_limit").default(30),
  quickswapRateLimit: integer("quickswap_rate_limit").default(1000),

  // Telegram
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),

  // Real Money Trading
  maxLoanUsd: integer("max_loan_usd").default(50000),
  dailyLossLimit: numeric("daily_loss_limit", { precision: 10, scale: 2 }).default("500.0"),
  maxSingleLossUsd: numeric("max_single_loss_usd", { precision: 10, scale: 2 }).default("100.0"),
  insuranceWalletAddress: text("insurance_wallet_address"),
  insuranceFundPercent: numeric("insurance_fund_percent", { precision: 5, scale: 2 }).default("5.0"),

  // Gas Settings
  maxGasPriceGwei: integer("max_gas_price_gwei").default(60),
  priorityFeeGwei: numeric("priority_fee_gwei", { precision: 5, scale: 2 }).default("1.5"),
  minNetProfitUsd: numeric("min_net_profit_usd", { precision: 10, scale: 2 }).default("1.5"),
  baseFeeMultiplier: numeric("base_fee_multiplier", { precision: 5, scale: 3 }).default("1.125"),
  maxGasLimit: integer("max_gas_limit").default(1500000),

  // Retry & Limits
  maxRetryAttempts: integer("max_retry_attempts").default(3),
  retryDelaySeconds: integer("retry_delay_seconds").default(5),
  liquidityMultiplier: integer("liquidity_multiplier").default(5),
  dexReserveMultiplier: integer("dex_reserve_multiplier").default(10),
  staticSlippagePercent: numeric("static_slippage_percent", { precision: 5, scale: 2 }).default("0.5"),

  // Safety & Emergency
  emergencyPauseDrawdownPercent: numeric("emergency_pause_drawdown_percent", { precision: 5, scale: 2 }).default("1.0"),
  autoPauseEnabled: boolean("auto_pause_enabled").default(true),
  enableRealTrading: boolean("enable_real_trading").default(false),
  useSimulation: boolean("use_simulation").default(true),

  // Rate Limits
  oneinchRateLimit: integer("oneinch_rate_limit").default(150),

  // Telegram Thresholds
  telegramProfitThresholdUsd: numeric("telegram_profit_threshold_usd", { precision: 10, scale: 2 }).default("10.0"),
  telegramFailedTxSummaryIntervalMinutes: integer("telegram_failed_tx_summary_interval_minutes").default(30),

  // Gnosis Safe Configuration
  gnosisSafeAddress: text("gnosis_safe_address"),
  safeAutoSignEnabled: boolean("safe_auto_sign_enabled").default(true),
  safeRetryIntervalMinutes: integer("safe_retry_interval_minutes").default(30),
  safeMaxPendingHours: integer("safe_max_pending_hours").default(24),

  // Ledger Configuration
  ledgerEnabled: boolean("ledger_enabled").default(false),
  ledgerTimeoutSeconds: integer("ledger_timeout_seconds").default(10),
  ledgerTelegramFallback: boolean("ledger_telegram_fallback").default(true),
  ledgerBatteryCheckEnabled: boolean("ledger_battery_check_enabled").default(true),
  ledgerLowBatteryThreshold: integer("ledger_low_battery_threshold").default(20),
  ledgerDerivationPath: varchar("ledger_derivation_path", { length: 50 }).default("44'/60'/0'/0/0"),
  ledgerCriticalBatteryThreshold: integer("ledger_critical_battery_threshold").default(10),
  ledgerRejectOnCriticalBattery: boolean("ledger_reject_on_critical_battery").default(true),
  useLedgerForSafeSigner2: boolean("use_ledger_for_safe_signer2").default(false),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBotConfigSchema = createInsertSchema(botConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type BotConfig = typeof botConfig.$inferSelect;

// Bot Status - текущее состояние бота
export const botStatus = pgTable("bot_status", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Status
  isRunning: boolean("is_running").notNull().default(false),
  isPaused: boolean("is_paused").notNull().default(false),
  pauseReason: text("pause_reason"),

  // Metrics
  totalProfitUsd: numeric("total_profit_usd", { precision: 15, scale: 2 }).default("0.0"),
  successRate: numeric("success_rate", { precision: 5, scale: 2 }).default("0.0"),
  activeOpportunities: integer("active_opportunities").default(0),
  gasCostUsd: numeric("gas_cost_usd", { precision: 15, scale: 2 }).default("0.0"),
  net24hUsd: numeric("net_24h_usd", { precision: 15, scale: 2 }).default("0.0"),
  insuranceFundUsd: numeric("insurance_fund_usd", { precision: 15, scale: 2 }).default("0.0"),

  lastStartedAt: timestamp("last_started_at"),
  lastStoppedAt: timestamp("last_stopped_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type BotStatus = typeof botStatus.$inferSelect;

// Ledger Device Status
export const ledgerStatus = pgTable("ledger_status", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  connected: boolean("connected").notNull().default(false),
  deviceModel: varchar("device_model", { length: 100 }),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  batteryLevel: integer("battery_level"),
  address: text("address"),

  lastConnectedAt: timestamp("last_connected_at"),
  lastBatteryCheck: timestamp("last_battery_check"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type LedgerStatus = typeof ledgerStatus.$inferSelect;

// Safe Multisig Transactions
export const safeTransactions = pgTable("safe_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  safeTxHash: text("safe_tx_hash").notNull().unique(),
  to: text("to").notNull(),
  value: text("value").notNull(),
  data: text("data"),
  operation: integer("operation").default(0),
  nonce: integer("nonce").notNull(),

  status: varchar("status", { length: 50 }).notNull().default("PENDING"),
  confirmations: integer("confirmations").default(0),
  requiredConfirmations: integer("required_confirmations").default(2),

  executedTxHash: text("executed_tx_hash"),
  executedAt: timestamp("executed_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSafeTransactionSchema = createInsertSchema(safeTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSafeTransaction = z.infer<typeof insertSafeTransactionSchema>;
export type SafeTransaction = typeof safeTransactions.$inferSelect;

// Arbitrage Transactions History
export const arbitrageTransactions = pgTable("arbitrage_transactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  txHash: text("tx_hash").notNull().unique(),
  tokenIn: varchar("token_in", { length: 100 }),
  tokenOut: varchar("token_out", { length: 100 }),
  amountIn: text("amount_in"),
  amountOut: text("amount_out"),
  profitUsd: numeric("profit_usd", { precision: 15, scale: 2 }),
  gasCostUsd: numeric("gas_cost_usd", { precision: 15, scale: 2 }),
  netProfitUsd: numeric("net_profit_usd", { precision: 15, scale: 2 }),

  status: varchar("status", { length: 50 }).notNull(),

  dexPath: text("dex_path"),

  createdAt: timestamp("created_at").defaultNow(),
});

export type ArbitrageTransaction = typeof arbitrageTransactions.$inferSelect;

// Connected Wallets (MetaMask, etc)
export const connectedWallets = pgTable("connected_wallets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  address: text("address").notNull(),
  walletType: varchar("wallet_type", { length: 50 }).notNull(),
  chainId: integer("chain_id").notNull(),
  isConnected: boolean("is_connected").notNull().default(true),

  lastConnectedAt: timestamp("last_connected_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ConnectedWallet = typeof connectedWallets.$inferSelect;

// Activity Logs - Real-time system activity tracking
export const activityLogs = pgTable("activity_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  type: varchar("type", { length: 50 }).notNull(), // 'swap', 'wallet_connect', 'trade', 'config_update', etc
  level: varchar("level", { length: 20 }).notNull().default("info"), // 'info', 'warning', 'error', 'success'
  message: text("message").notNull(),

  metadata: jsonb("metadata"), // Additional data like transaction hash, amounts, etc

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Telegram Messages History - для отслеживания всех отправленных сообщений
export const telegramMessages = pgTable("telegram_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  message: text("message").notNull(),
  messageType: varchar("message_type", { length: 50 }).notNull().default("notification"), // 'notification', 'alert', 'trade', 'error'
  success: boolean("success").notNull().default(true),
  error: text("error"),

  metadata: jsonb("metadata"), // Дополнительные данные (profit, txHash, и т.д.)

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTelegramMessageSchema = createInsertSchema(telegramMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertTelegramMessage = z.infer<typeof insertTelegramMessageSchema>;
export type TelegramMessage = typeof telegramMessages.$inferSelect;

// Open Positions - активные позиции с расчетом unrealized P&L
export const openPositions = pgTable("open_positions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Position details
  tokenIn: varchar("token_in", { length: 100 }).notNull(),
  tokenOut: varchar("token_out", { length: 100 }).notNull(),
  amountIn: text("amount_in").notNull(),
  entryPriceUsd: numeric("entry_price_usd", { precision: 15, scale: 6 }).notNull(),

  // Flash loan details
  flashLoanAmount: text("flash_loan_amount"),
  flashLoanProvider: varchar("flash_loan_provider", { length: 50 }), // 'aave', 'balancer'

  // DEX path
  dexPath: text("dex_path"),

  // Current state (calculated)
  currentPriceUsd: numeric("current_price_usd", { precision: 15, scale: 6 }),
  unrealizedProfitUsd: numeric("unrealized_profit_usd", { precision: 15, scale: 2 }),
  unrealizedProfitPercent: numeric("unrealized_profit_percent", { precision: 10, scale: 2 }),

  // Status
  status: varchar("status", { length: 50 }).notNull().default("OPEN"), // 'OPEN', 'CLOSING', 'CLOSED'

  // Timestamps
  openedAt: timestamp("opened_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertOpenPositionSchema = createInsertSchema(openPositions).omit({
  id: true,
  openedAt: true,
  lastUpdatedAt: true,
});
export type InsertOpenPosition = z.infer<typeof insertOpenPositionSchema>;
export type OpenPosition = typeof openPositions.$inferSelect;

// Aave Flash Loan Requests - история flash loan запросов
export const flashLoanRequests = pgTable("flash_loan_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Loan details
  token: varchar("token", { length: 100 }).notNull(),
  amount: text("amount").notNull(),
  provider: varchar("provider", { length: 50 }).notNull().default("aave_v3"), // 'aave_v3', 'balancer'

  // Transaction info
  txHash: text("tx_hash"),
  status: varchar("status", { length: 50 }).notNull().default("PENDING"), // 'PENDING', 'SUCCESS', 'FAILED'

  // Results
  premium: text("premium"), // Flash loan fee
  profitUsd: numeric("profit_usd", { precision: 15, scale: 2 }),
  gasCostUsd: numeric("gas_cost_usd", { precision: 15, scale: 2 }),

  error: text("error"),

  createdAt: timestamp("created_at").defaultNow(),
  executedAt: timestamp("executed_at"),
});

export const insertFlashLoanRequestSchema = createInsertSchema(flashLoanRequests).omit({
  id: true,
  createdAt: true,
});
export type InsertFlashLoanRequest = z.infer<typeof insertFlashLoanRequestSchema>;
export type FlashLoanRequest = typeof flashLoanRequests.$inferSelect;

// Token Whitelist - список разрешенных токенов для торговли
export const tokenWhitelist = pgTable("token_whitelist", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Token info
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(),
  tokenName: varchar("token_name", { length: 100 }),
  decimals: integer("decimals").default(18),
  chainId: integer("chain_id").notNull().default(80002), // Polygon Amoy testnet

  // Status
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  addedAt: timestamp("added_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTokenWhitelistSchema = createInsertSchema(tokenWhitelist).omit({
  id: true,
  addedAt: true,
  updatedAt: true,
});
export type InsertTokenWhitelist = z.infer<typeof insertTokenWhitelistSchema>;
export type TokenWhitelist = typeof tokenWhitelist.$inferSelect;

// Performance Metrics - детальная статистика и риск-метрики
export const performanceMetrics = pgTable("performance_metrics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Time period
  period: varchar("period", { length: 20 }).notNull().default("daily"), // 'daily', 'weekly', 'monthly', 'all_time'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end"),

  // Performance metrics
  totalTrades: integer("total_trades").default(0),
  successfulTrades: integer("successful_trades").default(0),
  failedTrades: integer("failed_trades").default(0),
  winRate: numeric("win_rate", { precision: 5, scale: 2 }).default("0.0"), // percentage

  // P&L metrics
  totalProfitUsd: numeric("total_profit_usd", { precision: 15, scale: 2 }).default("0.0"),
  totalLossUsd: numeric("total_loss_usd", { precision: 15, scale: 2 }).default("0.0"),
  netProfitUsd: numeric("net_profit_usd", { precision: 15, scale: 2 }).default("0.0"),
  averageProfitUsd: numeric("average_profit_usd", { precision: 15, scale: 2 }).default("0.0"),
  averageLossUsd: numeric("average_loss_usd", { precision: 15, scale: 2 }).default("0.0"),

  // Risk metrics
  sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 4 }), // Risk-adjusted return
  maxDrawdownUsd: numeric("max_drawdown_usd", { precision: 15, scale: 2 }).default("0.0"),
  maxDrawdownPercent: numeric("max_drawdown_percent", { precision: 10, scale: 2 }).default("0.0"),
  volatility: numeric("volatility", { precision: 10, scale: 4 }), // Standard deviation of returns

  // Gas metrics
  totalGasCostUsd: numeric("total_gas_cost_usd", { precision: 15, scale: 2 }).default("0.0"),
  averageGasCostUsd: numeric("average_gas_cost_usd", { precision: 15, scale: 2 }).default("0.0"),

  // Additional metrics
  largestWinUsd: numeric("largest_win_usd", { precision: 15, scale: 2 }).default("0.0"),
  largestLossUsd: numeric("largest_loss_usd", { precision: 15, scale: 2 }).default("0.0"),
  profitFactor: numeric("profit_factor", { precision: 10, scale: 2 }), // Gross profit / Gross loss

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PerformanceMetrics = typeof performanceMetrics.$inferSelect;

// Alert Rules - настраиваемые правила для алертов
export const alertRules = pgTable("alert_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Rule info
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),

  // Condition
  conditionType: varchar("condition_type", { length: 50 }).notNull(), // 'profit_above', 'loss_above', 'gas_above', 'win_rate_below', etc.
  conditionValue: numeric("condition_value", { precision: 15, scale: 2 }).notNull(),
  conditionOperator: varchar("condition_operator", { length: 20 }).notNull().default("greater_than"), // 'greater_than', 'less_than', 'equals'

  // Action
  actionType: varchar("action_type", { length: 50 }).notNull(), // 'telegram', 'webhook', 'auto_pause', 'email'
  actionConfig: jsonb("action_config"), // Configuration for the action (webhook URL, message template, etc.)

  // Metadata
  triggerCount: integer("trigger_count").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  triggerCount: true,
  lastTriggeredAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

// Webhook Configurations - настройки webhook endpoints
export const webhookConfigs = pgTable("webhook_configs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Webhook info
  name: varchar("name", { length: 100 }).notNull(),
  url: text("url").notNull(),
  secret: text("secret"), // Optional webhook secret for signature verification
  isActive: boolean("is_active").notNull().default(true),

  // Events to subscribe to
  events: jsonb("events").notNull(), // Array of event types: ['trade_success', 'trade_failed', 'bot_paused', etc.]

  // Headers (optional)
  headers: jsonb("headers"), // Custom HTTP headers

  // Retry configuration
  retryEnabled: boolean("retry_enabled").default(true),
  maxRetries: integer("max_retries").default(3),
  retryDelaySeconds: integer("retry_delay_seconds").default(5),

  // Statistics
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  lastCalledAt: timestamp("last_called_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWebhookConfigSchema = createInsertSchema(webhookConfigs).omit({
  id: true,
  totalCalls: true,
  successfulCalls: true,
  failedCalls: true,
  lastCalledAt: true,
  lastSuccessAt: true,
  lastErrorAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWebhookConfig = z.infer<typeof insertWebhookConfigSchema>;
export type WebhookConfig = typeof webhookConfigs.$inferSelect;

// Webhook Logs - история вызовов webhook
export const webhookLogs = pgTable("webhook_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  webhookConfigId: integer("webhook_config_id").references(() => webhookConfigs.id, { onDelete: "cascade" }),

  // Call info
  eventType: varchar("event_type", { length: 50 }).notNull(),
  url: text("url").notNull(),
  method: varchar("method", { length: 10 }).default("POST"),

  // Request
  requestBody: jsonb("request_body"),
  requestHeaders: jsonb("request_headers"),

  // Response
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  responseTime: integer("response_time"), // milliseconds

  // Result
  success: boolean("success").notNull(),
  error: text("error"),
  retryAttempt: integer("retry_attempt").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;

// Circuit Breaker Events - история автоматических остановок
export const circuitBreakerEvents = pgTable("circuit_breaker_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Event type
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'daily_loss_limit', 'max_drawdown', 'consecutive_failures', 'gas_spike', etc.
  severity: varchar("severity", { length: 20 }).notNull().default("warning"), // 'info', 'warning', 'critical'

  // Trigger details
  triggerValue: numeric("trigger_value", { precision: 15, scale: 2 }),
  thresholdValue: numeric("threshold_value", { precision: 15, scale: 2 }),
  description: text("description").notNull(),

  // Action taken
  actionTaken: varchar("action_taken", { length: 50 }).notNull(), // 'auto_paused', 'alert_sent', 'manual_intervention_required'
  autoPaused: boolean("auto_paused").default(false),

  // Resolution
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 50 }), // 'auto', 'manual', 'user'
  resolutionNotes: text("resolution_notes"),

  // Metadata
  metadata: jsonb("metadata"), // Additional context data

  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCircuitBreakerEventSchema = createInsertSchema(circuitBreakerEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertCircuitBreakerEvent = z.infer<typeof insertCircuitBreakerEventSchema>;
export type CircuitBreakerEvent = typeof circuitBreakerEvents.$inferSelect;

// Risk Limits Tracking - детальный трекинг использования лимитов в реальном времени
export const riskLimitsTracking = pgTable("risk_limits_tracking", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Current daily metrics
  dailyLossUsd: numeric("daily_loss_usd", { precision: 15, scale: 2 }).default("0.0"),
  dailyProfitUsd: numeric("daily_profit_usd", { precision: 15, scale: 2 }).default("0.0"),
  dailyTradeCount: integer("daily_trade_count").default(0),
  dailyGasUsedUsd: numeric("daily_gas_used_usd", { precision: 15, scale: 2 }).default("0.0"),

  // Limits from config (cached for quick comparison)
  dailyLossLimit: numeric("daily_loss_limit", { precision: 15, scale: 2 }),
  maxPositionSizeUsd: numeric("max_position_size_usd", { precision: 15, scale: 2 }),
  maxSingleLossUsd: numeric("max_single_loss_usd", { precision: 15, scale: 2 }),

  // Utilization percentages
  dailyLossUtilization: numeric("daily_loss_utilization", { precision: 5, scale: 2 }).default("0.0"), // percentage
  largestPositionUtilization: numeric("largest_position_utilization", { precision: 5, scale: 2 }).default("0.0"),

  // Last reset
  lastResetAt: timestamp("last_reset_at").defaultNow(),

  updatedAt: timestamp("updated_at").defaultNow(),
});

export type RiskLimitsTracking = typeof riskLimitsTracking.$inferSelect;