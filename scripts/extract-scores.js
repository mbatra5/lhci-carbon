const fs = require('fs');
const path = require('path');

const LHCI_DIR = path.join(__dirname, '..', '.lighthouseci');

function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}${getOrdinalSuffix(day)} ${month}, ${year}`;
}

/**
 * Extract performance scores from all LHR JSON files in .lighthouseci/
 * @returns {{ date: string, formattedDate: string, scores: Array<{ url: string, score: number, sourceFile: string }> }}
 */
function extractScores() {
  if (!fs.existsSync(LHCI_DIR)) {
    throw new Error(`Lighthouse CI data directory not found: ${LHCI_DIR}`);
  }

  const jsonFiles = fs.readdirSync(LHCI_DIR)
    .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
    .sort();

  if (jsonFiles.length === 0) {
    throw new Error(`No LHR JSON files found in ${LHCI_DIR}`);
  }

  const scores = [];
  let earliestDate = null;

  for (const file of jsonFiles) {
    const filePath = path.join(LHCI_DIR, file);
    const report = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const url = report.requestedUrl || report.finalUrl || 'unknown';
    const rawPerf = report.categories?.performance?.score;
    const score = typeof rawPerf === 'number' ? Math.round(rawPerf * 100) : null;
    const fetchTime = report.fetchTime || null;

    if (fetchTime && (!earliestDate || fetchTime < earliestDate)) {
      earliestDate = fetchTime;
    }

    scores.push({ url, score, sourceFile: file });
  }

  return {
    date: earliestDate,
    formattedDate: earliestDate ? formatDate(earliestDate) : 'Unknown Date',
    scores
  };
}

if (require.main === module) {
  const { parseEnvArg } = require('../lib/config');
  const env = parseEnvArg();
  console.log(`🌐 Extracting scores (environment context: ${env})`);

  try {
    const result = extractScores();
    const output = process.argv.includes('--pretty')
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);

    if (process.argv.includes('--output')) {
      const idx = process.argv.indexOf('--output');
      const outPath = process.argv[idx + 1];
      if (!outPath) {
        console.error('Error: --output requires a file path');
        process.exit(1);
      }
      fs.writeFileSync(outPath, output, 'utf8');
      console.log(`Scores written to ${outPath}`);
    } else {
      console.log(output);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

module.exports = { extractScores, formatDate };
