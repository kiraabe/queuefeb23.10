# AA Landholding Reg & Info Agency - Virtual Queue System

A production-ready full-stack React application for managing virtual queues with QR-powered ticketing, real-time updates, and teller window management.

## Project Overview

This is a **QR-powered virtual queuing system** designed for organizations that need to manage customer flow efficiently. The system provides:

- **Virtual Ticket Generation**: Fast, contactless QR ticket issuance with automatic codes
- **Real-Time Queue Updates**: Live position tracking and wait time estimates via Server-Sent Events (SSE)
- **Teller Window Management**: Staff dashboards with per-window controls and analytics
- **Public Tracking**: Customers can scan QR codes to view their queue status
- **Display Boards**: Large-format screens showing "Now Serving" information
- **Audio Announcements**: Text-to-speech support in multiple languages (English, Amharic)
- **Window Transfers**: Seamless ticket transfers between service windows
- **Session Management**: Role-based authentication with session tracking and concurrent login protection

## Tech Stack (Framework Preset)

### Frontend

- **React 18** - UI library
- **React Router 6** - SPA routing (Single Page Application)
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **TailwindCSS 3** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **React Query** - Data fetching and caching
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualization

### Backend

- **Express.js** - Web framework
- **Node.js** - Runtime environment
- **PostgreSQL** - Database (via Neon or Supabase)
- **Zod** - Schema validation
- **Server-Sent Events (SSE)** - Real-time push updates

### Testing & Quality

- **Vitest** - Unit testing framework
- **TypeScript** - Static type checking
- **Prettier** - Code formatting
- **pnpm** - Fast package manager

## Project Structure

```
client/                   # React SPA frontend
├── pages/                # Route components (Index.tsx = home)
├── components/           # Reusable React components
│   ├── ui/              # Pre-built UI component library
│   ├── layout/          # Layout components (Header, Footer, ConsoleShell)
│   ├── auth/            # Authentication components
│   └── teller/          # Teller-specific components
├── hooks/               # Custom React hooks (useSSE, useNetworkStatus)
├── lib/                 # Utility functions and helpers
├── App.tsx              # App entry point with routing
└── global.css           # TailwindCSS configuration

server/                   # Express API backend
├── index.ts             # Main server setup & route registration
├── routes/              # API handlers
│   ├── queue.ts         # Queue management & SSE endpoint
│   ├── auth.ts          # Authentication & session management
│   ├── teller.ts        # Teller analytics & statistics
│   ├── admin.ts         # Admin-only operations
│   └── demo.ts          # Demo data endpoints
├── services/            # Business logic
│   ├── cambai.ts        # CambAi TTS provider
│   ├── aivoov.ts        # Aivoov TTS provider
│   └── wellsaid.ts      # WellSaid Labs TTS provider
└── store/               # Database operations & session store

shared/                   # Shared types
├── api.ts               # API interfaces and types
└── ...

public/                   # Static assets
tests/                    # Test files
```

## Core Features

### 1. Reception Console

**Location**: `/reception`

- Issue QR tickets with customer information
- Select service type (S1, S2, S3)
- Assign woreda (location) from 13 sub-city divisions
- Add optional notes and customer names
- Auto-generated ticket codes with QR code preview
- Print and share tracking links
- Responsive form layout for mobile and desktop
- Real-time validation with error handling

**API**: `POST /api/tickets` (requires reception role)

### 2. Virtual Queue (Customer View)

**Location**: `/queue`

- Real-time queue status display
- Current position tracking
- Wait time estimates
- Next ticket alerts with blinking notifications
- Waiting list organized by service type
- Scannable QR codes for public tracking
- Share tracking URL via clipboard
- Live updates via Server-Sent Events (SSE)
- Offline fallback with graceful degradation

**API**: `GET /api/events` (SSE stream), `GET /api/display`, `GET /api/windows`

### 3. Teller Console (Staff Dashboard)

**Location**: `/teller` and `/teller/:id`

Window-specific ticket management:

- **Call Next** - Serve next waiting customer (FIFO across services)
- **Recall** - Call current customer again
- **Done** - Mark ticket as completed
- **Skip** - Skip ticket (returns to queue)
- **Transfer** - Move ticket to different window

Features:

- Per-window controls with real-time status
- Ticket history panels (served, skipped, in-progress, transferred)
- Daily statistics: served count, skipped count, average handling time
- Audio announcements with TTS (English/Amharic support)
- Automatic audio fallback to Web Speech API
- Window status badges (Serving/Idle)
- Session-based window assignment
- Responsive grid layout for multiple windows

