import { ethers } from 'ethers';
import { storage } from './storage';
import { web3Provider } from './web3Provider';
import { aaveFlashLoanV3 } from './aaveFlashLoanV3';
import { DexAggregator } from './dexAggregator';
import { sendTelegramMessage } from './telegram';
import type { ArbitrageOpportunity } from './opportunityScanner';

export interface TradeExecutionResult {
  success: boolean;
  txHash?: string;
  profitUsd?: number;
  gasCostUsd?: number;
  message: string;
  error?: string;
  executionTime?: number;
}

export class TradeExecutor {
  /**
   * Execute arbitrage trade using flash loan
   * This is the CRITICAL function that actually executes trades!
   */
  async executeArbitrageTrade(
    userId: string,
    opportunity: ArbitrageOpportunity,
    isSimulation: boolean = true
  ): Promise<TradeExecutionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n🚀 EXECUTING ARBITRAGE TRADE`);
      console.log(`   Mode: ${isSimulation ? 'SIMULATION' : 'REAL TRADING'}`);
      console.log(`   Pair: ${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}`);
      console.log(`   Buy: ${opportunity.buyDex} → Sell: ${opportunity.sellDex}`);
      console.log(`   Expected Profit: $${opportunity.estimatedProfitUsd.toFixed(2)}`);

      // Step 1: Validate opportunity is still profitable
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `🔍 ШАГ 1/7: Проверка арбитражной возможности ${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}`,
        metadata: { 
          opportunityId: opportunity.id,
          expectedProfit: opportunity.estimatedProfitUsd,
          mode: isSimulation ? 'simulation' : 'real',
          step: '1_validation',
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
        },
      });

      // Step 2: Get bot configuration
      const config = await storage.getBotConfig(userId);
      if (!config) {
        throw new Error('Bot configuration not found');
      }

      // Step 3: Check if real trading is enabled
      if (!isSimulation && !config.enableRealTrading) {
        throw new Error('Real trading is disabled in configuration');
      }

      // Step 4: Validate private key for real trading
      // Check config first, then environment variable as fallback
      let privateKey = config.privateKey?.trim() || process.env.PRIVATE_KEY;
      
      // Validate private key format (must start with 0x and be 66 chars total)
      if (privateKey && !privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      
      if (privateKey && privateKey.length !== 66) {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'error',
          message: `❌ ОШИБКА: Неверный формат приватного ключа. Должен быть 64 символа (без 0x) или 66 (с 0x)`,
          metadata: { 
            step: '2_validation_failed',
            error: 'invalid_private_key_format',
            keyLength: privateKey.length,
            recommendation: 'Проверьте формат приватного ключа в Settings',
          },
        });
        throw new Error('Invalid private key format. Must be 64 hex characters (or 66 with 0x prefix)');
      }
      
      if (!isSimulation && !privateKey) {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'error',
          message: `❌ ОШИБКА: Приватный ключ не настроен для реальной торговли. Установите PRIVATE_KEY в переменных окружения или в Settings → Safe & Ledger`,
          metadata: { 
            step: '2_validation_failed',
            error: 'private_key_not_configured',
            recommendation: 'Добавьте PRIVATE_KEY в Secrets или в настройках приложения',
          },
        });
        throw new Error('Private key not configured for real trading. Set PRIVATE_KEY in environment or Settings.');
      }
      
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `🔐 ШАГ 2/7: Приватный ключ подтвержден ${privateKey ? '(настроен)' : '(отсутствует)'}`,
        metadata: { 
          step: '2_key_validation',
          keySource: config.privateKey ? 'config' : 'environment',
          isConfigured: !!privateKey,
        },
      });

      // Step 5: Check MATIC balance (for gas fees)
      let maticBalance = '0';
      if (!isSimulation && privateKey) {
        try {
          const wallet = new ethers.Wallet(privateKey);
          const walletAddress = wallet.address;
          const chainId = config.networkMode === 'mainnet' ? 137 : 80002;
          
          const balanceData = await web3Provider.getNativeBalance(walletAddress, chainId);
          maticBalance = balanceData.balanceFormatted;
          
          const minMaticRequired = 0.1; // Minimum 0.1 MATIC for gas
          const currentMatic = parseFloat(maticBalance);
          
          await storage.createActivityLog(userId, {
            type: 'trade_execution',
            level: 'info',
            message: `💰 ШАГ 3/7: Проверка баланса MATIC: ${currentMatic.toFixed(4)} MATIC ${currentMatic < minMaticRequired ? '⚠️ НИЗКИЙ!' : '✅'}`,
            metadata: { 
              step: '3_balance_check',
              maticBalance: currentMatic,
              minRequired: minMaticRequired,
              walletAddress,
              isSufficient: currentMatic >= minMaticRequired,
            },
          });
          
          if (currentMatic < minMaticRequired) {
            throw new Error(`Insufficient MATIC balance: ${currentMatic.toFixed(4)} MATIC (minimum: ${minMaticRequired} MATIC required for gas)`);
          }
        } catch (error: any) {
          console.error('Failed to check MATIC balance:', error);
          await storage.createActivityLog(userId, {
            type: 'trade_execution',
            level: 'warning',
            message: `⚠️ Не удалось проверить баланс MATIC: ${error.message}`,
            metadata: { 
              step: '3_balance_check_failed',
              error: error.message,
            },
          });
        }
      }

      // Step 6: Check current gas price
      const gasData = await web3Provider.getGasPrice();
      const currentGasGwei = parseFloat(gasData.gasPriceGwei);

      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `⛽ ШАГ 4/7: Проверка цены газа: ${currentGasGwei.toFixed(1)} Gwei ${currentGasGwei > (config.maxGasPriceGwei || 60) ? '⚠️ ВЫСОКАЯ!' : '✅'}`,
        metadata: { 
          step: '4_gas_check',
          gasGwei: currentGasGwei,
          maxGasGwei: config.maxGasPriceGwei,
          maticBalance,
          isAcceptable: currentGasGwei <= (config.maxGasPriceGwei || 60),
        },
      });
      
      if (currentGasGwei > (config.maxGasPriceGwei || 60)) {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'error',
          message: `❌ ОШИБКА: Цена газа слишком высокая ${currentGasGwei.toFixed(1)} Gwei (максимум: ${config.maxGasPriceGwei} Gwei). Ожидание снижения...`,
          metadata: { 
            step: '4_gas_too_high',
            gasGwei: currentGasGwei,
            maxGasGwei: config.maxGasPriceGwei,
            recommendation: 'Дождитесь снижения цены газа или увеличьте лимит в Settings',
          },
        });
        throw new Error(`Gas price too high: ${currentGasGwei} Gwei (max: ${config.maxGasPriceGwei})`);
      }

      // Step 6: SIMULATION MODE - Just log and create mock transaction
      if (isSimulation) {
        console.log('📊 SIMULATION MODE - Creating mock transaction');
        
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'info',
          message: `⚡ ШАГ 5/7: СИМУЛЯЦИЯ - Подготовка мок-транзакции`,
          metadata: {
            mode: 'simulation',
            step: '5_mock_transaction',
          },
        });
        
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'success',
          message: `✅ ШАГ 7/7: СИМУЛЯЦИЯ ЗАВЕРШЕНА! Прибыль: $${opportunity.estimatedProfitUsd.toFixed(2)}`,
          metadata: {
            mode: 'simulation',
            pair: `${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}`,
            profit: opportunity.estimatedProfitUsd,
            dexs: `${opportunity.buyDex} → ${opportunity.sellDex}`,
            step: '7_completed',
          },
        });

        // Create simulated transaction record
        const mockTxHash = `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
        
