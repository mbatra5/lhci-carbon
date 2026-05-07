# Feature Summary

## Multi-Environment Lighthouse CI Framework (v2.0)

A modular, multi-environment performance testing framework that combines Lighthouse CI audits, carbon footprint analysis, and Confluence score publishing — all controlled via a single `--env` flag.

---

## Core Features

### 1. Multi-Environment Support

Run Lighthouse tests against any number of target environments from a single codebase:

```bash
npm run lhci:run -- --env=CANARY
npm run lhci:run -- --env=PROD
```

All environment configuration lives in `projects-config.json` — URLs, LHCI tokens, cookie setup, and Confluence targets.

### 2. Dual Cookie Authentication

- **Automated**: Playwright navigates to an IP-access page and captures session cookies (for whitelisted environments)
- **Manual**: Supports browser-exported cookie files for environments with CloudFront signed cookies or other external auth

The runner automatically selects the right approach based on `cookieUrl` in the config.

### 3. Local LHCI Dashboard

A local SQLite-backed dashboard at `http://localhost:9001` stores all historical runs, enabling:
- Score trend tracking across builds
- Side-by-side comparisons between runs
- Pass/fail assertions based on `lighthouse:recommended` preset
- Responsive UI (custom CSS patch for long-URL layouts)

### 4. Carbon Footprint Reports

`calculate-carbon.js` processes raw Lighthouse JSON and generates a suite of HTML reports:
- Per-page carbon footprint (CO2 grams per visit)
- Sustainability ratings
- Monthly emission projections
- Global vs local issue classification
- Prioritized QA-friendly optimization opportunities

### 5. QA-Friendly Opportunity Reports

Each page detail report replaces raw JSON with a prioritized list:

| Priority | Criteria | Visual |
|----------|----------|--------|
| HIGH | Top 3 by impact | Red badge |
| MEDIUM | Next 3 | Yellow badge |
| LOW | Remaining | Green badge |

Every opportunity includes:
- Plain-English description
- Potential savings (time or bytes)
- "What to report to dev" action item

### 6. Confluence Score Publishing

Automatically adds a new column to a Confluence tracking table with scores from the latest run:

```bash
npm run lhci:confluence -- --env=CANARY
npm run lhci:confluence:attach -- --env=CANARY  # also uploads LHR JSON files
```

Supports dry-run mode (`--dry-run`) for previewing changes.

### 7. Responsive Dashboard Patch

`patch-lhci-ui.js` injects custom CSS into the LHCI server UI via a `postinstall` hook:
- Prevents long-URL horizontal overflow
- Media queries adjust layout at four breakpoints (1200px, 900px, 600px, <600px)
- Dropdowns stack vertically on small screens
- Score gauges wrap on mobile

### 8. Per-Build Carbon Reports (lhci:fetch)

`scripts/fetch-build.js` lets you generate carbon reports from **any historical build** stored in the LHCI dashboard — without re-running Lighthouse:

```bash
# List all builds for an environment
npm run lhci:fetch -- --env=PROD --list

# Fetch a specific build's LHR files into .lighthouseci/
npm run lhci:fetch -- --env=PROD --build=<build-id>

# Then generate carbon reports as normal
npm run lhci:carbon
```

The script:
- Queries the LHCI server API to find the project matching `--env`
- Lists available builds with dates and IDs (supports partial ID prefix matching)
- Clears existing LHR files from `.lighthouseci/` and replaces them with the selected build's data
- Prints a `npm run lhci:carbon` reminder on completion

### 9. Browser Cookie Import

`scripts/import-cookies.js` converts a raw Chrome/browser cookie export into Playwright `storageState` format:

```bash
# Paste raw export into cookies-import.template.json, then:
npm run cookies-import -- --env=PROD

# Or point at a specific file:
npm run cookies-import -- --env=PROD --input=my-export.json
```

Accepts both raw JSON arrays and existing Playwright `storageState` objects. Writes output to `cookies-{env}.json`.

---

## Architecture

### Shared Libraries

Common utilities extracted to `lib/` to eliminate duplication:

| Module | Exports |
|--------|---------|
| `lib/config.js` | `parseEnvArg()`, `loadProjectConfig()`, `getCookiesFilePath()`, `getProjectRoot()` |
| `lib/cookies.js` | `readCookiesFromFile()`, `getAuthCookies()` |

### Script Responsibilities

| Script | Role |
|--------|------|
| `run-lighthouse.js` | Orchestrate cookie fetching, temp config generation, and `lhci autorun` |
| `setup-cookies.js` | Playwright-based cookie capture for automated environments |
| `scripts/extract-scores.js` | Parse `.lighthouseci/lhr-*.json` into score summaries |
| `scripts/update-confluence.js` | Publish scores to a Confluence table |
| `scripts/fetch-build.js` | Fetch historical build LHR files from the LHCI server API |
| `scripts/import-cookies.js` | Convert raw browser cookie export to Playwright `storageState` format |
| `calculate-carbon.js` | Generate carbon footprint HTML reports |
| `patch-lhci-ui.js` | Inject responsive CSS into LHCI dashboard |

---

## Configuration

### projects-config.json

Central source of truth for all environments:

```json
{
  "ENV_NAME": {
    "urlFile": "./urls/env-urls.json",
    "cookieUrl": "https://your-site.example.com/ip-access",
    "lhciToken": "build-token-from-lhci-wizard",
    "serverBaseUrl": "http://localhost:9001",
    "confluence": {
      "pageId": "page-id",
      "spaceId": "space-id",
      "baseUrl": "https://your-instance.atlassian.net",
      "tableLocalId": "table-local-id"
    }
  }
}
```

### Adding a New Environment

1. Create `urls/{env}-urls.json`
2. Run `npx lhci wizard` to register a new LHCI project
3. Add the entry to `projects-config.json`
4. Done — all scripts pick it up via `--env`

---

## Technical Notes

### Temp Config Generation

`run-lighthouse.js` builds a `.lighthouserc.tmp.json` at runtime (pure JSON, no JS evaluation). This avoids the security concerns of writing executable `.js` config files and is auto-cleaned after the run.

### Cookie Handling Flow

```
Is there a cached cookie file?
  ├── Yes, age < 1 hour --> use it
  ├── Yes, age >= 1 hour
  │   ├── cookieUrl set --> re-fetch via Playwright
  │   └── cookieUrl null --> use stale file (manual refresh required)
  └── No file found
      ├── cookieUrl set --> fetch via Playwright
      └── cookieUrl null --> warn and continue without cookies
```

### Opportunity Scoring

```
impactScore = (1 - audit.score) * 100
```

Sorted by impact descending, then by potential savings. Priority assigned positionally (top 3 = HIGH, next 3 = MEDIUM, remainder = LOW).

---

## Status

**v2.0** — Multi-environment support complete. Modular architecture with shared `lib/`, generic npm scripts, responsive dashboard, per-build carbon report fetching, and browser cookie import utility.
