import { Server, Asset } from '@stellar/stellar-sdk';
import { Pool } from 'pg';

const HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const horizonServer = new Server(HORIZON_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Payment Stream Processor
 * 
 * Monitors incoming Stellar payments and matches them to pending transactions
 * in the database.
 * 
 * ISSUE #199 FIX:
 * Previous implementation used string comparison (amount::text = $4) which failed
 * when Stellar amounts ("100.0000000") didn't exactly match DB amounts ("100" or "100.00").
 * 
 * SOLUTION:
 * - Cast both sides to NUMERIC for comparison
 * - Add tolerance for floating-point precision errors
 * - Test with various amount string formats
 */

const AMOUNT_TOLERANCE = 0.0000001; // 7 decimal places precision

export interface PaymentMatch {
  transactionId: string;
  stellarTxHash: string;
  amount: string;
  asset: string;
  matched: boolean;
}

/**
 * Match incoming Stellar payment to pending database transaction
 * 
 * Uses NUMERIC comparison with tolerance to handle different decimal representations
 */
export async function matchPaymentToTransaction(
  stellarTxHash: string,
  amount: string,
  assetCode: string,
  destinationAddress: string
): Promise<PaymentMatch | null> {
  try {
    // Convert amount to numeric for comparison
    const numericAmount = parseFloat(amount);

    // Query with NUMERIC comparison and tolerance
    const result = await pool.query(
      `SELECT 
        transaction_id,
        amount,
        asset_code,
        destination_address
       FROM pending_transactions
       WHERE destination_address = $1
         AND asset_code = $2
         AND ABS(amount::numeric - $3::numeric) < $4
         AND status = 'pending'
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 1`,
      [destinationAddress, assetCode, numericAmount, AMOUNT_TOLERANCE]
    );

    if (result.rows.length === 0) {
      console.warn('No matching transaction found', {
        stellarTxHash,
        amount,
        assetCode,
        destinationAddress,
      });
      return null;
    }

    const transaction = result.rows[0];

    // Update transaction status
    await pool.query(
      `UPDATE pending_transactions
       SET status = 'confirmed',
           stellar_tx_hash = $1,
           confirmed_at = NOW()
       WHERE transaction_id = $2`,
      [stellarTxHash, transaction.transaction_id]
    );

    return {
      transactionId: transaction.transaction_id,
      stellarTxHash,
      amount: transaction.amount,
      asset: transaction.asset_code,
      matched: true,
    };
  } catch (error) {
    console.error('Error matching payment to transaction:', error);
    throw error;
  }
}

/**
 * Start monitoring Stellar payment stream
 * 
 * Listens for incoming payments and matches them to pending transactions
 */
export async function startPaymentStream(platformAddress: string): Promise<void> {
  console.log(`Starting payment stream for address: ${platformAddress}`);

  // Get the latest cursor from database or start from 'now'
  const cursorResult = await pool.query(
    `SELECT cursor FROM payment_stream_cursor WHERE id = 1`
  );
  const startCursor = cursorResult.rows[0]?.cursor || 'now';

  // Start streaming payments
  const paymentsStream = horizonServer
    .payments()
    .forAccount(platformAddress)
    .cursor(startCursor)
    .stream({
      onmessage: async (payment: any) => {
        try {
          // Only process payment operations
          if (payment.type !== 'payment' && payment.type !== 'create_account') {
            return;
          }

          // Extract payment details
          const amount = payment.amount;
          const assetCode = payment.asset_type === 'native' ? 'XLM' : payment.asset_code;
          const destination = payment.to;
          const txHash = payment.transaction_hash;

          console.log('Received payment:', {
            txHash,
            amount,
            assetCode,
            destination,
          });

          // Match to pending transaction
          const match = await matchPaymentToTransaction(
            txHash,
            amount,
            assetCode,
            destination
          );

          if (match) {
            console.log('Payment matched to transaction:', match);
            
            // Trigger any post-payment actions (notifications, etc.)
            await handlePaymentConfirmed(match);
          } else {
            // Log unmatched payment for investigation
            await logUnmatchedPayment(txHash, amount, assetCode, destination);
            
            // Check if this is a large transaction that needs manual review
            if (parseFloat(amount) > 10000) {
              await triggerLargeTransactionAlert(txHash, amount, assetCode);
            }
          }

          // Update cursor
          await pool.query(
            `INSERT INTO payment_stream_cursor (id, cursor, updated_at)
             VALUES (1, $1, NOW())
             ON CONFLICT (id) DO UPDATE
             SET cursor = $1, updated_at = NOW()`,
            [payment.paging_token]
          );
        } catch (error) {
          console.error('Error processing payment:', error);
          // Don't throw - continue processing other payments
        }
      },
      onerror: (error: any) => {
        console.error('Payment stream error:', error);
        // Reconnect after delay
        setTimeout(() => startPaymentStream(platformAddress), 5000);
      },
    });

  console.log('Payment stream started successfully');
}

/**
 * Handle confirmed payment (send notifications, update balances, etc.)
 */
async function handlePaymentConfirmed(match: PaymentMatch): Promise<void> {
  // TODO: Implement notification logic
  console.log('Payment confirmed:', match);
  
  // Example: Send notification to user
  // await notificationService.send(userId, {
  //   type: 'payment_confirmed',
  //   transactionId: match.transactionId,
  //   amount: match.amount,
  //   asset: match.asset,
  // });
}

/**
 * Log unmatched payment for investigation
 */
async function logUnmatchedPayment(
  txHash: string,
  amount: string,
  assetCode: string,
  destination: string
): Promise<void> {
  await pool.query(
    `INSERT INTO unmatched_payments (stellar_tx_hash, amount, asset_code, destination_address, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [txHash, amount, assetCode, destination]
  );
}

/**
 * Trigger alert for large unmatched transaction
 */
async function triggerLargeTransactionAlert(
  txHash: string,
  amount: string,
  assetCode: string
): Promise<void> {
  console.warn('ALERT: Large unmatched transaction detected', {
    txHash,
    amount,
    assetCode,
  });

  // TODO: Implement alerting logic (email, Slack, PagerDuty, etc.)
  // await alertService.send({
  //   severity: 'high',
  //   title: 'Large Unmatched Transaction',
  //   details: { txHash, amount, assetCode },
  // });
}

/**
 * Stop payment stream (for graceful shutdown)
 */
export function stopPaymentStream(): void {
  // The stream will be stopped when the process exits
  console.log('Stopping payment stream...');
}
