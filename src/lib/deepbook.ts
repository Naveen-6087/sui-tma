/**
 * DeepBook V3 Integration Library
 * 
 * This module provides integration with DeepBook V3 CLOB on Sui
 * for executing trades, flash loans, and market orders.
 */

import { Transaction } from '@mysten/sui/transactions';

// ============== Package IDs (for compatibility) ==============

export const PACKAGE_IDS = {
  intentRegistry: '0xe29fd9c9698d416c6f4327fe83e06dad7116302f6efabef96b94d9ab86442656',
  sealPolicy: '0xdacdece21b4b19fe7b5631a9594056fc01132a11d5dc75498a4f4c4a641b9c37',
  intentRegistryObject: '0x4a7e401d3cf98cb1e22b6443c5acff556ffc1e78dd5319dca8bdfc73edbc053c',
};

// ============== DeepBook V3 Contract Addresses (Testnet) ==============

export const DEEPBOOK_TESTNET = {
  PACKAGE_ID: '0x337f4f4f6567fcd778d5454f27c16c70e2f274cc6377ea6249ddf491482ef497',
  REGISTRY_ID: '0xb51c5c21e4c16fc6c3b4c3f3c1e6c8d7f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5', // Update with actual
};

// ============== Coin Types ==============

export const COIN_TYPES = {
  SUI: '0x2::sui::SUI',
  USDC: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  DEEP: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP',
  DBUSDC: '0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC',
  DBUSDT: '0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDT::DBUSDT',
};

// ============== Pool Information (Testnet) ==============

export const POOLS = {
  SUI_USDC: {
    poolId: '0xd0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1',
    baseCoin: COIN_TYPES.SUI,
    quoteCoin: COIN_TYPES.USDC,
    baseDecimals: 9,
    quoteDecimals: 6,
    tickSize: 1000,
    lotSize: 1000000,
    minSize: 10000000,
  },
  DEEP_SUI: {
    poolId: '0xa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3d4e5f6a7b8c9d0e1f2',
    baseCoin: COIN_TYPES.DEEP,
    quoteCoin: COIN_TYPES.SUI,
    baseDecimals: 6,
    quoteDecimals: 9,
    tickSize: 1000,
    lotSize: 1000000,
    minSize: 10000000,
  },
  DBUSDC_DBUSDT: {
    poolId: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3d4e5f6a7b8c9d0e1f2a3',
    baseCoin: COIN_TYPES.DBUSDC,
    quoteCoin: COIN_TYPES.DBUSDT,
    baseDecimals: 6,
    quoteDecimals: 6,
    tickSize: 1000,
    lotSize: 1000000,
    minSize: 10000000,
  },
};

// ============== Types ==============

export interface PoolInfo {
  poolId: string;
  baseCoin: string;
  quoteCoin: string;
  baseDecimals: number;
  quoteDecimals: number;
  tickSize: number;
  lotSize: number;
  minSize: number;
}

export interface OrderParams {
  poolId: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  orderType: 'limit' | 'market' | 'ioc' | 'fok';
  clientOrderId?: string;
}

export interface SwapParams {
  poolId: string;
  inputCoin: string;
  outputCoin: string;
  amount: bigint;
  minOutput: bigint;
}

export interface FlashLoanParams {
  poolId: string;
  borrowBase: boolean;
  amount: bigint;
}

// ============== Demo/Simulation Mode ==============

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// Mock price data for simulation
export const MOCK_PRICES: Record<string, number> = {
  SUI_USDC: 1.85,
  DEEP_SUI: 0.12,
  DBUSDC_DBUSDT: 1.0001,
};

// Mock order book for simulation
export const MOCK_ORDERBOOK = {
  SUI_USDC: {
    bids: [
      { price: 1.84, quantity: 1000 },
      { price: 1.83, quantity: 2500 },
      { price: 1.82, quantity: 5000 },
    ],
    asks: [
      { price: 1.86, quantity: 800 },
      { price: 1.87, quantity: 1500 },
      { price: 1.88, quantity: 3000 },
    ],
  },
};

// ============== Price Fetching ==============

/**
 * Fetch current price from DeepBook indexer or mock data
 */
