# Lighthouse CI - Multi-Environment Performance & Carbon Footprint Testing

A comprehensive performance testing solution that combines **Google Lighthouse** audits with **carbon footprint analysis**, historical tracking via a local dashboard, and optional **Confluence reporting**.

---

## Table of Contents

- [Overview](#overview)
- [What Does This Tool Do?](#what-does-this-tool-do)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Multi-Environment Setup](#multi-environment-setup)
- [Running Tests](#running-tests)
- [Understanding Reports](#understanding-reports)
- [Confluence Integration](#confluence-integration)
- [Configuration Reference](#configuration-reference)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              LIGHTHOUSE CI + CARBON REPORTING + CONFLUENCE                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   📊 Performance Scores    +    🌍 Carbon Footprint    +    🎯 QA Reports  │
│                                                                             │
│   • Page load times            • CO₂ per page view        • Prioritized    │
│   • Core Web Vitals            • Monthly emissions           issues        │
│   • Resource analysis          • Sustainability            • Global vs     │
│   • Opportunities                ratings                     Local issues  │
│                                                                             │
│   🌐 Multi-Environment     +    📝 Confluence Publishing                   │
│                                                                             │
│   • CANARY / PROD / any        • Auto-update tracking tables               │
│   • Single --env flag          • Score attachments per run                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

All commands support a `--env` flag to target different environments (e.g., staging, production) from a single codebase.

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
- Multi-environment support via a single `--env` flag and `projects-config.json`
- Dashboard for comparing runs over time
- Custom assertions based on performance budgets
- Carbon footprint calculations using `@tgwf/co2` model
- Authentication support via Playwright cookies (automated or manually exported)
- QA-friendly reports with actionable remediation guidance
- Confluence integration for auto-publishing scores and attachments

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         LIGHTHOUSE CI ARCHITECTURE                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                      │     │                 │     │                 │
│  projects-config.json│     │   LIGHTHOUSE    │     │   LHCI SERVER   │
│  (env → token, URLs, │────▶│   CI CLI        │────▶│   (Dashboard)   │
│   cookies, confluence│     │                 │     │   :9001         │
│                      │     │                 │     │                 │
└──────────────────────┘     └────────┬────────┘     └─────────────────┘
          │                           │
          │  urls/                    │ JSON Reports
          │  canary-urls.json         ▼
          │  prod-urls.json  ┌─────────────────┐
          └─────────────────▶│                 │
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
           ┌──────────────────────────┼───────────────────────┐
           │                          │                       │
           ▼                          ▼                       ▼
┌──────────────────┐      ┌────────────────────┐   ┌────────────────────┐
│                  │      │                    │   │                    │
│  Carbon          │      │  QA-Friendly       │   │  Confluence        │
│  Footprint       │      │  Opportunities     │   │  Table Update      │
│  Reports         │      │  & Global/Local    │   │  (scores +         │
│                  │      │  Issue Analysis    │   │   attachments)     │
└──────────────────┘      └────────────────────┘   └────────────────────┘
```

### Key Design Decisions

- **Environment-first**: Every command accepts `--env=ENV` to select the target environment. No hardcoded URLs or tokens.
- **Shared lib/**: Common utilities (`lib/config.js`, `lib/cookies.js`) eliminate duplication across scripts.
- **JSON temp config**: The LHCI config is generated as `.lighthouserc.tmp.json` (safe, no code injection) and auto-deleted after each run.
- **Dual cookie support**: Supports both Playwright-automated cookie capture (for IP-whitelisted environments) and manually-exported browser cookies (for environments using CloudFront signed cookies).

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
               │                         │  npm run lhci:run   │
               │                         │  -- --env=PROD      │
               │                         └──────────┬──────────┘
               │                                    │
               │                                    ▼
               │                         ┌─────────────────────┐
               │                         │ 3. Load env config  │
               │                         │    from             │
               │                         │    projects-config  │
               │                         │    .json            │
               │                         └──────────┬──────────┘
               │                                    │
               │                                    ▼
               │                         ┌─────────────────────┐
               │                         │ 4. Auto-fetch       │
               │                         │    Cookies          │
               │                         │    (if needed)      │
               │                         │                     │
               │                         │  🍪 Playwright      │
               │                         │  browser opens      │
               │                         └──────────┬──────────┘
               │                                    │
               │                                    ▼
               │                         ┌─────────────────────┐
               │                         │ 5. Lighthouse       │
               │                         │    Runs on Each URL │
               │                         │                     │
               │         ◄───────────────│  🔍 Testing...      │
               │         Results sent    │  URL 1 of N         │
               │         to dashboard    │  URL 2 of N  ...    │
               │                         └──────────┬──────────┘
               │                                    │
               ▼                                    ▼
    ┌─────────────────────┐              ┌─────────────────────┐
    │                     │              │ 6. JSON Reports     │
    │  View Results in    │              │    Saved to         │
    │  Dashboard          │              │    .lighthouseci/   │
    │                     │              │                     │
    │  localhost:9001     │              │  📁 lhr-*.json      │
    │                     │              └──────────┬──────────┘
    └─────────────────────┘                         │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ 7. Generate Carbon  │
                                         │    Reports          │
                                         │                     │
                                         │  npm run lhci:carbon│
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ 8. Publish to       │
                                         │    Confluence       │
                                         │    (optional)       │
                                         │                     │
                                         │  npm run            │
                                         │  lhci:confluence    │
                                         │  -- --env=PROD      │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                                  DONE ✅

     ALTERNATIVE: Carbon Reports from a Historical Build
     ────────────────────────────────────────────────────

                                         ┌─────────────────────┐
                                         │ A. List builds in   │
                                         │    the dashboard    │
                                         │                     │
                                         │  npm run lhci:fetch │
                                         │  -- --env=PROD      │
                                         │     --list          │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ B. Fetch a specific │
                                         │    build's LHRs     │
                                         │    into             │
                                         │    .lighthouseci/   │
                                         │                     │
                                         │  npm run lhci:fetch │
                                         │  -- --env=PROD      │
                                         │     --build=<id>    │
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ C. Generate carbon  │
                                         │    reports as       │
                                         │    normal           │
                                         │                     │
                                         │  npm run lhci:carbon│
                                         └──────────┬──────────┘
                                                    │
                                                    ▼
                                                  DONE ✅
```

---

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | v18+ | JavaScript runtime |
| **npm** | v9+ | Package manager |
| **Chrome** | Latest | Browser for Lighthouse |

```bash
node --version  # v18.x.x or higher
npm --version   # 9.x.x or higher
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment config
cp projects-config.example.json projects-config.json
#    Fill in your URLs, LHCI tokens, and Confluence details

# 3. Create URL files for each environment
#    e.g. urls/canary-urls.json and urls/prod-urls.json
#    See the Multi-Environment Setup section below for the format

# 4. Start the dashboard server (Terminal 1 - keep running)
npm run lhci:server

# 5. Create a project (first time only, Terminal 2)
npx lhci wizard
#    Select: new-project
#    Server URL: http://localhost:9001
#    Name: my-project
#    Copy the build token into projects-config.json

# 6. Run Lighthouse tests
npm run lhci:run -- --env=PROD

# 7. Generate carbon reports (optional)
npm run lhci:carbon
```

---

## Multi-Environment Setup

All environment configuration lives in `projects-config.json`:

```json
{
  "CANARY": {
    "urlFile": "./urls/canary-urls.json",
    "cookieUrl": "https://your-site.example.com/ip-access",
    "lhciToken": "your-build-token-here",
    "serverBaseUrl": "http://localhost:9001",
    "confluence": {
      "pageId": "your-page-id",
      "spaceId": "your-space-id",
      "baseUrl": "https://your-instance.atlassian.net",
      "tableLocalId": "your-table-local-id"
    }
  },
  "PROD": {
    "urlFile": "./urls/prod-urls.json",
    "cookieUrl": null,
    "lhciToken": "your-prod-build-token",
    "serverBaseUrl": "http://localhost:9001",
    "confluence": { "..." : "..." }
  }
}
```

### URL Files

Each environment has a JSON file in `urls/`:

```json
{
  "urls": [
    "https://your-site.example.com/",
    "https://your-site.example.com/page-1",
    "https://your-site.example.com/page-2"
  ]
}
```

### Adding a New Environment

1. Create `urls/staging-urls.json` with your URLs (the `urls/` folder is gitignored — keep real URLs local)
2. Start the server: `npm run lhci:server`
3. Run `npx lhci wizard` to create a new project and get a build token
4. Add the entry to `projects-config.json` (also gitignored — keep tokens local)
5. Run: `npm run lhci:run -- --env=STAGING`

No other file changes needed.

### Cookie Authentication

**Automated (Playwright)**: For environments with an IP-access page, set `cookieUrl` in the config. Cookies are auto-fetched and cached for 1 hour.

```bash
npm run cookies-setup -- --env=CANARY
```

**Manual (browser export)**: For environments using CloudFront signed cookies or other manual auth, set `cookieUrl: null`. Export cookies from your browser, paste them into `cookies-import.template.json`, then convert and save them for the target environment:

```bash
npm run cookies-import -- --env=PROD
```

This normalises the raw Chrome/browser export into Playwright `storageState` format and writes it to `cookies-prod.json`. You can also point at a specific file:

```bash
npm run cookies-import -- --env=PROD --input=my-export.json
```

The script accepts both a raw JSON array of cookies and an existing Playwright `storageState` object.

---

## Running Tests

All scripts accept `--env=ENV` to target a specific environment (defaults to `CANARY`):

```bash
# Run Lighthouse tests
npm run lhci:run -- --env=PROD

# Extract scores from latest run
npm run lhci:scores -- --env=PROD

# Generate carbon reports (from latest run)
npm run lhci:carbon

# Fetch a historical build and generate carbon reports from it
npm run lhci:fetch -- --env=PROD --list           # list all available builds
npm run lhci:fetch -- --env=PROD --build=<id>     # pull a specific build's LHRs
npm run lhci:carbon                               # then generate reports

# Refresh cookies manually
npm run cookies-setup -- --env=CANARY

# Import browser-exported cookies (for CloudFront / manual auth environments)
npm run cookies-import -- --env=PROD
```

### What Happens During a Run

1. Loads environment config from `projects-config.json`
2. Checks for cached cookies (auto-refreshes if expired and `cookieUrl` is set)
3. Generates a temporary LHCI JSON config with URLs, cookies, and token
4. Runs `lhci autorun` (Lighthouse tests + upload to dashboard)
5. Cleans up the temp config
6. Results available at `http://localhost:9001` and in `.lighthouseci/`

---

## Per-Build Carbon Reports (lhci:fetch)

By default, `lhci:carbon` reads whatever LHR JSON files are currently in `.lighthouseci/`. `lhci:fetch` lets you pull the raw reports from **any historical build** stored in the dashboard and run carbon analysis on it — without re-running Lighthouse.

### Workflow

```
1. List available builds
   npm run lhci:fetch -- --env=PROD --list

2. Copy the build ID from the list output:
   #  Build ID          Run ID                 Date
   1  3a7f91b2c5d1...   abc123...              7 May 2026, 18:32

3. Fetch that build's LHR files into .lighthouseci/
   npm run lhci:fetch -- --env=PROD --build=3a7f91b2c5d1

4. Generate carbon & QA reports from the fetched data
   npm run lhci:carbon
```

### Notes

- `--list` can be omitted; running `lhci:fetch` with just `--env` also prints the build list.
- The fetch step **replaces** any existing LHR files in `.lighthouseci/` with the build's data.
- The LHCI server must be running (`npm run lhci:server`) when you call `lhci:fetch`.
- Partial build IDs work — the script matches on prefix.

---

## Understanding Reports

### Dashboard (localhost:9001)

- 📈 **Historical Trends** — Track performance over time
- 🔄 **Run Comparisons** — Compare before/after optimizations
- 📊 **Score Breakdowns** — Performance, Accessibility, Best Practices, SEO
- 🔔 **Assertions** — Pass/fail based on `lighthouse:recommended` preset

### Carbon Reports (carbon-reports-by-host/)

Generated by `npm run lhci:carbon`:

```
carbon-reports-by-host/
├── index.html                    # 📑 Main entry - lists all hosts
└── your-site.example.com/
    ├── index.html                # 📊 Host summary with all URLs
    └── your-site-page-1.html    # 📄 Detailed report per page
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

#### Detail Page (click any URL)

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
│  │ 🔴 HIGH  🌐 GLOBAL  Reduce unused JavaScript  💰 1.2MB  ▼ │  │
│  │ Remove unused functions and libraries from bundles...    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟡 MEDIUM  📄 LOCAL  Use modern image formats  💰 450KB ▼ │  │
│  │ Convert images to WebP format...                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Priority Badges

| Badge | Meaning | Action |
|-------|---------|--------|
| 🔴 **HIGH** | Top 3 impact items | Fix immediately |
| 🟡 **MEDIUM** | Items 4-6 | Fix soon |
| 🟢 **LOW** | Remaining items | Nice to have |

### Scope Badges

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

## Confluence Integration

Automatically publish Lighthouse scores to a Confluence table after each run.

```bash
# Update Confluence table with latest scores
npm run lhci:confluence -- --env=CANARY

# Same, but also upload LHR JSON as attachments
npm run lhci:confluence:attach -- --env=CANARY

# Dry run (preview without changing Confluence)
npm run lhci:confluence -- --env=CANARY --dry-run
```

### Setup

1. Create a `.env` file:
   ```
   CONFLUENCE_EMAIL=your-email@example.com
   CONFLUENCE_API_TOKEN=your-api-token
   ```

2. Set up a Confluence page with a table, then add the page ID, space ID, and table `ac:local-id` to the environment's `confluence` block in `projects-config.json`.

---

## Configuration Reference

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run lhci:server` | Start the LHCI dashboard server |
| `npm run lhci:run` | Run Lighthouse tests (use `-- --env=ENV`) |
| `npm run lhci:scores` | Extract and print scores from latest run |
| `npm run lhci:fetch` | List or download a historical build's LHRs (use `-- --env=ENV --list` or `--build=<id>`) |
| `npm run lhci:carbon` | Generate carbon footprint HTML reports from `.lighthouseci/` |
| `npm run lhci:confluence` | Publish scores to Confluence |
| `npm run lhci:confluence:attach` | Publish scores + upload LHR JSON attachments |
| `npm run cookies-setup` | Auto-fetch cookies via Playwright (for IP-whitelisted envs) |
| `npm run cookies-import` | Convert a browser-exported cookie file to Playwright format |
| `npm run sitespeed` | Run sitespeed.io analysis (separate pipeline) |

### Configuration Files

| File | Purpose |
|------|---------|
| `projects-config.example.json` | Template — copy to `projects-config.json` and fill in your values |
| `projects-config.json` | Your local config with real tokens/URLs/IDs (gitignored, never committed) |
| `urls/*.json` | URL lists per environment (gitignored, create locally) |
| `best-practices.json` | Fix recommendation text for carbon reports |
| `templates/` | HTML templates for carbon reports |
| `.env` | Confluence API credentials (not committed) |
| `.env.example` | Template for `.env` |

### Shared Libraries

| File | Exports |
|------|---------|
| `lib/config.js` | `parseEnvArg()`, `loadProjectConfig()`, `getCookiesFilePath()` |
| `lib/cookies.js` | `readCookiesFromFile()`, `getAuthCookies()` |

---

## Project Structure

```
Lighthouse-CI/
├── 📄 README.md                      # This file
├── 📄 package.json                   # Dependencies & scripts
├── 📄 projects-config.example.json   # Multi-environment config template (copy → projects-config.json)
├── 📄 best-practices.json            # Fix recommendations for reports
├── 📄 run-lighthouse.js              # Main test runner
├── 📄 setup-cookies.js               # Playwright cookie capture
├── 📄 calculate-carbon.js            # Carbon footprint report generator
├── 📄 patch-lhci-ui.js               # Responsive CSS patch for LHCI dashboard
├── 📄 .env.example                   # Confluence credential template
│
├── 📁 lib/                           # Shared utilities
│   ├── config.js                     # Env parsing, project config loading
│   └── cookies.js                    # Cookie reading and auth logic
│
├── 📁 urls/                          # (gitignored) URL lists per environment — create locally
│   ├── canary-urls.json              #   e.g. {"urls": ["https://your-site.example.com/page-1"]}
│   └── prod-urls.json
│
├── 📁 scripts/                       # Reporting scripts
│   ├── extract-scores.js             # Parse LHR JSON into score summaries
│   ├── update-confluence.js          # Publish scores to Confluence
│   ├── fetch-build.js                # Fetch historical build LHRs from dashboard
│   └── import-cookies.js             # Convert raw browser cookie export to Playwright format
│
├── 📁 templates/                     # HTML templates for carbon reports
│   ├── detail.html                   # Individual page report
│   ├── host-index.html               # Host summary page
│   ├── host-row.html                 # Table row template
│   ├── issue-summary.html            # Global/local issues
│   ├── opportunity.html              # Opportunity card
│   └── top-index.html                # Main index
│
├── 📁 .lighthouseci/                 # (generated) Raw LHR JSON reports
├── 📁 carbon-reports-by-host/        # (generated) Carbon HTML reports
├── 🍪 cookies-*.json                 # (generated) Auth cookies per env
├── 🗄️  lhci.db                       # (generated) SQLite dashboard database
└── 📋 tokens.txt                     # (local only) LHCI project tokens
```

---

## Troubleshooting

### "Cannot connect to server"

The LHCI server isn't running. Start it in a separate terminal:
```bash
npm run lhci:server
```

### "No Lighthouse data found"

Run Lighthouse tests before generating carbon reports:
```bash
npm run lhci:run -- --env=PROD
npm run lhci:carbon
```

### "Cookies expired" / 403 errors

For environments with automated cookies (`cookieUrl` set), cookies refresh automatically. For manual environments:
1. Export cookies from your browser
2. Save as `cookies-{env}.json` in the project root
3. Re-run the tests

### "Port 9001 already in use"

```bash
lsof -ti:9001 | xargs kill -9
npm run lhci:server
```

### Browser window opens during tests

This is normal — Playwright is fetching authentication cookies for the target environment. Wait for it to complete.

### Dashboard shows "Set up a new project"

Run `npx lhci wizard` to create a project (requires the server to be running).

---

## FAQ

### How often should I run tests?

- **Recommended:** After each deployment
- **Minimum:** Weekly
- **Best Practice:** Integrate into CI/CD pipeline

### How do I add new URLs to test?

Edit the URL file for your environment (e.g., `urls/prod-urls.json`) and add entries to the `urls` array.

### How do I add a new environment?

1. Create `urls/{env}-urls.json`
2. Run `npx lhci wizard` to get a build token
3. Add the entry to `projects-config.json`
4. Run: `npm run lhci:run -- --env={ENV}`

### Can I test authenticated pages?

Yes. Set `cookieUrl` in `projects-config.json` for automated Playwright capture, or set it to `null` and manually export cookies to `cookies-{env}.json`.

### What affects the carbon footprint?

Page weight (images, scripts, styles), number of requests, server efficiency, CDN usage, and caching policies.

### How do I reset all data?

```bash
rm lhci.db                          # Dashboard database
rm cookies-*.json                   # Auth cookies
rm -rf .lighthouseci                # Raw Lighthouse reports
rm -rf carbon-reports-by-host       # Carbon HTML reports
```

---

## License

ISC License

---

*Built with ❤️ for better web performance and a greener internet.*
