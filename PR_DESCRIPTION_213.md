# Implement Mentor Browsing with Filters and Pagination

Closes #213

## Description

This PR implements a comprehensive mentor browsing page with advanced filtering capabilities and pagination. Users can now filter mentors by skill, hourly rate, rating, and availability, with real-time results and skeleton loading states.

## Changes Made

### New Components
- `src/components/search/MentorFilterSidebar.tsx` - Filter sidebar with skill tags, price range slider, minimum rating selector, and availability toggle
- `src/components/search/MentorCardSkeleton.tsx` - Skeleton loading component for mentor cards

### Modified Components
- `src/pages/MentorSearch.tsx` - Complete rewrite with filter integration, pagination, and API integration

## Features Implemented

### Filter Sidebar
- Multi-select skill tag filtering with visual feedback
- Price range slider with manual min/max input fields
- Minimum rating selector (4.5+, 4.0+, 3.5+, 3.0+)
- Availability toggle to show only mentors available in the next 7 days
- Clear all filters button

### Pagination
- Cursor-based pagination matching API design
- Page number display with ellipsis for large page counts
- Previous/Next navigation buttons
- Current page indicator

### Loading States
- Skeleton loading cards while fetching data
- Loading indicator in results count

### Empty State
- Friendly empty state when no mentors match filters
- Helpful message to adjust filters

### URL Integration
- All filters sync to URL parameters
- Shareable search links
- Browser back/forward navigation support

## API Integration

Integrates with `GET /mentors` endpoint with the following query parameters:
- `q` - Search query
- `skills` - Comma-separated skill list
- `minPrice` - Minimum hourly rate
- `maxPrice` - Maximum hourly rate
- `minRating` - Minimum rating threshold
- `page` - Page number
- `limit` - Items per page

## Acceptance Criteria

- [x] Filter sidebar with skill tags, price range slider, minimum rating selector, and availability toggle
- [x] Mentor cards showing avatar, name, rating (stars), hourly rate, and verified badge
- [x] Cursor-based pagination or infinite scroll (matches API's cursor pagination)
- [x] Skeleton loading states while fetching
- [x] Empty state when no mentors match filters

## Testing

Tested scenarios:
- Filter by single and multiple skills
- Adjust price range with slider and manual inputs
- Filter by minimum rating
- Toggle availability filter
- Navigate through multiple pages
- Clear all filters
- Empty state display
- URL parameter persistence
- Browser back/forward navigation

## Screenshots

N/A - UI components follow existing design system

## Breaking Changes

None

## Dependencies

No new dependencies added

## Notes

- Uses existing `searchMentors` service from `mentor.service.ts`
- Follows existing component patterns and styling
- Responsive design works on mobile, tablet, and desktop
- All filters are optional and can be combined