**APIs**:

- `POST /api/windows/:id/call-next` - Serve next customer
- `POST /api/windows/:id/recall` - Recall current customer
- `POST /api/windows/:id/complete` - Mark ticket complete
- `POST /api/windows/:id/skip` - Skip ticket
- `POST /api/windows/:id/transfer` - Transfer ticket
- `GET /api/teller/:id/stats` - Window statistics
- `GET /api/teller/:id/tickets` - Paginated ticket history

### 4. Display Boards (Public Display)

**Location**: `/display`

- Large-format "Now Serving" display
- Full-screen mode support
- Per-window current ticket display
- Status badges for each window (Serving/Idle)
- Window-specific QR codes for tracking
- Real-time updates via SSE with 3-second polling fallback
- Responsive scaling for distant viewing
- Optimized typography for readability

**Features**: Fullscreen API support, 3-second refresh intervals, window status monitoring

### 5. Public Ticket Tracking

**Location**: `/tickets/:code` or `/track`

- QR code scanning support
- Ticket status lookup by code
- Current position in queue display
- Service type information
- No authentication required
- Mobile-optimized UI

**API**: `GET /api/tickets/:code`

### 6. Home/Overview Page

**Location**: `/` (Index)

- System status dashboard
- Live statistics:
  - Customers waiting
  - Currently serving count
  - Average handling time
  - Served today count
- Feature highlights and descriptions
- Quick-start links to all consoles
- Real-time updates via SSE

**API**: `GET /api/events` (SSE), initial snapshot on page load

## Authentication & Authorization

The system supports three user roles:

### Role-Based Access Control

| Role          | Permissions                                        | Pages                     |
| ------------- | -------------------------------------------------- | ------------------------- |
| **Reception** | Create tickets, view queue status                  | `/reception`, `/queue`    |
| **Teller**    | Manage assigned windows, serve customers           | `/teller/:id`, `/queue`   |
| **Admin**     | Full system access, session management, demo reset | All pages, `/api/admin/*` |

### Session Features

- Cookie-based session management
- Concurrent login protection (new login revokes previous session)
- Idle timeout enforcement
- Session activity tracking ("touch" on activity)
- Maximum session age enforcement
- Rate-limiting on login attempts
- Simple password verification

**APIs**:

- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/me` - Current user info

## Real-Time Updates

### Server-Sent Events (SSE)

The system uses SSE for real-time, server-pushed updates:

**Endpoint**: `GET /api/events` (keep-alive stream)

**Event Types**:

- `init` - Full state snapshot (windows, tickets, services)
- `ticket.created` - New ticket issued
- `ticket.updated` - Ticket status changed
- `window.updated` - Window state changed
- `display.updated` - Display board refresh
- `transfer.success` - Ticket successfully transferred
- `transfer.received` - Received transferred ticket
- `ping` - Heartbeat (connection keep-alive)

**Benefits**:

- Eliminates polling overhead
- Automatic browser reconnection on disconnect
- Batched updates reduce bandwidth
- Real-time experience for all connected clients
- Automatic cleanup on client disconnect

### Fallback Polling

For display boards and clients that can't maintain SSE connections:

- 3-second refresh intervals
- Silent failure handling
- Automatic retry on connection restore

## Audio & Text-to-Speech

The system supports automated announcements in multiple languages:

### TTS Providers (Fallback Chain)

1. **CambAi** - High-quality synthesis
2. **Aivoov** - Alternative provider
3. **WellSaid Labs** - Premium quality
4. **Web Speech API** - Browser-native fallback

### Features

- Automatic provider selection based on availability
- Support for English and Amharic announcements
- Graceful fallback if audio generation fails
- Base64 audio streaming from server
- Client-side Web Audio API playback
- Announcement templates for:
  - "Customer calling"
  - "Next ticket"
  - "Now serving"

## Advanced Features

### Queue Management

- **Global FIFO Ordering**: Serves customers in creation order across all service types
- **Service Types**: Three configurable service categories (S1, S2, S3)
- **Woredas (Locations)**: Support for 13 sub-city divisions
- **Daily Reset**: Automatic queue reset at midnight (UTC)
  - Tickets older than 24 hours marked as "done"
  - Counters reset for new day
  - Window states reset
- **Transfer History**: Track ticket movements between windows
- **Audit Logging**: Log all queue operations for compliance

### Window Management

- Per-window state tracking
- Current ticket assignment
- Status indicators (serving, idle, offline)
- Station-specific configuration
- Concurrent window operation support

### Offline Support

- Graceful degradation when offline
- Cached data displayed with "offline" warning
- Action queuing for retry on reconnection
- Network status detection
- Automatic reconnection handling

## Responsive Design & Accessibility

### Mobile-First Responsive

- **Mobile** (≤640px): Single column, full-width buttons, stacked layouts
- **Tablet** (641–1024px): Two-column grids, optimized spacing
- **Desktop** (>1024px): Multi-column layouts, sidebars, panels

All pages tested and optimized for:

- 375px width (iPhone SE)
- 768px width (iPad)
- 1920px width (Desktop)
- Full-screen and fullscreen API support

### WCAG 2.1 Level AA Accessibility

**Perceivable**:

- Text color contrast 4.5:1 (normal), 3:1 (large)
- 200% zoom support without horizontal scroll
- Non-text UI components 3:1 contrast

**Operable**:

- Full keyboard navigation
- No keyboard traps
- Logical tab order
- Visible focus indicators (2px ring)
- 44×44px minimum touch targets

**Understandable**:

- Semantic HTML structure
- ARIA labels and live regions
- Error messages with `role="alert"`
- Form submission confirmations

**Robust**:

- Valid HTML (no duplicate IDs)
- Proper ARIA attributes
- Status messages with `aria-live="polite"`

**Tested with**:

- WAVE accessibility extension
- Axe DevTools
- Manual keyboard navigation
- Screen reader compatibility

## Development

### Commands

```bash
# Install dependencies
pnpm install

