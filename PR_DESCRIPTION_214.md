# Implement Booking Flow with Timezone Support

Closes #214

## Description

This PR implements a sophisticated booking flow with IANA timezone scheduling and DST awareness. Users can book sessions with mentors across different timezones, with automatic timezone detection and clear display of times in both user and mentor timezones.

## Changes Made

### New Components
- `src/components/learner/EnhancedAvailabilityPicker.tsx` - Timezone-aware availability slot picker
- `src/components/learner/TimezoneSelector.tsx` - Timezone selection with auto-detection
- `src/components/learner/BookingSummaryModal.tsx` - Pre-payment booking confirmation modal

### Modified Components
- `src/components/learner/BookingModal.tsx` - Updated to integrate timezone support and summary modal

## Features Implemented

### Timezone Detection
- Auto-detect user's local timezone on page load using `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Manual timezone override dropdown with common timezones
- Display detected timezone with option to use it

### Availability Display
- Calendar view showing mentor's available slots from `GET /mentors/:id/availability`
- Times displayed in user's timezone
- Mentor's timezone shown alongside for clarity
- "Today" and "Tomorrow" labels for convenience
- Grouped by date with clear date headers

### Booking Confirmation
- Comprehensive booking summary modal before payment
- Display session details (type, duration)
- Show date and time in both user and mentor timezones
- Pricing breakdown with session fee and platform fee
- Session notes display
- Important notice about idempotency

### Idempotency Protection
- Generate UUID idempotency key using `crypto.randomUUID()` before confirmation
- Disable confirm button after first click to prevent double-submission
- Clear warning message about single submission

### DST Awareness
- Uses IANA timezone database for accurate timezone conversions
- Handles Daylight Saving Time transitions automatically
- Accurate time display regardless of DST status

## API Integration

Integrates with the following endpoints:
- `GET /mentors/:id/availability` - Fetch mentor's available time slots
- `POST /bookings` - Create booking with idempotency key

## Acceptance Criteria

- [x] Calendar view showing mentor's available slots pulled from GET /mentors/:id/availability
- [x] Auto-detect user's local timezone on page load, with a manual override dropdown
- [x] Display times in both the user's timezone and the mentor's timezone
- [x] Confirm button generates a UUID idempotency key before calling POST /bookings
- [x] Disable the confirm button after first click to prevent double-submission
- [x] Show a booking summary modal before final confirmation

## Testing

Tested scenarios:
- Auto-detection of various timezones
- Manual timezone selection
- Booking slots across different timezones
- DST boundary handling
- Idempotency key generation
- Double-click prevention
- Summary modal display
- Timezone information clarity

## Technical Details

### Timezone Handling
- Uses native JavaScript `Intl` API for timezone detection
- Timezone conversions use `toLocaleTimeString` and `toLocaleDateString` with timezone options
- No external timezone libraries required

### Idempotency
- Uses `crypto.randomUUID()` for idempotency key generation
- Supported in all modern browsers
- No external UUID library dependency

## Breaking Changes

None

## Dependencies

No new dependencies added

## Notes

- Integrates seamlessly with existing booking flow
- Maintains backward compatibility
- Follows existing component patterns
- Responsive design for mobile and desktop
- Clear visual distinction between user and mentor timezones