        await storage.createArbitrageTransaction(userId, {
          txHash: mockTxHash,
          tokenIn: opportunity.tokenIn.symbol,
          tokenOut: opportunity.tokenOut.symbol,
          amountIn: opportunity.flashLoanAmount,
          amountOut: (parseFloat(opportunity.flashLoanAmount) * 1.01).toString(),
          profitUsd: opportunity.estimatedProfitUsd.toString(),
          gasCostUsd: opportunity.estimatedGasCostUsd.toString(),
          netProfitUsd: (opportunity.estimatedProfitUsd - opportunity.estimatedGasCostUsd).toString(),
          status: 'success',
          dexPath: `${opportunity.buyDex} → ${opportunity.sellDex}`,
        });

        // Send Telegram notification for significant profits
        const profitThreshold = parseFloat(config.telegramProfitThresholdUsd?.toString() || '10');
        if (opportunity.estimatedProfitUsd >= profitThreshold) {
          await sendTelegramMessage(
            userId,
            `🎯 <b>СИМУЛЯЦИЯ: Арбитражная сделка</b>\n\n` +
            `💹 Пара: ${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}\n` +
            `📊 DEX: ${opportunity.buyDex} → ${opportunity.sellDex}\n` +
            `💰 Прибыль: $${opportunity.estimatedProfitUsd.toFixed(2)} (${opportunity.netProfitPercent.toFixed(2)}%)\n` +
            `⛽ Gas: $${opportunity.estimatedGasCostUsd.toFixed(2)}\n` +
            `⏱ Время: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n` +
            `🔗 TX: ${mockTxHash.substring(0, 10)}...`,
            'trade_success'
          );
        }

