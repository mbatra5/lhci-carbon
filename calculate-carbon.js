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
 * Generate actionable steps for QA teams based on audit ID
 * @param {Object} opp - Opportunity object
 * @returns {String} - HTML string with actionable steps
 */
function generateActionableSteps(opp) {
  // Map audit IDs to QA-friendly action items
  const actionMap = {
    'render-blocking-resources': 'Ask dev to defer non-critical CSS/JS or move scripts to bottom of page. This will improve initial page load time.',
    'unused-css-rules': 'Request removal of unused CSS styles to reduce file size. Check if CSS can be split per page.',
    'unused-javascript': 'Request removal of unused JavaScript code or implement lazy-loading for code that\'s not immediately needed.',
    'modern-image-formats': 'Ask dev to convert images to WebP or AVIF format. These formats are 25-35% smaller than JPEG/PNG.',
    'offscreen-images': 'Request lazy loading for images that appear below the fold (not visible on initial page load).',
    'unminified-css': 'Ask dev to minify CSS files before deployment. This removes whitespace and comments.',
    'unminified-javascript': 'Ask dev to minify JavaScript files before deployment. This removes whitespace and shortens variable names.',
    'uses-text-compression': 'Request enabling gzip or brotli compression on the server for text-based resources.',
    'uses-responsive-images': 'Ask dev to serve appropriately-sized images for different screen sizes and devices.',
    'efficient-animated-content': 'Request converting GIF animations to video formats (MP4/WebM). Videos are much smaller.',
    'duplicated-javascript': 'Request removing duplicate JavaScript code that appears in multiple bundles.',
    'legacy-javascript': 'Ask dev to modernize JavaScript code to reduce polyfills and transpilation overhead.',
    'total-byte-weight': 'Request overall page weight reduction. Consider optimizing images, scripts, and styles.',
    'uses-long-cache-ttl': 'Ask dev to set proper cache headers (1 year) for static assets to improve repeat visits.',
    'font-display': 'Request adding "font-display: swap" to font declarations to prevent invisible text.',
    'server-response-time': 'Report slow server response time (should be under 600ms). May need backend optimization or CDN.',
    'redirects': 'Request removal of unnecessary redirects. Each redirect adds latency.',
    'uses-rel-preconnect': 'Ask dev to add preconnect hints for third-party domains to establish connections earlier.',
    'dom-size': 'Request reducing number of DOM elements on the page. Large DOMs slow down rendering and JavaScript.',
    'bootup-time': 'Request reducing JavaScript execution time during page load. Consider code splitting.',
    'mainthread-work-breakdown': 'Request optimizing JavaScript that blocks the main thread. This causes slow interactions.',
    'third-party-summary': 'Review third-party scripts. They may be slowing down the page significantly.',
    'largest-contentful-paint-element': 'The largest content element is loading slowly. Optimize this element\'s resources.',
    'lcp-lazy-loaded': 'The LCP (main content) image should NOT be lazy-loaded. Ask dev to eagerly load it.',
    'unsized-images': 'Request adding width and height attributes to images to prevent layout shifts.'
  };

  const action = actionMap[opp.id] || 'Review this optimization with the development team.';
  
  return `
    <div class="opp-action">
      <strong>📋 What to report to dev:</strong> ${escapeHtml(action)}
    </div>
  `;
}

/**
 * Generate HTML for opportunities section
 * @param {Array} opportunities - Array of opportunity objects
 * @returns {String} - HTML string
 */
function generateOpportunitiesHTML(opportunities) {
  if (opportunities.length === 0) {
    return '<p style="color:#27ae60;font-size:15px;padding:20px;background:#e8f5e9;border-radius:8px;border-left:4px solid #27ae60">✅ <strong>Excellent!</strong> No significant optimization opportunities found. This page is well optimized!</p>';
  }

  let html = '<div class="opportunities">';
  
  opportunities.forEach((opp, index) => {
    const priority = index < 3 ? '🔴 HIGH' : index < 6 ? '🟡 MEDIUM' : '🟢 LOW';
    const impactClass = index < 3 ? 'high-impact' : index < 6 ? 'medium-impact' : 'low-impact';
    
    html += `
      <div class="opportunity ${impactClass}">
        <div class="opp-header">
          <span class="opp-priority">${priority}</span>
          <h4 class="opp-title">${escapeHtml(opp.title)}</h4>
          ${opp.savingsText ? `<span class="opp-savings">💰 Potential savings: ${escapeHtml(opp.savingsText)}</span>` : ''}
        </div>
        <div class="opp-description">${escapeHtml(opp.description)}</div>
        ${generateActionableSteps(opp)}
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
  .filter(f => f.endsWith('.json'))
  .map(f => path.join(lhciDataPath, f));

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
for (const report of reports) {
  const url = report.requestedUrl || report.finalUrl || (report.lhr && report.lhr.finalUrl) || 'unknown-url';
  let hostname = 'unknown-host';
  try {
    hostname = (new urlLib.URL(url)).hostname || 'unknown-host';
  } catch (e) {}
  
  if (!byHost[hostname]) byHost[hostname] = [];
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

    // Extract and format opportunities
    const opportunities = extractOpportunities(report);
    const opportunitiesHTML = generateOpportunitiesHTML(opportunities);

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

    // Generate opportunities badge for table
    let opportunitiesBadge = '';
    if (opportunities.length === 0) {
      opportunitiesBadge = '<span style="color:#27ae60;font-weight:600">✓ 0</span>';
    } else {
      const highPriorityCount = opportunities.filter((_, i) => i < 3).length;
      const badgeColor = highPriorityCount > 0 ? '#e74c3c' : opportunities.length > 3 ? '#f39c12' : '#95a5a6';
      const badgeIcon = highPriorityCount > 0 ? '🔴' : '🟡';
      opportunitiesBadge = `<span style="color:${badgeColor};font-weight:700">${badgeIcon} ${opportunities.length}</span>`;
    }

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
      RATING_TEXT_PLAIN: rating.textPlain,
      OPPORTUNITIES_BADGE: opportunitiesBadge
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

  const hostIndexHtml = render(hostIndexTpl, {
    HOSTNAME: hostname,
    GENERATED_AT: generatedAt,
    MONTHLY_VIEWS: monthlyViews,
    TOTAL_URLS: hostStats.count,
    AVG_CO2: avgCO2,
    AVG_PERF: avgPerf,
    TOTAL_YEARLY_CO2: totalYearlyCO2,
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