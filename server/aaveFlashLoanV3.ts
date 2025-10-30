import { ethers } from 'ethers';
import { storage } from './storage';
import { web3Provider } from './web3Provider';

// Aave V3 Pool addresses
const AAVE_POOL_ADDRESSES = {
  polygon: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  mumbai: '0x0b913A76beFF3887d35073b8e5530755D60F78C7',
};

// Aave V3 Pool ABI (minimal)
const AAVE_POOL_ABI = [
  'function flashLoan(address receiverAddress, address[] calldata assets, uint256[] calldata amounts, uint256[] calldata interestRateModes, address onBehalfOf, bytes calldata params, uint16 referralCode)',
  'function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128)',
];

// Flash Loan Receiver ABI (for custom receiver contract)
const FLASHLOAN_RECEIVER_ABI = [
  'function executeOperation(address[] calldata assets, uint256[] calldata amounts, uint256[] calldata premiums, address initiator, bytes calldata params) external returns (bool)',
];

// Available assets for flash loans on Polygon
export const FLASH_LOAN_ASSETS = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
};

export interface FlashLoanParams {
  assets: string[]; // Token addresses to borrow
  amounts: string[]; // Amounts to borrow (in wei)
  receiverAddress: string; // Contract that will receive and execute arbitrage
  params?: string; // Encoded parameters for receiver contract
}

export interface FlashLoanResult {
  success: boolean;
  txHash?: string;
  loanAmount: string;
  premium: string;
  totalRepayment: string;
  message: string;
  error?: string;
  gasUsed?: string;
  gasCostUsd?: number;
}

export class AaveFlashLoanV3 {
  private poolAddress: string;
  private chainId: number;

  constructor(chainId: number = 137) {
    this.chainId = chainId;
    this.poolAddress = chainId === 137 
      ? AAVE_POOL_ADDRESSES.polygon 
      : AAVE_POOL_ADDRESSES.mumbai;
  }