# Start development server (client + server on port 8080)
npm run dev

# Build for production
npm run build

# Build client only
npm run build:client

# Build server only
npm run build:server

# Start production server
npm start

# Run tests
npm test

# Type checking
npm run typecheck

# Code formatting
npm run format.fix
```

### Development Features

- Single-port development (port 8080) for both frontend/backend
- Hot reload for both client and server code
- Type-safe API communication
- Real-time updates via Server-Sent Events (SSE)
- Browser DevTools support
- Full source map support

## Routing

The app uses React Router 6 SPA mode with the following routes:

| Route            | Purpose              | Auth Required | Role             |
| ---------------- | -------------------- | ------------- | ---------------- |
| `/`              | Home / Overview      | No            | Public           |
| `/login`         | Authentication       | No            | Public           |
| `/reception`     | Ticket issuance      | Yes           | Reception        |
| `/queue`         | Virtual queue view   | Yes           | Reception/Teller |
| `/teller`        | Teller console       | Yes           | Teller/Admin     |
| `/teller/:id`    | Individual window    | Yes           | Teller/Admin     |
| `/display`       | Public display board | No            | Public           |
| `/tickets/:code` | Ticket status        | No            | Public           |
| `/track`         | QR tracking page     | No            | Public           |

## API Endpoints

### Health & Status

| Method | Endpoint       | Purpose             |
| ------ | -------------- | ------------------- |
| `GET`  | `/api/ping`    | Simple health check |
| `GET`  | `/api/healthz` | Health status       |
| `GET`  | `/api/readyz`  | Readiness status    |

### Authentication

| Method | Endpoint           | Purpose           | Auth |
| ------ | ------------------ | ----------------- | ---- |
| `POST` | `/api/auth/login`  | User login        | No   |
| `POST` | `/api/auth/logout` | User logout       | Yes  |
| `GET`  | `/api/auth/me`     | Current user info | Yes  |

### Queue Management

| Method | Endpoint             | Purpose                | Role      |
| ------ | -------------------- | ---------------------- | --------- |
| `POST` | `/api/tickets`       | Create ticket          | Reception |
| `GET`  | `/api/tickets/:code` | Get ticket status      | Public    |
| `GET`  | `/api/windows`       | List all windows       | Public    |
| `GET`  | `/api/display`       | Display state snapshot | Public    |

### Window Operations

| Method | Endpoint                     | Purpose                    | Role   |
| ------ | ---------------------------- | -------------------------- | ------ |
| `POST` | `/api/windows/:id/call-next` | Serve next customer        | Teller |
| `POST` | `/api/windows/:id/recall`    | Recall current customer    | Teller |
| `POST` | `/api/windows/:id/complete`  | Mark ticket complete       | Teller |
| `POST` | `/api/windows/:id/skip`      | Skip ticket                | Teller |
| `POST` | `/api/windows/:id/transfer`  | Transfer to another window | Teller |

### Teller Analytics

| Method | Endpoint                  | Purpose                  | Role   |
| ------ | ------------------------- | ------------------------ | ------ |
| `GET`  | `/api/teller/:id/stats`   | Window statistics        | Teller |
| `GET`  | `/api/teller/:id/tickets` | Paginated ticket history | Teller |

### Real-Time Updates

| Method | Endpoint      | Purpose                   |
| ------ | ------------- | ------------------------- |
| `GET`  | `/api/events` | Server-Sent Events stream |

### Admin Operations

| Method | Endpoint                | Purpose         | Role  |
| ------ | ----------------------- | --------------- | ----- |
| `POST` | `/api/admin/clear-demo` | Clear demo data | Admin |
| `GET`  | `/api/admin/sessions`   | List sessions   | Admin |

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication
AUTH_SECRET=your-secret-key

# TTS Services (optional)
WELLSAIDLABS_API_KEY=your-api-key
CAMBAI_API_KEY=your-api-key
AIVOOV_API_KEY=your-api-key

# Security
FORCE_STRICT_ORIGIN=true
ALLOWED_ORIGINS=https://example.com,https://app.example.com
ALLOW_ANY_ORIGIN=false  # Dev only

# Deployment
NODE_ENV=production
PORT=8080
```

