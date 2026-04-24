# Fix Orderbook Rate Direction for Buy/Sell Operations

Closes #201

## Problem

The rate fetch uses `orderbook.asks[0].price` for both buying and selling directions. This is incorrect because:

- When buying asset B with asset A: use ask price (what sellers want)
- When selling asset B to get asset A: use bid price (what buyers offer)

Using the ask price for both directions systematically overestimates the cost for one direction and underestimates it for the other, leading to incorrect payment quotes.

## Solution

Implemented correct bid/ask handling based on transaction direction:

- For `from → to` (buying to with from): use `asks[0].price`
- For `to → from` (selling to to get from): use `bids[0].price`
- Added mid-price option: `(ask + bid) / 2` for display with slippage on execution

## Changes Made

### New Service
- `server/src/services/stellar.service.ts` - Stellar orderbook integration with correct rate direction

### New Tests
- `server/tests/services/stellar.service.test.ts` - Comprehensive tests verifying rate direction

## Features Implemented

### Correct Rate Direction
- `getExchangeRate(fromAsset, toAsset, direction)` - Returns correct rate based on buy/sell direction
- Direction parameter: `'buy'` or `'sell'`
- Validates rate is different for buy vs sell (spread)

### Mid-Price Option
- `getExchangeRateMidPrice(fromAsset, toAsset)` - Returns average of bid and ask
- Useful for display purposes
- Requires slippage tolerance on execution

### Spread Calculation
- Calculates spread percentage: `(ask - bid) / midPrice * 100`
- Returns spread in response for transparency
- Helps users understand market conditions

### Slippage Protection
- `calculateOutputWithSlippage(inputAmount, rate, slippageTolerance)` - Calculates expected and minimum output
- Default 1% slippage tolerance
- Configurable for different market conditions

## Testing

Comprehensive test suite verifies:

- Ask price used when buying (direction: buy)
- Bid price used when selling (direction: sell)
- Mid-price calculated correctly
- Spread calculated correctly
- Rates are different for buy vs sell
- Error handling for insufficient liquidity
- Various asset pair combinations

### Test Cases

```typescript
// USDC -> XLM (buying XLM with USDC)
const buyRate = await getExchangeRate(usdc, xlm, 'buy');
expect(buyRate.rate).toBe('1.0500000'); // asks[0].price

// XLM -> USDC (selling XLM for USDC)
const sellRate = await getExchangeRate(xlm, usdc, 'sell');
expect(sellRate.rate).toBe('1.0400000'); // bids[0].price

// Buy rate should be higher than sell rate (spread)
expect(parseFloat(buyRate.rate)).toBeGreaterThan(parseFloat(sellRate.rate));
```

## API Response Format

```json
{
  "rate": "1.0500000",
  "direction": "buy",
  "spread": "0.9569%",
  "midPrice": "1.0450000"
}
```

## Breaking Changes

None - this is a new service implementation

## Dependencies

- `@stellar/stellar-sdk` - Already in use

## Production Recommendations

1. Monitor spread percentages for market health
2. Set maximum spread threshold for user protection
3. Implement rate caching with short TTL (5-10 seconds)
4. Add circuit breaker for orderbook API failures
5. Log all rate fetches for audit trail

## Security Considerations

- Rate manipulation: Use multiple orderbook levels for large trades
- Slippage protection: Always set minimum output amount
- Timeout handling: Fail gracefully if orderbook unavailable

## Notes

- Orderbook rates are real-time and can change between quote and execution
- Always use slippage tolerance for actual trades
- Consider implementing price impact calculation for large trades
- Monitor for wash trading or market manipulation
