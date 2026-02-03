# Lighthouse CI - Performance & Carbon Footprint Testing

A comprehensive performance testing solution that combines **Google Lighthouse** audits with **carbon footprint analysis** to help teams identify and fix performance issues while tracking environmental impact.

---

## Table of Contents

- [Overview](#overview)
- [What Does This Tool Do?](#what-does-this-tool-do)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quick Start Guide](#quick-start-guide)
- [Detailed Setup](#detailed-setup)
- [Running Tests](#running-tests)
- [Understanding Reports](#understanding-reports)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LIGHTHOUSE CI + CARBON REPORTING                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   📊 Performance Scores    +    🌍 Carbon Footprint    +    🎯 QA Reports  │
│                                                                             │
│   • Page load times            • CO₂ per page view        • Prioritized    │
│   • Core Web Vitals            • Monthly emissions         issues          │
│   • Resource analysis          • Tree offset calc         • Global vs      │
│   • Opportunities              • Sustainability            Local issues    │
│                                  ratings                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Does This Tool Do?

### For Non-Technical Users 👥

This tool helps you understand:

1. **How fast is your website?** - Get a score from 0-100 for each page
2. **What's slowing it down?** - See prioritized issues with clear explanations
3. **How to fix it?** - Get specific instructions for each problem
4. **Environmental impact** - Track carbon emissions from your website

### For Technical Users 👨‍💻

- Automated Lighthouse CI audits with historical tracking
- Dashboard for comparing runs over time
- Custom assertions based on performance budgets
- Carbon footprint calculations using `@tgwf/co2` model
- Authentication support via Playwright cookies
- QA-friendly reports with actionable remediation guidance

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           LIGHTHOUSE CI ARCHITECTURE                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  TEST URLS      │     │   LIGHTHOUSE    │     │   LHCI SERVER   │
│  (test-urls.    │────▶│   CI CLI        │────▶│   (Dashboard)   │
│   json)         │     │                 │     │   :9001         │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ JSON Reports
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  .lighthouseci/ │
                        │  (Raw Reports)  │
                        │                 │
                        └────────┬────────┘
                                 │
                                 │ Process
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  calculate-     │
                        │  carbon.js      │
                        │                 │
                        └────────┬────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌────────────────┐      ┌────────────────┐
│               │      │                │      │                │
│  Carbon       │      │  QA-Friendly   │      │  Global/Local  │
│  Footprint    │      │  Opportunities │      │  Issue         │
│  Reports      │      │  Reports       │      │  Analysis      │
│               │      │                │      │                │
└───────────────┘      └────────────────┘      └────────────────┘
```

---

## How It Works

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

     TERMINAL 1 (Dashboard)              TERMINAL 2 (Tests)
     ─────────────────────              ──────────────────

            START
              │
              ▼
    ┌─────────────────────┐
    │ 1. Start LHCI Server│
    │    (Dashboard)       │
    │                      │
    │  npm run lhci:server │
    │                      │
    │  📊 Dashboard runs   │
    │  at localhost:9001   │
    └──────────┬──────────┘
               │
               │  Server Running...
               │  (Keep this open)
               │
               │                         ┌─────────────────────┐
               │                         │ 2. Run Lighthouse   │
               │                         │    Tests            │
               │                         │                     │
               │                         │  npm run lhci       │
               │                         │                     │
               │                         └──────────┬──────────┘
               │                                    │
               │                                    ▼
               │                         ┌─────────────────────┐
               │                         │ 3. Auto-fetch       │
               │                         │    Cookies          │
               │                         │    (if needed)      │
               │                         │                     │
               │                         │  🍪 Playwright      │
               │                         │  browser opens      │
               │                         └──────────┬──────────┘
               │                                    │
               │                                    ▼
               │                         ┌─────────────────────┐
               │                         │ 4. Lighthouse       │
               │                         │    Runs on Each URL │
               │                         │                     │
               │                         │  🔍 Testing...      │
               │         ◄───────────────│  URL 1 of N         │
               │         Results sent    │  URL 2 of N         │
               │         to dashboard    │  ...                │
               │                         └──────────┬──────────┘
               │                                    │
               ▼                                    ▼
    ┌─────────────────────┐              ┌─────────────────────┐
    │                     │              │ 5. JSON Reports     │
    │  View Results in    │              │    Saved to         │
    │  Dashboard          │              │    .lighthouseci/   │
    │                     │              │                     │
    │  localhost:9001     │              │  📁 lhr-*.json      │
    │                     │              └──────────┬──────────┘
    └─────────────────────┘                         │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ 6. Generate Carbon  │
                                         │    Reports          │
                                         │                     │
                                         │  npm run lhci:carbon│
                                         │                     │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ 7. View HTML        │
                                         │    Reports          │
                                         │                     │
                                         │  📂 Open            │
                                         │  carbon-reports-by- │
                                         │  host/index.html    │
                                         └─────────────────────┘
                                                    │
                                                    ▼
                                                  DONE
```

---

## Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **Node.js** | v18+ | JavaScript runtime | [Download](https://nodejs.org/) |
| **npm** | v9+ | Package manager | Comes with Node.js |
| **Chrome** | Latest | Browser for Lighthouse | [Download](https://www.google.com/chrome/) |

### Verify Installation

Open Terminal and run:

```bash
# Check Node.js version
node --version
# Expected: v18.x.x or higher

# Check npm version  
npm --version
# Expected: 9.x.x or higher
```

---

## Quick Start Guide

### 🚀 5-Minute Setup

```bash
# 1. Clone/navigate to the project
cd Lighthouse-CI

# 2. Install dependencies
npm install

# 3. Open TWO terminal windows (important!)
```

### Terminal 1: Start Dashboard

```bash
npm run lhci:server
```

Or use the full command:
```bash
npx lhci server --storage.storageMethod=sql --storage.sqlDialect=sqlite --storage.sqlDatabasePath=./lhci.db
```

You should see:

```
Server listening on port 9001
```

✅ **Keep this terminal running!**

### Terminal 2: Run Tests

```bash
# Run Lighthouse tests
npm run lhci

# Generate carbon + QA reports
npm run lhci:carbon
```

### View Results

1. **Dashboard**: Open [http://localhost:9001](http://localhost:9001) in browser
2. **QA Reports**: Open `carbon-reports-by-host/index.html` in browser

---

## Detailed Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `@lhci/cli` - Lighthouse CI command-line tool
- `@lhci/server` - Dashboard server
- `@tgwf/co2` - Carbon footprint calculations
- `playwright` - Browser automation for authentication
- `sqlite3` - Database for storing results

### Step 2: Configure Test URLs

Edit `test-urls.json` to add your URLs:

```json
{
  "urls": [
    "https://your-site.com/",
    "https://your-site.com/page-1",
    "https://your-site.com/page-2"
  ]
}
```

### Step 3: Authentication (If Required)

If your site requires authentication, edit `setup-cookies.js`:

```javascript
// Line 19: Update the IP whitelist/auth URL
await page.goto("https://your-auth-url.com/login");
```

The system will automatically:
1. Open a browser window
2. Navigate to the auth URL
3. Save cookies for Lighthouse to use
4. Cache cookies for 1 hour

---

## Running Tests

### Method 1: Full Automated Run

```bash
# Terminal 1 - Start dashboard (keep running)
npm run lhci:server

# Terminal 2 - Run tests + generate reports
npm run lhci && npm run lhci:carbon
```

### Method 2: Step by Step

#### Step 1: Start the Dashboard Server

```bash
npm run lhci:server
```

**What happens:**
- Dashboard starts at `http://localhost:9001`
- SQLite database created/loaded at `lhci.db`
- Server waits for test results

**Expected output:**
```
Server listening on port 9001
```

⚠️ **Keep this terminal open!**

---

#### Step 2: Run Lighthouse Tests

Open a **new terminal** and run:

```bash
npm run lhci
```

**What happens:**
1. 🍪 Checks for cached authentication cookies
2. 🌐 If cookies expired, opens browser to fetch new ones
3. 🔍 Runs Lighthouse on each URL in `test-urls.json`
4. 📤 Uploads results to the dashboard
5. 💾 Saves JSON reports to `.lighthouseci/` folder

**Expected output:**
```
🚀 Running Lighthouse CI with identifier: run-1706636400000
⏰ Timestamp: 2026-01-30T15:00:00.000Z

🍪 Using cached cookies (15 minutes old)
📋 Loaded 3 cookie(s) from file

✅ Lighthouse CI completed successfully!
```

---

#### Step 3: Generate Carbon & QA Reports

```bash
npm run lhci:carbon
```

**Optional:** Specify monthly page views (default: 10,000):

```bash
npm run lhci:carbon 50000
```

**What happens:**
1. 📁 Reads Lighthouse JSON reports from `.lighthouseci/`
2. 🧮 Calculates carbon footprint for each page
3. 🎯 Extracts and prioritizes optimization opportunities
4. 🌐 Analyzes global vs local issues
5. 📝 Generates HTML reports in `carbon-reports-by-host/`

**Expected output:**
```
📁 Found Lighthouse data at: .lighthouseci
📊 Found 9 Lighthouse report(s)

✅ Wrote 9 report(s) for host: canary-bp.navitas.bpglobal.com

📂 All reports written to: carbon-reports-by-host
🧭 Open carbon-reports-by-host/index.html in your browser.
```

---

## Understanding Reports

### Dashboard (localhost:9001)

The LHCI Dashboard provides:

- 📈 **Historical Trends** - Track performance over time
- 🔄 **Run Comparisons** - Compare before/after optimizations
- 📊 **Score Breakdowns** - Detailed Lighthouse metrics
- 🔔 **Assertions** - Pass/fail based on performance budgets

### Carbon Reports (carbon-reports-by-host/)

```
carbon-reports-by-host/
├── index.html                     # 📑 Main entry - lists all hosts
└── your-site.com/
    ├── index.html                 # 📊 Host summary with all URLs
    ├── your-site.com-page-1.html  # 📄 Detailed report for page 1
    └── your-site.com-page-2.html  # 📄 Detailed report for page 2
```

#### Host Summary Page

```
┌─────────────────────────────────────────────────────────────────┐
│  🌱 your-site.com — Performance + Carbon Report                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Summary Stats                                               │
│  ┌──────────┬──────────┬──────────┬──────────┐                 │
│  │ Total    │ Avg CO₂  │ Total    │ Avg      │                 │
│  │ URLs: 9  │ 0.85g    │ CO₂/yr   │ Perf: 42 │                 │
│  └──────────┴──────────┴──────────┴──────────┘                 │
│                                                                 │
│  📋 URL Performance Table                                       │
│  ┌────────────────┬──────┬──────┬─────────┬─────────┐         │
│  │ URL            │ Size │ Perf │ CO₂/vis │ Rating  │         │
│  ├────────────────┼──────┼──────┼─────────┼─────────┤         │
│  │ /page-1        │ 2.1M │ 65   │ 0.42g   │ 🟢 Good │         │
│  │ /page-2        │ 4.8M │ 38   │ 1.25g   │ 🟠 Fair │         │
│  └────────────────┴──────┴──────┴─────────┴─────────┘         │
│                                                                 │
│  🌐 Global Issues (Site-wide)    📄 Local Issues               │
│  ┌───────────────────────────┐   ┌──────────────────────────┐  │
│  │ • Unused JavaScript (100%)│   │ • Modern images (22%)    │  │
│  │ • Render-blocking (100%)  │   └──────────────────────────┘  │
│  │ • Cache policy (100%)     │                                 │
│  └───────────────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Detail Page (Click any URL)

```
┌─────────────────────────────────────────────────────────────────┐
│  Report — https://your-site.com/page-1                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 Metrics                                                     │
│  ┌────────────┬────────────┬────────────┬────────────┐         │
│  │ Transfer   │ Perf Score │ CO₂/visit  │ Rating     │         │
│  │ 2.1 MB     │ 65         │ 0.42g      │ 🟢 Good    │         │
│  └────────────┴────────────┴────────────┴────────────┘         │
│                                                                 │
│  🎯 Optimization Opportunities                                  │
│  💡 Click any item to see how to fix it                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 HIGH  🌐 GLOBAL  Reduce unused JavaScript  💰 1.2MB  ▼ │   │
│  │ Remove unused functions and libraries from bundles...    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟡 MEDIUM  📄 LOCAL  Use modern image formats  💰 450KB ▼ │   │
│  │ Convert images to WebP format...                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Understanding Priority Badges

| Badge | Meaning | Action |
|-------|---------|--------|
| 🔴 **HIGH** | Top 3 impact items | Fix immediately |
| 🟡 **MEDIUM** | Items 4-6 | Fix soon |
| 🟢 **LOW** | Remaining items | Nice to have |

### Understanding Scope Badges

| Badge | Meaning | Action |
|-------|---------|--------|
| 🌐 **GLOBAL** | Affects 50%+ of pages | Infrastructure fix (helps all pages) |
| 📄 **LOCAL** | Affects <50% of pages | Component-specific fix |

### Carbon Ratings

| Rating | CO₂/view | Meaning |
|--------|----------|---------|
| 🟢 Excellent | < 0.5g | Highly optimized |
| 🟡 Good | 0.5-1.0g | Efficient, minor improvements possible |
| 🟠 Fair | 1.0-2.0g | Average, optimizations recommended |
| 🔴 Poor | > 2.0g | Heavy, needs significant optimization |

---

## Configuration

### Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run lhci:server` | `npx lhci server ...` | Start the dashboard server |
| `npm run lhci` | `node run-lighthouse.js` | Run Lighthouse tests |
| `npm run lhci:carbon` | `node calculate-carbon.js` | Generate carbon reports |

### Configuration Files

| File | Purpose |
|------|---------|
| `test-urls.json` | URLs to test |
| `lighthouserc.js` | Lighthouse CI configuration |
| `setup-cookies.js` | Authentication setup |
| `best-practices.json` | Fix recommendations |
| `templates/` | HTML report templates |

### Customizing Monthly Views

The carbon footprint calculations use monthly page views. Default is 10,000.

```bash
# Use custom monthly views
npm run lhci:carbon 50000  # 50,000 views/month
npm run lhci:carbon 100000 # 100,000 views/month
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to server"

**Problem:** Tests fail with connection error

**Solution:**
```bash
# Make sure dashboard is running in Terminal 1
npm run lhci:server
```

#### 2. "No Lighthouse data found"

**Problem:** Carbon reports fail with "No valid LHR reports"

**Solution:**
```bash
# Run Lighthouse tests first
npm run lhci

# Then generate carbon reports
npm run lhci:carbon
```

#### 3. "Cookies expired"

**Problem:** Authentication fails

**Solution:**
- The system auto-fetches new cookies
- If it keeps failing, delete `cookies.json` and re-run
- Check that `setup-cookies.js` has the correct auth URL

#### 4. "Port 9001 already in use"

**Problem:** Dashboard won't start

**Solution:**
```bash
# Kill existing process
lsof -ti:9001 | xargs kill -9

# Restart dashboard
npm run lhci:server
```

#### 5. "Cannot use sqlite without a database path"

**Problem:** Server fails with database path error

**Solution:**
Use the correct command syntax (newer LHCI versions):
```bash
npm run lhci:server
# Or:
npx lhci server --storage.storageMethod=sql --storage.sqlDialect=sqlite --storage.sqlDatabasePath=./lhci.db
```

#### 6. Browser window opens during tests

**Why:** This is normal! It's fetching authentication cookies.

**Action:** Just wait for it to complete automatically.

---

## FAQ

### How often should I run tests?

- **Recommended:** After each deployment
- **Minimum:** Weekly
- **Best Practice:** Integrate into CI/CD pipeline

### Can I test authenticated pages?

Yes! The system uses Playwright to handle authentication:
1. Edit `setup-cookies.js` with your auth URL
2. Cookies are cached for 1 hour
3. Tests automatically use the saved cookies

### How do I add new URLs to test?

Edit `test-urls.json`:
```json
{
  "urls": [
    "https://your-site.com/new-page"
  ]
}
```

### What affects the carbon footprint?

- Page weight (images, scripts, styles)
- Number of requests
- Server efficiency
- CDN usage
- Caching policies

### How do I reset all data?

```bash
# Delete database
rm lhci.db

# Delete cached cookies
rm cookies.json

# Delete reports
rm -rf .lighthouseci carbon-reports-by-host
```

---

## Project Structure

```
Lighthouse-CI/
├── 📄 README.md                 # This file
├── 📄 package.json              # Dependencies & scripts
├── 📄 lighthouserc.js           # LHCI configuration
├── 📄 test-urls.json            # URLs to test
├── 📄 run-lighthouse.js         # Main test runner
├── 📄 setup-cookies.js          # Authentication handler
├── 📄 calculate-carbon.js       # Carbon report generator
├── 📄 best-practices.json       # Fix recommendations
├── 📁 templates/                # HTML report templates
│   ├── detail.html              # Individual page report
│   ├── host-index.html          # Host summary page
│   ├── host-row.html            # Table row template
│   ├── issue-summary.html       # Global/local issues
│   ├── opportunity.html         # Opportunity card
│   └── top-index.html           # Main index
├── 📁 .lighthouseci/            # Raw Lighthouse reports (generated)
├── 📁 carbon-reports-by-host/   # HTML reports (generated)
└── 🗄️ lhci.db                   # SQLite database (generated)
```

---

## Support

For questions or issues:
- Check the [Troubleshooting](#troubleshooting) section
- Review the [FAQ](#faq)
- Contact: Madhur Batra

---

## License

ISC License

---

*Built with ❤️ for better web performance and a greener internet*
