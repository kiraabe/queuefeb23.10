# Multi-Day Field Visit Workflow Implementation

## Overview

This feature allows employees to flag a service as requiring field work, which closes the daily ticket (removing it from queue), while keeping the underlying case active for multi-day work. Once field work completes, employees can generate a new daily ticket or have the case directly assigned.

## Database Schema Changes

### 1. New Status for Tickets

Add new ticket status: `"field_visit"` (in addition to existing statuses)

### 2. New Table: `field_visit_cases`

Tracks multi-day field work sessions separate from daily tickets.

```sql
CREATE TABLE IF NOT EXISTS field_visit_cases (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references tickets(id) on delete cascade,
  case_id uuid not null,
  status text not null check (status in ('initiated', 'in_progress', 'ready_for_service', 'completed')) default 'initiated',
  initiated_by_user_id uuid not null references users(id) on delete restrict,
  initiated_at timestamptz not null default now(),

  -- Field work tracking
  field_work_started_at timestamptz,
  field_work_started_by_user_id uuid references users(id) on delete set null,
  field_work_completed_at timestamptz,
  field_work_completed_by_user_id uuid references users(id) on delete set null,

  -- Readiness status
  ready_for_service_at timestamptz,
  ready_for_service_by_user_id uuid references users(id) on delete set null,

  -- Policy-based assignment after field work
  assignment_policy text check (assignment_policy in ('queue_new_ticket', 'direct_assignment')) default 'queue_new_ticket',
  assigned_employee_id uuid references users(id) on delete set null, -- For direct_assignment policy

  -- New ticket generated from field visit (if queue_new_ticket policy)
  new_ticket_id uuid unique references tickets(id) on delete set null,

  -- Field work notes and metadata
  field_work_notes text,
  field_work_metadata jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3. Extend Tickets Table

Add field visit related columns:

```sql
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS field_visit_case_id uuid unique references field_visit_cases(id) on delete set null;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_field_visit_generated boolean default false;
```

### 4. Extend Employee Case Performance

Add field visit status tracking:

```sql
ALTER TABLE employee_case_performance ADD COLUMN IF NOT EXISTS field_visit_case_id uuid references field_visit_cases(id) on delete set null;
```

### 5. Indexes for Performance

```sql
CREATE INDEX IF NOT EXISTS idx_field_visit_cases_ticket_id ON field_visit_cases(ticket_id);
CREATE INDEX IF NOT EXISTS idx_field_visit_cases_case_id ON field_visit_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_field_visit_cases_status ON field_visit_cases(status);
CREATE INDEX IF NOT EXISTS idx_field_visit_cases_initiated_at ON field_visit_cases(initiated_at);
CREATE INDEX IF NOT EXISTS idx_tickets_field_visit_case_id ON tickets(field_visit_case_id);
```

## API Endpoints

### 1. POST /api/employee/cases/:ticketId/require-field-visit

**Role**: employee
**Description**: Employee determines service requires field visit, closes daily ticket, initiates field work case

**Request**:

```json
{
  "fieldWorkNotes": "Description of field work required",
  "assignmentPolicy": "queue_new_ticket" | "direct_assignment",
  "assignedEmployeeId": "uuid" // Required if assignmentPolicy is direct_assignment
}
```

**Response**:

```json
{
  "ok": true,
  "fieldVisitCase": {
    "id": "uuid",
    "ticketId": "uuid",
    "status": "initiated",
    "initiatedAt": number,
    "initiatedByUserId": "uuid"
  },
  "ticket": { /* updated ticket with status: "field_visit" */ }
}
```

**Atomic Operations**:

1. Verify ticket exists and is in 'serving' or 'transferred' status
2. Create field_visit_cases record
3. Update ticket status to 'field_visit'
4. Clear window.current_ticket_id if assigned to window
5. Create audit log
6. Return via SSE: ticket.updated

### 2. POST /api/employee/field-visit-cases/:caseId/start-field-work

**Role**: employee (initiated employee or authorized supervisor)
**Description**: Mark field work as started

**Request**:

```json
{
  "startNotes": "optional notes"
}
```

**Response**:

```json
{
  "ok": true,
  "fieldVisitCase": {
    /* updated case */
  }
}
```

### 3. POST /api/employee/field-visit-cases/:caseId/complete-field-work

**Role**: employee (field work owner or supervisor)
**Description**: Mark field work as completed and ready for service

**Request**:

```json
{
  "completionNotes": "Details of completed field work",
  "timestamp": number
}
```

**Response**:

```json
{
  "ok": true,
  "fieldVisitCase": {
    /* updated case with status: "ready_for_service" */
  }
}
```

**Atomic Operations**:

1. Verify field visit case exists and is in 'in_progress' status
2. Update field_work_completed_at and status to 'ready_for_service'
3. Create audit log
4. Determine next action based on assignment_policy

### 4. POST /api/employee/field-visit-cases/:caseId/ready-for-service

**Role**: employee or authorized manager
**Description**: Execute ready-for-service action

**Request**:

```json
{
  "policy": "queue_new_ticket" | "direct_assignment",
  "assignedEmployeeId": "uuid", // Required if policy is direct_assignment
  "newTicketServiceCategory": "string" // Required if policy is queue_new_ticket
}
```

**Response**:

```json
{
  "ok": true,
  "action": "queue_new_ticket" | "direct_assignment",
  "newTicketId": "uuid", // If queue_new_ticket
  "display": { /* updated display state */ }
}
```

**Atomic Operations for queue_new_ticket**:

1. Verify field visit case status is 'ready_for_service'
2. Create new ticket with original case details, service_category from request
3. Set is_field_visit_generated = true
4. Link new_ticket_id in field_visit_case
5. Update field_visit_case status to 'completed'
6. Enqueue new ticket for appropriate service category (FIFO from readiness time)
7. Emit SSE: ticket.created (for new ticket), display.updated
8. Create audit log

**Atomic Operations for direct_assignment**:

1. Verify field visit case status is 'ready_for_service'
2. Verify assigned_employee_id exists and has 'employee' role
3. Update field_visit_case: assigned_employee_id, status = 'completed'
4. Create transfer-like logic: ticket.transferred_to_user_id = assigned_employee_id
5. Update ticket status to 'transferred'
6. Create employee_case_performance entry for next employee
7. Create audit log
8. Emit SSE: transfer.success

### 5. GET /api/employee/field-visit-cases

**Role**: employee
**Description**: List active field visit cases for current employee

**Response**:

```json
{
  "cases": [
    {
      "id": "uuid",
      "ticketId": "uuid",
      "status": "initiated|in_progress|ready_for_service|completed",
      "initiatedAt": number,
      "fieldWorkStartedAt": number | null,
      "fieldWorkCompletedAt": number | null,
      "readyForServiceAt": number | null,
      "assignmentPolicy": "queue_new_ticket|direct_assignment",
      "fieldWorkNotes": "string"
    }
  ]
}
```

### 6. GET /api/employee/field-visit-cases/:caseId

**Role**: employee, admin
**Description**: Get detailed field visit case with history

**Response**:

```json
{
  "case": { /* full field visit case object */ },
  "originalTicket": { /* original ticket */ },
  "newTicket": { /* newly created ticket if applicable */ },
  "timeline": [
    {
      "action": "initiated|started|completed|ready|assigned",
      "timestamp": number,
      "userId": "uuid",
      "userFullName": "string",
      "details": {}
    }
  ]
}
```

## Role-Based Permissions

| Action                 | Reception | Teller | Employee      | Supervisor | Archiver | Admin |
| ---------------------- | --------- | ------ | ------------- | ---------- | -------- | ----- |
| Require Field Visit    | ❌        | ❌     | ✅ (own case) | ✅         | ❌       | ✅    |
| Start Field Work       | ❌        | ❌     | ✅ (own case) | ✅         | ❌       | ✅    |
| Complete Field Work    | ❌        | ❌     | ✅ (own case) | ✅         | ❌       | ✅    |
| Ready for Service      | ❌        | ❌     | ✅ (own case) | ✅         | ❌       | ✅    |
| View Field Visit Cases | ❌        | ❌     | ✅ (own)      | ✅ (all)   | ❌       | ✅    |

## Audit Logging

Log all field visit actions with action codes:

- `field_visit.initiated` - Ticket moved to field visit
- `field_visit.work_started` - Field work commenced
- `field_visit.work_completed` - Field work finished
- `field_visit.ready_for_service` - Ready for service phase
- `field_visit.new_ticket_generated` - New daily ticket created from field visit
- `field_visit.direct_assignment` - Case directly assigned to employee

**Audit Entry Structure**:

```json
{
  "action": "string",
  "userId": "uuid",
  "username": "string",
  "fieldVisitCaseId": "uuid",
  "ticketId": "uuid",
  "details": {
    "fieldWorkNotes": "string",
    "assignmentPolicy": "string",
    "transitionedFrom": "string",
    "transitionedTo": "string",
    "newTicketId": "uuid",
    "assignedEmployeeId": "uuid"
  }
}
```

## QR Tracking & Customer Status Updates

For QR tracking (assuming existing QR code generation):

1. Original ticket QR code continues to track case progress
2. When "field_visit" status is reached, customer tracking shows:
   - "Field Work In Progress"
   - Estimated completion based on field_work_started_at
3. When new ticket is generated, either:
   - QR code gets new ticket code (if queue_new_ticket)
   - QR tracking shows "Case assigned to specialist" (if direct_assignment)

**Customer-facing Status Messages**:

- `field_visit` → "Your service requires site visit. Our team is conducting field work."
- `field_visit` (+ days elapsed) → "Field work in progress. Expected completion: {date}"

## End-of-Day Rules

### Ticket Cleanup

```sql
-- End-of-day job: mark tickets as expired if not completed
UPDATE tickets
SET status = 'done', expired_at = now()
WHERE status IN ('waiting', 'serving', 'transferred')
AND created_at < date_trunc('day', now())
AND window_id IS NOT NULL;

