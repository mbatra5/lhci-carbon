# QA-Friendly Lighthouse Reporting Guide

## Overview

This Lighthouse CI project now generates **QA-friendly performance reports** with prioritized, actionable optimization opportunities. Instead of showing raw technical JSON data, the reports now display issues in plain language that QAs can easily understand and report to developers.

## What's New

### 1. **Prioritized Opportunities** 🎯

When you click on a URL in the carbon report, you'll now see optimization opportunities sorted by impact:

- **🔴 HIGH Priority** - Issues with the biggest performance impact (top 3)
- **🟡 MEDIUM Priority** - Moderate improvements (next 3)
- **🟢 LOW Priority** - Nice-to-have optimizations (remaining)

### 2. **Non-Technical Descriptions**

Each opportunity shows:
- **Title**: Clear name of the issue
- **Description**: What the problem is in plain language
- **Potential Savings**: How much time/data could be saved (e.g., "1.2s" or "450 KB")
- **Action Item**: Specific instruction for what to report to developers

### 3. **Issues Column in Main Report**

The main report table now includes an **🎯 Issues** column showing:
- Number of optimization opportunities per URL
- Color-coded by severity:
  - 🔴 Red badge = Has HIGH priority issues
  - 🟡 Yellow badge = Only MEDIUM/LOW priority issues
  - ✓ Green checkmark = No issues (well optimized!)

## How to Use

### Step 1: Run Lighthouse Tests

```bash
node run-lighthouse.js
```

This will:
1. Fetch authentication cookies (if needed)
2. Run Lighthouse tests on all URLs in `test-urls.json`
3. Store results in `.lighthouseci/` folder

### Step 2: Generate Carbon & Performance Reports

```bash
node calculate-carbon.js
```

Optional: Specify monthly views (default is 10,000):
```bash
node calculate-carbon.js 50000
```

This generates HTML reports in `carbon-reports-by-host/`

### Step 3: View Reports

Open `carbon-reports-by-host/index.html` in your browser.

1. **Main Index** - Lists all hosts tested
2. **Host Report** - Shows all URLs for a host with performance metrics and issue counts
3. **Detail Page** - Click any URL to see prioritized opportunities

## Example Opportunities

### High Priority Example

```
🔴 HIGH | Eliminate render-blocking resources | 💰 Save: 1.2s

Description: Resources are blocking the first paint of your page. Consider 
delivering critical JS/CSS inline and deferring all non-critical resources.

📋 What to report to dev: Ask dev to defer non-critical CSS/JS or move 
scripts to bottom of page. This will improve initial page load time.
```

### Medium Priority Example

```
🟡 MEDIUM | Remove unused JavaScript | 💰 Save: 450 KB

Description: Remove unused JavaScript to reduce bytes consumed by network activity.

📋 What to report to dev: Request removal of unused JavaScript code or 
implement lazy-loading for code that's not immediately needed.
```

## Creating Bug Reports

When you find performance issues, create a bug with:

1. **URL**: The page URL from the report
2. **Priority**: Use the badge color (🔴 HIGH, 🟡 MEDIUM, 🟢 LOW)
3. **Issue**: Copy the opportunity title
4. **Potential Savings**: Copy the savings value
5. **Action Needed**: Copy the "What to report to dev" text
6. **Screenshot**: Attach screenshot from the detail page

### Example Bug Template

```
Title: [PERFORMANCE] Eliminate render-blocking resources on /qa-modal

Priority: HIGH 🔴
Potential Savings: 1.2 seconds

Description:
Resources are blocking the first paint of the page, causing slow initial load.

Action Required:
Defer non-critical CSS/JS or move scripts to bottom of page to improve 
initial page load time.

URL: https://example.com/page-name
Report: [attach screenshot]
```

## Tips for QAs

1. **Focus on HIGH priority issues first** - These have the biggest impact
2. **Sort by Issues column** - Click the 🎯 Issues header to find pages with most problems
3. **Check the "Potential Savings"** - Prioritize issues with largest time/size savings
4. **Group similar issues** - If multiple pages have the same issue, report them together
5. **Use the raw data** - Click "View raw Lighthouse data" if devs need technical details

## Opportunity Types Explained

| Opportunity | What It Means | Impact |
|-------------|---------------|--------|
| Render-blocking resources | CSS/JS files loading before page content shows | High |
| Unused JavaScript | Code downloaded but never executed | High |
| Unused CSS | Styles downloaded but never used | Medium |
| Modern image formats | Using old JPEG/PNG instead of WebP/AVIF | Medium |
| Offscreen images | All images load immediately, even below fold | Medium |
| Unminified files | Files contain whitespace/comments | Low |
| Long cache TTL | Browser doesn't cache files for repeat visits | Low |
| DOM size | Too many HTML elements on the page | High |

## Technical Details

### Files Modified

- `calculate-carbon.js` - Added opportunity extraction and formatting logic
- `templates/detail.html` - Updated to show prioritized opportunities
- `templates/host-index.html` - Added Issues column to table
- `templates/host-row.html` - Added opportunities badge to rows

### Opportunity Prioritization Logic

1. Calculate impact score: `(1 - audit.score) * 100`
2. Sort by impact score (descending)
3. Secondary sort by potential savings value
4. Assign priority:
   - Top 3 = HIGH (🔴)
   - Next 3 = MEDIUM (🟡)
   - Rest = LOW (🟢)

### Supported Audits

The report extracts 25+ performance audits including:
- Resource optimization (blocking, unused, compression)
- Image optimization (formats, lazy-loading, sizing)
- JavaScript optimization (execution time, main-thread work)
- Caching and network efficiency
- DOM and third-party script impact

## Troubleshooting

**Q: No opportunities showing**
- Great! The page is well optimized

**Q: Too many LOW priority issues**
- Focus on HIGH/MEDIUM first, LOW can be addressed later

**Q: Need technical details**
- Click "View raw Lighthouse data" at bottom of detail page

**Q: Savings seem high**
- Lighthouse shows theoretical maximum savings; actual results may vary

## Next Steps

1. Run regular Lighthouse tests (weekly recommended)
2. Track issue count over time
3. Celebrate when HIGH priority issues are fixed! 🎉
4. Compare before/after performance scores

---

**Questions or Feedback?**
Contact: Madhur Batra or your QA Lead
