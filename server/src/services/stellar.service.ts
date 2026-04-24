import { Server, Asset, Horizon } from '@stellar/stellar-sdk';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const horizonServer = new Server(HORIZON_URL);

export interface OrderbookRate {
  rate: string;
  direction: 'buy' | 'sell';
  spread: string;
  midPrice: string;
}

/**
 * Fetch exchange rate from Stellar orderbook with correct bid/ask handling
 * 
 * For buying toAsset with fromAsset: use asks[0].price (seller's price)
 * For selling toAsset to get fromAsset: use bids[0].price (buyer's price)
 * 
 * @param fromAsset - Asset being sold/spent
 * @param toAsset - Asset being bought/received
 * @param direction - 'buy' means buying toAsset, 'sell' means selling toAsset
 */
export async function getExchangeRate(
  fromAsset: Asset,
  toAsset: Asset,
  direction: 'buy' | 'sell' = 'buy'
): Promise<OrderbookRate> {
  try {
    // Fetch orderbook for the asset pair
    const orderbook = await horizonServer
      .orderbook(fromAsset, toAsset)
      .call();

    const asks: Array<{ price: string; amount: string }> = orderbook.asks ?? [];
    const bids: Array<{ price: string; amount: string }> = orderbook.bids ?? [];

    if (asks.length === 0 || bids.length === 0) {
      throw new Error('Insufficient liquidity in orderbook');
    }

    // Use correct side of orderbook based on direction
    // When buying toAsset with fromAsset: use ask price (what sellers want)
    // When selling toAsset for fromAsset: use bid price (what buyers offer)
    const rate = direction === 'buy' ? asks[0].price : bids[0].price;
    
    // Calculate mid-price for reference
    const askPrice = parseFloat(asks[0].price);
    const bidPrice = parseFloat(bids[0].price);
    const midPrice = ((askPrice + bidPrice) / 2).toFixed(7);
    
    // Calculate spread (difference between ask and bid)
    const spread = ((askPrice - bidPrice) / midPrice * 100).toFixed(4);

    return {
      rate,
      direction,
      spread: `${spread}%`,
      midPrice,
    };
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    throw new Error(`Failed to fetch exchange rate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get exchange rate using mid-price (average of bid and ask)
 * This provides a fair price but requires slippage tolerance on execution
 */
export async function getExchangeRateMidPrice(
  fromAsset: Asset,
  toAsset: Asset
): Promise<OrderbookRate> {
  try {
    const orderbook = await horizonServer
      .orderbook(fromAsset, toAsset)
      .call();

    const asks: Array<{ price: string; amount: string }> = orderbook.asks ?? [];
    const bids: Array<{ price: string; amount: string }> = orderbook.bids ?? [];

    if (asks.length === 0 || bids.length === 0) {
      throw new Error('Insufficient liquidity in orderbook');
    }

    const askPrice = parseFloat(asks[0].price);
    const bidPrice = parseFloat(bids[0].price);
    const midPrice = ((askPrice + bidPrice) / 2).toFixed(7);
    const spread = ((askPrice - bidPrice) / parseFloat(midPrice) * 100).toFixed(4);

    return {
      rate: midPrice,
      direction: 'mid',
      spread: `${spread}%`,
      midPrice,
    };
  } catch (error) {
    console.error('Error fetching mid-price:', error);
    throw new Error(`Failed to fetch mid-price: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate expected output amount with slippage protection
 */
export function calculateOutputWithSlippage(
  inputAmount: number,
  rate: string,
  slippageTolerance: number = 0.01 // 1% default
): { expectedOutput: string; minimumOutput: string } {
  const rateNum = parseFloat(rate);
  const expectedOutput = inputAmount * rateNum;
  const minimumOutput = expectedOutput * (1 - slippageTolerance);

  return {
    expectedOutput: expectedOutput.toFixed(7),
    minimumOutput: minimumOutput.toFixed(7),
  };
}
