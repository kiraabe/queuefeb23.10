/**
 * Shared types for Queue/Teller system
 */

export interface DemoResponse {
  message: string;
}

export type ServiceType = string;

export interface Ticket {
  id: string; // uuid
  service: ServiceType;
  number: number; // incremental per service
  code: string; // e.g. S1-015
  status:
    | "waiting"
    | "serving"
    | "done"
    | "skipped"
    | "transferred"
    | "waiting_archive"
    | "field_visit";
  windowId: number | null;
  createdAt: number;
  startedAt?: number | null; // when serving started
  completedAt?: number | null; // when service completed
  notes?: string;
  ownerName?: string;
  woreda?: string;
  serviceCategory?: string; // Selected service category (e.g. "rights-group")
  selectedServices?: string[]; // Array of selected service names (e.g. ["የንብረት መያዣ ምዝገባ", "የንብረት መያዣ ስረዛ"])
  // Optional fields for skipped/completed tickets
  remark?: string | null;
  skippedAt?: number | null;
  skippedByWindow?: number | null;
  // Optional fields for transferred tickets
  transferredFromWindow?: number | null;
  transferredToWindow?: number | null;
  transferredAt?: number | null;
  transferredToUserId?: string | null; // User ID of the employee who received the ticket
  // Case workflow fields - for employee case tracking
  startedAt?: number | null; // when current employee started handling the case
  startedByUserId?: string | null; // which employee started the case
  proceededAt?: number | null; // when case was transferred to another employee
  jobTitleForProceed?: string | null; // job title selected when proceeding
  employeeStartedAt?: number | null; // when the current employee started working on this case (from employee_case_performance)
  // Auto-expiration field
  expiredAt?: number | null;
  // Document tracking for archiever
  documentsFetched?: boolean;
  documentsFetchedAt?: number | null;
  // Field visit tracking
  fieldVisitCaseId?: string | null;
  isFieldVisitGenerated?: boolean;
}

export interface WindowState {
  id: number; // 1..6
  name: string; // "Window 1" etc
  currentTicketId: string | null;
  busy: boolean;
  updatedAt: number;
  tellerUsername?: string | null; // Active teller assigned to this window
  tellerId?: string | null; // Teller user ID
}

export interface DisplayTicket {
  id: string;
  code: string;
  service: ServiceType;
  status: Ticket["status"];
  windowId: number | null;
  createdAt: number;
  updatedAt?: number;
  currentEmployee?: { id: string; fullName: string; jobTitle: string } | null;
}

export interface DisplayState {
  current: DisplayTicket[]; // All tickets currently being served (includes window-bound and employee-proceeded)
  next: DisplayTicket | null;
  nextAfter: DisplayTicket | null;
  waiting: DisplayTicket[];
}

export interface AnnouncementAudio {
  mimeType: string;
  base64: string;
}

export interface CallNextResponse {
  window: WindowState;
  ticket: Ticket;
  display: DisplayState;
  audio?: AnnouncementAudio | null;
}

export interface RecallResponse {
  ok: true;
  ticket: Ticket;
  display: DisplayState;
  audio?: AnnouncementAudio | null;
}

export interface QueueSnapshot {
  windows: WindowState[];
  services: Record<ServiceType, { nextNumber: number; waitingIds: string[] }>;
  tickets: Record<string, Ticket>;
  display: DisplayState;
}

export interface TransferEventPayload {
  source: { id: number; name: string };
  target: { id: number; name: string };
  ticket: { id: string | null; code: string | null };
  message: string;
}

export type QueueEvent =
  | { type: "init"; payload: QueueSnapshot }
  | { type: "window.updated"; payload: WindowState }
  | { type: "ticket.created"; payload: Ticket }
  | { type: "ticket.updated"; payload: Ticket }
  | { type: "display.updated"; payload: DisplayState }
  | { type: "transfer.success"; payload: TransferEventPayload }
  | { type: "transfer.received"; payload: TransferEventPayload };

export interface CallNextRequest {
  service?: ServiceType; // defaults to S1
}

export interface TransferRequest {
  targetWindowId?: number;
  targetUserId?: string;
  reason?: string;
}

export interface CreateTicketRequest {
  service: ServiceType;
  notes?: string;
  ownerName?: string;
  woreda?: string;
  serviceCategory?: string;
  selectedServices?: string[];
}

export interface DisplayResponse {
  state: DisplayState;
}

