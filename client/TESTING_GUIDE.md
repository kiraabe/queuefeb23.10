# Visual Testing Guide & Component Documentation

**Purpose**: Validate responsive design across breakpoints and document component states
**Last Updated**: 2024

---

## Quick Start: Testing Workflow

### 1. Local Testing (Chrome DevTools)

```bash
pnpm dev
# Open http://localhost:5173 in browser
```

**DevTools Setup:**

1. Press `F12` to open DevTools
2. Click device toggle icon (top-left) to enable device emulation
3. Select device or set custom dimensions

### 2. Test Devices

#### Phones

- iPhone SE: 375×667px
- iPhone 14 Pro: 390×844px
- Pixel 6: 412×915px
- Galaxy S20: 360×800px

#### Tablets

- iPad (9th): 768×1024px
- iPad Pro: 1024×1366px
- Galaxy Tab S7: 1024×1600px

#### Desktops

- 1280×720px (HD)
- 1920×1080px (Full HD)
- 2560×1440px (2K)

---

## Page-by-Page Testing Checklist

### 1. Index (Overview) Page

**URL**: `/`

#### Mobile (375px)

- [ ] Hero section readable without horizontal scroll
- [ ] Heading text: "A personal status hub..." fits in 1-2 lines
- [ ] "Launch reception console" button full-width, tappable
- [ ] Stats grid: 1 column layout
  - [ ] Each stat card has icon (top-center)
  - [ ] Number readable (24px+)
  - [ ] Cards have breathing room (gap-3)
- [ ] Features section: 1 column, cards stacked
- [ ] "Get started" section: full-width button

#### Tablet (768px)

- [ ] Heading scales to `sm:text-3xl` (24px)
- [ ] Stats grid: 2 columns
- [ ] Features: 3 columns (if possible with space)
- [ ] Padding increases to `sm:px-6`

#### Desktop (1920px)

- [ ] Heading: `lg:text-5xl` (36px)
- [ ] Stats grid: 4 columns
- [ ] Hero section: 2-column layout
- [ ] Full-bleed sections extend to edges with proper padding

#### Accessibility Checks

- [ ] Icon colors have 4.5:1 contrast with background
- [ ] Stat numbers are accessible text (not image)
- [ ] Buttons are 44×44px minimum
- [ ] Tab order: left-to-right, top-to-bottom

---

### 2. Reception Console

**URL**: `/reception`

#### Mobile (375px)

- [ ] Form container: full-width, p-4
- [ ] Input fields: full-width
  - [ ] Label visible above input
  - [ ] Input height: 40px+ (touch-friendly)
- [ ] Service options: 3 cards stacked
  - [ ] Icon (left side): 8-9px
  - [ ] Award icon visible
  - [ ] Selected state: primary/5 background
- [ ] Ticket preview: readable text, p-3 padding
  - [ ] Order number large (text-lg+)
  - [ ] QR code: 128px square
- [ ] Generate button: full-width, h-11

#### Tablet (768px)

- [ ] Form: 2-column (Name + Woreda)
- [ ] Service options: better spacing (gap-3)
- [ ] Ticket preview: p-4 padding
- [ ] Bottom section cards: 2-3 columns

#### Desktop (1920px)

- [ ] Main form container: centered, max-w-3xl
- [ ] Service options: gap-4
- [ ] QR preview section: landscape layout
- [ ] Benefits section: 3-column grid with icons

#### Accessibility Checks

- [ ] Form labels connected with `htmlFor`
- [ ] Service option cards keyboard-navigable
- [ ] "Generate QR Ticket" button prominent
- [ ] Error messages (if any) have `role="alert"`
- [ ] Copy/Share buttons tappable (44px+)

---

### 3. Virtual Queue Page

**URL**: `/queue`

#### Mobile (375px)

- [ ] Title: "Virtual Queue" visible
- [ ] Badge: "Phase 2 · Customer View" fits in 1 line
- [ ] Main heading: "A personal status hub..." wraps nicely
- [ ] Card layout:
  - [ ] Now Serving: p-4, text-2xl number
  - [ ] Next/Next After: stacked or 2-column
  - [ ] Action: "Please proceed..." visible
