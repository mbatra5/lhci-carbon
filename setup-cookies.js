const { chromium } = require('playwright');
const { resolve } = require('path');

async function setupCookies() {
try {
  console.log("Starting cookies setup...");

  // Launch a browser instance
  const browser = await chromium.launch({ headless: false });
  console.log("Browser launched successfully.");

  // Create a new browser context
  const context = await browser.newContext();
  console.log("Browser context created.");

  // Open a new page
  const page = await context.newPage();
  console.log("Navigating to whitelisting IP address URL...");
  await page.goto("https://canary-bp.navitas.bpglobal.com/nvp/ip-access");

  // Wait for page load and allow JS to set cookies
  await page.waitForLoadState("networkidle");
  
  // Debug: get and print all cookies for the current domain
  const cookies = await context.cookies();
  console.log("Cookies in context after wait:", cookies);

  // Save storage state (cookies and session data)
  const storagePath = resolve(__dirname, "cookies.json");
  console.log(`Saving storage state to ${storagePath}...`);
  await context.storageState({ path: storagePath });
  console.log("Storage state saved successfully.");

  // Close the browser
  await browser.close();
  console.log("Browser closed.");
} catch (error) {
  console.error("Error during cookies setup:", error);
  throw error;
}
}

if (require.main === module) {
setupCookies().catch((err) => {
  console.error("Unhandled error in cookies setup:", err);
  process.exit(1);
});
}

module.exports = setupCookies;