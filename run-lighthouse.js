const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');

// Get run identifier from command line argument, or use timestamp-based default
const runId = process.argv[2] || `run-${Date.now()}`;

// Auto-generate timestamp (current time in seconds)
const timestamp = Math.floor(Date.now() / 1000);

// Set all environment variables
const envVars = {
LHCI_BUILD_CONTEXT__CURRENT_HASH: runId,
LHCI_BUILD_CONTEXT__CURRENT_BRANCH: 'main',
LHCI_BUILD_CONTEXT__COMMIT_MESSAGE: `Performance test: ${runId}`,
LHCI_BUILD_CONTEXT__AUTHOR: 'Madhur Batra <madhur.batra@example.com>',
LHCI_BUILD_CONTEXT__AVATAR_URL: 'https://www.gravatar.com/avatar/default',
LHCI_BUILD_CONTEXT__COMMIT_TIME: timestamp
};

// Build environment string
const envString = Object.entries(envVars)
.map(([key, value]) => `${key}="${value}"`)
.join(' ');

// Function to get auth cookies from Playwright cookies.json
async function getAuthCookies() {
// Check if cookies file exists and is recent (less than 1 hour old)
if (fs.existsSync(COOKIES_FILE)) {
  const stats = fs.statSync(COOKIES_FILE);
  const ageInMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
  
  if (ageInMinutes < 60) {
    console.log(`🍪 Using cached cookies (${Math.floor(ageInMinutes)} minutes old)\n`);
    return readCookiesFromFile();
  } else {
    console.log('🍪 Cached cookies expired, fetching new ones...\n');
  }
}

// Fetch new cookies using Playwright
console.log('🔐 Running Playwright script to fetch cookies...\n');

try {
  execSync('node setup-cookies.js', { stdio: 'inherit' });
  console.log('\n✅ Cookies fetched successfully\n');
  return readCookiesFromFile();
} catch (error) {
  console.error('❌ Failed to fetch cookies:', error.message);
  console.log('⚠️  Continuing without authentication\n');
  return null;
}
}

// Function to read and parse Playwright cookies.json
function readCookiesFromFile() {
try {
  const storageState = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  const cookies = storageState.cookies || [];
  
  if (cookies.length === 0) {
    console.log('⚠️  No cookies found in file\n');
    return null;
  }
  
  // Convert Playwright cookies to cookie string format
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log(`📋 Loaded ${cookies.length} cookie(s) from file\n`);
  
  return cookieString;
} catch (error) {
  console.error('❌ Failed to read cookies file:', error.message);
  return null;
}
}

// Function to create temporary config with cookies
function createTempConfig(cookies) {
const testUrls = require('./test-urls.json');

const extraHeadersConfig = cookies 
  ? `extraHeaders: JSON.stringify({ Cookie: ${JSON.stringify(cookies)} }),`
  : '';

const configContent = `
const testUrls = require('./test-urls.json');

module.exports = {
ci: {
  collect: {
    url: testUrls.urls,
    numberOfRuns: 1,
    settings: {
      ${extraHeadersConfig}
    }
  },
  upload: {
    target: 'lhci',
    serverBaseUrl: 'http://localhost:9001',
    token: 'de50f1c9-439a-476d-8a24-0c97fb44e0e5',
  },
  assert: {
    preset: 'lighthouse:recommended',
  }
}
};
`;

const tempConfigPath = path.join(__dirname, '.lighthouserc.tmp.js');
fs.writeFileSync(tempConfigPath, configContent);
return tempConfigPath;
}

// Main execution
async function main() {
console.log(`🚀 Running Lighthouse CI with identifier: ${runId}`);
console.log(`⏰ Timestamp: ${new Date(timestamp * 1000).toISOString()}\n`);

// Get cookies first
const cookies = await getAuthCookies();

// Create temp config with cookies
const tempConfigPath = createTempConfig(cookies);

try {
  execSync(`${envString} npx lhci autorun --config=${tempConfigPath}`, { stdio: 'inherit' });
  console.log('\n✅ Lighthouse CI completed successfully!');
} catch (error) {
  console.error('\n❌ Lighthouse CI failed');
  process.exit(1);
} finally {
  // Clean up temp config file
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
  }
}
}

main();