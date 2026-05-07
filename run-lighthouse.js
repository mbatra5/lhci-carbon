const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseEnvArg, loadProjectConfig, getProjectRoot } = require('./lib/config');
const { getAuthCookies } = require('./lib/cookies');

const ENV = parseEnvArg();
const project = loadProjectConfig(ENV);

const runId = process.argv.slice(2).find(a => !a.startsWith('--')) || `run-${Date.now()}`;
const timestamp = Math.floor(Date.now() / 1000);

const presetName = project.presetFile || 'mobile';
const presetPath = path.join(getProjectRoot(), 'presets', `${presetName}.json`);
const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

console.log(`🌐 Environment: ${ENV}`);
console.log(`📄 URL file: ${project.urlFile}`);
console.log(`📱 Form factor: ${preset.formFactor} (presets/${presetName}.json)`);
console.log(`🔁 Runs per URL: ${project.numberOfRuns || 1}`);

const envVars = {
  LHCI_BUILD_CONTEXT__CURRENT_HASH: runId,
  LHCI_BUILD_CONTEXT__CURRENT_BRANCH: 'main',
  LHCI_BUILD_CONTEXT__COMMIT_MESSAGE: `Performance test [${ENV}]: ${runId}`,
  LHCI_BUILD_CONTEXT__AUTHOR: 'Lighthouse CI <lhci@example.com>',
  LHCI_BUILD_CONTEXT__AVATAR_URL: 'https://www.gravatar.com/avatar/default',
  LHCI_BUILD_CONTEXT__COMMIT_TIME: timestamp,
};

const envString = Object.entries(envVars)
  .map(([key, value]) => `${key}="${value}"`)
  .join(' ');

function createTempConfig(cookies) {
  const urlFilePath = path.resolve(getProjectRoot(), project.urlFile);
  const testUrls = require(urlFilePath);

  const settings = { ...preset };
  if (cookies) {
    settings.extraHeaders = JSON.stringify({ Cookie: cookies });
  }

  const config = {
    ci: {
      collect: {
        url: testUrls.urls,
        numberOfRuns: project.numberOfRuns || 1,
        settings,
      },
      upload: {
        target: 'lhci',
        serverBaseUrl: project.serverBaseUrl,
        token: project.lhciToken,
      },
      assert: {
        preset: 'lighthouse:recommended',
      },
    },
  };

  const tempConfigPath = path.join(getProjectRoot(), '.lighthouserc.tmp.json');
  fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
  return tempConfigPath;
}

async function main() {
  console.log(`🚀 Running Lighthouse CI with identifier: ${runId}`);
  console.log(`⏰ Timestamp: ${new Date(timestamp * 1000).toISOString()}\n`);

  const cookies = await getAuthCookies(ENV, project);
  const tempConfigPath = createTempConfig(cookies);

  try {
    execSync(`${envString} npx lhci autorun --config=${tempConfigPath}`, { stdio: 'inherit' });
    console.log('\n✅ Lighthouse CI completed successfully!');
  } catch (error) {
    console.error('\n❌ Lighthouse CI failed');
    process.exit(1);
  } finally {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
}

main();
