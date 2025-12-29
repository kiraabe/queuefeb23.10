# Responsive Design Specification & Accessibility Guide

**Last Updated**: 2024
**Version**: 1.0

---

## Table of Contents

1. [Breakpoints & Layout System](#breakpoints--layout-system)
2. [Typography & Spacing](#typography--spacing)
3. [Accessibility (WCAG 2.1)](#accessibility-wcag-21)
4. [Performance Guidelines](#performance-guidelines)
5. [Component Specifications](#component-specifications)
6. [Testing Checklist](#testing-checklist)
7. [Mobile-First Best Practices](#mobile-first-best-practices)

---

## Breakpoints & Layout System

### Tailwind Breakpoints

All pages use Tailwind CSS breakpoints for responsive behavior:

| Breakpoint | Width   | Use Case             |
| ---------- | ------- | -------------------- |
| `sm`       | ≥640px  | Tablets in portrait  |
| `md`       | ≥768px  | Tablets in landscape |
| `lg`       | ≥1024px | Desktops             |
| `xl`       | ≥1280px | Large desktops       |

### Grid System

- **Mobile (< 640px)**: Single column layout, stacked components
- **Tablet (640px - 1024px)**: 2-3 column layouts, flexible grids
- **Desktop (> 1024px)**: Full 3+ column layouts, side panels visible

### Spacing Variables

Used throughout all pages for consistency:

```
Mobile padding: px-4 (16px) to px-6 (24px)
Tablet padding: sm:px-6 to sm:px-8
Desktop padding: lg:px-8

Gap between cards:
Mobile: gap-3 (12px)
Tablet: sm:gap-4 (16px)
Desktop: gap-6 (24px)
```

---

## Typography & Spacing

### Font Sizes

All headings use `font-display` (Space Grotesk) with scalable sizes:

| Element            | Mobile    | Tablet       | Desktop                 |
| ------------------ | --------- | ------------ | ----------------------- |
| Page Title (h1)    | text-2xl  | sm:text-3xl  | md:text-4xl lg:text-5xl |
| Section Title (h2) | text-lg   | sm:text-xl   | md:text-2xl             |
| Card Title (h3)    | text-base | sm:text-lg   | md:text-xl              |
| Body Text (p)      | text-sm   | sm:text-base | text-base               |

### Line Height & Leading

- Headings: `tracking-tight`
- Body text: `leading-relaxed` (1.625 rem)
- Compact lists: default (1.5 rem)

---

## Accessibility (WCAG 2.1)

### Key Principles Implemented

#### 1. **Semantic HTML**

- All layouts use `<section>`, `<header>`, `<nav>`, `<aside>`, `<main>` tags
- Links and buttons have proper semantic elements
- Form labels explicitly connected with `htmlFor` attribute

#### 2. **ARIA Attributes**

**Required in all interactive components:**

```tsx
// Window selection cards (Teller page)
<Card
  role="button"
  tabIndex={0}
  aria-pressed={isSelected}
  aria-label="Window 1, Idle"
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    }
  }}
/>

// Status indicators
<span role="status" aria-live="polite" aria-label="Online">
  Online
</span>

// Alert/warning areas
<div role="alert" className="...">
  Offline mode - changes will sync when connection restores
</div>

// Complementary panels
<aside aria-label="Additional information">
  {rightPanel}
</aside>
```

#### 3. **Keyboard Navigation**

**All interactive elements support:**

- **Tab navigation**: Proper tab order maintained
- **Enter/Space**: Activates buttons and button-role elements
- **Arrow keys**: Can be used in custom selects (if implemented)
- **Escape**: Closes modals/dropdowns

**Focus indicators:**

```css
/* Visible focus rings on all interactive elements */
focus:ring-2 focus:ring-primary/50
focus:outline-none
```

#### 4. **Touch Targets**

All interactive elements meet **44×44px** minimum:

```tsx
// Button sizing
<Button className="h-11 sm:h-12">  /* 44px-48px height */
<Button className="h-9 sm:h-10">   /* 36px-40px height, acceptable for secondary actions */
```

**Spacing between touch targets:**

- Minimum 8px margin between interactive elements
- Larger gaps (16-24px) on mobile for comfort

#### 5. **Color Contrast**

**WCAG AA compliance (4.5:1 minimum):**

- Primary text on background: ✓ Tested
- Icon colors: ✓ Pass with colored overlays
- Disabled elements: Use `disabled` attribute (native browser handling)
- Focus states: 2px rings with high-contrast primary color

#### 6. **Images & Icons**

```tsx
// Decorative icons (no alt-text needed)
<Compass className="h-5 w-5 text-primary" aria-hidden="true" />

// Meaningful images
<img
  src={qrCode}
  alt="Queue tracking QR code - scan to check status"
/>

// Status indicators
<span aria-hidden="true" className="h-2 w-2 bg-green-600 rounded-full"></span>
<span>Serving</span>
```

#### 7. **Form Accessibility**

```tsx
// Labels connected to inputs
<Label htmlFor="owner-name" className="text-sm font-medium">
  Property owner's full name
</Label>
<Input
  id="owner-name"
  placeholder="Add guest or organization name"
  required
  aria-required="true"
/>

// Error messages
<span role="alert" className="text-destructive text-sm">
  This field is required
</span>
```

#### 8. **Real-time Updates**

```tsx
// Live region for status updates
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {liveQueueCount} customers waiting
</div>

// Blink animations with reduced motion support
@media (prefers-reduced-motion: reduce) {
  .animate-blink { animation: none; opacity: 1; }
}
```

---

## Performance Guidelines

### Lazy Loading & Code Splitting

**Pages that use lazy loading:**

```tsx
// QR codes generated on-demand, not on load
const [qrSrc, setQrSrc] = useState<string | null>(null);
useEffect(() => {
  let mounted = true;
  QRCode.toDataURL(url, options)
    .then((url) => mounted && setQrSrc(url))
    .catch(() => mounted && setQrSrc(null));
  return () => {
    mounted = false;
  };
}, [url]);
```

**Images & assets:**

- QR code images cached using Blob URLs
- Fallback QR matrices shown while generating
- CSS background images optimized with `lazy` loading

### Debouncing & Throttling

**Real-time Updates:**

```tsx
// SSE updates: natural debounce by network latency
useSSE(sseUrl, (event) => {
  // Updates handled as they arrive
  // Multiple rapid updates still batched by React
});

// Polling: 3-5 second intervals minimum
const poll = setInterval(() => {
  getDisplay().then(setDisplay);
}, 3000); // 3 second debounce

// Window resize: debounced layout recalculation
const debouncedResize = useMemo(() => debounce(recalcLayout, 300), []);
```

### Network State Handling

**Offline detection & fallbacks:**

```tsx
// Network status hook
const { online } = useNetworkStatus();

// Fallback UI when offline
{
  !online && (
    <div role="alert" className="...">
      Offline mode - Live updates paused. Changes will sync automatically when
      reconnected.
    </div>
  );
}

// Fallback content (non-API-dependent)
{
  !qrDataUrl && <FallbackQRCode />;
}
```

**Caching strategy:**

- Window state cached from last successful fetch
- Tickets displayed from local state + server updates
- Display board shows cached data during network interruption

### Bundle Size Optimization

**Current approach:**

- Single-page app with React Router (SPA mode)
- Shared UI components library (Radix UI + Tailwind)
- Minimal inline styles; utility-first CSS

**Monitoring:**

- Check bundle size with: `npm run build`
- Target: < 200KB gzipped (before splitting)

---

## Component Specifications

### 1. ConsoleShell (Layout Container)

**Purpose:** Main layout wrapper for admin pages

**Responsive Features:**

- Sidebar hidden on mobile (`hidden sm:flex`)
- Collapsible offcanvas sidebar on mobile
- Title scales with viewport (`text-xl sm:text-2xl`)
- Status indicator abbreviates on mobile ("Off" vs "Offline")

**Accessibility:**

- Status region has `role="status"` and `aria-live="polite"`
- Sidebar trigger labeled (`aria-label="Toggle navigation menu"`)
- Right panel labeled as complementary (`aria-label="Additional information"`)

**Example Usage:**

```tsx
<ConsoleShell
  title="Reception Console"
  className="lg:grid-cols-1"
  rightPanel={<AnalyticsPanel />}
>
  {/* Main content */}
</ConsoleShell>
```

### 2. Index (Overview) Page

**Responsive Sections:**

| Section       | Mobile     | Tablet      | Desktop                 |
| ------------- | ---------- | ----------- | ----------------------- |
| Hero heading  | text-3xl   | sm:text-4xl | md:text-5xl lg:text-6xl |
| Stats grid    | 1 col      | sm:2 col    | lg:4 col                |
| Features grid | 1 col      | sm:3 col    | lg:3 col                |
| Buttons       | full-width | flex-row    | flex-row                |

**Performance:**

- Stats computed from real-time SSE data (no API fetch)
- Cards memoized to prevent unnecessary re-renders

### 3. Reception Console

**Layout:**

- Form container: full width on mobile, centered max-w-2xl on desktop
- Service options: stack on mobile, single row on tablet+
- Ticket preview: responsive padding (p-3 sm:p-4 md:p-5)
- Benefits section: 1 col mobile, 3 col desktop (with negative margin full-bleed)

**Accessibility:**

- Form labels all connected with `htmlFor`
- Service option buttons have keyboard support
- QR preview shows loading state with spinner + text
- Copy/Share buttons have clear labels

### 4. Virtual Queue Page

**Real-time Updates:**

- Queue synced via SSE with minimal latency
- "Now Serving" section updates instantly
- "Waiting" list updates as tickets move

**Mobile Optimizations:**

- QR code section stacks vertically on mobile
- Buttons full-width when stacked
- Tracking URL with truncate on mobile
- Copy/Share buttons full-width below URL on mobile

### 5. Teller Console

**Window Selection:**

- Grid: 1 col mobile, 2 col tablet, 3 col desktop
- Cards interactive with keyboard support (`role="button"`, `tabIndex={0}`)
- Selected window highlighted with primary color

**Action Buttons:**

- Grid layout on mobile (2x2)
- Buttons responsive height (h-9 sm:h-10)
- Transfer dropdown full-width on mobile
- Action buttons flex-1 to share space equally

**Ticket History:**

- 4 sections below window controls
- Grid: 1 col mobile, 2 col desktop
- Each section has scroll container if needed

### 6. Display Page (Full-Screen Mode)

**Layout:**

- Window cards: 1 col mobile, 2 col tablet, 3 col desktop
- QR section: vertical stack on mobile, horizontal on tablet+
- All text scales: `text-3xl sm:text-4xl md:text-5xl lg:text-6xl` (for h1)
- Minimum 44×44px buttons

**Full-Screen Behavior:**

- Works on mobile browsers with requestFullscreen API
- Fallback: regular view on browsers without support
- Exit button labeled clearly ("Exit FS" on mobile, "Exit Full Screen" on desktop)

---

## Testing Checklist

### Mobile Testing (≤640px)

#### Layout & Spacing

- [ ] All content fits within viewport without horizontal scroll
- [ ] Padding/margin looks balanced (no large gaps)
- [ ] Text is readable without zooming
- [ ] Images scale down appropriately
- [ ] Forms are easy to fill with one hand

#### Buttons & Interactive Elements

- [ ] All buttons/links are 44×44px minimum
- [ ] Spacing between touch targets is 8px+
- [ ] Buttons don't wrap unexpectedly
- [ ] Hover states work with mouse (if available)

#### Accessibility

- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Focus indicators visible (2px ring)
- [ ] Color contrast passes WCAG AA (4.5:1 text)
- [ ] Images have alt text
- [ ] Form labels are readable

#### Performance

- [ ] Page loads in < 3 seconds on 4G
- [ ] No layout shifts during loading (CLS < 0.1)
- [ ] Scroll is smooth (60fps)

### Tablet Testing (640px - 1024px)

#### Layout

- [ ] 2-3 column layouts activate properly
- [ ] Sidebar visible (not offcanvas)
- [ ] Cards display in grid without wrapping
- [ ] Side panels visible if present

#### Orientation

- [ ] Portrait: 640px width minimum, full height
- [ ] Landscape: 1024px width, dynamic height
- [ ] Rotation doesn't break layout

### Desktop Testing (>1024px)

#### Layout

- [ ] 3+ column layouts activated
- [ ] Right panels visible
- [ ] Full-width sections extend to edges (with container max-width)
- [ ] Spacing is generous (gap-6, p-8, etc.)

#### Accessibility

- [ ] Keyboard navigation: Tab, Shift+Tab, Enter, Escape
- [ ] Mouse hover states prominent
- [ ] Focus visible at all times
- [ ] Modals/dropdowns close with Escape

---

## Mobile-First Best Practices

### CSS-First Approach

```tsx
// ✓ Good: Mobile-first
<div className="p-3 sm:p-4 md:p-6">
  {/* Default: p-3, then scales up */}
</div>

// ✗ Avoid: Desktop-first (requires override)
<div className="p-6 md:p-4 sm:p-3">
  {/* Confusing, hard to maintain */}
</div>
```

### Responsive Images

```tsx
// ✓ Good: Responsive sizing
<img
  src={qrCode}
  alt="QR code"
  className="h-32 sm:h-40 md:h-48 w-32 sm:w-40 md:w-48"
/>

// ✗ Avoid: Fixed sizes
<img src={qrCode} className="h-48 w-48" />
```

### Flexible Buttons

```tsx
// ✓ Good: Stack on mobile, row on desktop
<div className="flex flex-col sm:flex-row gap-2">
  <Button className="w-full sm:w-auto">Primary</Button>
  <Button className="w-full sm:w-auto">Secondary</Button>
</div>

// ✗ Avoid: Hard-coded layout
<div className="flex gap-2">
  <Button>Primary</Button>
  <Button>Secondary</Button>
</div>
```

### Touch-Friendly Spacing

```tsx
// ✓ Good: Extra margin for touch
<button className="h-11 sm:h-12 px-4 sm:px-6 m-2">
  {/* 44-48px height, 8px margin between targets */}
</button>

// ✗ Avoid: Cramped on mobile
<button className="h-8 px-3">
  {/* Too small for reliable touch */}
</button>
```

---

## State Management & Real-Time Updates

### SSE (Server-Sent Events)

**Used for real-time data:**

```tsx
useSSE(sseUrl, (event) => {
  if (event.type === "init") {
    // Full state snapshot
    setWindows(event.payload.windows);
    setTickets(event.payload.tickets);
  }
  if (event.type === "window.updated") {
    // Incremental update
    setWindows((prev) =>
      prev.map((w) => (w.id === event.payload.id ? event.payload : w)),
    );
  }
});
```

**Fallback polling:**

```tsx
// For Display page (3-5 second polls acceptable)
const poll = () =>
  getDisplay()
    .then((d) => setDisplay(d.state))
    .catch(() => {});

const id = setInterval(poll, 3000);
return () => clearInterval(id);
```

---

## Browser Compatibility

### Supported Browsers

- Chrome/Edge: Latest (v90+)
- Firefox: Latest (v88+)
- Safari: Latest (v14+)
- Mobile Safari (iOS 13+)
- Mobile Chrome (Android 10+)

### Polyfills & Fallbacks

- Fullscreen API: Graceful fallback to regular view
- Clipboard API: Fallback to `execCommand('copy')`
- Web Audio API: Fallback to `<audio>` element
- Vibration API: Optional enhancement, not required

---

## Dark Mode Support

All pages support dark mode via `prefers-color-scheme`:

```tsx
// Tailwind dark: prefix automatically applied
<div className="bg-card dark:bg-card-dark text-foreground dark:text-foreground-dark">
  {/* Colors adjust automatically */}
</div>

// Status indicators
<span className="text-green-600 dark:text-green-400">Online</span>

// Background layers
<div className="bg-foreground/5 dark:bg-foreground/10">
  {/* More visible in dark mode */}
</div>
```

---

## Summary

This responsive design system ensures:

✓ **Mobile-first approach** with flexible layouts
✓ **WCAG 2.1 AA compliance** for accessibility
✓ **Performance optimized** with lazy loading and caching
✓ **Touch-friendly** with 44×44px minimum targets
✓ **Real-time updates** via SSE and polling
✓ **Offline support** with fallback UI
✓ **Cross-browser** compatibility with graceful degradation

All pages follow these principles consistently.
