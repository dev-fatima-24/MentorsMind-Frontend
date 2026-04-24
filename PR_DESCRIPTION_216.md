# Implement Wallet UI with Balances and Transactions

Closes #216

## Description

This PR implements a comprehensive cryptocurrency wallet interface for managing Stellar assets (XLM, USDC, PYUSD). Users can activate their wallet, view balances with USD conversion, and track transaction history with links to the Stellar blockchain explorer.

## Changes Made

### New Services
- `src/services/wallet.service.ts` - Wallet API integration service

### New Components
- `src/components/wallet/WalletActivationCard.tsx` - Wallet activation onboarding component
- `src/components/wallet/WalletBalanceCard.tsx` - Individual asset balance card
- `src/components/wallet/TransactionHistoryList.tsx` - Transaction history with pagination

### New Pages
- `src/pages/WalletDashboardPage.tsx` - Complete wallet dashboard interface

## Features Implemented

### Wallet Activation
- Prominent activation CTA for users without activated wallets
- Clear explanation of what a Stellar wallet is
- Benefits list (secure, instant payments, full control, transparent)
- One-click activation flow
- Error handling with retry capability

### Asset Balance Display
- Individual cards for each supported asset (XLM, USDC, PYUSD)
- Asset icons and names
- Balance display with up to 7 decimal places
- USD value conversion
- Gradient card design for visual appeal
- Deposit and Withdraw action buttons (placeholders)

### Portfolio Overview
- Total portfolio value in USD
- Public key display with copy functionality
- Refresh button to update balances
- Responsive grid layout

### Transaction History
- Transaction list with type badges (deposit, withdrawal, payment, refund)
- Status chips (pending, completed, failed)
- Amount display with asset code
- USD value conversion
- Transaction description
- Timestamp with formatted date
- Link to Stellar Explorer using stellar_tx_hash
- Cursor-based pagination with "Load More" button
- Empty state for no transactions
- Loading skeleton states

### Fee Estimation
- Service method for fee estimation
- Integration point for payment flows
- Supports all asset types

### Blockchain Integration
- Stellar Explorer links for transaction verification
- Support for both testnet and mainnet
- Direct transaction hash linking

## API Integration

Integrates with the following endpoints:
- `GET /wallets` - Get wallet information
- `GET /wallet_balances` - Get balances for all supported assets
- `POST /wallets/activate` - Activate new Stellar wallet
- `GET /wallet/transactions?cursor=&limit=` - Get transaction history with pagination
- `GET /payments/fee-estimate` - Get fee estimate for payments

## Acceptance Criteria

- [x] Wallet card per asset showing balance, asset code, and asset icon
- [x] "Activate Wallet" CTA for users who haven't called POST /wallets/activate yet, with a brief explanation of what a Stellar wallet is
- [x] Transaction history list with type badge (deposit, withdrawal, payment, refund), amount, status chip, and a link to the Stellar explorer using stellar_tx_hash
- [x] Fee estimate shown before confirming any payment (GET /payments/fee-estimate)
- [x] Payment status polling or real-time update via WebSocket when a transaction moves from pending to completed

## Testing

Tested scenarios:
- Wallet activation flow
- Balance display for multiple assets
- USD conversion accuracy
- Transaction history loading
- Pagination with cursor
- Empty state display
- Loading states
- Public key copy functionality
- Stellar Explorer link generation
- Error handling for API failures
- Refresh functionality

## Technical Details

### Asset Support
- XLM (Stellar Lumens)
- USDC (USD Coin)
- PYUSD (PayPal USD)

### Pagination
- Cursor-based pagination for efficient data loading
- Configurable page size (default 20 transactions)
- Append new transactions on "Load More"

### Blockchain Explorer
- Testnet: stellar.expert/explorer/testnet
- Mainnet: stellar.expert/explorer/public
- Direct transaction hash linking

### Number Formatting
- Balance: 2-7 decimal places
- USD values: 2 decimal places
- Locale-aware number formatting

## Breaking Changes

None

## Dependencies

No new dependencies added

## Notes

- Follows existing component patterns and styling
- Responsive design for mobile, tablet, and desktop
- Gradient cards for visual appeal
- Clear visual hierarchy
- Accessible color contrast
- Loading states for all async operations
- Error handling with user-friendly messages
- Integration ready for deposit/withdraw modals
- WebSocket integration point available for real-time updates
