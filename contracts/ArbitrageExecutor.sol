
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArbitrageExecutor
 * @notice Executes arbitrage trades using Aave V3 Flash Loans
 * @dev This contract receives flash loans and executes swaps on DEXes
 */
contract ArbitrageExecutor is FlashLoanSimpleReceiverBase, Ownable {
    
    // Events
    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        address indexed executor
    );
    
    event EmergencyWithdraw(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );

    // Structs
    struct SwapParams {
        address router;      // DEX router address (1inch, Uniswap, etc.)
        bytes callData;      // Encoded swap call data
    }

    struct ArbitrageParams {
        SwapParams buySwap;   // First swap (buy)
        SwapParams sellSwap;  // Second swap (sell)
        uint256 minProfit;    // Minimum profit required (in token units)
    }

    // State variables
    mapping(address => bool) public approvedExecutors;
    uint256 public totalProfits;
    
    /**
     * @notice Constructor
     * @param _addressProvider Aave V3 Pool Addresses Provider
     */
    constructor(
        IPoolAddressesProvider _addressProvider
    ) FlashLoanSimpleReceiverBase(_addressProvider) Ownable(msg.sender) {}

    /**
     * @notice Execute arbitrage trade using flash loan
     * @param asset Token address to borrow
     * @param amount Amount to borrow
     * @param params Encoded arbitrage parameters
     */
    function executeArbitrage(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external {
        require(approvedExecutors[msg.sender] || msg.sender == owner(), "Not authorized");
        
        // Request flash loan from Aave V3
        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0 // referral code
        );
    }

    /**
     * @notice Called by Aave Pool after receiving flash loan
     * @param asset The address of the flash-borrowed asset
     * @param amount The amount of the flash-borrowed asset
     * @param premium The fee for the flash loan
     * @param initiator The address that initiated the flash loan
     * @param params Encoded arbitrage parameters
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Caller must be Pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Decode arbitrage parameters
        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));

        // Get initial balance
        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));

        // Execute BUY swap
        _executeSwap(asset, amount, arbParams.buySwap);

        // Execute SELL swap (swap back to original token)
        _executeSwap(asset, 0, arbParams.sellSwap); // Amount will be max balance

        // Check profit
        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        uint256 totalRepayment = amount + premium;
        
        require(balanceAfter >= totalRepayment, "Insufficient balance to repay loan");
        
        uint256 profit = balanceAfter - totalRepayment;
        require(profit >= arbParams.minProfit, "Profit below minimum threshold");

        // Approve repayment
        IERC20(asset).approve(address(POOL), totalRepayment);

        // Track profits
        totalProfits += profit;

        emit ArbitrageExecuted(asset, amount, profit, initiator);

        return true;
    }

    /**
     * @notice Execute swap on DEX
     * @param tokenIn Input token address
     * @param amountIn Amount to swap (0 = use full balance)
     * @param swapParams Swap parameters
     */
    function _executeSwap(
        address tokenIn,
        uint256 amountIn,
        SwapParams memory swapParams
    ) internal {
        // If amountIn is 0, use full balance
        if (amountIn == 0) {
            amountIn = IERC20(tokenIn).balanceOf(address(this));
        }

        // Approve router to spend tokens
        IERC20(tokenIn).approve(swapParams.router, amountIn);

        // Execute swap via router
        (bool success, bytes memory result) = swapParams.router.call(swapParams.callData);
        require(success, string(abi.encodePacked("Swap failed: ", result)));
    }

    /**
     * @notice Add approved executor
     * @param executor Address to approve
     */
    function addExecutor(address executor) external onlyOwner {
        approvedExecutors[executor] = true;
    }

    /**
     * @notice Remove approved executor
     * @param executor Address to remove
     */
    function removeExecutor(address executor) external onlyOwner {
        approvedExecutors[executor] = false;
    }

    /**
     * @notice Emergency withdraw tokens
     * @param token Token address (address(0) for native)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).transfer(owner(), amount);
        }
        
        emit EmergencyWithdraw(token, amount, owner());
    }

    /**
     * @notice Withdraw profits
     * @param token Token address
     */
    function withdrawProfits(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No profits to withdraw");
        
        IERC20(token).transfer(owner(), balance);
    }

    /**
     * @notice Get contract balance
     * @param token Token address
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Receive ETH
    receive() external payable {}
}
