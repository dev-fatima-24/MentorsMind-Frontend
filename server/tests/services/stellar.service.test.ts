import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Asset } from '@stellar/stellar-sdk';
import { getExchangeRate, getExchangeRateMidPrice, calculateOutputWithSlippage } from '../../src/services/stellar.service';

// Mock the Stellar SDK
vi.mock('@stellar/stellar-sdk', async () => {
  const actual = await vi.importActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Server: vi.fn().mockImplementation(() => ({
      orderbook: vi.fn().mockReturnValue({
        call: vi.fn(),
      }),
    })),
  };
});

describe('Stellar Service - Exchange Rate', () => {
  const mockOrderbook = {
    asks: [
      { price: '1.0500000', amount: '1000' },
      { price: '1.0600000', amount: '500' },
    ],
    bids: [
      { price: '1.0400000', amount: '800' },
      { price: '1.0300000', amount: '600' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getExchangeRate', () => {
    it('should use ask price when buying (direction: buy)', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const fromAsset = new Asset('USDC', 'ISSUER');
      const toAsset = new Asset('XLM', 'native');

      const result = await getExchangeRate(fromAsset, toAsset, 'buy');

      expect(result.rate).toBe('1.0500000'); // Should use asks[0].price
      expect(result.direction).toBe('buy');
    });

    it('should use bid price when selling (direction: sell)', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const fromAsset = new Asset('XLM', 'native');
      const toAsset = new Asset('USDC', 'ISSUER');

      const result = await getExchangeRate(fromAsset, toAsset, 'sell');

      expect(result.rate).toBe('1.0400000'); // Should use bids[0].price
      expect(result.direction).toBe('sell');
    });

    it('should calculate mid-price correctly', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const fromAsset = new Asset('USDC', 'ISSUER');
      const toAsset = new Asset('XLM', 'native');

      const result = await getExchangeRate(fromAsset, toAsset, 'buy');

      // Mid-price = (1.05 + 1.04) / 2 = 1.045
      expect(result.midPrice).toBe('1.0450000');
    });

    it('should calculate spread correctly', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const fromAsset = new Asset('USDC', 'ISSUER');
      const toAsset = new Asset('XLM', 'native');

      const result = await getExchangeRate(fromAsset, toAsset, 'buy');

      // Spread = (1.05 - 1.04) / 1.045 * 100 ≈ 0.9569%
      expect(parseFloat(result.spread)).toBeCloseTo(0.9569, 2);
    });

    it('should throw error when orderbook has no asks', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue({
        asks: [],
        bids: mockOrderbook.bids,
      });

      const fromAsset = new Asset('USDC', 'ISSUER');
      const toAsset = new Asset('XLM', 'native');

      await expect(getExchangeRate(fromAsset, toAsset, 'buy')).rejects.toThrow(
        'Insufficient liquidity in orderbook'
      );
    });

    it('should throw error when orderbook has no bids', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue({
        asks: mockOrderbook.asks,
        bids: [],
      });

      const fromAsset = new Asset('USDC', 'ISSUER');
      const toAsset = new Asset('XLM', 'native');

      await expect(getExchangeRate(fromAsset, toAsset, 'sell')).rejects.toThrow(
        'Insufficient liquidity in orderbook'
      );
    });
  });

  describe('getExchangeRateMidPrice', () => {
    it('should return mid-price between bid and ask', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const fromAsset = new Asset('USDC', 'ISSUER');
      const toAsset = new Asset('XLM', 'native');

      const result = await getExchangeRateMidPrice(fromAsset, toAsset);

      expect(result.rate).toBe('1.0450000');
      expect(result.midPrice).toBe('1.0450000');
      expect(result.direction).toBe('mid');
    });
  });

  describe('calculateOutputWithSlippage', () => {
    it('should calculate expected output correctly', () => {
      const result = calculateOutputWithSlippage(100, '1.0500000', 0.01);

      expect(result.expectedOutput).toBe('105.0000000');
      expect(parseFloat(result.minimumOutput)).toBeCloseTo(103.95, 2);
    });

    it('should apply custom slippage tolerance', () => {
      const result = calculateOutputWithSlippage(100, '1.0500000', 0.05); // 5% slippage

      expect(result.expectedOutput).toBe('105.0000000');
      expect(parseFloat(result.minimumOutput)).toBeCloseTo(99.75, 2);
    });

    it('should handle zero slippage', () => {
      const result = calculateOutputWithSlippage(100, '1.0500000', 0);

      expect(result.expectedOutput).toBe('105.0000000');
      expect(result.minimumOutput).toBe('105.0000000');
    });
  });

  describe('Rate Direction Verification', () => {
    it('should verify correct rate for USDC -> XLM (buying XLM)', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const usdc = new Asset('USDC', 'ISSUER');
      const xlm = Asset.native();

      const result = await getExchangeRate(usdc, xlm, 'buy');

      // When buying XLM with USDC, we pay the ask price (what sellers want)
      expect(result.rate).toBe('1.0500000');
      expect(result.direction).toBe('buy');
    });

    it('should verify correct rate for XLM -> USDC (selling XLM)', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const xlm = Asset.native();
      const usdc = new Asset('USDC', 'ISSUER');

      const result = await getExchangeRate(xlm, usdc, 'sell');

      // When selling XLM for USDC, we receive the bid price (what buyers offer)
      expect(result.rate).toBe('1.0400000');
      expect(result.direction).toBe('sell');
    });

    it('should verify rates are different for buy vs sell', async () => {
      const { Server } = await import('@stellar/stellar-sdk');
      const mockServer = new Server('');
      (mockServer.orderbook as any)().call.mockResolvedValue(mockOrderbook);

      const usdc = new Asset('USDC', 'ISSUER');
      const xlm = Asset.native();

      const buyRate = await getExchangeRate(usdc, xlm, 'buy');
      const sellRate = await getExchangeRate(usdc, xlm, 'sell');

      // Buy rate should be higher than sell rate (spread)
      expect(parseFloat(buyRate.rate)).toBeGreaterThan(parseFloat(sellRate.rate));
    });
  });
});
