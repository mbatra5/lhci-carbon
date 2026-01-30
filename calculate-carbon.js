const { co2 } = require('@tgwf/co2');
const fs = require('fs');
const path = require('path');
const urlLib = require('url');

const co2Emission = new co2();
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUT_ROOT = path.join(__dirname, 'carbon-reports-by-host');
const DEFAULT_MONTHLY_VIEWS = 10000;

function loadTemplate(name) {
const p = path.join(TEMPLATES_DIR, name);
if (!fs.existsSync(p)) throw new Error(`Template not found: ${p}`);
return fs.readFileSync(p, 'utf8');
}

function render(template, vars) {
return template.replace(/\{\{(\w+?)\}\}/g, (_, key) => {
  return (vars && vars[key] !== undefined) ? String(vars[key]) : '';
});
}

function ensureDir(dir) {
fs.mkdirSync(dir, { recursive: true });
}

function sanitizeFilename(s) {
return String(s || '')
  .replace(/(^\w+:|^)\/\//, '')
  .replace(/[:?#]/g, '')
  .replace(/[^\w.-]/g, '-')
  .slice(0, 180);
}

function ratingFor(co2Grams) {
if (co2Grams < 0.5) return { text: '🟢 Excellent', textPlain: 'Excellent', cssClass: 'rating-green' };
if (co2Grams < 1.0) return { text: '🟡 Good', textPlain: 'Good', cssClass: 'rating-yellow' };
if (co2Grams < 2.0) return { text: '🟠 Fair', textPlain: 'Fair', cssClass: 'rating-orange' };
return { text: '🔴 Poor', textPlain: 'Poor', cssClass: 'rating-red' };
}

function escapeHtml(s) {
return String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
}

/**
 * Extract optimization opportunities from Lighthouse report
 * @param {Object} report - Lighthouse report
 * @returns {Array} - Array of opportunity objects sorted by impact
 */
function extractOpportunities(report) {
  const audits = report.audits || (report.lhr && report.lhr.audits) || {};
  const opportunities = [];

  // Key audits that provide actionable optimization opportunities
  const relevantAudits = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'modern-image-formats',
    'offscreen-images',
    'unminified-css',
    'unminified-javascript',
    'uses-text-compression',
    'uses-responsive-images',
    'efficient-animated-content',
    'duplicated-javascript',
    'legacy-javascript',
    'total-byte-weight',
    'uses-long-cache-ttl',
    'font-display',
    'server-response-time',
    'redirects',
    'uses-rel-preconnect',
    'dom-size',
    'bootup-time',
    'mainthread-work-breakdown',
    'third-party-summary',
    'largest-contentful-paint-element',
    'lcp-lazy-loaded',
    'unsized-images'
  ];

  for (const auditId of relevantAudits) {
    const audit = audits[auditId];
    if (!audit || audit.score === null || audit.score >= 1) continue;

    // Extract potential savings
    let savingsText = audit.displayValue || '';
    let savingsValue = audit.numericValue || 0;
    
    // Calculate impact score (0-100, higher = more important)
    // Based on: potential savings, current score, and audit weight
    const scoreImpact = (1 - (audit.score || 0)) * 100;
    const impactScore = Math.round(scoreImpact);

    opportunities.push({
      id: auditId,
      title: audit.title || auditId,
      description: audit.description || '',
      score: audit.score,
      savingsText: savingsText,
      savingsValue: savingsValue,
      impactScore: impactScore,
      details: audit.details || null
    });
  }

  // Sort by impact (highest first)
  opportunities.sort((a, b) => {
    // Primary: impact score
    if (b.impactScore !== a.impactScore) {
      return b.impactScore - a.impactScore;
    }
    // Secondary: savings value
    return b.savingsValue - a.savingsValue;
  });

  return opportunities;
}

/**
 * Get best practices for resolving specific audit issues
 * @param {String} auditId - Audit identifier
 * @returns {String} - HTML string with best practices
 */
function getBestPractices(auditId) {
  const practices = {
    'render-blocking-resources': `
      <strong>How to fix:</strong>
      <ul>
        <li>Add <code>defer</code> or <code>async</code> attribute to script tags: <code>&lt;script defer src="script.js"&gt;</code></li>
        <li>Move critical CSS inline in the <code>&lt;head&gt;</code></li>
        <li>Load non-critical CSS asynchronously using media queries</li>
        <li>Place scripts at the bottom of <code>&lt;body&gt;</code> tag when possible</li>
      </ul>`,
    'unused-css-rules': `
      <strong>How to fix:</strong>
      <ul>
        <li>Remove unused CSS classes and rules from stylesheets</li>
        <li>Split CSS into per-page bundles instead of one large file</li>
        <li>Use tools like PurgeCSS to automatically remove unused styles</li>
        <li>Load page-specific styles only when needed</li>
      </ul>`,
    'unused-javascript': `
      <strong>How to fix:</strong>
      <ul>
        <li>Remove unused functions and libraries from bundles</li>
        <li>Use code splitting to load JavaScript only when needed</li>
        <li>Implement lazy loading: <code>import('module').then(...)</code></li>
        <li>Use tree-shaking to eliminate dead code during build</li>
      </ul>`,
    'modern-image-formats': `
      <strong>How to fix:</strong>
      <ul>
        <li>Convert images to WebP format (25-35% smaller than JPEG)</li>
        <li>Use <code>&lt;picture&gt;</code> tag with fallbacks:
          <pre>&lt;picture&gt;
  &lt;source srcset="image.webp" type="image/webp"&gt;
  &lt;img src="image.jpg" alt="..."&gt;
&lt;/picture&gt;</pre></li>
        <li>Consider AVIF format for even better compression</li>
      </ul>`,
    'offscreen-images': `
      <strong>How to fix:</strong>
      <ul>
        <li>Add <code>loading="lazy"</code> attribute to images below the fold:
          <pre>&lt;img src="image.jpg" loading="lazy" alt="..."&gt;</pre></li>
        <li>Do NOT lazy-load images in the viewport (above the fold)</li>
        <li>Consider intersection observer for custom lazy loading</li>
      </ul>`,
    'unminified-css': `
      <strong>How to fix:</strong>
      <ul>
        <li>Minify CSS files during build process</li>
        <li>Remove whitespace, comments, and unnecessary characters</li>
        <li>Use build tools like webpack, vite, or postcss</li>
      </ul>`,
    'unminified-javascript': `
      <strong>How to fix:</strong>
      <ul>
        <li>Minify JavaScript files during build process</li>
        <li>Use tools like Terser or UglifyJS</li>
        <li>Enable minification in webpack/vite configuration</li>
      </ul>`,
    'uses-text-compression': `
      <strong>How to fix:</strong>
      <ul>
        <li>Enable gzip or brotli compression on the web server</li>
        <li><strong>Apache:</strong> Add to .htaccess:
          <pre>AddOutputFilterByType DEFLATE text/html text/css text/javascript</pre></li>
        <li><strong>Nginx:</strong> Add to config:
          <pre>gzip on;
gzip_types text/css text/javascript application/javascript;</pre></li>
      </ul>`,
    'uses-responsive-images': `
      <strong>How to fix:</strong>
      <ul>
        <li>Use <code>srcset</code> attribute to serve different sizes:
          <pre>&lt;img srcset="small.jpg 480w, medium.jpg 800w, large.jpg 1200w" 
     sizes="(max-width: 600px) 480px, 800px" 
     src="medium.jpg" alt="..."&gt;</pre></li>
        <li>Generate multiple image sizes during build</li>
      </ul>`,
    'uses-long-cache-ttl': `
      <strong>How to fix:</strong>
      <ul>
        <li>Set cache headers for static assets (CSS, JS, images):
          <pre>Cache-Control: public, max-age=31536000, immutable</pre></li>
        <li>Use versioned filenames: <code>app.v123.js</code></li>
        <li>Configure CDN caching policies</li>
      </ul>`,
    'font-display': `
      <strong>How to fix:</strong>
      <ul>
        <li>Add <code>font-display: swap</code> to @font-face rules:
          <pre>@font-face {
  font-family: 'MyFont';
  src: url('font.woff2');
  font-display: swap;
}</pre></li>
        <li>This shows text immediately using fallback fonts</li>
      </ul>`,
    'uses-rel-preconnect': `
      <strong>How to fix:</strong>
      <ul>
        <li>Add preconnect hints for third-party domains in <code>&lt;head&gt;</code>:
          <pre>&lt;link rel="preconnect" href="https://fonts.googleapis.com"&gt;
&lt;link rel="preconnect" href="https://cdn.example.com"&gt;</pre></li>
        <li>Use <code>dns-prefetch</code> for older browsers:
          <pre>&lt;link rel="dns-prefetch" href="https://cdn.example.com"&gt;</pre></li>
      </ul>`,
    'dom-size': `
      <strong>How to fix:</strong>
      <ul>
        <li>Reduce number of DOM nodes (aim for &lt;1500 nodes)</li>
        <li>Avoid deep nesting (max depth: 32)</li>
        <li>Use virtualization for long lists (show only visible items)</li>
        <li>Remove unnecessary wrapper divs</li>
      </ul>`,
    'bootup-time': `
      <strong>How to fix:</strong>
      <ul>
        <li>Split large JavaScript bundles into smaller chunks</li>
        <li>Defer non-critical script execution</li>
        <li>Remove or lazy-load heavy libraries</li>
        <li>Use code splitting: load only what's needed per page</li>
      </ul>`,
    'mainthread-work-breakdown': `
      <strong>How to fix:</strong>
      <ul>
        <li>Move heavy computations to Web Workers</li>
        <li>Break long tasks into smaller chunks using <code>setTimeout</code></li>
        <li>Optimize JavaScript execution and parsing</li>
        <li>Reduce main thread blocking time</li>
      </ul>`,
    'redirects': `
      <strong>How to fix:</strong>
      <ul>
        <li>Remove unnecessary redirect chains</li>
        <li>Update links to point directly to final destination</li>
        <li>Avoid HTTP to HTTPS redirects by using HTTPS links</li>
      </ul>`,
    'third-party-summary': `
      <strong>How to fix:</strong>
      <ul>
        <li>Audit and remove unnecessary third-party scripts</li>
        <li>Load non-critical third-party scripts asynchronously</li>
        <li>Use <code>async</code> or <code>defer</code> for analytics, ads</li>
        <li>Consider self-hosting critical third-party resources</li>
      </ul>`,
    'lcp-lazy-loaded': `
      <strong>How to fix:</strong>
      <ul>
        <li>Remove <code>loading="lazy"</code> from the main hero/LCP image</li>
        <li>Eagerly load above-the-fold images:
          <pre>&lt;img src="hero.jpg" loading="eager" alt="..."&gt;</pre></li>
        <li>Consider preloading the LCP image:
          <pre>&lt;link rel="preload" as="image" href="hero.jpg"&gt;</pre></li>
      </ul>`,
    'unsized-images': `
      <strong>How to fix:</strong>
      <ul>
        <li>Add explicit width and height to all images:
          <pre>&lt;img src="image.jpg" width="800" height="600" alt="..."&gt;</pre></li>
        <li>This reserves space and prevents layout shifts</li>
        <li>Browser scales images proportionally with CSS</li>
      </ul>`,
    'server-response-time': `
      <strong>How to fix:</strong>
      <ul>
        <li>Optimize database queries</li>
        <li>Implement server-side caching (Redis, Memcached)</li>
        <li>Use a CDN to serve content closer to users</li>
        <li>Upgrade server resources if needed</li>
      </ul>`,
    'efficient-animated-content': `
      <strong>How to fix:</strong>
      <ul>
        <li>Convert GIF animations to video formats:
          <pre>&lt;video autoplay loop muted playsinline&gt;
  &lt;source src="animation.mp4" type="video/mp4"&gt;
&lt;/video&gt;</pre></li>
        <li>Videos are 80-90% smaller than GIFs</li>
      </ul>`,
    'duplicated-javascript': `
      <strong>How to fix:</strong>
      <ul>
        <li>Configure webpack to extract common chunks</li>
        <li>Avoid bundling same library multiple times</li>
        <li>Use shared vendor bundles for common dependencies</li>
      </ul>`,
    'legacy-javascript': `
      <strong>How to fix:</strong>
      <ul>
        <li>Update transpilation targets to modern browsers</li>
        <li>Serve modern ES6+ code to modern browsers</li>
        <li>Use differential loading: modern + legacy bundles</li>
        <li>Reduce polyfills for newer browsers</li>
      </ul>`,
    'largest-contentful-paint-element': `
      <strong>How to fix:</strong>
      <ul>
        <li>Optimize the largest content element (usually hero image)</li>
        <li>Preload critical resources:
          <pre>&lt;link rel="preload" as="image" href="hero.jpg"&gt;</pre></li>
        <li>Reduce image file size</li>
        <li>Use modern formats (WebP, AVIF)</li>
      </ul>`
  };

  return practices[auditId] || `
    <strong>Action needed:</strong>
    <ul>
      <li>Review this optimization with the development team</li>
      <li>Check Lighthouse documentation for specific guidance</li>
    </ul>`;
}

/**
 * Analyze opportunities to categorize as global (site-wide) or local (page-specific)
 * @param {Object} opportunitiesByUrl - Map of URL to opportunities
 * @param {Number} totalPages - Total number of pages analyzed
 * @returns {Object} - Analysis with global and local issues
 */
function analyzeGlobalVsLocal(opportunitiesByUrl, totalPages) {
  const issueCount = {}; // Track how many pages each issue appears on
  const issueUrls = {}; // Track which URLs have each issue
  
  // Count occurrences of each issue type across all pages
  Object.entries(opportunitiesByUrl).forEach(([url, opportunities]) => {
    opportunities.forEach(opp => {
      if (!issueCount[opp.id]) {
        issueCount[opp.id] = 0;
        issueUrls[opp.id] = [];
      }
      issueCount[opp.id]++;
      issueUrls[opp.id].push(url);
    });
  });
  
  // Categorize issues
  const globalIssues = []; // Appears on 50%+ of pages
  const localIssues = [];   // Appears on < 50% of pages
  const threshold = Math.ceil(totalPages * 0.5); // 50% threshold
  
  Object.entries(issueCount).forEach(([issueId, count]) => {
    const percentage = Math.round((count / totalPages) * 100);
    const isGlobal = count >= threshold;
    
    const issueInfo = {
      id: issueId,
      count: count,
      percentage: percentage,
      urls: issueUrls[issueId]
    };
    
    if (isGlobal) {
      globalIssues.push(issueInfo);
    } else {
      localIssues.push(issueInfo);
    }
  });
  
  // Sort by count (most common first)
  globalIssues.sort((a, b) => b.count - a.count);
  localIssues.sort((a, b) => b.count - a.count);
  
  return {
    global: globalIssues,
    local: localIssues,
    totalPages: totalPages
  };
}

/**
 * Get friendly name for audit ID
 * @param {String} auditId - Audit identifier
 * @returns {String} - Human-readable name
 */
function getAuditFriendlyName(auditId) {
  const names = {
    'render-blocking-resources': 'Render-blocking resources',
    'unused-css-rules': 'Unused CSS',
    'unused-javascript': 'Unused JavaScript',
    'modern-image-formats': 'Use modern image formats',
    'offscreen-images': 'Lazy load offscreen images',
    'unminified-css': 'Unminified CSS',
    'unminified-javascript': 'Unminified JavaScript',
    'uses-text-compression': 'Enable text compression',
    'uses-responsive-images': 'Use responsive images',
    'efficient-animated-content': 'Use video for animations',
    'duplicated-javascript': 'Duplicated JavaScript',
    'legacy-javascript': 'Legacy JavaScript',
    'total-byte-weight': 'Large page size',
    'uses-long-cache-ttl': 'Inefficient cache policy',
    'font-display': 'Missing font-display',
    'server-response-time': 'Slow server response',
    'redirects': 'Avoid redirects',
    'uses-rel-preconnect': 'Preconnect to required origins',
    'dom-size': 'Excessive DOM size',
    'bootup-time': 'Reduce JavaScript execution time',
    'mainthread-work-breakdown': 'Minimize main-thread work',
    'third-party-summary': 'Reduce third-party impact',
    'largest-contentful-paint-element': 'Optimize LCP element',
    'lcp-lazy-loaded': 'LCP image lazy-loaded',
    'unsized-images': 'Missing image dimensions'
  };
  
  return names[auditId] || auditId;
}

/**
 * Generate HTML for global/local issues summary
 * @param {Object} analysis - Analysis from analyzeGlobalVsLocal
 * @returns {String} - HTML string
 */
function generateIssueSummaryHTML(analysis) {
  let html = '<div class="issue-summary">';
  
  // Global Issues Section
  html += '<div class="issue-category global-category">';
  html += '<h3>🌐 Global Issues (Site-wide)</h3>';
  html += '<p class="category-desc">These issues appear on <strong>50% or more</strong> pages. Fix once to benefit all pages.</p>';
  
  if (analysis.global.length === 0) {
    html += '<p style="color:#27ae60">✓ No global issues found!</p>';
  } else {
    html += '<ul class="issue-list">';
    analysis.global.forEach(issue => {
      html += `<li>
        <span class="issue-name">${escapeHtml(getAuditFriendlyName(issue.id))}</span>
        <span class="issue-stat">${issue.count}/${analysis.totalPages} pages (${issue.percentage}%)</span>
      </li>`;
    });
    html += '</ul>';
  }
  html += '</div>';
  
  // Local Issues Section
  html += '<div class="issue-category local-category">';
  html += '<h3>📄 Page-Specific Issues (Local)</h3>';
  html += '<p class="category-desc">These issues appear on <strong>less than 50%</strong> of pages. Component-specific fixes.</p>';
  
  if (analysis.local.length === 0) {
    html += '<p style="color:#27ae60">✓ No local-only issues found!</p>';
  } else {
    html += '<ul class="issue-list">';
    analysis.local.forEach(issue => {
      html += `<li>
        <span class="issue-name">${escapeHtml(getAuditFriendlyName(issue.id))}</span>
        <span class="issue-stat">${issue.count}/${analysis.totalPages} pages (${issue.percentage}%)</span>
      </li>`;
    });
    html += '</ul>';
  }
  html += '</div>';
  
  html += '</div>';
  return html;
}

/**
 * Strip out learn links from description
 * @param {String} description - Original description with links
 * @returns {String} - Clean description without learn links
 */
function stripLearnLinks(description) {
  if (!description) return '';
  // Remove [Learn how to...](url) markdown links
  return description.replace(/\s*\[Learn[^\]]*\]\([^)]*\)\.?/gi, '');
}