### System Configuration

- **Service Types**: S1, S2, S3 (configurable)
- **Woredas**: 13 sub-city divisions (Akaki Kaliti)
- **Queue Reset Time**: Midnight UTC
- **SSE Heartbeat**: Every 30 seconds
- **Display Refresh**: Every 3 seconds (polling fallback)

## Performance Metrics

Optimized for Lighthouse 90+ scores:

| Metric                         | Target  | Status |
| ------------------------------ | ------- | ------ |
| First Contentful Paint (FCP)   | < 1.5s  | ✓      |
| Largest Contentful Paint (LCP) | < 2.5s  | ✓      |
| Cumulative Layout Shift (CLS)  | < 0.1   | ✓      |
| Time to Interactive (TTI)      | < 3s    | ✓      |
| Bundle Size (gzipped)          | < 200KB | ✓      |

### Optimization Techniques

- **Lazy Loading**: QR codes generated on-demand
- **Debouncing**: SSE natural batching, 3-5 second polling intervals
- **Caching**: Window state cached, incremental updates
- **Code Splitting**: Route-based lazy loading
- **Offline Support**: Cached data with graceful degradation

## Deployment

### Deployment Options

- **Netlify** - Recommended for serverless deployment
- **Vercel** - Alternative serverless platform
- **Docker** - Containerized deployment
- **Self-hosted** - Node.js server with PostgreSQL

### Production Build

```bash
npm run build    # Creates optimized production bundles
npm start        # Runs the production server
```

### Database

The system uses PostgreSQL with the following main tables:

- `tickets` - Queue tickets with status and metadata
- `windows` - Teller window states and assignments
- `sessions` - User session data with timeout tracking
- `users` - User accounts with roles (optional)

Auto-migration creates schema on first run.

## Testing

Run tests with Vitest:

```bash
npm test
```

Test coverage includes:

- API endpoint functionality
- Queue state management
- Window operations
- Authentication flows
- Type safety validation

## Browser Support

### Tested & Supported

| Browser       | Version     | Status    |
| ------------- | ----------- | --------- |
| Chrome        | 90+         | Primary   |
| Firefox       | 88+         | Secondary |
| Safari        | 14+         | Secondary |
| Edge          | 90+         | Primary   |
| Mobile Safari | iOS 13+     | Primary   |
| Mobile Chrome | Android 10+ | Primary   |

### Graceful Degradation

- **Fullscreen API**: Fallback to regular view
- **Clipboard API**: Fallback to `execCommand('copy')`
- **Web Audio API**: Fallback to `<audio>` element
- **Web Speech API**: Optional enhancement

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Maintain the component hierarchy
4. Write meaningful commit messages
5. Test changes before pushing
6. Follow responsive-first development
7. Ensure WCAG 2.1 AA compliance

## Documentation

Additional documentation available:

- **AGENTS.md** - Architecture and starter guide
- **IMPLEMENTATION_CHECKLIST.md** - Responsive design & accessibility verification
- **RESPONSIVE_DESIGN_SPEC.md** - Detailed responsive design specifications
- **TESTING_GUIDE.md** - Comprehensive testing procedures

## Support

For issues or questions:

- Check the AGENTS.md for architecture details
- Review IMPLEMENTATION_CHECKLIST.md for feature completeness
- Ensure PostgreSQL database is properly configured
- Check environment variables are set correctly
- Review server logs for error details

## License

Proprietary - AA Landholding Reg & Info Agency
#   q u e u e 2 6  
 #   q u e u e d e c 2 9 . 2  
 