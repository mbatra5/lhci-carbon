const fs = require('fs');
const { execSync } = require('child_process');
const { getCookiesFilePath } = require('./config');

const SAMESIDE_MAP = {
  no_restriction: 'None',
  lax: 'Lax',
  strict: 'Strict',
};

/**
 * Convert a raw Chrome/browser cookie export (bare array) into
 * Playwright storageState format ({ cookies: [...], origins: [] }).
 *
 * @param {object[]} rawCookies - Array of Chrome-format cookie objects
 * @returns {{ cookies: object[], origins: [] }}
 */
function normalizeCookies(rawCookies) {
  return {
    cookies: rawCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expirationDate ?? c.expires ?? -1,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure ?? false,
      sameSite: SAMESIDE_MAP[c.sameSite] || c.sameSite || 'None',
    })),
    origins: [],
  };
}

/**
 * Read and parse a cookies file. Supports two formats:
 *   1. Playwright storage state: { cookies: [...], origins: [] }
 *   2. Raw browser export (e.g. EditThisCookie): [ { name, value, ... }, ... ]
 *
 * When a raw browser export is detected it is automatically converted to
 * Playwright storage state format and the file is re-saved in-place so
 * future reads are always in the correct format.
 *
 * @param {string} filePath - Absolute path to the cookies JSON file
 * @returns {string|null} Cookie header string ("name=val; name2=val2") or null
 */
function readCookiesFromFile(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    let cookies;
    if (Array.isArray(parsed)) {
      const validRaw = parsed.filter(c => c.name && c.value);
      if (validRaw.length === 0) {
        console.log('⚠️  No cookies found in file\n');
        return null;
      }
      console.log('🔄 Detected raw browser export — converting to Playwright format and saving...');
      const normalized = normalizeCookies(validRaw);
      fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
      console.log(`✅ Saved normalized cookies to ${filePath}\n`);
      cookies = normalized.cookies;
    } else {
      cookies = parsed.cookies || [];
    }

    if (cookies.length === 0) {
      console.log('⚠️  No cookies found in file\n');
      return null;
    }

    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log(`📋 Loaded ${cookies.length} cookie(s) from file\n`);
    return cookieString;
  } catch (error) {
    console.error('❌ Failed to read cookies file:', error.message);
    return null;
  }
}

/**
 * Get auth cookies for an environment. Uses cached file if fresh enough,
 * auto-refreshes via Playwright for environments with a cookieUrl,
 * or prompts for manual export if no cookieUrl is configured.
 *
 * @param {string} env - Environment name (e.g. 'CANARY', 'PROD')
 * @param {object} project - Project config from projects-config.json
 * @returns {Promise<string|null>} Cookie header string or null
 */
async function getAuthCookies(env, project) {
  const cookiesFile = getCookiesFilePath(env);

  if (fs.existsSync(cookiesFile)) {
    const stats = fs.statSync(cookiesFile);
    const ageInMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;

    if (ageInMinutes < 60) {
      console.log(`🍪 Using cached cookies for ${env} (${Math.floor(ageInMinutes)} minutes old)\n`);
      return readCookiesFromFile(cookiesFile);
    }

    if (!project.cookieUrl) {
      console.log(`🍪 Using manually provided cookies for ${env} (${Math.floor(ageInMinutes)} minutes old — refresh manually when expired)\n`);
      return readCookiesFromFile(cookiesFile);
    }

    console.log(`🍪 Cached cookies for ${env} expired, fetching new ones...\n`);
  }

  if (!project.cookieUrl) {
    console.log(`⚠️  No cookies file found at ${cookiesFile}. For ${env}, export cookies manually from your browser and save them there.\n`);
    return null;
  }

  console.log(`🔐 Running Playwright script to fetch cookies for ${env}...\n`);

  try {
    execSync(`node setup-cookies.js --env=${env}`, { stdio: 'inherit' });
    console.log('\n✅ Cookies fetched successfully\n');
    return readCookiesFromFile(cookiesFile);
  } catch (error) {
    console.error('❌ Failed to fetch cookies:', error.message);
    console.log('⚠️  Continuing without authentication\n');
    return null;
  }
}

module.exports = { normalizeCookies, readCookiesFromFile, getAuthCookies };
