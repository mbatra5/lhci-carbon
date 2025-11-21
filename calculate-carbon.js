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