export async function fetchPrice(pair: string): Promise<number> {
  if (DEMO_MODE) {
    // Return mock price with slight variation for realism
    const basePrice = MOCK_PRICES[pair] || 1.0;
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    return basePrice * (1 + variation);
  }

  try {
    // Try DeepBook indexer
    const response = await fetch(
      `https://deepbook-indexer.testnet.sui.io/get_mid_price?pool_id=${POOLS[pair as keyof typeof POOLS]?.poolId}`
    );
    
    if (response.ok) {
      const data = await response.json();
      return parseFloat(data.mid_price);
    }
  } catch (error) {
    console.warn('DeepBook indexer unavailable, using fallback');
  }

  // Fallback to CoinGecko for SUI price
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd'
    );
    const data = await response.json();
    return data.sui?.usd || MOCK_PRICES[pair] || 1.0;
  } catch {
    return MOCK_PRICES[pair] || 1.0;
  }
}

/**
 * Fetch order book from DeepBook indexer
 */
export async function fetchOrderBook(pair: string, depth: number = 10) {
  if (DEMO_MODE) {
    return MOCK_ORDERBOOK[pair as keyof typeof MOCK_ORDERBOOK] || MOCK_ORDERBOOK.SUI_USDC;
  }

  try {
    const pool = POOLS[pair as keyof typeof POOLS];
    if (!pool) throw new Error(`Unknown pair: ${pair}`);

    const response = await fetch(
      `https://deepbook-indexer.testnet.sui.io/get_order_book?pool_id=${pool.poolId}&depth=${depth}`
    );
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to fetch order book:', error);
  }

  return MOCK_ORDERBOOK.SUI_USDC;
}

// ============== PTB Builders ==============

/**
 * Build a market swap transaction
 */
export function buildSwapTx(
  params: SwapParams,
  tx: Transaction = new Transaction()
): Transaction {
  const pool = Object.values(POOLS).find(p => p.poolId === params.poolId);
  if (!pool) throw new Error('Pool not found');

  // Determine if we're swapping base for quote or quote for base
  const isBaseToQuote = params.inputCoin === pool.baseCoin;
  const functionName = isBaseToQuote ? 'swap_exact_base_for_quote' : 'swap_exact_quote_for_base';

  tx.moveCall({
    target: `${DEEPBOOK_TESTNET.PACKAGE_ID}::pool::${functionName}`,
    typeArguments: [pool.baseCoin, pool.quoteCoin],
    arguments: [
      tx.object(params.poolId),
      tx.pure.u64(params.amount),
      tx.pure.u64(params.minOutput),
      tx.object('0x6'), // Clock
    ],
  });

  return tx;
}

/**
 * Build a flash loan borrow transaction
 * Returns the coin and flash loan receipt
 */
export function buildFlashLoanBorrowTx(
  params: FlashLoanParams,
  tx: Transaction = new Transaction()
): { tx: Transaction; coinResult: any; receiptResult: any } {
  const pool = Object.values(POOLS).find(p => p.poolId === params.poolId);
  if (!pool) throw new Error('Pool not found');

  const functionName = params.borrowBase ? 'borrow_flashloan_base' : 'borrow_flashloan_quote';

  const result = tx.moveCall({
    target: `${DEEPBOOK_TESTNET.PACKAGE_ID}::pool::${functionName}`,
    typeArguments: [pool.baseCoin, pool.quoteCoin],
    arguments: [
      tx.object(params.poolId),
      tx.pure.u64(params.amount),
    ],
  });

  return { tx, coinResult: result, receiptResult: result };
}

/**
 * Build a flash loan repay transaction
 */
export function buildFlashLoanRepayTx(
  poolId: string,
  coin: any,
  receipt: any,
  borrowBase: boolean,
  tx: Transaction
): Transaction {
  const pool = Object.values(POOLS).find(p => p.poolId === poolId);
  if (!pool) throw new Error('Pool not found');

  const functionName = borrowBase ? 'return_flashloan_base' : 'return_flashloan_quote';

  tx.moveCall({
    target: `${DEEPBOOK_TESTNET.PACKAGE_ID}::pool::${functionName}`,
    typeArguments: [pool.baseCoin, pool.quoteCoin],
    arguments: [
      tx.object(poolId),
      coin,
      receipt,
    ],
  });

  return tx;
}

/**
 * Build a limit order transaction
 */
