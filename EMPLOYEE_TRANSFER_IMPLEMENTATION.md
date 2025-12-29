# Employee Transfer API Implementation

## Overview

Modified the transfer API to support transferring tickets directly to employees, even when they don't have window assignments.

## Changes Made

### 1. Server-Side Database Function (server/store/db.ts)

**Updated `transferDb` function signature:**

```typescript
export async function transferDb(
  windowId: number,
  targetWindowId?: number | null,
  reason?: string,
  targetUserId?: string | null,
);
```

**Key Features:**

- Accepts optional `targetUserId` parameter
- Handles three transfer scenarios:
  1. **Transfer to user with window**: Uses both `targetUserId` and `targetWindowId`
  2. **Transfer to user without window**: Uses only `targetUserId`
  3. **Legacy window-only transfer**: Uses only `targetWindowId` (backward compatible)

**Implementation Details:**

- If `targetUserId` is provided:
  - Sets `transferred_to_user_id` directly to the provided user ID
  - Validates that the user exists and has 'teller' role
  - If `targetWindowId` is also provided, checks if window is available
  - If no window, creates a pseudo-window object for response
- If only `targetWindowId` is provided:
  - Maintains legacy behavior (looks up user assigned to that window)
- Throws error if neither `targetUserId` nor `targetWindowId` provided

**Database Updates:**

- Source window: Clears current ticket and sets busy=false
- Target window (if exists): Updates with new ticket and sets busy=true
- Ticket record: Updates with transfer details including `transferred_to_user_id`
- Transfer history: Records window-to-window transfer (only if target window exists)

### 2. Server-Side API Route (server/routes/queue.ts)

**Updated `transfer` route handler:**

- Extracts `targetUserId` from request body
- Passes it to `transferDb` function
- Updated error logging to include `targetUserId`

**Request/Response:**

- Accepts POST `/api/windows/:id/transfer`
- Body: `{ targetWindowId?: number, targetUserId?: string, reason?: string }`
- Returns: `{ ok: true, ticket, source, target, display }`

### 3. Client-Side Transfer Mutation (client/pages/TellerWindow.tsx)

**Updated `transfer` mutation:**