  /**
   * Execute flash loan on Aave V3
   * REAL implementation - interacts with Aave smart contracts
   */
  async executeFlashLoan(
    userId: string,
    params: FlashLoanParams,
    signerPrivateKey: string
  ): Promise<FlashLoanResult> {
    try {
      // Validate parameters
      if (params.assets.length !== params.amounts.length) {
        throw new Error('Assets and amounts arrays must have same length');
      }

      if (params.assets.length === 0) {
        throw new Error('Must specify at least one asset');
      }

      // Get provider and create signer
      const provider = await web3Provider.getCustomProvider(userId);
      const signer = new ethers.Wallet(signerPrivateKey, provider);

      // Create Pool contract instance
      const poolContract = new ethers.Contract(
        this.poolAddress,
        AAVE_POOL_ABI,
        signer
      );

      // Get flash loan premium (fee %)
      const premiumTotal = await poolContract.FLASHLOAN_PREMIUM_TOTAL();
      const premiumPercent = Number(premiumTotal) / 10000; // Premium is in basis points

      // Calculate total repayment
      const totalPremium = params.amounts.reduce((sum, amount) => {
        const amountBN = BigInt(amount);
        const premium = (amountBN * BigInt(premiumTotal)) / BigInt(10000);
        return sum + premium;
      }, BigInt(0));

      // Interest rate modes (0 = no debt, just flash loan)
      const modes = params.assets.map(() => 0);

      // Encode params for receiver contract
      const encodedParams = params.params || '0x';

      // Estimate gas
      const gasEstimate = await poolContract.flashLoan.estimateGas(
        params.receiverAddress,
        params.assets,
        params.amounts,
        modes,
        signer.address,
        encodedParams,
        0 // referral code
      );

      // Get gas price
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);

      // Calculate gas cost
      const gasCost = gasEstimate * gasPrice;
      const gasCostEth = parseFloat(ethers.formatEther(gasCost));
      const maticPriceUsd = 0.7; // Should get from price oracle in production
      const gasCostUsd = gasCostEth * maticPriceUsd;

      // Execute flash loan transaction
      const tx = await poolContract.flashLoan(
        params.receiverAddress,
        params.assets,
        params.amounts,
        modes,
        signer.address,
        encodedParams,
        0,
        {
          gasLimit: gasEstimate * BigInt(12) / BigInt(10), // Add 20% buffer
        }
      );

      console.log(`📤 Flash loan transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Transaction failed');
      }

      console.log(`✅ Flash loan executed successfully: ${tx.hash}`);

      // Log to database
      await storage.createFlashLoanRequest(userId, {
        userId,
        token: params.assets[0], // First asset
        amount: params.amounts[0],
        provider: 'aave_v3',
        txHash: tx.hash,
        status: 'SUCCESS',
        premium: ethers.formatUnits(totalPremium, 6), // Assume USDC decimals
        gasCostUsd: gasCostUsd.toString(),
      });

      return {
        success: true,
        txHash: tx.hash,
        loanAmount: params.amounts[0],
        premium: ethers.formatUnits(totalPremium, 6),
        totalRepayment: ethers.formatUnits(
          BigInt(params.amounts[0]) + totalPremium,
          6
        ),
        message: `Flash loan executed successfully on ${this.chainId === 137 ? 'Polygon' : 'Mumbai'}`,
        gasUsed: receipt.gasUsed.toString(),
        gasCostUsd,
      };
    } catch (error: any) {
      console.error('Flash loan execution failed:', error);

      // Log failed attempt to database
      await storage.createFlashLoanRequest(userId, {
        userId,
        token: params.assets[0],
        amount: params.amounts[0],
        provider: 'aave_v3',
        status: 'FAILED',
        error: error.message,
      });

      return {
        success: false,
        loanAmount: params.amounts[0],
        premium: '0',
        totalRepayment: '0',
        message: 'Flash loan execution failed',
        error: error.message,
      };
    }
  }

  /**
   * Simulate flash loan execution (for testing without spending gas)
   */
  async simulateFlashLoan(
    userId: string,
    params: FlashLoanParams,
    signerPrivateKey: string
  ): Promise<FlashLoanResult> {
    try {
      // Get provider
      const provider = await web3Provider.getCustomProvider(userId);
      const signer = new ethers.Wallet(signerPrivateKey, provider);

      // Create Pool contract instance
      const poolContract = new ethers.Contract(
        this.poolAddress,
        AAVE_POOL_ABI,
        signer
      );

      // Get flash loan premium
      const premiumTotal = await poolContract.FLASHLOAN_PREMIUM_TOTAL();
      
      // Calculate premium
      const totalPremium = params.amounts.reduce((sum, amount) => {
        const amountBN = BigInt(amount);
        const premium = (amountBN * BigInt(premiumTotal)) / BigInt(10000);
        return sum + premium;
      }, BigInt(0));

      // Simulate using staticCall (doesn't send transaction)
      const modes = params.assets.map(() => 0);
      const encodedParams = params.params || '0x';

      await poolContract.flashLoan.staticCall(
        params.receiverAddress,
        params.assets,
        params.amounts,
        modes,
        signer.address,
        encodedParams,
        0
      );

      console.log('✅ Flash loan simulation successful');

      return {
        success: true,
        loanAmount: params.amounts[0],
        premium: ethers.formatUnits(totalPremium, 6),
        totalRepayment: ethers.formatUnits(
          BigInt(params.amounts[0]) + totalPremium,
          6
        ),
        message: 'Flash loan simulation successful',
      };
    } catch (error: any) {
      console.error('Flash loan simulation failed:', error);

      return {
        success: false,
        loanAmount: params.amounts[0],
        premium: '0',
        totalRepayment: '0',
        message: 'Flash loan simulation failed',
        error: error.message,
      };
    }
  }

  /**
   * Get available flash loan assets with current liquidity
   */
  async getAvailableAssets(userId: string): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    maxLiquidity: string;
  }>> {
    try {
      // In production, fetch actual liquidity from Aave data provider
      // For now, return static list
      return [
        {
          address: FLASH_LOAN_ASSETS.USDC,
          symbol: 'USDC',
          name: 'USD Coin',
          maxLiquidity: '10000000', // 10M USDC
        },
        {
          address: FLASH_LOAN_ASSETS.USDT,
          symbol: 'USDT',
          name: 'Tether USD',
          maxLiquidity: '8000000',
        },
        {
          address: FLASH_LOAN_ASSETS.DAI,
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          maxLiquidity: '5000000',
        },
        {
          address: FLASH_LOAN_ASSETS.WETH,
          symbol: 'WETH',
          name: 'Wrapped Ether',
          maxLiquidity: '2000',
        },
        {
          address: FLASH_LOAN_ASSETS.WMATIC,
          symbol: 'WMATIC',
          name: 'Wrapped MATIC',
          maxLiquidity: '5000000',
        },
        {
          address: FLASH_LOAN_ASSETS.WBTC,
          symbol: 'WBTC',
          name: 'Wrapped BTC',
          maxLiquidity: '100',
        },
      ];
    } catch (error) {
      console.error('Error fetching available assets:', error);
      return [];
    }
  }

  /**
   * Calculate flash loan premium and total repayment
   */
  async calculatePremium(
    amount: string,
    assetDecimals: number = 6
  ): Promise<{ premium: string; totalRepayment: string; premiumPercent: number }> {
    try {
      // Aave V3 flash loan premium is 0.05% (5 basis points)
      const PREMIUM_BP = 5; // basis points
      const premiumPercent = PREMIUM_BP / 100; // 0.05%

      const amountBN = BigInt(amount);
      const premium = (amountBN * BigInt(PREMIUM_BP)) / BigInt(10000);
      const totalRepayment = amountBN + premium;

      return {
        premium: ethers.formatUnits(premium, assetDecimals),
        totalRepayment: ethers.formatUnits(totalRepayment, assetDecimals),
        premiumPercent,
      };
    } catch (error) {
      throw new Error(`Failed to calculate premium: ${error}`);
    }
  }

  /**
   * Get Aave Pool address for current chain
   */
  getPoolAddress(): string {
    return this.poolAddress;
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.chainId;
  }
}

// Export singleton instance
export const aaveFlashLoanV3 = new AaveFlashLoanV3();