/**
 * Generate HTML for opportunities section with accordions
 * @param {Array} opportunities - Array of opportunity objects
 * @param {Object} globalIssues - Set of global issue IDs for badge display
 * @returns {String} - HTML string
 */
function generateOpportunitiesHTML(opportunities, globalIssues = {}) {
  if (opportunities.length === 0) {
    return '<p style="color:#27ae60;font-size:15px;padding:20px;background:#e8f5e9;border-radius:8px;border-left:4px solid #27ae60">✅ <strong>Excellent!</strong> No significant optimization opportunities found. This page is well optimized!</p>';
  }

  let html = '<div class="opportunities">';
  
  opportunities.forEach((opp, index) => {
    const priority = index < 3 ? '🔴 HIGH' : index < 6 ? '🟡 MEDIUM' : '🟢 LOW';
    const impactClass = index < 3 ? 'high-impact' : index < 6 ? 'medium-impact' : 'low-impact';
    const cleanDescription = stripLearnLinks(opp.description);
    const accordionId = `opp-${index}`;
    
    // Check if this is a global issue
    const isGlobal = globalIssues[opp.id];
    const scopeBadge = isGlobal 
      ? `<span class="scope-badge global-badge" title="Appears on ${isGlobal.count}/${isGlobal.total} pages (${isGlobal.percentage}%)">🌐 GLOBAL</span>`
      : `<span class="scope-badge local-badge" title="Page-specific issue">📄 LOCAL</span>`;
    
    html += `
      <div class="opportunity ${impactClass}">
        <div class="opp-header" onclick="toggleAccordion('${accordionId}')">
          <span class="opp-priority">${priority}</span>
          ${scopeBadge}
          <h4 class="opp-title">${escapeHtml(opp.title)}</h4>
          ${opp.savingsText ? `<span class="opp-savings">💰 ${escapeHtml(opp.savingsText)}</span>` : ''}
          <span class="accordion-icon" id="${accordionId}-icon">▼</span>
        </div>
        <div class="opp-summary">${escapeHtml(cleanDescription)}</div>
        <div class="opp-details" id="${accordionId}" style="display:none">
          ${getBestPractices(opp.id)}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

async function main() {
const monthlyViewsArg = process.argv[2];
const monthlyViewsParsed = monthlyViewsArg ? Number(monthlyViewsArg) : DEFAULT_MONTHLY_VIEWS;
const monthlyViews = (!Number.isFinite(monthlyViewsParsed) || monthlyViewsParsed <= 0) 
  ? DEFAULT_MONTHLY_VIEWS 
  : monthlyViewsParsed;

const possiblePaths = [
  path.join(__dirname, '.lighthouseci'),
  path.join(__dirname, '.lighthouseci', 'lh-reports'),
  path.join(__dirname, 'lh-reports'),
  path.join(process.cwd(), '.lighthouseci'),
  path.join(process.cwd(), 'lh-reports'),
];

let lhciDataPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    lhciDataPath = p;
    console.log(`📁 Found Lighthouse data at: ${p}`);
    break;
  }
}

if (!lhciDataPath) {
  console.error('⚠️ No Lighthouse CI data found. Looked in:');
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  process.exit(1);
}

let files = fs.readdirSync(lhciDataPath)
  .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
  .map(f => path.join(lhciDataPath, f));

console.log(`📊 Found ${files.length} Lighthouse report(s)\n`);

const reports = files.map(fp => {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    console.warn(`⚠️ Failed to parse ${fp}: ${e.message}`);
    return null;
  }
}).filter(Boolean);

if (reports.length === 0) {
  console.error('⚠️ No valid LHR reports found in:', lhciDataPath);
  process.exit(1);
}

const detailTpl = loadTemplate('detail.html');
const hostIndexTpl = loadTemplate('host-index.html');
const hostRowTpl = loadTemplate('host-row.html');
const topIndexTpl = loadTemplate('top-index.html');

const byHost = {};
const opportunitiesByHost = {}; // Track opportunities per host for global analysis

for (const report of reports) {
  const url = report.requestedUrl || report.finalUrl || (report.lhr && report.lhr.finalUrl) || 'unknown-url';
  let hostname = 'unknown-host';
  try {
    hostname = (new urlLib.URL(url)).hostname || 'unknown-host';
  } catch (e) {}
  
  if (!byHost[hostname]) {
    byHost[hostname] = [];
    opportunitiesByHost[hostname] = {};
  }
  byHost[hostname].push({ url, report });
}

ensureDir(OUT_ROOT);
const topHostList = [];
const generatedAt = new Date().toLocaleString();

for (const hostname of Object.keys(byHost).sort()) {
  const hostDir = path.join(OUT_ROOT, sanitizeFilename(hostname));
  ensureDir(hostDir);

  const rowsHtml = [];
  const hostStats = {
    totalCO2: 0,
    totalPerf: 0,
    perfCount: 0,
    count: 0
  };

  // FIRST PASS: Collect all opportunities for global/local analysis
  const opportunitiesByUrl = {};
  for (const { url, report } of byHost[hostname]) {
    const opportunities = extractOpportunities(report);
    opportunitiesByUrl[url] = opportunities;
  }

  // Analyze global vs local issues
  const issueAnalysis = analyzeGlobalVsLocal(opportunitiesByUrl, byHost[hostname].length);
  
  // Create a lookup map for global issues
  const globalIssuesMap = {};
  issueAnalysis.global.forEach(issue => {
    globalIssuesMap[issue.id] = {
      count: issue.count,
      total: issueAnalysis.totalPages,
      percentage: issue.percentage
    };
  });

  // SECOND PASS: Generate reports with global/local awareness
  for (const { url, report } of byHost[hostname]) {
    const transferBytes =
      (report.audits && report.audits['total-byte-weight'] && report.audits['total-byte-weight'].numericValue) ||
      (report.lhr && report.lhr.audits && report.lhr.audits['total-byte-weight'] && report.lhr.audits['total-byte-weight'].numericValue) ||
      0;

    const transferKB = (transferBytes / 1024).toFixed(2);
    const transferMB = (transferBytes / 1024 / 1024).toFixed(2);

    const rawPerf =
      (report.categories && report.categories.performance && report.categories.performance.score) ||
      (report.lhr && report.lhr.categories && report.lhr.categories.performance && report.lhr.categories.performance.score);
    const perfScore = (typeof rawPerf === 'number') ? Math.round(rawPerf * 100) : 'n/a';

    const co2Grams = co2Emission.perByte(transferBytes, false);
    const co2PerVisit = co2Grams.toFixed(6);
    const monthlyKg = ((co2Grams * monthlyViews) / 1000).toFixed(3);
    const yearlyKg = ((co2Grams * monthlyViews * 12) / 1000).toFixed(2);
    const treesPerYear = (yearlyKg / 21).toFixed(2);

    const rating = ratingFor(co2Grams);

    // Accumulate stats
    hostStats.totalCO2 += co2Grams;
    hostStats.count++;
    if (typeof rawPerf === 'number') {
      hostStats.totalPerf += rawPerf * 100;
      hostStats.perfCount++;
    }

    const fileBase = sanitizeFilename(url) || `report-${Date.now()}`;
    const detailFile = `${fileBase}.html`;

    // Generate opportunities HTML with global/local badges
    const opportunities = opportunitiesByUrl[url];
    const opportunitiesHTML = generateOpportunitiesHTML(opportunities, globalIssuesMap);

    const detailVars = {
      TITLE: `Carbon + LH Report — ${escapeHtml(url)}`,
      HOSTNAME: hostname,
      URL: escapeHtml(url),
      GENERATED_AT: generatedAt,
      TRANSFER_KB: transferKB,
      TRANSFER_MB: transferMB,
      PERF: perfScore,
      CO2_PER_VISIT: co2PerVisit,
      CO2_PER_MONTH: monthlyKg,
      CO2_PER_YEAR: yearlyKg,
      MONTHLY_VIEWS: monthlyViews,
      RATING_CLASS: rating.cssClass,
      RATING_TEXT: rating.text,
      OPPORTUNITIES_HTML: opportunitiesHTML,
      OPPORTUNITIES_COUNT: opportunities.length,
      HIGH_PRIORITY_COUNT: opportunities.filter((_, i) => i < 3).length,
      LHR_EXCERPT: escapeHtml(JSON.stringify(report.categories || report.audits || report.lhr || {}, null, 2))
    };
    
    const detailHtml = render(detailTpl, detailVars);
    fs.writeFileSync(path.join(hostDir, detailFile), detailHtml, 'utf8');

    const rowVars = {
      DETAIL_FILE: detailFile,
      URL: escapeHtml(url),
      TRANSFER_MB: transferMB,
      PERF: perfScore,
      CO2_PER_VISIT: co2PerVisit,
      CO2_PER_MONTH: monthlyKg,
      TREES_PER_YEAR: treesPerYear,
      RATING_CLASS: rating.cssClass,
      RATING_TEXT: rating.text,
      RATING_TEXT_PLAIN: rating.textPlain
    };
    rowsHtml.push(render(hostRowTpl, rowVars));
  }

  // Calculate summary statistics
  const avgCO2 = hostStats.count > 0 
    ? (hostStats.totalCO2 / hostStats.count).toFixed(4) 
    : '0.0000';
  
  const avgPerf = hostStats.perfCount > 0 
    ? Math.round(hostStats.totalPerf / hostStats.perfCount) 
    : 'n/a';
  
  const totalYearlyCO2 = ((hostStats.totalCO2 * monthlyViews * 12) / 1000).toFixed(2);

  // Generate issue summary HTML
  const issueSummaryHTML = generateIssueSummaryHTML(issueAnalysis);

  const hostIndexHtml = render(hostIndexTpl, {
    HOSTNAME: hostname,
    GENERATED_AT: generatedAt,
    MONTHLY_VIEWS: monthlyViews,
    TOTAL_URLS: hostStats.count,
    AVG_CO2: avgCO2,
    AVG_PERF: avgPerf,
    TOTAL_YEARLY_CO2: totalYearlyCO2,
    ISSUE_SUMMARY: issueSummaryHTML,
    ROWS: rowsHtml.join('\n')
  });
  
  fs.writeFileSync(path.join(hostDir, 'index.html'), hostIndexHtml, 'utf8');

  topHostList.push(`<li><a href="./${path.basename(hostDir)}/index.html">${escapeHtml(hostname)}</a> — ${byHost[hostname].length} URL(s)</li>`);
  console.log(`✅ Wrote ${byHost[hostname].length} report(s) for host: ${hostname} -> ${hostDir}`);
}

const topIndexHtml = render(topIndexTpl, {
  MONTHLY_VIEWS: monthlyViews,
  GENERATED_AT: generatedAt,
  HOSTS: topHostList.join('\n')
});
fs.writeFileSync(path.join(OUT_ROOT, 'index.html'), topIndexHtml, 'utf8');

console.log(`\n📂 All reports written to: ${OUT_ROOT}`);
console.log(`🧭 Open ${path.join('carbon-reports-by-host','index.html')} in your browser.`);
}

main().catch(err => {
console.error('Error:', err.stack || err.message || err);
process.exit(1);
});