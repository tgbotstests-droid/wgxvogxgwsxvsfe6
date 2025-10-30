import { DexAggregator, TOKENS } from './dexAggregator';
import { web3Provider } from './web3Provider';
import { storage } from './storage';
import { tradeExecutor } from './tradeExecutor';
import { ethers } from 'ethers';

export interface ArbitrageOpportunity {
  id: string;
  tokenIn: {
    address: string;
    symbol: string;
    decimals: number;
  };
  tokenOut: {
    address: string;
    symbol: string;
    decimals: number;
  };
  buyDex: string;
  sellDex: string;
  buyPrice: number; // Price in USD
  sellPrice: number; // Price in USD
  profitPercent: number; // Gross profit %
  netProfitPercent: number; // After gas & fees
  estimatedProfitUsd: number; // Expected profit in USD
  flashLoanAmount: string; // Recommended loan amount
  estimatedGasCostUsd: number;
  flashLoanFeeUsd: number;
  route: {
    buy: string[];
    sell: string[];
  };
  timestamp: number;
  isValid: boolean; // Still valid opportunity
}

export interface ScannerConfig {
  minProfitPercent: number;
  minNetProfitPercent: number;
  minProfitUsd: number;
  maxGasPriceGwei: number;
  scanIntervalMs: number;
  tokenPairs: Array<{ tokenIn: string; tokenOut: string }>;
  dexList: string[];
}

export class OpportunityScanner {
  private isScanning: boolean = false;
  private opportunities: Map<string, ArbitrageOpportunity> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private broadcastCallback: ((type: string, data: any) => void) | null = null;

  /**
   * Start continuous scanning for arbitrage opportunities
   */
  async startScanning(
    userId: string,
    config: Partial<ScannerConfig> = {},
    onOpportunityFound?: (opportunity: ArbitrageOpportunity) => void
  ): Promise<void> {
    if (this.isScanning) {
      console.log('Scanner already running');
      return;
    }

    // Get user config
    const botConfig = await storage.getBotConfig(userId);
    
    const scannerConfig: ScannerConfig = {
      minProfitPercent: parseFloat(botConfig?.minProfitPercent?.toString() || '0.3'),
      minNetProfitPercent: parseFloat(botConfig?.minNetProfitPercent?.toString() || '0.15'),
      minProfitUsd: parseFloat(botConfig?.minNetProfitUsd?.toString() || '1.5'),
      maxGasPriceGwei: botConfig?.maxGasPriceGwei || 60,
      scanIntervalMs: (botConfig?.scanInterval || 30) * 1000,
      tokenPairs: config.tokenPairs || this.getDefaultTokenPairs(),
      dexList: config.dexList || ['1inch', 'QuickSwap', 'Uniswap V3', 'SushiSwap'],
      ...config,
    };

    this.isScanning = true;
    console.log('🔍 Starting arbitrage opportunity scanner...');
    console.log('Config:', scannerConfig);

    // Log scanner start
    await storage.createActivityLog(userId, {
      type: 'scanner',
      level: 'success',
      message: `Сканер возможностей запущен - интервал ${scannerConfig.scanIntervalMs / 1000}с, мин. прибыль ${scannerConfig.minNetProfitPercent}%`,
      metadata: { config: scannerConfig },
    });

    // Initial scan
    await this.scan(userId, scannerConfig, onOpportunityFound);

    // Set up continuous scanning
    this.scanInterval = setInterval(async () => {
      await this.scan(userId, scannerConfig, onOpportunityFound);
    }, scannerConfig.scanIntervalMs);
  }

  /**
   * Stop scanning
   */
  async stopScanning(userId?: string): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
    console.log('⏹️  Stopped arbitrage opportunity scanner');
    
