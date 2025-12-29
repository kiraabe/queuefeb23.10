# Selected Services Display Fix

## Problem

Selected Services were displaying UUIDs/IDs instead of human-readable service names:

```
Selected Services
• 5f2e9ebf-eb6a-4737-9ad9-7ad76f7c4bef
• a3c4d5e6-f7g8-h9i0-j1k2-l3m4n5o6p7q8
```

## Solution

Implemented service name mapping across the application. Services are fetched from the API using the ticket's `serviceCategory` to create an ID→Name mapping, which is then used to display human-readable names.

## Files Updated

### 1. client/components/teller/TicketSection.tsx

- **Added imports:** `useMemo` from React, `GetCategoryServicesResponse` type
- **Added state:** `serviceNames` (Record<serviceId, serviceName>) and `loading` flag
- **Added effect:** Fetches services from `/api/service-categories/{categoryId}/services` when ticket has selectedServices
- **Updated display:** Shows `serviceNames[serviceId] || serviceId` (falls back to ID if name not found)

**Key features:**

- Lazy loads service names only when needed
- Shows "Loading service names..." message while fetching
- Gracefully handles errors by falling back to service IDs

### 2. client/components/teller/ProceedHandoffDialog.tsx

- **Added imports:** `useEffect`, `useMemo`, `GetCategoryServicesResponse`
- **Added state:** `serviceNames` mapping
- **Added effect:** Fetches services when dialog is opened with a ticket containing selected services
- **Updated display:** Shows service names instead of IDs in the handoff preview

### 3. client/pages/Track.tsx

- **Added imports:** `GetCategoryServicesResponse` type
- **Added state:** `serviceNames` mapping
- **Added effect:** Fetches services when a ticket is loaded via ticket tracking
- **Updated display:** Shows service names in the ticket tracking detail view

### 4. client/pages/Reception.tsx

- **No changes needed:** Already displays `selectedServiceNames` (the mapping is done locally before sending to API)

## How It Works

### Data Flow

1. **During ticket creation (Reception):**
   - User selects a service category
   - Services for that category are fetched from `/api/service-categories/{categoryId}/services`
   - Service IDs are mapped to names locally
   - Only service IDs are sent to server in the `selectedServices` array

2. **During ticket display (TellerWindow, Track):**
   - Ticket is retrieved with `selectedServices` containing IDs
   - When displaying, the ticket's `serviceCategory` is used to fetch services again
   - Service IDs are mapped to names for display
   - A mapping record is created and stored in component state

### API Endpoints Used

```
GET /api/service-categories/{categoryId}/services
```

Response format:

```json
{
  "categoryId": "string",
  "categoryName": "string",
  "services": [
    {
      "id": "uuid",
      "categoryId": "uuid",
      "code": "string",
      "name": "Service Name",
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ]
}
```

## Database

No database changes required. The `selected_services` column in the `tickets` table continues to store service IDs (as JSONB array).

## Display Examples

### Before

```
Selected Services
• 5f2e9ebf-eb6a-4737-9ad9-7ad76f7c4bef
• a3c4d5e6-f7g8-h9i0-j1k2-l3m4n5o6p7q8
```

### After

```
Selected Services
• Title Registration
• Land Verification
```

## Error Handling

### If service names fail to load:

- Component displays the service ID as fallback: `serviceNames[serviceId] || serviceId`
- Error is logged to console but doesn't break the UI
- User can still see the ticket information with IDs visible

### If service not found in mapping:

- Falls back to displaying the service ID
- This handles cases where the service may have been deleted but is still referenced in tickets

## Performance Considerations

1. **Lazy Loading:** Service names are only fetched when a ticket with selectedServices is displayed
2. **Per-Category:** Services are fetched per service category (not all services globally)
3. **Caching:** Component-level caching via React state - each component maintains its own cache
4. **Loading States:** Displays "Loading service names..." message while fetching (only in TicketSection)

### Potential Future Optimization

For high-frequency displays (many tickets), consider:

- Global service cache using React Context or TanStack Query
- Server-side rendering of service names in the ticket data
- Adding service names to the ticket data structure at creation time

## Backward Compatibility

✅ Fully backward compatible

- Existing tickets with service IDs continue to work
- API responses unchanged
- Falls back gracefully if service names can't be loaded

## Testing Scenarios

1. **Ticket with selected services (window transfer):**
   - Create ticket with selected services
   - View in TellerWindow
   - Verify names display instead of IDs

2. **Proceed handoff dialog:**
   - Select employee and proceed
   - Dialog should show service names in preview

3. **Ticket tracking:**
   - Track a ticket with selected services via code lookup
   - Service names should display correctly

4. **Edge cases:**
   - Ticket without serviceCategory (no services will be shown)
   - Deleted services (falls back to showing ID)
   - Network error fetching services (shows IDs, error logged)
