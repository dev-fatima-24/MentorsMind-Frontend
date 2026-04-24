# Implement OAuth Integration for Google and GitHub

Closes #223

## Description

This PR implements OAuth authentication for Google and GitHub, allowing users to sign in or register using their social accounts. Includes account linking, management, and proper error handling for various OAuth scenarios.

## Changes Made

### New Components
- `src/components/auth/OAuthButtons.tsx` - OAuth button components with official branding
- `src/components/auth/OAuthCallback.tsx` - OAuth callback handler and redirect processor
- `src/components/settings/ConnectedAccounts.tsx` - Connected accounts management interface

### Modified Components
- `src/components/auth/LoginForm.tsx` - Added OAuth buttons above password login
- `src/components/auth/RegisterForm.tsx` - Added OAuth buttons above registration form
- `src/App.tsx` - Added OAuth callback route

## Features Implemented

### OAuth Buttons
- "Continue with Google" button with official Google brand colors and icon
- "Continue with GitHub" button with official GitHub brand colors and icon
- Loading states during OAuth redirect
- Disabled state when other authentication is in progress
- Visual "or" divider between social login and email/password form

### OAuth Flow
- Redirect to backend OAuth endpoints (`GET /auth/google`, `GET /auth/github`)
- Callback handler processes OAuth response
- Loading spinner during callback processing
- Session storage and automatic redirect after successful authentication

### Account Merge Handling
- Detect when OAuth account is already linked to existing email/password account
- Display clear merge prompt instead of generic error
- Provide instructions for linking accounts from settings
- Auto-redirect to login page after showing merge message

### Connected Accounts Management
- Settings section showing all connected OAuth providers
- Display connected account email
- "Connect" button for unlinked providers
- "Unlink" button for connected providers with confirmation dialog
- Visual provider icons (Google and GitHub)
- Benefits explanation section

### Error Handling
- Friendly error message when user denies OAuth permission
- Clear error display for authentication failures
- Network error handling
- Invalid response handling

## API Integration

Integrates with the following endpoints:
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/github` - Initiate GitHub OAuth flow
- `POST /auth/unlink/:provider` - Unlink OAuth account

OAuth callback expects URL parameters:
- `token` - Access token
- `refreshToken` - Refresh token
- `user` - User data (JSON encoded)
- `error` - Error message if authentication failed
- `merge_required` - Flag indicating account merge needed
- `email` - Email address for merge scenarios

## Acceptance Criteria

- [x] "Continue with Google" and "Continue with GitHub" buttons on both login and register screens, using official brand colors and icons
- [x] A visual divider ("or") between social login and email/password form
- [x] After OAuth redirect, show a loading spinner while the callback is processed
- [x] If the OAuth account is already linked to an existing email/password account, show a clear merge prompt rather than an error
- [x] Account settings page with a "Connected Accounts" section showing linked providers with an unlink option
- [x] Handle the case where a user denies OAuth permission with a friendly error message

## Testing

Tested scenarios:
- Google OAuth login flow
- GitHub OAuth login flow
- Google OAuth registration flow
- GitHub OAuth registration flow
- Account merge detection
- Permission denial handling
- Network error handling
- Account linking from settings
- Account unlinking with confirmation
- Multiple OAuth providers on same account

## Security Considerations

- OAuth tokens stored in localStorage (same as password authentication)
- State validation handled by backend
- HTTPS required for OAuth redirects
- Secure token transmission

## Breaking Changes

None

## Dependencies

No new dependencies added

## Notes

- OAuth buttons appear above existing authentication methods
- Maintains backward compatibility with email/password authentication
- Follows existing authentication patterns
- Responsive design for mobile and desktop
- Official brand guidelines followed for OAuth buttons
- Clear visual hierarchy in authentication forms
