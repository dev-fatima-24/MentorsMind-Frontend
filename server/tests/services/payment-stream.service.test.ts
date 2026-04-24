import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchPaymentToTransaction } from '../../src/services/payment-stream.service';

// Mock pg Pool
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
  })),
}));

describe('Payment Stream Service - Amount Matching', () => {
  let mockPool: any;

  beforeEach(async () => {
    const { Pool } = await import('pg');
    mockPool = new Pool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('matchPaymentToTransaction', () => {
    it('should match Stellar amount "100.0000000" to DB amount "100"', async () => {
      // Mock database response
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            transaction_id: 'tx123',
            amount: '100',
            asset_code: 'USDC',
            destination_address: 'GTEST123',
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE query

      const result = await matchPaymentToTransaction(
        'stellar_hash_123',
        '100.0000000', // Stellar format
        'USDC',
        'GTEST123'
      );

      expect(result).not.toBeNull();
      expect(result?.transactionId).toBe('tx123');
      expect(result?.matched).toBe(true);

      // Verify NUMERIC comparison was used
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('amount::numeric');
      expect(queryCall[0]).toContain('$3::numeric');
      expect(queryCall[0]).toContain('ABS');
    });

    it('should match Stellar amount "100.0000000" to DB amount "100.00"', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            transaction_id: 'tx456',
            amount: '100.00',
            asset_code: 'XLM',
            destination_address: 'GTEST456',
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await matchPaymentToTransaction(
        'stellar_hash_456',
        '100.0000000',
        'XLM',
        'GTEST456'
      );

      expect(result).not.toBeNull();
      expect(result?.transactionId).toBe('tx456');
    });

    it('should match amounts with minor precision differences', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            transaction_id: 'tx789',
            amount: '99.9999999',
            asset_code: 'PYUSD',
            destination_address: 'GTEST789',
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await matchPaymentToTransaction(
        'stellar_hash_789',
        '100.0000000',
        'PYUSD',
        'GTEST789'
      );

      expect(result).not.toBeNull();
      expect(result?.transactionId).toBe('tx789');
    });

    it('should NOT match amounts with significant differences', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [], // No match found
      });

      const result = await matchPaymentToTransaction(
        'stellar_hash_999',
        '100.0000000',
        'USDC',
        'GTEST999'
      );

      expect(result).toBeNull();
    });

    it('should handle various amount string formats', async () => {
      const testCases = [
        { stellar: '100.0000000', db: '100', shouldMatch: true },
        { stellar: '100.0000000', db: '100.00', shouldMatch: true },
        { stellar: '100.0000000', db: '100.0000000', shouldMatch: true },
        { stellar: '100.0000000', db: '99.9999999', shouldMatch: true },
        { stellar: '100.0000000', db: '100.0000001', shouldMatch: true },
        { stellar: '100.0000000', db: '100.001', shouldMatch: false },
        { stellar: '100.0000000', db: '99.99', shouldMatch: false },
        { stellar: '0.0000001', db: '0', shouldMatch: true },
        { stellar: '0.0000001', db: '0.0000001', shouldMatch: true },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        if (testCase.shouldMatch) {
          mockPool.query.mockResolvedValueOnce({
            rows: [
              {
                transaction_id: 'tx_test',
                amount: testCase.db,
                asset_code: 'TEST',
                destination_address: 'GTEST',
              },
            ],
          });
          mockPool.query.mockResolvedValueOnce({ rows: [] });
        } else {
          mockPool.query.mockResolvedValueOnce({
            rows: [],
          });
        }

        const result = await matchPaymentToTransaction(
          'test_hash',
          testCase.stellar,
          'TEST',
          'GTEST'
        );

        if (testCase.shouldMatch) {
          expect(result).not.toBeNull();
          expect(result?.transactionId).toBe('tx_test');
        } else {
          expect(result).toBeNull();
        }
      }
    });

    it('should update transaction status on successful match', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            transaction_id: 'tx_update',
            amount: '100',
            asset_code: 'USDC',
            destination_address: 'GTEST',
          },
        ],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE query

      await matchPaymentToTransaction(
        'stellar_hash_update',
        '100.0000000',
        'USDC',
        'GTEST'
      );

      // Verify UPDATE query was called
      const updateCall = mockPool.query.mock.calls[1];
      expect(updateCall[0]).toContain('UPDATE pending_transactions');
      expect(updateCall[0]).toContain('status = \'confirmed\'');
      expect(updateCall[0]).toContain('stellar_tx_hash = $1');
      expect(updateCall[1]).toEqual(['stellar_hash_update', 'tx_update']);
    });

    it('should only match pending transactions', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await matchPaymentToTransaction(
        'stellar_hash_pending',
        '100.0000000',
        'USDC',
        'GTEST'
      );

      // Verify query includes status = 'pending'
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('status = \'pending\'');
    });

    it('should only match recent transactions (within 24 hours)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await matchPaymentToTransaction(
        'stellar_hash_recent',
        '100.0000000',
        'USDC',
        'GTEST'
      );

      // Verify query includes time constraint
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('created_at > NOW() - INTERVAL \'24 hours\'');
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        matchPaymentToTransaction(
          'stellar_hash_error',
          '100.0000000',
          'USDC',
          'GTEST'
        )
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Amount Tolerance', () => {
    it('should use tolerance of 0.0000001 for 7 decimal places', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await matchPaymentToTransaction(
        'test_hash',
        '100.0000000',
        'USDC',
        'GTEST'
      );

      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[1][3]).toBe(0.0000001);
    });
  });
});
