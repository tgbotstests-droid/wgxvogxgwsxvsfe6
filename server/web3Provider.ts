import { ethers } from 'ethers';
import { storage } from './storage';

// Polygon RPC endpoints
const POLYGON_MAINNET_RPC = 'https://polygon-rpc.com';
const POLYGON_TESTNET_RPC = 'https://rpc.ankr.com/polygon_amoy';

// Token addresses on Polygon
export const POLYGON_TOKENS = {
  MATIC: '0x0000000000000000000000000000000000000000', // Native token
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
};

// ERC20 ABI (minimal for balance checking and transfers)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  balanceFormatted: string;
  valueUsd?: number;
}

interface WalletBalances {
  address: string;
  chainId: number;
  nativeBalance: string;
  nativeBalanceFormatted: string;
  tokens: TokenBalance[];
  totalValueUsd: number;
}

export class Web3Provider {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

  constructor() {
    // Initialize providers for both mainnet and testnet
    this.providers.set(137, new ethers.JsonRpcProvider(POLYGON_MAINNET_RPC)); // Polygon Mainnet
    this.providers.set(80002, new ethers.JsonRpcProvider(POLYGON_TESTNET_RPC)); // Polygon Amoy Testnet
  }

  /**
   * Get provider for specific chain
   */
  getProvider(chainId: number = 137): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not found for chain ${chainId}`);
    }
    return provider;
  }

  /**
   * Get custom RPC provider from user config
   */
  async getCustomProvider(userId: string): Promise<ethers.JsonRpcProvider> {
    const config = await storage.getBotConfig(userId);

    if (!config) {
      return this.getProvider(137); // Default to mainnet
    }

    const rpcUrl = config.networkMode === 'mainnet' 
      ? (config.polygonRpcUrl || POLYGON_MAINNET_RPC)
      : (config.polygonTestnetRpcUrl || POLYGON_TESTNET_RPC);

    return new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    chainId: number = 137
  ): Promise<{
    balance: string;
    balanceFormatted: string;
    decimals: number;
  }> {
    try {
      const provider = this.getProvider(chainId);

      // ERC20 ABI for balanceOf
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);

      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.decimals(),
      ]);

      const balanceFormatted = ethers.formatUnits(balance, decimals);

      return {
        balance: balance.toString(),
        balanceFormatted,
        decimals: Number(decimals),
      };
    } catch (error: any) {
      console.error('Error getting token balance:', error);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  /**
   * Get native token balance (MATIC)
   */
  async getNativeBalance(
    address: string, 
    chainId: number = 137
  ): Promise<{ balance: string; balanceFormatted: string }> {
    const provider = this.getProvider(chainId);
    const balance = await provider.getBalance(address);
    const balanceFormatted = ethers.formatEther(balance);

    return {
      balance: balance.toString(),
      balanceFormatted,
    };
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(
    walletAddress: string,
    tokenAddress: string,
    chainId: number = 137
  ): Promise<TokenBalance> {
    const provider = this.getProvider(chainId);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    try {
      const [balance, decimals, symbol, name] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals(),
        contract.symbol(),
        contract.name(),
      ]);

      const balanceFormatted = ethers.formatUnits(balance, decimals);

      return {
        address: tokenAddress,
        symbol,
        name,
        balance: balance.toString(),
        decimals: Number(decimals),
        balanceFormatted,
      };
    } catch (error) {
      console.error(`Error fetching token balance for ${tokenAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get all balances for a wallet (native + common tokens)
   */
  async getWalletBalances(
    walletAddress: string,
    chainId: number = 137,
    includeTokens: string[] = Object.values(POLYGON_TOKENS)
  ): Promise<WalletBalances> {
    const provider = this.getProvider(chainId);

    // Get native balance
    const nativeBalance = await provider.getBalance(walletAddress);
    const nativeBalanceFormatted = ethers.formatEther(nativeBalance);

    // Get token balances (excluding native MATIC address 0x0...)
    const tokenAddresses = includeTokens.filter(
      addr => addr !== POLYGON_TOKENS.MATIC
    );

    const tokenBalances = await Promise.allSettled(
      tokenAddresses.map(tokenAddr =>
        this.getTokenBalance(walletAddress, tokenAddr, chainId)
      )
    );

    const tokens: TokenBalance[] = tokenBalances
      .filter((result): result is PromiseFulfilledResult<TokenBalance> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value)
      .filter(token => parseFloat(token.balanceFormatted) > 0);

    return {
      address: walletAddress,
      chainId,
      nativeBalance: nativeBalance.toString(),
      nativeBalanceFormatted,
      tokens,
      totalValueUsd: 0, // TODO: Add price oracle integration
    };
  }

  /**
   * Get current gas price
   */
  async getGasPrice(chainId: number = 137): Promise<{
    gasPrice: string;
    gasPriceGwei: string;
  }> {
    const provider = this.getProvider(chainId);
    const feeData = await provider.getFeeData();

    if (!feeData.gasPrice) {
      throw new Error('Gas price not available');
    }

    const gasPrice = feeData.gasPrice.toString();
    const gasPriceGwei = ethers.formatUnits(feeData.gasPrice, 'gwei');

    return {
      gasPrice,
      gasPriceGwei,
    };
  }

  /**
   * Get current block number
   */
  async getBlockNumber(chainId: number = 137): Promise<number> {
    const provider = this.getProvider(chainId);
    return await provider.getBlockNumber();
  }

  /**
   * Check if address is valid
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash: string, chainId: number = 137) {
    const provider = this.getProvider(chainId);
    return await provider.getTransaction(txHash);
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string, chainId: number = 137) {
    const provider = this.getProvider(chainId);
    return await provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    txHash: string, 
    confirmations: number = 1,
    chainId: number = 137
  ) {
    const provider = this.getProvider(chainId);
    return await provider.waitForTransaction(txHash, confirmations);
  }
}

// Export singleton instance
export const web3Provider = new Web3Provider();