-- Clear windows for next day
UPDATE windows SET current_ticket_id = NULL, busy = false;
```

### Field Visit Cases Persistence

```sql
-- Field visit cases remain active across days
-- No cleanup of field_visit_cases table
-- Case can progress from day 1 → day N until marked complete
-- New tickets generated from field visits are tracked separately
```

### Validation Rules

1. No ticket carries over from previous day
2. If field_visit_case.status != 'completed', case remains active
3. When ready_for_service is called, new ticket must be created same day or case stays in ready_for_service
4. New daily tickets from field visits reset daily counter within same service category

## Implementation Checklist

### Database Layer (server/store/db.ts)

- [ ] Add initDb migration for field_visit_cases table
- [ ] Add field_visit_cases columns to existing tables
- [ ] Create indexes
- [ ] Export functions: requireFieldVisitDb, startFieldWorkDb, completeFieldWorkDb, readyForServiceDb, getFieldVisitCasesDb, getFieldVisitCaseDb

### API Endpoints (server/routes/employee.ts)

- [ ] requireFieldVisit handler
- [ ] startFieldWork handler
- [ ] completeFieldWork handler
- [ ] readyForService handler
- [ ] getFieldVisitCases handler
- [ ] getFieldVisitCase handler

### Authorization (server/routes/auth.ts)

- [ ] Add requireFieldVisitPermission middleware (check user is employee/supervisor)
- [ ] Verify ownership/authorization per action

### SSE Events (server/routes/queue.ts)

- [ ] New event type: field_visit.initiated
- [ ] New event type: field_visit.ready_for_service (to include display update)
- [ ] Extend ticket.updated event to include field_visit status

### UI Components (client/)

- [ ] FieldVisitActionButton component
- [ ] FieldVisitModal component (form for initiating)
- [ ] FieldVisitStatusPanel component (show case progress)
- [ ] FieldVisitReadyModal component (action to finalize)
- [ ] Add field visit indicators to EmployeeTicketList

### QR Tracking Integration

- [ ] Extend getTicketStatus endpoint to include field_visit status messaging
- [ ] Add customer status messaging for field_visit phase

### End-of-Day Implementation (server/routes/admin.ts or separate scheduler)

- [ ] Daily job to expire old tickets
- [ ] Verify field_visit_cases don't get cleared

### Testing

- [ ] Unit tests for atomic transitions
- [ ] Race condition tests (concurrent requireFieldVisit calls)
- [ ] Policy-based assignment logic tests
- [ ] Permission tests per role
- [ ] End-of-day scenario tests

## Success Criteria

1. **Atomic Transactions**: All field visit state changes are atomic (all-or-nothing)
2. **Role-Based Access**: Only authorized users can execute each action
3. **Audit Trail**: Every action is logged with user, timestamp, and details
4. **Queue Management**: New tickets from field visits re-enter queue properly
5. **Case Persistence**: Cases survive daily reset and continue across days
6. **Customer Communication**: QR tracking shows accurate status updates
7. **Concurrent Safety**: No race conditions between field visit and other operations
8. **Backward Compatibility**: Existing ticket workflows unaffected