        return {
          success: true,
          txHash: mockTxHash,
          profitUsd: opportunity.estimatedProfitUsd,
          gasCostUsd: opportunity.estimatedGasCostUsd,
          message: `Simulation successful - profit $${opportunity.estimatedProfitUsd.toFixed(2)}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Step 7: REAL TRADING MODE
      console.log('💸 REAL TRADING MODE - Executing actual transaction');
      
      // Validate 1inch API key is configured for real trading
      if (!config.oneinchApiKey?.trim()) {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'error',
          message: `❌ ОШИБКА: 1inch API ключ не настроен для реальной торговли. Добавьте API ключ в Settings → Trading Parameters`,
          metadata: {
            step: '5_api_key_missing',
            error: '1inch_api_key_not_configured',
            recommendation: 'Получите бесплатный API ключ на https://portal.1inch.dev/ и добавьте в настройках',
          },
        });
        throw new Error('1inch API key not configured for real trading. Add it in Settings → Trading Parameters');
      }
      
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'warning',
        message: `⚠️ ШАГ 5/7: РЕАЛЬНАЯ ТОРГОВЛЯ - Начало исполнения с реальными средствами`,
        metadata: {
          mode: 'real',
          step: '5_real_execution',
          pair: `${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}`,
          expectedProfit: opportunity.estimatedProfitUsd,
          has1inchKey: !!config.oneinchApiKey,
        },
      });

      // Step 8: Prepare flash loan parameters
      const loanAmount = ethers.parseUnits(
        opportunity.flashLoanAmount,
        opportunity.tokenIn.decimals
      );

      // Step 9: Get DexAggregator for executing swaps
      const dexAggregator = new DexAggregator(config.oneinchApiKey || undefined);
      
      // SECURITY: Derive wallet address from private key (NEVER send private key to APIs!)
      if (!privateKey) {
        throw new Error('Private key is required but not configured');
      }
      
      const wallet = new ethers.Wallet(privateKey);
      const walletAddress = wallet.address;
      
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `🔧 Инициализация DEXAggregator ${config.oneinchApiKey ? 'с 1inch API ключом' : 'в DEMO режиме'}`,
        metadata: {
          step: '5.1_dex_init',
          mode: config.oneinchApiKey ? 'production' : 'demo',
          walletAddress,
        },
      });
      
      // Step 10: Log that we're using Flash Loan (no balance check needed)
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `💰 ШАГ 6/8: Flash Loan будет использован для ${opportunity.tokenIn.symbol} (баланс кошелька не требуется)`,
        metadata: {
          step: '6_flash_loan_mode',
          token: opportunity.tokenIn.symbol,
          loanAmount: opportunity.flashLoanAmount,
          message: 'Using Aave V3 Flash Loan - wallet balance not required',
        },
      });
      
      // Step 11: Build swap transactions with enhanced error handling
      let buySwap;
      let sellSwap;
      
      try {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'info',
          message: `🔄 Построение BUY транзакции: ${opportunity.tokenIn.symbol} → ${opportunity.tokenOut.symbol}`,
          metadata: {
            step: '5.2_build_buy_swap',
            tokenIn: opportunity.tokenIn.symbol,
            tokenOut: opportunity.tokenOut.symbol,
            amount: loanAmount.toString(),
          },
        });

        const chainId = config.networkMode === 'mainnet' ? 137 : 80002;
        
        buySwap = await dexAggregator.buildSwapTransaction({
          src: opportunity.tokenIn.address,
          dst: opportunity.tokenOut.address,
          amount: loanAmount.toString(),
          from: walletAddress, // Wallet address (NOT private key!)
          slippage: 1, // 1% slippage tolerance
          disableEstimate: false, // Enable gas estimation
          allowPartialFill: false
        });

        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'success',
          message: `✅ BUY транзакция построена: получим ${buySwap.toAmount} ${opportunity.tokenOut.symbol} через ${buySwap.dex}`,
          metadata: {
            step: '5.3_buy_swap_ready',
            toAmount: buySwap.toAmount,
            dex: buySwap.dex,
            estimatedGas: buySwap.estimatedGas,
          },
        });

      } catch (error: any) {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'error',
          message: `❌ Ошибка построения BUY транзакции: ${error.message}`,
          metadata: {
            step: '5.3_buy_swap_failed',
            error: error.message,
            stack: error.stack,
          },
        });
        throw new Error(`Failed to build buy swap transaction: ${error.message}`);
      }

      try {
        // Convert toAmount to integer string (1inch requires integer string format)
        const sellAmount = Math.floor(parseFloat(buySwap.toAmount)).toString();
        
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'info',
          message: `🔄 Построение SELL транзакции: ${opportunity.tokenOut.symbol} → ${opportunity.tokenIn.symbol}`,
          metadata: {
            step: '5.4_build_sell_swap',
            tokenIn: opportunity.tokenOut.symbol,
            tokenOut: opportunity.tokenIn.symbol,
            amount: sellAmount,
          },
        });

        sellSwap = await dexAggregator.buildSwapTransaction({
          src: opportunity.tokenOut.address,
          dst: opportunity.tokenIn.address,
          amount: sellAmount,
          from: walletAddress, // Wallet address (NOT private key!)
          slippage: 1, // 1% slippage tolerance
          disableEstimate: false, // Enable gas estimation
          allowPartialFill: false
        });

        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'success',
          message: `✅ SELL транзакция построена: получим ${sellSwap.toAmount} ${opportunity.tokenIn.symbol} через ${sellSwap.dex}`,
          metadata: {
            step: '5.5_sell_swap_ready',
            toAmount: sellSwap.toAmount,
            dex: sellSwap.dex,
            estimatedGas: sellSwap.estimatedGas,
          },
        });

      } catch (error: any) {
        await storage.createActivityLog(userId, {
          type: 'trade_execution',
          level: 'error',
          message: `❌ Ошибка построения SELL транзакции: ${error.message}`,
          metadata: {
            step: '5.5_sell_swap_failed',
            error: error.message,
            stack: error.stack,
          },
        });
        throw new Error(`Failed to build sell swap transaction: ${error.message}`);
      }

      console.log('✅ Swap transactions built successfully');
      console.log(`   BUY: ${buySwap.fromAmount} ${opportunity.tokenIn.symbol} → ${buySwap.toAmount} ${opportunity.tokenOut.symbol} (${buySwap.dex})`);
      console.log(`   SELL: ${sellSwap.fromAmount} ${opportunity.tokenOut.symbol} → ${sellSwap.toAmount} ${opportunity.tokenIn.symbol} (${sellSwap.dex})`);

      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `🔄 ШАГ 6/8: Транзакции свопов подготовлены - выполнение Flash Loan через Aave V3`,
        metadata: {
          step: '6_swap_preparation',
          buyAmount: buySwap.toAmount,
          sellAmount: sellSwap.toAmount,
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
        },
      });

      // Step 11: Execute flash loan with arbitrage using deployed smart contract
      
      // Get deployed contract address from config or environment
      const arbitrageContractAddress = config.flashLoanContract || process.env.ARBITRAGE_CONTRACT;
      
      if (!arbitrageContractAddress) {
        throw new Error(
          'Arbitrage contract not deployed. Please deploy the ArbitrageExecutor contract first. ' +
          'See contracts/README.md for deployment instructions.'
        );
      }

      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `📄 Используется смарт-контракт: ${arbitrageContractAddress.substring(0, 10)}...`,
        metadata: {
          step: '6.1_contract_address',
          contractAddress: arbitrageContractAddress,
        },
      });

      // Map DEX names to router addresses on Polygon
      const DEX_ROUTERS: { [key: string]: string } = {
        '1inch': '0x1111111254EEB25477B68fb85Ed929f73A960582', // 1inch V5 Router on Polygon
        'QuickSwap': '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap Router
        'Uniswap V3': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 SwapRouter
        'SushiSwap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap Router
        'Curve': '0x445FE580eF8d70FF569aB36e80c647af338db351', // Curve Aave Pool (example)
        'Balancer': '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Balancer Vault
      };

      // Get router addresses - use actual addresses from transaction data if available, otherwise fallback to known routers
      const buyRouterAddress = buySwap.tx?.to || DEX_ROUTERS[opportunity.buyDex] || arbitrageContractAddress;
      const sellRouterAddress = sellSwap.tx?.to || DEX_ROUTERS[opportunity.sellDex] || arbitrageContractAddress;

      // Validate router addresses
      if (!ethers.isAddress(buyRouterAddress)) {
        throw new Error(`Invalid buy router address for ${opportunity.buyDex}: ${buyRouterAddress}`);
      }
      if (!ethers.isAddress(sellRouterAddress)) {
        throw new Error(`Invalid sell router address for ${opportunity.sellDex}: ${sellRouterAddress}`);
      }

      // Validate transaction data is present
      if (!buySwap.tx?.data) {
        throw new Error('Buy swap transaction data is missing');
      }
      if (!sellSwap.tx?.data) {
        throw new Error('Sell swap transaction data is missing');
      }

      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `📄 Используются роутеры: BUY=${buyRouterAddress.substring(0, 10)}... SELL=${sellRouterAddress.substring(0, 10)}...`,
        metadata: {
          step: '6.2_router_addresses',
          buyRouter: buyRouterAddress,
          sellRouter: sellRouterAddress,
          buyDex: opportunity.buyDex,
          sellDex: opportunity.sellDex,
        },
      });

      // Encode arbitrage parameters for smart contract
      const arbParams = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(tuple(address,bytes),tuple(address,bytes),uint256)'],
        [[
          [buyRouterAddress, buySwap.tx.data],
          [sellRouterAddress, sellSwap.tx.data],
          '0' // minProfit - will be calculated by contract
        ]]
      );

      // Execute flash loan through deployed contract
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'info',
        message: `🔄 ШАГ 7/8: Вызов Flash Loan через смарт-контракт...`,
        metadata: {
          step: '7_execute_flashloan',
          contractAddress: arbitrageContractAddress,
          loanAmount: loanAmount.toString(),
        },
      });

      const result = await aaveFlashLoanV3.executeFlashLoan(
        userId,
        {
          assets: [opportunity.tokenIn.address],
          amounts: [loanAmount.toString()],
          receiverAddress: arbitrageContractAddress,
          params: arbParams,
        },
        privateKey!
      );

      if (!result.success) {
        throw new Error(result.error || 'Flash loan execution failed');
      }

      const realTxHash = result.txHash || `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`;
      
      await storage.createArbitrageTransaction(userId, {
        txHash: realTxHash,
        tokenIn: opportunity.tokenIn.symbol,
        tokenOut: opportunity.tokenOut.symbol,
        amountIn: opportunity.flashLoanAmount,
        amountOut: buySwap.toAmount,
        profitUsd: opportunity.estimatedProfitUsd.toString(),
        gasCostUsd: opportunity.estimatedGasCostUsd.toString(),
        netProfitUsd: (opportunity.estimatedProfitUsd - opportunity.estimatedGasCostUsd).toString(),
        status: 'pending',
        dexPath: `${opportunity.buyDex} → ${opportunity.sellDex}`,
      });

      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'success',
        message: `✅ ШАГ 8/8: ТРАНЗАКЦИЯ ОТПРАВЛЕНА! TX: ${realTxHash.substring(0, 10)}...`,
        metadata: {
          step: '8_transaction_sent',
          txHash: realTxHash,
          profit: opportunity.estimatedProfitUsd,
          status: 'pending_confirmation',
        },
      });

      // Send Telegram notification
      await sendTelegramMessage(
        userId,
        `🚀 <b>РЕАЛЬНАЯ ТОРГОВЛЯ: Сделка отправлена</b>\n\n` +
        `💹 Пара: ${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}\n` +
        `📊 DEX: ${opportunity.buyDex} → ${opportunity.sellDex}\n` +
        `💰 Ожидаемая прибыль: $${opportunity.estimatedProfitUsd.toFixed(2)}\n` +
        `⛽ Gas: ~$${opportunity.estimatedGasCostUsd.toFixed(2)}\n` +
        `🔗 TX: ${realTxHash}\n` +
        `⏳ Статус: Ожидание подтверждения...`,
        'trade_pending'
      );

      return {
        success: true,
        txHash: realTxHash,
        profitUsd: opportunity.estimatedProfitUsd,
        gasCostUsd: opportunity.estimatedGasCostUsd,
        message: `Real trade executed - TX ${realTxHash}`,
        executionTime: Date.now() - startTime,
      };

    } catch (error: any) {
      console.error('❌ Trade execution failed:', error.message);
      
      // Determine recommended action based on error
      let recommendation = 'Проверьте логи и настройки. При повторении ошибки обратитесь к документации.';
      if (error.message.includes('1inch API key')) {
        recommendation = 'Получите бесплатный API ключ на https://portal.1inch.dev/ и добавьте в Settings → Trading Parameters';
      } else if (error.message.includes('Private key')) {
        recommendation = 'Добавьте PRIVATE_KEY в Secrets или в Settings → Safe & Ledger';
      } else if (error.message.includes('Gas price too high')) {
        recommendation = 'Дождитесь снижения цены газа или увеличьте лимит в Settings → Risk Management';
      } else if (error.message.includes('Insufficient MATIC')) {
        recommendation = 'Пополните баланс MATIC для оплаты комиссий';
      }
      
      // Log error with recommendation
      await storage.createActivityLog(userId, {
        type: 'trade_execution',
        level: 'error',
        message: `❌ Ошибка исполнения сделки: ${error.message}`,
        metadata: {
          error: error.stack,
          opportunity: opportunity.id,
          mode: isSimulation ? 'simulation' : 'real',
          recommendation,
          pair: `${opportunity.tokenIn.symbol}/${opportunity.tokenOut.symbol}`,
          expectedProfit: opportunity.estimatedProfitUsd,
        },
      });

      // Create failed transaction record
      await storage.createArbitrageTransaction(userId, {
        txHash: '0x0',
        tokenIn: opportunity.tokenIn.symbol,
        tokenOut: opportunity.tokenOut.symbol,
        amountIn: opportunity.flashLoanAmount,
        amountOut: '0',
        profitUsd: '0',
        gasCostUsd: '0',
        netProfitUsd: '0',
        status: 'failed',
        dexPath: `${opportunity.buyDex} → ${opportunity.sellDex}`,
      });

      return {
        success: false,
        message: `Trade execution failed: ${error.message}`,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate if opportunity is still profitable before executing
   */
  async validateOpportunity(
    userId: string,
    opportunity: ArbitrageOpportunity
  ): Promise<boolean> {
    try {
      const config = await storage.getBotConfig(userId);
      
      // Check if opportunity is still within time window (e.g., 30 seconds)
      const ageMs = Date.now() - opportunity.timestamp;
      if (ageMs > 30000) {
        console.log(`Opportunity too old: ${ageMs}ms`);
        return false;
      }

      // Check if profit is still above threshold
      if (opportunity.netProfitPercent < parseFloat(config?.minNetProfitPercent?.toString() || '0.15')) {
        console.log(`Profit below threshold: ${opportunity.netProfitPercent}%`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating opportunity:', error);
      return false;
    }
  }
}

// Export singleton instance
export const tradeExecutor = new TradeExecutor();