- [ ] QR section:
  - [ ] QR code: 96px square
  - [ ] Tracking URL: truncated, links nicely
  - [ ] Copy/Share buttons: full-width, stacked
- [ ] Bottom features: 1 column

#### Tablet (768px)

- [ ] Heading: `sm:text-3xl`
- [ ] Next/Next After: side-by-side (2 col)
- [ ] QR section: QR on left, URL on right
- [ ] Features: 2-3 columns

#### Desktop (1920px)

- [ ] Full layout: heading area, large card, features below
- [ ] QR: 192-256px square
- [ ] No horizontal scroll
- [ ] Proper spacing (gap-6+)

#### Accessibility Checks

- [ ] Live queue status: `role="status"`, `aria-live="polite"`
- [ ] Waiting list: ordered `<ol>`
- [ ] Ticket codes clickable (for copying to clipboard)
- [ ] QR image has alt text: "Queue QR code"
- [ ] Copy/Share buttons: 44×44px minimum

---

### 4. Teller Console

**URL**: `/teller`

#### Mobile (375px)

- [ ] Window Controls heading visible
- [ ] Window cards: 1 column, 100% width
  - [ ] Card title: window name + status badge
  - [ ] Current ticket: large number (text-xl)
  - [ ] Buttons arranged in rows (2 per row)
    - [ ] Call Next + Recall (side-by-side)
    - [ ] Done + Skip (side-by-side)
    - [ ] Transfer: full-width row
- [ ] Each button: h-9, flex-1 to share space
- [ ] No horizontal overflow

#### Tablet (768px)

- [ ] Window cards: 2 columns
- [ ] Buttons: same arrangement
- [ ] Ticket history: 1 column (if visible)

#### Desktop (1920px)

- [ ] Window cards: 3 columns
- [ ] Ticket History sections: 2-column grid
- [ ] Proper gap-6 spacing
- [ ] Transfer dropdown: full width, then transfer button

#### Accessibility Checks

- [ ] Window cards are keyboard-selectable (`role="button"`, `tabIndex={0}`)
- [ ] Selected window highlighted with `aria-pressed="true"`
- [ ] All buttons: 44×44px minimum
- [ ] Button labels clear (not just icons)
- [ ] Transfer dropdown has label

---

### 5. Display Page (Full-Screen Mode)

**URL**: `/display`

#### Mobile (375px)

- [ ] Title: "Now Serving" - text-3xl, fits
- [ ] Full Screen button: top-right, h-9 (shows "Full Screen")
- [ ] Window cards: 1 column
  - [ ] Window name: text-xs uppercase
  - [ ] Number: text-xl (large, readable from distance)
  - [ ] Status: "Serving" or "Idle" with indicator dot
- [ ] QR Section:
  - [ ] Stacked vertically (flex-col)
  - [ ] QR code: 128px square, centered
  - [ ] URL below QR
  - [ ] Copy/Share buttons: stacked, full-width
- [ ] No horizontal scroll

#### Tablet (768px)

- [ ] Window cards: 2 columns
- [ ] QR section: starts to layout horizontally
- [ ] Number size: text-2xl
- [ ] Full-screen toggle: larger hit target

#### Desktop (1920px)

- [ ] Window cards: 3 columns (max)
- [ ] QR section: horizontal layout (QR left, URL right)
- [ ] Number size: text-3xl+ (readable from 10+ feet)
- [ ] Large padding and spacing (p-8+)

#### Full-Screen Mode

- [ ] Enter full-screen: removes header/footer
- [ ] Window cards: fill viewport
- [ ] Numbers: large, high-contrast
- [ ] Exit button: visible, accessible
- [ ] Works on mobile browsers (if supported)

#### Accessibility Checks

- [ ] Window region labels: `aria-label="Window 1: Serving 015"`
- [ ] Status indicators have accessible text
- [ ] QR image alt-text: "Queue tracking QR code"
- [ ] Buttons: 44×44px minimum
- [ ] Color contrast: green/amber on white 4.5:1+

---

## Responsive Behavior Tests

### Layout Shifts