// Teller stats
export interface TellerStats {
  servedToday: number;
  skippedToday: number;
  inProgress: number;
  waiting: number;
  avgHandlingSecondsToday: number | null;
  proceedToday: number;
}

export interface TellerTicketsResponse {
  items: Ticket[];
  total: number;
}

export interface CurrentEmployee {
  id: string;
  fullName: string;
  jobTitle: string;
  jobTitleAmharic?: string;
}

export interface TicketStatusResponse {
  ticket: Ticket | null;
  positionInQueue: number | null; // 1-based position if waiting, else null
  estimatedWaitSeconds: number | null; // null if not applicable or unknown
  currentEmployee?: CurrentEmployee | null; // Employee currently handling the ticket
}

// Auth
export type UserRole =
  | "reception"
  | "teller"
  | "admin"
  | "employee"
  | "archiever";
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  roles?: UserRole[]; // all available roles for this user
  windowId?: number | null; // set for tellers
  fullName?: string; // full name of the user, primarily for tellers
  jobTitleId?: string | null; // job title for employees
}
export interface LoginRequest {
  username: string;
  password: string;
}
export interface LoginResponse {
  user: AuthUser;
  message?: string;
}

export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "SESSION_EXPIRED"
  | "SESSION_CONFLICT"
  | "SESSION_REVOKED"
  | "UNAUTHORIZED"
  | "SESSION_INVALIDATED"
  | "NO_SESSION";

export interface MeResponse {
  user: AuthUser | null;
  errorCode?: AuthErrorCode;
  message?: string;
}

export type SessionStatus = "active" | "revoked" | "expired";

export interface SessionSummary {
  id: string;
  username: string;
  role: UserRole;
  windowId: number | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  status: SessionStatus;
  revokeReason?: string | null;
}

export interface ListSessionsResponse {
  sessions: SessionSummary[];
}

export function formatTicketCode(_service: ServiceType, number: number) {
  // Ticket codes are numeric only in the range 001-200 and reset daily
  const wrapped = ((number - 1) % 200) + 1;
  return String(wrapped).padStart(3, "0");
}

// Queue Settings
export interface QueueSettings {
  maxTicketsPerDay: number;
  dailyResetTimeUtc: string; // HH:MM format
  fifoMode: boolean;
  updatedAt?: number;
}

export interface GetQueueSettingsResponse {
  settings: QueueSettings;
}

export interface UpdateQueueSettingsRequest {
  maxTicketsPerDay: number;
  dailyResetTimeUtc: string;
  fifoMode: boolean;
}

export interface UpdateQueueSettingsResponse {
  settings: QueueSettings;
  message: string;
}

// Service Categories and Services
export interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ServiceItem {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListServiceCategoriesResponse {
  categories: ServiceCategory[];
}

export interface GetCategoryServicesResponse {
  categoryId: string;
  categoryName: string;
  services: ServiceItem[];
}

// Job Title
export interface JobTitle {
  id: string;
  nameAmharic: string;
  nameEnglish: string;
  displayOrder?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ListJobTitlesResponse {
  jobTitles: JobTitle[];
}

// User Management
export interface UserInfo {
  id: string;
  username: string;
  role: UserRole;
  windowId: number | null;
  disabled?: boolean;
  fullName?: string;
  department?: string;
  email?: string;
  phone?: string;
  position?: string;
  jobTitleId?: string;
}

export interface ListUsersResponse {
  users: UserInfo[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
  windowId?: number | null;
  fullName?: string;
  department?: string;
  email?: string;
  phone?: string;
  position?: string;
}

export interface CreateUserResponse {
  user: UserInfo;
  message: string;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  role?: UserRole;
  windowId?: number | null;
  disabled?: boolean;
  fullName?: string;
  department?: string;
  email?: string;
  phone?: string;
  position?: string;
}

export interface UpdateUserResponse {
  user: UserInfo;
  message: string;
}

export interface DeleteUserResponse {
  message: string;
}

// Window Management
export interface WindowInfo {
  id: number;
  name: string;
  tellerCount?: number;
}

export interface ListWindowsResponse {
  windows: WindowInfo[];
}

export interface UpdateWindowRequest {
  name: string;
}

export interface UpdateWindowResponse {
  window: WindowInfo;
  message: string;
}

export interface AssignTellerRequest {
  windowId: number | null;
}

export interface AssignTellerResponse {
  user: UserInfo;
  message: string;
}
