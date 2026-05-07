# QA Reporting Guide — Lighthouse Performance Reports

## Overview

This framework generates **QA-friendly performance reports** with prioritized, actionable optimization opportunities. Instead of raw technical JSON, reports display issues in plain language that QA engineers can immediately understand and report to developers.

---

## How to Run

### Step 1: Start the Dashboard

```bash
npm run lhci:server
```

Keep this terminal running.

### Step 2: Run Lighthouse Tests

```bash
npm run lhci:run -- --env=CANARY
```

Replace `CANARY` with your target environment (e.g., `PROD`, `STAGING`).

### Step 3: Generate Carbon & Performance Reports

```bash
npm run lhci:carbon
```

Optional — specify monthly page views (default: 10,000):
```bash
npm run lhci:carbon 50000
```

> **Already have data in the dashboard?** You can skip re-running Lighthouse and generate carbon reports from a past build instead — see [Generating Reports from a Past Build](#generating-reports-from-a-past-build) below.

### Step 4: View Reports

- **Dashboard**: Open `http://localhost:9001` in your browser
- **Carbon Reports**: Open `carbon-reports-by-host/index.html` in your browser

---

## Understanding the Reports

### Main Report Table

The host summary page shows all tested URLs with an **Issues** column:

```
URL                    | Page Size | Perf | CO2   | Rating | Issues
-----------------------|-----------|------|-------|--------|-------
/page-1                | 30.46 MB  | 27   | 12.2g | Poor   | 16 (HIGH)
/page-2                | 28.33 MB  | 31   | 11.4g | Poor   | 14 (HIGH)
/page-3                | 24.12 MB  | 42   | 9.7g  | Fair   |  8 (MEDIUM)
```

- **Red badge** = Has HIGH priority issues
- **Yellow badge** = Only MEDIUM/LOW priority issues
- **Green checkmark** = Well optimized, no issues

Click any URL to see the detail page.

### Detail Page — Prioritized Opportunities

Each opportunity shows:

```
HIGH | Minimize main-thread work | Potential savings: 7.1s

Consider reducing the time spent parsing, compiling and executing JS.
You may find delivering smaller JS payloads helps with this.

What to report to dev:
Request optimizing JavaScript that blocks the main thread.
This causes slow interactions.
```

### Priority Levels

| Priority | Criteria | Action |
|----------|----------|--------|
| HIGH | Top 3 by impact | Fix immediately |
| MEDIUM | Next 3 by impact | Fix soon |
| LOW | Remaining | Nice to have |

### Scope Indicators

| Scope | Meaning | How to Report |
|-------|---------|---------------|
| GLOBAL | Affects 50%+ of pages | Report once — it's an infrastructure issue |
| LOCAL | Affects <50% of pages | Report per affected page |

---

## Creating Bug Reports

When you find performance issues, use this template:

```
Title: [PERFORMANCE] {Issue title} on {page path}

Priority: {HIGH / MEDIUM / LOW}
Potential Savings: {time or bytes from the report}

Description:
{Copy the description from the report}

Action Required:
{Copy the "What to report to dev" text}

Environment: {CANARY / PROD / etc.}
URL: {full page URL}
Report: {attach screenshot of the detail page}
```

### Example

```
Title: [PERFORMANCE] Eliminate render-blocking resources on /page-1

Priority: HIGH
Potential Savings: 1.2 seconds

Description:
Resources are blocking the first paint of the page, causing slow initial load.

Action Required:
Ask dev to defer non-critical CSS/JS or move scripts to bottom of page
to improve initial page load time.

Environment: CANARY
URL: https://example.com/page-1
Report: [screenshot attached]
```

---

## Common Opportunity Types

| Opportunity | What It Means | Typical Impact |
|-------------|---------------|----------------|
| Render-blocking resources | CSS/JS files loading before page content shows | High |
| Unused JavaScript | Code downloaded but never executed | High |
| Unused CSS | Styles downloaded but never used | Medium |
| Modern image formats | Using old JPEG/PNG instead of WebP/AVIF | Medium |
| Offscreen images | All images load immediately, even below fold | Medium |
| Unminified files | Files contain unnecessary whitespace/comments | Low |
| Long cache TTL | Browser doesn't cache files for repeat visits | Low |
| DOM size | Too many HTML elements on the page | High |
| Main-thread work | Excessive JavaScript execution blocking interactions | High |
| Third-party scripts | External scripts impacting performance | Medium |

---

## Tips

1. **Focus on HIGH priority issues first** — they have the biggest performance impact
2. **Sort by Issues column** — click the header to find pages with the most problems
3. **Check potential savings** — prioritize issues with the largest time/size savings
4. **Group similar issues** — if multiple pages share the same issue, report them together as a single ticket
5. **Use raw data if needed** — click "View raw Lighthouse data" at the bottom of a detail page for technical details
6. **Compare runs** — use the LHCI dashboard at `localhost:9001` to compare before/after scores

---

## Troubleshooting

**No opportunities showing?**
The page is well optimized — no action needed.

**Too many LOW priority issues?**
Focus on HIGH/MEDIUM first. LOW issues can be addressed in later sprints.

**Savings seem unrealistically high?**
Lighthouse shows theoretical maximum savings. Actual results depend on implementation.

**Need the raw Lighthouse data?**
Click "View raw Lighthouse data" at the bottom of any detail page, or find JSON files in `.lighthouseci/`.

---

---

## Generating Reports from a Past Build

If Lighthouse tests have already been run and uploaded to the dashboard, you can generate carbon reports from **any historical build** without re-running Lighthouse. This is useful for:

- Comparing carbon footprint across builds without triggering a new run
- Analysing a specific release build after the fact
- Generating reports when you don't have access to the environment right now

### Step 1: Make sure the dashboard server is running

```bash
npm run lhci:server
```

### Step 2: List available builds

```bash
npm run lhci:fetch -- --env=PROD --list
```

Output:

```
📋 Builds for "prod" (newest first):

  #  Build ID (use with --build=)              Run ID                 Date
  ─  ────────────────────────────────────────  ─────────────────────  ────────────────────
  1  3a7f91b2c5d1...                            abc123...              7 May 2026, 18:32
  2  9c2e44a1f8b0...                            def456...              6 May 2026, 10:14
```

### Step 3: Fetch that build's data

Copy the build ID from the list and pass it with `--build=`:

```bash
npm run lhci:fetch -- --env=PROD --build=3a7f91b2c5d1
```

This downloads all the LHR JSON files for that build into `.lighthouseci/` (replacing any existing files there).

### Step 4: Generate carbon reports as normal

```bash
npm run lhci:carbon
```

Open `carbon-reports-by-host/index.html` to view the reports.

---

## Workflow Summary

### Fresh run

```
1. npm run lhci:server                    # Start dashboard (keep running)
2. npm run lhci:run -- --env=CANARY       # Run tests
3. npm run lhci:carbon                    # Generate reports
4. Open carbon-reports-by-host/index.html
5. File bugs for HIGH priority issues
6. Track progress in the dashboard over time
```

### From a historical build

```
1. npm run lhci:server                                    # Start dashboard (keep running)
2. npm run lhci:fetch -- --env=CANARY --list              # Find the build you want
3. npm run lhci:fetch -- --env=CANARY --build=<id>        # Fetch its LHR data
4. npm run lhci:carbon                                    # Generate reports
5. Open carbon-reports-by-host/index.html
```