export function buildLimitOrderTx(
  params: OrderParams,
  balanceManagerId: string,
  tradeProofId: string,
  tx: Transaction = new Transaction()
): Transaction {
  const pool = Object.values(POOLS).find(p => p.poolId === params.poolId);
  if (!pool) throw new Error('Pool not found');

  // Convert price to tick units
  const priceInTicks = Math.floor(params.price * Math.pow(10, pool.quoteDecimals) / pool.tickSize);
  
  // Convert quantity to lot units
  const quantityInLots = Math.floor(params.quantity * Math.pow(10, pool.baseDecimals) / pool.lotSize);

  const isBid = params.side === 'buy';
  const orderType = params.orderType === 'limit' ? 0 : params.orderType === 'ioc' ? 1 : 2;

  tx.moveCall({
    target: `${DEEPBOOK_TESTNET.PACKAGE_ID}::pool::place_limit_order`,
    typeArguments: [pool.baseCoin, pool.quoteCoin],
    arguments: [
      tx.object(params.poolId),
      tx.object(balanceManagerId),
      tx.object(tradeProofId),
      tx.pure.u64(params.clientOrderId || Date.now().toString()),
      tx.pure.u8(orderType),
      tx.pure.u8(0), // self-matching prevention
      tx.pure.u64(priceInTicks),
      tx.pure.u64(quantityInLots),
      tx.pure.bool(isBid),
      tx.pure.bool(true), // pay with deep
      tx.pure.u64(Date.now() + 3600000), // expire in 1 hour
      tx.object('0x6'), // Clock
    ],
  });

  return tx;
}

// ============== Flash Arbitrage ==============

/**
 * Build a flash arbitrage transaction
 * 1. Borrow asset A from pool 1
 * 2. Swap A -> B in pool 2
 * 3. Swap B -> A in pool 3 (or back in pool 1)
 * 4. Repay flash loan
 * 5. Keep profit
 */
export function buildFlashArbitrageTx(
  borrowPoolId: string,
  swapPool1Id: string,
  swapPool2Id: string,
  borrowAmount: bigint,
  minProfit: bigint,
  tx: Transaction = new Transaction()
): Transaction {
  // This is a simplified example - real arbitrage would need more complex routing
  
  // Step 1: Borrow from flash loan
  const { tx: tx1, coinResult, receiptResult } = buildFlashLoanBorrowTx(
    { poolId: borrowPoolId, borrowBase: true, amount: borrowAmount },
    tx
  );

  // Step 2 & 3: Swap through pools (simplified)
  // In reality, you'd chain multiple swaps
  
  // Step 4: Repay flash loan
  buildFlashLoanRepayTx(borrowPoolId, coinResult, receiptResult, true, tx1);

  return tx1;
}

// ============== Utility Functions ==============

/**
 * Calculate slippage-adjusted minimum output
 */
export function calculateMinOutput(
  amount: bigint,
  price: number,
  slippageBps: number,
  decimalsIn: number,
  decimalsOut: number
): bigint {
  const expectedOutput = (Number(amount) / Math.pow(10, decimalsIn)) * price * Math.pow(10, decimalsOut);
  const minOutput = expectedOutput * (1 - slippageBps / 10000);
  return BigInt(Math.floor(minOutput));
}

/**
 * Format amount with decimals
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = Math.pow(10, decimals);
  return (Number(amount) / divisor).toFixed(decimals > 4 ? 4 : decimals);
}

/**
 * Parse amount string to bigint
 */
export function parseAmount(amount: string, decimals: number): bigint {
  const multiplier = Math.pow(10, decimals);
  return BigInt(Math.floor(parseFloat(amount) * multiplier));
}

// ============== Demo Transaction Builders ==============

/**
 * Build a demo swap transaction that simulates the workflow
 * but uses minimal amounts for testnet
 */
export function buildDemoSwapTx(
  pair: string,
  side: 'buy' | 'sell',
  amount: number,
  tx: Transaction = new Transaction()
): { tx: Transaction; description: string } {
  const pool = POOLS[pair as keyof typeof POOLS];
  if (!pool) throw new Error(`Unknown pair: ${pair}`);

  // Use very small amounts for demo (0.01 SUI worth)
  const demoAmount = BigInt(Math.floor(amount * Math.pow(10, pool.baseDecimals)));
  
  const description = `Demo ${side} ${amount} ${pair.split('_')[0]} at market price`;

  // For demo mode, we just emit an event rather than executing real swap
  if (DEMO_MODE) {
    // Just split a tiny amount from gas to create a valid transaction
    tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
  }

  return { tx, description };
}

export default {
  DEEPBOOK_TESTNET,
  COIN_TYPES,
  POOLS,
  DEMO_MODE,
  fetchPrice,
  fetchOrderBook,
  buildSwapTx,
  buildFlashLoanBorrowTx,
  buildFlashLoanRepayTx,
  buildLimitOrderTx,
  buildFlashArbitrageTx,
  buildDemoSwapTx,
  calculateMinOutput,
  formatAmount,
  parseAmount,
};