**Test**: Reload page at each breakpoint, watch for layout jumping

```
✓ Mobile → Tablet: Cards reflow smoothly
✓ Tablet → Desktop: Panels appear/disappear without shift
✓ Image loading: No layout shift when QR code loads
✓ Font loading: Heading sizes set before fonts load
```

### Touch Interactions

**Test on actual mobile device:**

- [ ] Can tap all buttons without zooming in
- [ ] Touch targets don't overlap
- [ ] Swipe gestures not interfering (if used)
- [ ] Copy to clipboard works without full-screen exit
- [ ] Share sheet appears correctly

### Keyboard Navigation

**Test on desktop:**

```
Tab through all pages:
✓ Focus visible on all elements (2px ring)
✓ Tab order logical (top-to-bottom, left-to-right)
✓ Can activate buttons with Enter/Space
✓ Can close modals with Escape
✓ Can select windows with arrow keys (if implemented)
```

### Offline Behavior

**Test:**

1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Reload page, observe:

- [ ] Cached content displays
- [ ] Offline warning appears
- [ ] Buttons remain functional (or clearly disabled)
- [ ] When reconnected, data syncs

---

## Performance Validation

### Load Time Targets

| Metric                         | Target | Tool       |
| ------------------------------ | ------ | ---------- |
| First Contentful Paint (FCP)   | < 1.5s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Cumulative Layout Shift (CLS)  | < 0.1  | Lighthouse |
| Time to Interactive (TTI)      | < 3s   | Lighthouse |

### Testing Steps

1. **Open Lighthouse:**
   - DevTools → Lighthouse
   - Select "Mobile" or "Desktop"
   - Run audit

2. **Check metrics:**
   - Performance score: 90+
   - No red flags in "Opportunities"

3. **Bundle size:**
   ```bash
   npm run build
   # Check dist/ folder size
   # Target: < 200KB gzipped (JS)
   ```

### Network Throttling

Test on simulated 4G:

1. DevTools → Network tab
2. Set throttling: "Fast 4G"
3. Reload page
4. Should load in < 3s

---

## Accessibility Audit Checklist

### WAVE Browser Extension

Install WAVE (WebAIM): https://wave.webaim.org/extension/

1. Open page
2. Click WAVE icon
3. Check for:
   - [ ] No red errors
   - [ ] No contrast issues
   - [ ] No missing alt-text
   - [ ] Proper heading hierarchy

### Axe DevTools

Install axe DevTools: https://www.deque.com/axe/devtools/

1. Open page
2. Click axe DevTools icon
3. Run scan
4. Verify: No violations

### Manual Checks

- [ ] **Color blindness**: Use Chrome extension "Colorblindly"
  - Page readable in Protanopia, Deuteranopia, Tritanopia modes
- [ ] **Zoom**: Zoom to 200% (Ctrl/Cmd + +)
  - No text cuts off
  - Buttons still tappable
  - Content doesn't become inaccessible

- [ ] **Reader mode**: Enable browser reader mode
  - Content extracts cleanly
  - Structure is semantic

- [ ] **High contrast**: Enable OS high contrast mode
  - Text remains readable
  - Focus indicators visible

---

## Component State Testing

### Button States

Test on all button types:

```
✓ Default: normal appearance
✓ Hover: color change or underline
✓ Focus: 2px ring visible
✓ Active/Pressed: darker shade or different background
✓ Disabled: grayed out, not tappable
✓ Loading: spinner or "..." indicator
```

### Form Input States

```
✓ Empty: placeholder text visible
✓ Focused: border color change, label bold
✓ Filled: text visible, proper contrast
✓ Error: red border, error message in aria-alert
✓ Disabled: grayed out, cursor: not-allowed
```

### Card Selection (Teller Window)

```
✓ Default: normal card appearance
✓ Hover: subtle shadow increase or background change
✓ Focus: 2px ring around card
✓ Selected: primary/5 background, primary/60 border
✓ Disabled: grayed, cursor: not-allowed
```

### Live Regions (Real-time Updates)

```
✓ Queue count updates: announced via aria-live="polite"
✓ Status changes: "Online" → "Offline" announced
✓ New data: screen readers announce updates
✓ Loading states: "Generating QR..." shows spinner + text
```

