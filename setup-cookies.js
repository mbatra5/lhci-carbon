const { chromium } = require('playwright');
const { parseEnvArg, loadProjectConfig, getCookiesFilePath } = require('./lib/config');

async function setupCookies(cookieUrl, cookiesFilePath) {
  if (!cookieUrl || !cookiesFilePath) {
    const env = parseEnvArg();
    const project = loadProjectConfig(env);

    cookieUrl = cookieUrl || project.cookieUrl;
    cookiesFilePath = cookiesFilePath || getCookiesFilePath(env);
    console.log(`🌐 Setting up cookies for environment: ${env}`);
  }

  try {
    console.log('Starting cookies setup...');

    const browser = await chromium.launch({ headless: false });
    console.log('Browser launched successfully.');

    const context = await browser.newContext();
    console.log('Browser context created.');

    const page = await context.newPage();
    console.log(`Navigating to IP access URL: ${cookieUrl}`);
    await page.goto(cookieUrl);

    await page.waitForLoadState('networkidle');

    const cookies = await context.cookies();
    console.log('Cookies in context after wait:', cookies);

    console.log(`Saving storage state to ${cookiesFilePath}...`);
    await context.storageState({ path: cookiesFilePath });
    console.log('Storage state saved successfully.');

    await browser.close();
    console.log('Browser closed.');
  } catch (error) {
    console.error('Error during cookies setup:', error);
    throw error;
  }
}

if (require.main === module) {
  setupCookies().catch((err) => {
    console.error('Unhandled error in cookies setup:', err);
    process.exit(1);
  });
}

module.exports = setupCookies;
