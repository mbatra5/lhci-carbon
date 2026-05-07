/**
 * Patches the LHCI server's built UI to inject custom CSS fixes.
 * Run automatically via the `postinstall` npm script after `npm install`.
 *
 * Fixes:
 *  - Horizontal overflow caused by long URLs pushing content off the left edge
 *  - URL dropdowns truncated with ellipsis instead of overflowing
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'node_modules/@lhci/server/dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const CUSTOM_CSS_SRC = path.join(__dirname, 'lhci-custom.css');
const CUSTOM_CSS_DEST = path.join(DIST_DIR, 'custom.css');
const LINK_TAG = '<link rel="stylesheet" href="/app/custom.css">';
const INJECT_AFTER = '<link rel="stylesheet" href="/app/chunks/entry-C4YZOFS6.css">';

const CSS_CONTENT = `/* Custom LHCI UI fixes — injected via patch-lhci-ui.js */

/* Prevent long URLs from pushing content off the left edge of the screen */
body {
  overflow-x: hidden;
}

/* Clip the header band so negative-margin bleed doesn't cause horizontal scroll */
.lhr-comparison__scores-and-dropdowns {
  overflow: hidden;
  box-sizing: border-box;
}

/* ── URL dropdowns: truncate with ellipsis at all sizes ── */
.dropdown--url select,
.dropdown--compare-url select {
  text-overflow: ellipsis;
  overflow: hidden;
}

.dropdown__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}

/* ── Large screens (≥1200px): generous URL width ── */
@media (min-width: 1200px) {
  .dropdown--url select,
  .dropdown--compare-url select {
    max-width: 380px;
  }
  .dropdown__label {
    max-width: 380px;
  }
}

/* ── Medium screens (900px–1199px): comfortable but compact ── */
@media (min-width: 900px) and (max-width: 1199px) {
  .dropdown--url select,
  .dropdown--compare-url select {
    max-width: 260px;
  }
  .dropdown__label {
    max-width: 260px;
  }
}

/* ── Small screens (600px–899px): tight, stack the dropdowns ── */
@media (min-width: 600px) and (max-width: 899px) {
  .dropdown--url select,
  .dropdown--compare-url select {
    max-width: 180px;
  }
  .dropdown__label {
    max-width: 180px;
  }

  /* Stack the Base/Compare URL row vertically */
  .lhr-comparison__dropdowns {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}

/* ── Extra-small screens (<600px): minimal width, stack everything ── */
@media (max-width: 599px) {
  .dropdown--url select,
  .dropdown--compare-url select {
    max-width: 130px;
  }
  .dropdown__label {
    max-width: 130px;
  }

  .lhr-comparison__dropdowns {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  /* Scores row: wrap so they don't overflow horizontally */
  .lhr-comparison-scores {
    flex-wrap: wrap;
    justify-content: center;
  }

  .lhr-comparison-scores-item {
    flex-basis: 45%;
    margin-bottom: 8px;
  }
}
`;

if (!fs.existsSync(DIST_DIR)) {
  console.warn('patch-lhci-ui: @lhci/server dist directory not found, skipping patch.');
  process.exit(0);
}

// Write the CSS file
fs.writeFileSync(CUSTOM_CSS_DEST, CSS_CONTENT, 'utf8');
console.log('patch-lhci-ui: wrote custom.css');

// Patch index.html if not already patched
let html = fs.readFileSync(INDEX_HTML, 'utf8');
if (html.includes(LINK_TAG)) {
  console.log('patch-lhci-ui: index.html already patched, skipping.');
} else {
  html = html.replace(INJECT_AFTER, `${INJECT_AFTER}\n    ${LINK_TAG}`);
  fs.writeFileSync(INDEX_HTML, html, 'utf8');
  console.log('patch-lhci-ui: patched index.html with custom CSS link.');
}

console.log('patch-lhci-ui: done.');
