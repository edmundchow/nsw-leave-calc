# NSW Leave Calculator — Project Handover

**Last Updated**: 2026-05-16  
**Repository**: edmundchow/nsw-leave-calc  
**Branch**: `main`  
**App Type**: Single-page HTML/JS PWA (offline-capable via Service Worker)

---

## 1) Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | 205 | UI shell with inline CSS; 6 collapsible card sections |
| `app.js` | 390+ | All logic: calculations, persistence, collapsible sections |
| `sw.js` | 38 | Service worker (network-first, cache-fallback, version `v16`) |
| `manifest.json` | 15 | PWA install manifest |
| `style.css` | 53 | External styles (used in addition to inline styles) |

## 2) What's Implemented

### Core (Phase 1)
- Annual Leave accrual: `weeklyHours × 4` per year, prorated by fractional service years
- LSL accrual: `serviceYears × (8.6667 / 10)` weeks (NSW LSL Act 1955 formula)
- Known-balance mode (manual balance entry with recorded date)
- Roster-aware calculations (weekday toggles, public holiday exclusions)
- Leave history with Annual Leave / LSL type differentiation (radio button)
- IndexedDB persistence (`NSWLeaveTracker` / `userData`)
- PWA with service worker (network-first, cache-fallback for offline)
- Holiday data fetched from `data.gov.au` with hardcoded fallback
- Leave optimizer (finds high-value holiday clusters for long weekends)

### Phase 2 — Resignation Mode
- Strategy comparison: lump sum payout vs. run-down during notice period
- Notice planner: back-calculates submission dates accounting for working days and public holidays
- Notice shortfall display with income loss and super loss estimates
- Leave loading toggle (default 0%, configurable per award)
- Notice planner output shows two scenarios: full notice vs. reduced/immediate release

### UI Features
- All 6 section cards collapsible, collapsed by default
- Section titles have clickable toggle with ▶/▼ indicator
- `initCollapsibleSections()` wraps card content via DOM manipulation at runtime

## 3) Key Functions in `app.js`

| Function | Line | Purpose |
|---|---|---|
| `getState()` | 52 | Reads all form inputs into a state object |
| `validateState(state)` | 73 | Returns error string or null |
| `calculateServiceYears()` | 86 | `(end - start) / 365.2425 / msPerDay` |
| `calculateLeaveFromState()` | 91 | Returns `{ annualHours, annualDays, lslWeeks, serviceYears }` |
| `calculateExitStrategies()` | 118 | Lump sum vs run-down comparison with leave loading |
| `renderStrategies()` | 137 | Renders strategy results to DOM |
| `isWorkingDay()` | 155 | Checks roster + public holiday exclusion |
| `findResignationDate()` | 161 | Walks backwards from target date counting working days |
| `renderNoticePlanner()` | 172 | Shows submission dates, shortfall, income/super loss |
| `calculateLeave()` | 222 | Main calculation entry point |
| `saveToDB()` / `loadFromDB()` | 261 / 284 | IndexedDB persistence |
| `addHistoryEntry()` | 305 | Adds leave taken entry with Annual/LSL type |
| `initCollapsibleSections()` | 324 | Sets up accordion behavior for all cards |
| `initializeUI()` | 344 | Populates dropdowns, attaches event listeners |

## 4) Business Logic & Assumptions

### Annual Leave
- Accrual rate: `weeklyHours × 4` per year (NES minimum)
- Daily hours: `weeklyHours / workingDays` (equal distribution across roster days)
- Accrual calculated to today's date (not to target last day)

### LSL
- Formula: `serviceYears × (8.6667 / 10)` weeks
- Deducts LSL taken (`lslTakenHours / weeklyHours`) from accrued balance
- Always prorates (even before 5/10 year thresholds)

### Resignation / Notice
- Notice required = `noticeWeeks × workingDaysPerWeek` in **working days**
- Public holidays inside notice period do **not** count toward notice
- Submission date is the earliest working day that satisfies the required working days when walking backwards from target last day
- Income loss = shortfall working days × daily pay
- Super loss = income loss × super rate

### Payout
- Lump sum = `annualHours × hourlyRate × (1 + leaveLoading / 100)`
- Run-down = `runDownHours × hourlyRate` (where runDown includes extra accrual during notice)
- Leave loading defaults to 0% (NES minimum); set per award (commonly 17.5%)

## 5) Known Risks & Gaps

1. **No automated tests** — zero test files; regression testing is manual
2. **UI/logic coupling** — `getState()` and `render*()` functions read/write DOM directly
3. **Legal assumptions not validated** — notice as working days, holiday exclusions, pro-rata treatment all need domain sign-off
4. **Holiday data** — fetched from `data.gov.au` at runtime with a hardcoded fallback array (2026-2027); no versioning or year-scoped refresh policy
5. **Accrual endpoint** — uses `today` rather than target last day; resignation scenario doesn't freeze accrual at the effective exit date
6. **No tax modeling** — all figures are pre-tax

## 6) Tag

- `pre-radio-leave-type` — checkpoint before Annual Leave / LSL radio button differentiation was added

## 7) Suggested Priorities

1. **Add automated tests** — extract pure calculation functions, test with known scenario matrix
2. **Validate legal assumptions** — working days vs calendar days for notice, holiday counting rules
3. **Decouple UI from logic** — refactor into state + pure functions + DOM adapters
4. **Harden holiday data** — version per year, clear fallback policy
5. **Improve resignation accrual** — freeze leave accrual at the actual last day, not today

---

*See `README.md` for deployment instructions (GitHub Pages).*
