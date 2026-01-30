# Hold/Resume Case Workflow

## Overview

The Hold/Resume Case Workflow allows employees to pause case processing when additional documents are needed from customers or when the working day ends before completion. Cases placed on hold remain visible across multiple days and can be resumed without losing context.

## Feature Implementation

### Database Schema

Cases on hold are tracked in the `case_holds` table with the following structure:

```sql
CREATE TABLE case_holds (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  held_by_user_id uuid not null references users(id) on delete set null,
  subject text not null,
  description text not null,
  held_at timestamptz not null default now(),
  resumed_at timestamptz,
  hold_duration_seconds int,
  created_at timestamptz not null default now()
);
```

**Key Fields:**

- `held_at`: Timestamp when the case was placed on hold
- `resumed_at`: Timestamp when the case was resumed (null if still on hold)
- `hold_duration_seconds`: Total seconds the case was on hold
- `subject`: Reason for hold (e.g., "Waiting for customer documents")
- `description`: Details about what was completed and what is needed

### API Endpoints

#### 1. Place Case On Hold

**POST** `/api/employee/cases/:id/hold`

Request body:

```json
{
  "subject": "Waiting for customer documents",
  "description": "Completed initial assessment. Awaiting property ownership documents."
}
```

Response:

```json
{
  "ticket": { ... },
  "hold": {
    "id": "uuid",
    "ticketId": "uuid",
    "heldByUserId": "uuid",
    "subject": "...",
    "description": "...",
    "heldAt": 1234567890000,
    "resumedAt": null,
    "holdDurationSeconds": null
  },
  "message": "Case placed on hold successfully"
}
```

**Status Change:** Case status changes from `serving` → `on_hold`

#### 2. Resume Case

**POST** `/api/employee/cases/:id/resume`

Response:

```json
{
  "ticket": { ... },
  "hold": {
    "id": "uuid",
    "resumedAt": 1234567890000,
    "holdDurationSeconds": 3600
  },
  "message": "Case resumed successfully"
}
```

**Status Change:** Case status changes from `on_hold` → `serving`

#### 3. Get Case Holds

**GET** `/api/employee/holds?ticketId={ticketId}`

Response:

```json
{
  "holds": [
    {
      "id": "uuid",
      "ticketId": "uuid",
      "heldByUserId": "uuid",
      "subject": "...",
      "description": "...",
      "heldAt": 1234567890000,
      "resumedAt": 1234567900000,
      "holdDurationSeconds": 10000
    }
  ]
}
```

### User Interface

#### Hold Case Dialog

- **Trigger:** Click "⏸ Hold" button on in-progress case
- **Form Fields:**
  - Subject (required): Reason for hold
  - Description (required): Details about what's needed
- **Confirmation:** Dialog shows workflow implications
  - Time on hold won't count toward processing metrics
  - Case remains visible across multiple days
  - Can be resumed when customer returns

#### Case Display

**Received Cases Tab:**

- On-hold cases are displayed alongside active cases
- Status badge shows "On Hold" with yellow highlight
- Resume button replaces standard action buttons

**History Tab:**

- Cases show complete workflow chain
- Hold entries display:
  - Subject and description
  - Hold duration with visual emphasis
  - When placed on hold and when resumed

### Case Status Handling

#### Visibility Rules

- On-hold cases remain visible in "Received Cases" tab
- Cases are NOT auto-archived at end of day if on hold
- Cases persist across multiple days while on hold

#### Query Updates

The following queries were updated to include `on_hold` status:

1. **employeeReceivedTickets** (both tab-specific and default)
   - Now includes `t.status = 'on_hold'` in WHERE clause
   - Location: `server/routes/employee.ts:59, 69, 123, 133`

2. **employeeStats**
   - Updated received cases count to include on-hold cases
   - Location: `server/routes/employee.ts:208`

#### Time Tracking

**Hold Duration Calculation:**

```
holdDurationSeconds = floor((resumedAt - heldAt) / 1000)
```

**Metrics Exclusion:**
Hold time is automatically excluded from performance metrics:

```sql
SUM(
  EXTRACT(EPOCH FROM (ecp.ended_at - ecp.started_at)) -
  COALESCE((
    SELECT SUM(COALESCE(hold_duration_seconds, 0))
    FROM case_holds
    WHERE ticket_id = ecp.ticket_id
      AND held_by_user_id = ecp.employee_id
  ), 0)
) as total_duration
```

### Workflow Chain

Cases display a complete workflow history including:

1. **Initial Performance Entry** (Initiated badge)
   - Shows employee who started the case
   - Time spent until first hold/completion

2. **Hold Records** (Paused badge)
   - Subject and description of the hold
   - Hold duration in human-readable format
   - Held at and resumed at timestamps

3. **Subsequent Performance Entries**
   - Work resumed after hold
   - Additional time spent
   - Final completion or forwarding

## Example Workflow

### Scenario: Customer Documents Needed

1. **Employee starts case:** Case status = `serving`
2. **Additional documents needed:** Employee clicks "Hold"
3. **Hold Dialog:**
   - Subject: "Waiting for customer documents"
   - Description: "Completed property assessment. Customer needs to provide ownership certificate by tomorrow."
4. **Case placed on hold:**
   - Case status → `on_hold`
   - Hold record created with timestamps
   - Case remains visible next day
5. **Customer returns with documents:**
   - Employee clicks "Resume"
   - Case status → `serving`
   - Hold end time recorded
   - Hold duration calculated and logged
   - Employee performance metrics exclude hold time
6. **Case completed:**
   - Employee clicks "Complete"
   - Final status = `done`
   - History shows complete workflow with hold details

## Metrics and Reporting

### Processing Time Calculation

- **Active Time:** Total work time minus hold durations
- **Hold Time:** Tracked separately for analysis
- **Total Case Time:** Includes all hold periods

### Dashboard Display

- Stats show "Cases Received" including on-hold cases
- Performance metrics exclude hold durations
- History view shows all hold instances with durations

## Implementation Status

✅ **Completed Features:**

- [x] Hold/Resume dialog with form validation
- [x] Database schema with case_holds table
- [x] API endpoints for hold, resume, and get holds
- [x] Hold records visible in case history
- [x] On-hold cases remain visible across days
- [x] Hold time excluded from performance metrics
- [x] Complete workflow chain visualization
- [x] Hold duration calculation and storage
- [x] Audit logging of hold/resume actions
- [x] Case status management (serving ↔ on_hold)

## Future Enhancements

- Hold reminder notifications
- Bulk hold operations
- Hold time analytics and reporting
- Automatic resume suggestions based on case requirements