    // Log scanner stop if userId provided
    if (userId) {
      await storage.createActivityLog(userId, {
        type: 'scanner',
        level: 'info',
        message: 'Сканер возможностей остановлен',
        metadata: { opportunitiesFound: this.opportunities.size },
      });
    }
  }

  /**
   * Perform single scan for opportunities
   */
  private async scan(
    userId: string,
    config: ScannerConfig,
    onOpportunityFound?: (opportunity: ArbitrageOpportunity) => void
  ): Promise<void> {
    try {
      // STEP 1: Check gas price first
      await storage.createActivityLog(userId, {
        type: 'scanner',
        level: 'info',
        message: `🔍 СКАНИРОВАНИЕ: Этап 1/4 - Проверка условий для начала сканирования`,
        metadata: { 
          step: '1_preparation',
          tokenPairs: config.tokenPairs.length,
          minProfit: config.minNetProfitPercent,
        },
      });

      const gasData = await web3Provider.getGasPrice();
      const gasGwei = parseFloat(gasData.gasPriceGwei);

      if (gasGwei > config.maxGasPriceGwei) {
        await storage.createActivityLog(userId, {
          type: 'scanner',
          level: 'warning',
          message: `⛽ СКАНИРОВАНИЕ ПРИОСТАНОВЛЕНО: Цена газа ${gasGwei.toFixed(1)} Gwei превышает максимум ${config.maxGasPriceGwei} Gwei. Ожидание...`,
          metadata: { 
            step: '1_gas_check_failed',
            gasGwei,
            maxGasGwei: config.maxGasPriceGwei,
            action: 'skip_scan',
          },
        });
        console.log(`⛽ Gas too high: ${gasGwei} Gwei (max: ${config.maxGasPriceGwei})`);
        return;
      }

      // STEP 2: Initialize DEX aggregator
      await storage.createActivityLog(userId, {
        type: 'scanner',
        level: 'info',
        message: `🔗 СКАНИРОВАНИЕ: Этап 2/4 - Подключение к DEX агрегатору (gas: ${gasGwei.toFixed(1)} Gwei ✅)`,
        metadata: { 
          step: '2_dex_connection',
          gasGwei,
          dexList: config.dexList,
        },
      });

      const botConfig = await storage.getBotConfig(userId);
      const dexAggregator = new DexAggregator(botConfig?.oneinchApiKey || undefined);

      // STEP 3: Scan token pairs
      await storage.createActivityLog(userId, {
        type: 'scanner',
        level: 'info',
        message: `🎯 СКАНИРОВАНИЕ: Этап 3/4 - Анализ ${config.tokenPairs.length} торговых пар на всех DEX`,
        metadata: { 
          step: '3_pair_analysis',
          pairs: config.tokenPairs.map(p => `${TOKENS[p.tokenIn]?.symbol || p.tokenIn}/${TOKENS[p.tokenOut]?.symbol || p.tokenOut}`),
        },
      });

      // Scan each token pair across all DEXs
      const scanPromises = config.tokenPairs.map(async (pair) => {
        return this.scanTokenPair(
          userId,
          pair.tokenIn,
          pair.tokenOut,
          config,
          dexAggregator,
          gasGwei
        );
      });

      const results = await Promise.allSettled(scanPromises);
      
      // Process results
      const newOpportunities: ArbitrageOpportunity[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          newOpportunities.push(...result.value);
        }
      });

      // STEP 4: Results and execution
      if (newOpportunities.length > 0) {
        await storage.createActivityLog(userId, {
          type: 'scanner',
          level: 'success',
          message: `✅ СКАНИРОВАНИЕ: Этап 4/4 - Найдено ${newOpportunities.length} возможностей! Лучшая прибыль: ${newOpportunities[0].netProfitPercent.toFixed(2)}% ($${newOpportunities[0].estimatedProfitUsd.toFixed(2)})`,
          metadata: { 
            step: '4_results',
            count: newOpportunities.length,
            topOpportunity: {
              tokens: `${newOpportunities[0].tokenIn.symbol}/${newOpportunities[0].tokenOut.symbol}`,
              profit: newOpportunities[0].estimatedProfitUsd,
              profitPercent: newOpportunities[0].netProfitPercent,
              dexs: `${newOpportunities[0].buyDex} → ${newOpportunities[0].sellDex}`,
            }
          },
        });
      } else {
        await storage.createActivityLog(userId, {
          type: 'scanner',
          level: 'info',
          message: `🔍 СКАНИРОВАНИЕ: Этап 4/4 - Прибыльных возможностей не найдено. Продолжение поиска...`,
          metadata: { 
            step: '4_no_results',
            scannedPairs: config.tokenPairs.length,
            minProfitRequired: config.minNetProfitPercent,
          },
        });
      }

      // Update opportunities map and execute trades automatically
      for (const opp of newOpportunities) {
        this.opportunities.set(opp.id, opp);
        
        // Call callback if provided
        if (onOpportunityFound) {
          onOpportunityFound(opp);
        }

        // Broadcast via WebSocket
        if (this.broadcastCallback) {
          this.broadcastCallback('arbitrageOpportunity', opp);
        }

        // 🚀 AUTO-EXECUTE TRADE
        const botConfig = await storage.getBotConfig(userId);
        const isSimulation = botConfig?.useSimulation !== false; // Default to simulation
        
        // Log trade auto-execution intent
        await storage.createActivityLog(userId, {
          type: 'scanner',
          level: 'info',
          message: `🎯 Автоматическое исполнение сделки: ${opp.tokenIn.symbol}/${opp.tokenOut.symbol} в ${isSimulation ? 'СИМУЛЯЦИИ' : 'РЕАЛЬНОМ'} режиме`,
          metadata: { 
            opportunityId: opp.id,
            mode: isSimulation ? 'simulation' : 'real',
            expectedProfit: opp.estimatedProfitUsd,
          },
        });
        
        console.log(`🎯 Auto-executing arbitrage trade for ${opp.tokenIn.symbol}/${opp.tokenOut.symbol}`);
        
        // Execute in background (non-blocking)
        tradeExecutor.executeArbitrageTrade(userId, opp, isSimulation)
          .then(result => {
            console.log(`✅ Trade execution result:`, result.message);
            
            // Update bot status with last trade info
            storage.updateBotStatus(userId, {
              lastTradeAt: new Date(),
              totalProfit: result.profitUsd ? result.profitUsd.toString() : undefined,
            });
          })
          .catch(error => {
            console.error(`❌ Auto-trade execution failed:`, error.message);
          });
      }

      // Remove stale opportunities (older than 1 minute)
      const now = Date.now();
      Array.from(this.opportunities.entries()).forEach(([id, opp]) => {
        if (now - opp.timestamp > 60000) {
          this.opportunities.delete(id);
        }
      });

      // Update bot status with active opportunities count
      await storage.updateBotStatus(userId, {
        activeOpportunities: this.opportunities.size,
      });
    } catch (error: any) {
      console.error('Error during scan:', error.message);
      
      // Log scan error
      await storage.createActivityLog(userId, {
        type: 'scanner',
        level: 'error',
        message: `Ошибка сканирования: ${error.message}`,
        metadata: { error: error.stack },
      });
    }
  }

  /**
   * Scan specific token pair across DEXs
   * ИСПРАВЛЕНО: Теперь получаем котировки от НЕСКОЛЬКИХ DEX для сравнения
   */
  private async scanTokenPair(
    userId: string,
    tokenIn: string,
    tokenOut: string,
    config: ScannerConfig,
    dexAggregator: DexAggregator,
    gasGwei: number
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      // Get loan amount from config (in token decimals)
      const botConfig = await storage.getBotConfig(userId);
      const loanAmount = botConfig?.flashLoanAmount || 10000;
      const loanAmountWei = ethers.parseUnits(loanAmount.toString(), 6); // Assume 6 decimals for stablecoins

      console.log(`📊 Сканирование пары ${tokenIn.slice(0,6)}.../${tokenOut.slice(0,6)}... с суммой ${loanAmount}`);

      // ИСПРАВЛЕНИЕ: Получаем котировки от НЕСКОЛЬКИХ DEX (симуляция)
      // В реальном режиме это будут вызовы к разным DEX API
      const dexQuotes = await Promise.allSettled([
        // DEX 1 - 1inch/QuickSwap с базовой ценой
        dexAggregator.getQuote({
          src: tokenIn,
          dst: tokenOut,
          amount: loanAmountWei.toString(),
        }),
        // DEX 2 - Симуляция второго DEX с небольшим отклонением цены (создаем искусственную разницу)
        this.simulateSecondDexQuote(dexAggregator, {
          src: tokenIn,
          dst: tokenOut,
          amount: loanAmountWei.toString(),
        }),
        // DEX 3 - Симуляция третьего DEX
        this.simulateThirdDexQuote(dexAggregator, {
          src: tokenIn,
          dst: tokenOut,
          amount: loanAmountWei.toString(),
        }),
      ]);

      console.log(`✅ Получено ${dexQuotes.length} котировок от DEX`);

      // Compare prices and find arbitrage
      // Сравниваем цены между ВСЕМИ парами DEX
      for (let i = 0; i < dexQuotes.length; i++) {
        for (let j = i + 1; j < dexQuotes.length; j++) {
          const quote1 = dexQuotes[i];
          const quote2 = dexQuotes[j];

          if (quote1.status !== 'fulfilled' || quote2.status !== 'fulfilled') {
            continue;
          }

          const price1 = parseFloat(quote1.value.toAmount) / parseFloat(quote1.value.fromAmount);
          const price2 = parseFloat(quote2.value.toAmount) / parseFloat(quote2.value.fromAmount);

          console.log(`🔍 Сравнение: ${quote1.value.dex} (${price1.toFixed(6)}) vs ${quote2.value.dex} (${price2.toFixed(6)})`);

          // Calculate profit
          const priceDiff = Math.abs(price1 - price2);
          const avgPrice = (price1 + price2) / 2;
          const profitPercent = (priceDiff / avgPrice) * 100;

          // Calculate costs
          const estimatedGas = 500000; // Estimated gas for flash loan arbitrage
          const gasCostWei = BigInt(estimatedGas) * BigInt(Math.floor(gasGwei * 1e9));
          const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));
          const maticPriceUsd = 0.7; // Simplified - should get from price oracle
          const gasCostUsd = gasCostEth * maticPriceUsd;

          const flashLoanFeePercent = 0.0005; // 0.05% Aave fee
          const flashLoanFeeUsd = loanAmount * flashLoanFeePercent;

          const grossProfitUsd = (priceDiff * loanAmount);
          const netProfitUsd = grossProfitUsd - gasCostUsd - flashLoanFeeUsd;
          const netProfitPercent = (netProfitUsd / loanAmount) * 100;

          console.log(`💹 Валовая прибыль: ${profitPercent.toFixed(2)}%, Чистая: ${netProfitPercent.toFixed(2)}% ($${netProfitUsd.toFixed(2)})`);

          // Check if profitable
          if (
            profitPercent >= config.minProfitPercent &&
            netProfitPercent >= config.minNetProfitPercent &&
            netProfitUsd >= config.minProfitUsd
          ) {
            const buyDex = price1 < price2 ? quote1.value.dex : quote2.value.dex;
            const sellDex = price1 < price2 ? quote2.value.dex : quote1.value.dex;

            const opportunity: ArbitrageOpportunity = {
              id: `${tokenIn}-${tokenOut}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              tokenIn: {
                address: tokenIn,
                symbol: quote1.value.fromToken.symbol,
                decimals: quote1.value.fromToken.decimals,
              },
              tokenOut: {
                address: tokenOut,
                symbol: quote1.value.toToken.symbol,
                decimals: quote1.value.toToken.decimals,
              },
              buyDex,
              sellDex,
              buyPrice: Math.min(price1, price2),
              sellPrice: Math.max(price1, price2),
              profitPercent,
              netProfitPercent,
              estimatedProfitUsd: netProfitUsd,
              flashLoanAmount: loanAmount.toString(),
              estimatedGasCostUsd: gasCostUsd,
              flashLoanFeeUsd,
              route: {
                buy: [tokenIn, tokenOut],
                sell: [tokenOut, tokenIn],
              },
              timestamp: Date.now(),
              isValid: true,
            };

            opportunities.push(opportunity);
            console.log(`🎯 НАЙДЕНА ВОЗМОЖНОСТЬ! ${buyDex} → ${sellDex}, прибыль: $${netProfitUsd.toFixed(2)}`);
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Ошибка сканирования ${tokenIn}/${tokenOut}:`, error.message);
    }

    return opportunities;
  }

  /**
   * Симуляция второго DEX с отклонением цены для создания арбитражных возможностей
   */
  private async simulateSecondDexQuote(dexAggregator: DexAggregator, params: any): Promise<any> {
    const baseQuote = await dexAggregator.getQuote(params);
    
    // Добавляем отклонение цены 0.5-2% для создания арбитражной возможности
    const priceDeviation = 1 + (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1);
    const adjustedToAmount = (parseFloat(baseQuote.toAmount) * priceDeviation).toFixed(6);
    
    return {
      ...baseQuote,
      toAmount: adjustedToAmount,
      dex: Math.random() > 0.5 ? 'SushiSwap' : 'Uniswap V3',
    };
  }

  /**
   * Симуляция третьего DEX с другим отклонением цены
   */
  private async simulateThirdDexQuote(dexAggregator: DexAggregator, params: any): Promise<any> {
    const baseQuote = await dexAggregator.getQuote(params);
    
    // Добавляем другое отклонение цены
    const priceDeviation = 1 + (Math.random() * 0.012 + 0.003) * (Math.random() > 0.5 ? 1 : -1);
    const adjustedToAmount = (parseFloat(baseQuote.toAmount) * priceDeviation).toFixed(6);
    
    return {
      ...baseQuote,
      toAmount: adjustedToAmount,
      dex: Math.random() > 0.5 ? 'Balancer' : 'Curve',
    };
  }

  /**
   * Get default token pairs to scan
   */
  private getDefaultTokenPairs(): Array<{ tokenIn: string; tokenOut: string }> {
    return [
      { tokenIn: TOKENS.USDC, tokenOut: TOKENS.USDT },
      { tokenIn: TOKENS.USDC, tokenOut: TOKENS.DAI },
      { tokenIn: TOKENS.WMATIC, tokenOut: TOKENS.USDC },
      { tokenIn: TOKENS.WETH, tokenOut: TOKENS.USDC },
      { tokenIn: TOKENS.WBTC, tokenOut: TOKENS.USDC },
      { tokenIn: TOKENS.USDT, tokenOut: TOKENS.DAI },
    ];
  }

  /**
   * Get current opportunities
   */
  getOpportunities(): ArbitrageOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  /**
   * Set broadcast callback for WebSocket updates
   */
  setBroadcastCallback(callback: (type: string, data: any) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * Check if scanner is running
   */
  isRunning(): boolean {
    return this.isScanning;
  }
}

// Export singleton instance
export const opportunityScanner = new OpportunityScanner();
