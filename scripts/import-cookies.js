#!/usr/bin/env node
/**
 * import-cookies.js
 *
 * Converts a raw Chrome/browser cookie export into Playwright storageState
 * format and writes it to the target environment's cookie file.
 *
 * Usage:
 *   node scripts/import-cookies.js --env=PROD
 *   node scripts/import-cookies.js --env=CANARY
 *   node scripts/import-cookies.js --env=PROD --input=my-export.json
 *
 * By default reads from cookies-import.template.json in the project root.
 * The --input flag lets you point at any raw Chrome export file instead.
 */

const fs = require('fs');
const path = require('path');
const { normalizeCookies } = require('../lib/cookies');
const { parseEnvArg, getCookiesFilePath, getProjectRoot } = require('../lib/config');

function parseInputArg() {
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--input=(.+)$/i);
    if (match) return match[1];
  }
  return null;
}

function main() {
  const env = parseEnvArg();
  const root = getProjectRoot();

  const inputArg = parseInputArg();
  const inputPath = inputArg
    ? path.resolve(inputArg)
    : path.join(root, 'cookies-import.template.json');

  const outputPath = getCookiesFilePath(env);

  console.log(`\n🍪 Importing cookies for environment: ${env}`);
  console.log(`   Input : ${inputPath}`);
  console.log(`   Output: ${outputPath}\n`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    console.error('   Paste your raw Chrome cookie export into cookies-import.template.json and try again.');
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to parse input file as JSON:', err.message);
    process.exit(1);
  }

  let rawCookies;
  if (Array.isArray(parsed)) {
    rawCookies = parsed;
  } else if (Array.isArray(parsed.cookies)) {
    console.log('ℹ️  Input is already in Playwright storageState format — copying as-is.');
    fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
    console.log(`✅ Saved ${parsed.cookies.length} cookie(s) to ${outputPath}\n`);
    return;
  } else {
    console.error('❌ Unrecognised format. Expected a JSON array of cookies or a Playwright storageState object.');
    process.exit(1);
  }

  const validCookies = rawCookies.filter(c => c.name && c.value);
  if (validCookies.length === 0) {
    console.error('❌ No valid cookies found (each entry must have "name" and "value"). Is the template still empty?');
    process.exit(1);
  }
  if (validCookies.length < rawCookies.length) {
    console.warn(`⚠️  Skipped ${rawCookies.length - validCookies.length} entry/entries missing "name" or "value".`);
  }

  const normalized = normalizeCookies(validCookies);
  fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2));
  console.log(`✅ Converted and saved ${normalized.cookies.length} cookie(s) to ${outputPath}\n`);
}

main();