---

## Responsive Type Scale

### Verify font sizes scale correctly

| Element       | Mobile | Tablet | Desktop   |
| ------------- | ------ | ------ | --------- |
| Page Title    | 24px   | 30px   | 36px-48px |
| Section Title | 18px   | 20px   | 24px      |
| Card Title    | 16px   | 18px   | 20px      |
| Body          | 14px   | 16px   | 16px      |
| Small Text    | 12px   | 12px   | 14px      |

**Test:**

1. Measure with DevTools Computed Styles
2. Verify base + breakpoint sizes match spec

---

## Browser Testing Matrix

### Desktop Browsers

| Browser | Version | Status      |
| ------- | ------- | ----------- |
| Chrome  | Latest  | ✓ Primary   |
| Edge    | Latest  | ✓ Primary   |
| Firefox | Latest  | ✓ Secondary |
| Safari  | Latest  | ✓ Secondary |

### Mobile Browsers

| Browser          | OS          | Status      |
| ---------------- | ----------- | ----------- |
| Chrome           | Android 10+ | ✓ Primary   |
| Safari           | iOS 13+     | ✓ Primary   |
| Firefox Mobile   | Android 10+ | ✓ Secondary |
| Samsung Internet | Android 10+ | ✓ Secondary |

---

## Visual Regression Testing (Optional)

If implementing automated visual tests:

### Tools

- Playwright (with visual comparisons)
- Percy.io (cloud-based visual testing)
- BackstopJS (local visual regression)

### Test Cases

1. Index page: mobile, tablet, desktop
2. Reception: form states, success state
3. Queue: live updates, offline state
4. Teller: window selected, no windows
5. Display: window cards, full-screen mode

---

## Sign-Off Checklist

Before declaring the responsive design complete:

### Development

- [ ] All breakpoints tested locally
- [ ] No horizontal scroll on any device
- [ ] Offline fallbacks display correctly
- [ ] Performance targets met (Lighthouse 90+)

### Accessibility

- [ ] WAVE: 0 errors
- [ ] Axe: 0 violations
- [ ] Keyboard navigation works throughout
- [ ] Color contrast: WCAG AA (4.5:1)
- [ ] Touch targets: 44×44px minimum

### Cross-Browser

- [ ] Chrome: Latest version
- [ ] Safari: Latest version
- [ ] Firefox: Latest version
- [ ] Mobile Safari: iOS 13+
- [ ] Mobile Chrome: Android 10+

### Real Devices

- [ ] iPhone (any model)
- [ ] Android phone (any vendor)
- [ ] iPad or Android tablet
- [ ] Desktop (1920px+)

### Performance

- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Bundle size < 200KB (gzipped)

---

## Debugging Common Issues

### Problem: Text too small on mobile

**Solution:**

- Check font-size classes: should start with `text-sm` or `text-base`
- Add `sm:text-base` or `md:text-lg` for scaling
- Verify no hardcoded `12px` sizes in inline styles

### Problem: Buttons not tappable

**Solution:**

- Minimum height: 44px (11 units in Tailwind = `h-11`)
- Add margin/padding between targets: `m-1` or `gap-2`
- Verify no overlapping elements

### Problem: Layout shift when images load

**Solution:**

- Set explicit dimensions: `h-32 w-32` before image loads
- Use skeleton screens or placeholder
- Preload critical images

### Problem: Offline data missing

**Solution:**

- Check browser cache (DevTools → Storage → Cache Storage)
- Verify SSE fallback polling works
- Display cached data with "last updated" timestamp

### Problem: Focus rings not visible

**Solution:**

- Add `focus:ring-2 focus:ring-primary/50` to interactive elements
- Increase ring width: `focus:ring-2` (minimum)
- Test with DevTools element inspector

---

## Conclusion

Use this guide to validate:

✓ Responsive layouts across all breakpoints
✓ Accessibility compliance (WCAG 2.1 AA)
✓ Performance metrics
✓ Cross-browser compatibility
✓ Real-world user experiences

Repeat testing before each release to ensure quality.
