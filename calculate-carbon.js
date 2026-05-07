const { co2 } = require('@tgwf/co2');
const fs = require('fs');
const path = require('path');
const urlLib = require('url');

const co2Emission = new co2();
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const OUT_ROOT = path.join(__dirname, 'carbon-reports-by-host');
const DEFAULT_MONTHLY_VIEWS = 10000;

// Load best practices from JSON file
const BEST_PRACTICES = JSON.parse(fs.readFileSync(path.join(__dirname, 'best-practices.json'), 'utf8'));

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
  return BEST_PRACTICES[auditId] || BEST_PRACTICES['default'];
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
  const issueSummaryTpl = loadTemplate('issue-summary.html');
  
  // Build global issues list
  let globalListHTML = analysis.global.length === 0 
    ? '<p style="color:#27ae60">✓ No global issues found!</p>'
    : '<ul class="issue-list">' + analysis.global.map(issue => 
        `<li><span class="issue-name">${escapeHtml(getAuditFriendlyName(issue.id))}</span>` +
        `<span class="issue-stat">${issue.count}/${analysis.totalPages} pages (${issue.percentage}%)</span></li>`
      ).join('') + '</ul>';
  
  // Build local issues list
  let localListHTML = analysis.local.length === 0
    ? '<p style="color:#27ae60">✓ No local-only issues found!</p>'
    : '<ul class="issue-list">' + analysis.local.map(issue =>
        `<li><span class="issue-name">${escapeHtml(getAuditFriendlyName(issue.id))}</span>` +
        `<span class="issue-stat">${issue.count}/${analysis.totalPages} pages (${issue.percentage}%)</span></li>`
      ).join('') + '</ul>';
  
  return render(issueSummaryTpl, {
    GLOBAL_ISSUES_LIST: globalListHTML,
    LOCAL_ISSUES_LIST: localListHTML
  });
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

  const oppTpl = loadTemplate('opportunity.html');
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
    
    const savings = opp.savingsText ? `<span class="opp-savings">💰 ${escapeHtml(opp.savingsText)}</span>` : '';
    
    html += render(oppTpl, {
      IMPACT_CLASS: impactClass,
      ACCORDION_ID: accordionId,
      PRIORITY: priority,
      SCOPE_BADGE: scopeBadge,
      TITLE: escapeHtml(opp.title),
      SAVINGS: savings,
      DESCRIPTION: escapeHtml(cleanDescription),
      BEST_PRACTICES: getBestPractices(opp.id)
    });
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
    const co2PerVisit = co2Grams.toFixed(2);
    const monthlyKg = ((co2Grams * monthlyViews) / 1000).toFixed(2);
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