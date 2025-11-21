const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load URLs
const { urls } = require('./sitespeed-urls.json');

// Get run identifier from command line, or use timestamp
const runId = process.argv[2] || `sitespeed-${Date.now()}`;

// Output folder for this run
const outputFolder = path.join(__dirname, 'sitespeed-results', runId);

// Create the output folder structure if it doesn't exist
fs.mkdirSync(outputFolder, { recursive: true });

console.log(`\n🚀 Running sitespeed.io`);
console.log(`📦 Run ID: ${runId}`);
console.log(`📁 Output: ${outputFolder}`);
console.log(`📄 Testing ${urls.length} URL(s)\n`);

// Build the command with quoted path
const urlsString = urls.join(' ');
const command = `npx sitespeed.io ${urlsString} -n 1 --outputFolder "${outputFolder}" --sustainable.enable true --sustainable.useGreenWebHostingAPI true`;

try {
execSync(command, { stdio: 'inherit' });
console.log(`\n✅ sitespeed.io completed successfully!`);
console.log(`📊 View report: ${outputFolder}/index.html\n`);
} catch (error) {
console.error(`\n❌ sitespeed.io failed\n`);
process.exit(1);
}