```typescript
const transfer = useMutation({
  mutationFn: async ({
    targetWindowId,
    targetUserId,
    reason,
  }: {
    targetWindowId?: number;
    targetUserId?: string;
    reason?: string;
  }) =>
    apiFetch(`/api/windows/${windowId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ targetWindowId, targetUserId, reason }),
    }),
  // ... success/error handlers
});
```

**Changes:**

- Both `targetWindowId` and `targetUserId` are now optional
- Both parameters are sent to the server
- Transfer mutation can be triggered with either or both parameters

### 4. Client-Side UI Updates (client/pages/TellerWindow.tsx)

**Removed Window Assignment Requirement:**

- Previously: Showed error if employee didn't have window assigned
- Now: Allows transferring to any employee (with or without window)

**State Management:**

- Added `pendingTransferUserId` state to track selected employee ID
- Updated Proceed button logic:
  - Stores both `windowId` and `userId` when employee is selected
  - No longer validates window assignment
  - Passes both to transfer mutation

**Dialog Handling:**

- Clears both `pendingTransferTarget` and `pendingTransferUserId` on dialog close

### 5. Dialog Component Updates (client/components/teller/ProceedHandoffDialog.tsx)

**Improved Display for Non-Window Transfers:**

- Dialog description now conditional:
  - With window: "Proceeding ticket X to [User] at [Window]"
  - Without window: "Proceeding ticket X to [User]"
- Gracefully handles employees without window assignments

## Testing Scenarios

### Scenario 1: Transfer with Window Assignment (Existing)

1. Select job title from dropdown
2. Select employee who HAS a window assigned
3. Click "Proceed" button
4. Dialog shows: "Proceeding ticket ABC to John Doe at Window 3"
5. Enter reason (optional)
6. Click "Proceed Handoff"
7. Verify:
   - Toast: "Ticket ABC transferred to Window 3 successfully"
   - Ticket transferred to both window and user
   - SSE events sent (transfer.success, transfer.received)

### Scenario 2: Transfer WITHOUT Window Assignment (New)

1. Select job title from dropdown
2. Select employee who does NOT have a window assigned
3. Click "Proceed" button (should NOT error)
4. Dialog shows: "Proceeding ticket ABC to Jane Smith"
5. Enter reason (optional)
6. Click "Proceed Handoff"
7. Verify:
   - Toast: "Ticket ABC transferred successfully"
   - Ticket stored with `transferred_to_user_id = jane_id`
   - Ticket `window_id` may be NULL
   - Employee can retrieve ticket from their /api/employee/tickets endpoint

### Scenario 3: API Validation

1. POST to `/api/windows/1/transfer`
   - Body: `{ targetUserId: "employee-id" }`
   - Should succeed with employee transfer

2. POST to `/api/windows/1/transfer`
   - Body: `{ targetWindowId: 2 }`
   - Should succeed with window transfer (backward compatible)

3. POST to `/api/windows/1/transfer`
   - Body: `{}`
   - Should return 400 error: "Either targetWindowId or targetUserId must be provided"

4. POST to `/api/windows/1/transfer`
   - Body: `{ targetUserId: "invalid-id" }`
   - Should return 400 error: "Target user not found or is not a teller"

## Database State Verification

### For Window Transfer:

```sql
SELECT * FROM tickets WHERE id = 'ticket_id';
-- Columns populated:
-- - window_id: 2 (target window)
-- - transferred_to_window: 2
-- - transferred_to_user_id: 'user-id' (user assigned to window 2)
-- - transferred_from_window: 1
-- - status: 'transferred'
-- - remark: 'Transferred from window...'
```

### For Non-Window Transfer:

```sql
SELECT * FROM tickets WHERE id = 'ticket_id';
-- Columns populated:
-- - window_id: NULL (or unchanged)
-- - transferred_to_window: NULL
-- - transferred_to_user_id: 'target-user-id' (directly assigned user)
-- - transferred_from_window: 1
-- - status: 'transferred'
-- - remark: 'Transferred from window...'
```

## Employee Ticket Retrieval

Employees can retrieve tickets transferred to them via:

```
GET /api/employee/tickets?tab=received
```

This endpoint (in server/routes/employee.ts) already queries by `transferred_to_user_id`, so it will work for both:

- Tickets transferred to their assigned window
- Tickets transferred directly to their user ID

## Backward Compatibility

✅ **Fully backward compatible:**

- Existing calls with only `targetWindowId` still work
- Legacy transfer logic preserved
- No breaking changes to API contracts
- Old clients continue to function without modification

## Edge Cases Handled

1. **Employee without window + targetWindowId provided:**
   - Uses the employee's ID as `transferred_to_user_id`
   - Updates the target window with the ticket
   - Validates window is not busy

2. **Employee with window + targetWindowId provided:**
   - Transfers to the specified window
   - Looks up user assigned to that window
   - Sets that user as `transferred_to_user_id`

3. **User not found:**
   - Returns 400 error
   - Transaction rolled back
   - Source window not modified

4. **Target window busy:**
   - Returns 400 error
   - Transaction rolled back
   - Source window not modified

5. **No active ticket in source window:**
   - Returns 400 error (existing validation)
   - Transaction rolled back

## Files Modified

1. `shared/api.ts` - TransferRequest already supports targetUserId (no changes needed)
2. `server/store/db.ts` - Updated transferDb function
3. `server/routes/queue.ts` - Updated transfer handler
4. `client/pages/TellerWindow.tsx` - Updated mutation and UI
5. `client/components/teller/ProceedHandoffDialog.tsx` - Updated dialog display

## Verification Checklist

- [x] Server function accepts targetUserId parameter
- [x] Server route extracts and passes targetUserId
- [x] Client mutation sends targetUserId
- [x] UI allows selection of employees without windows
- [x] Dialog displays correctly for both transfer types
- [x] Type safety maintained (TypeScript)
- [x] Backward compatible with existing window transfers
- [x] Database updates handle both scenarios
- [x] Error handling for invalid users
- [x] Employee routes can retrieve transferred tickets
- [x] Dev server compiles without errors
- [x] All imports and dependencies correct
