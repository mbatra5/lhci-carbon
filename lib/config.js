const path = require('path');

const PROJECTS_CONFIG = require('../projects-config.json');
const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Parse --env=VALUE from CLI args or ENV environment variable.
 * @param {string} [defaultEnv='CANARY']
 * @returns {string} Uppercase environment name
 */
function parseEnvArg(defaultEnv = 'CANARY') {
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--env=(.+)$/i);
    if (match) return match[1].toUpperCase();
  }
  if (process.env.ENV) return process.env.ENV.toUpperCase();
  return defaultEnv;
}

/**
 * Load project config for the given environment. Exits if env is unknown.
 * @param {string} env
 * @returns {object} Project config object from projects-config.json
 */
function loadProjectConfig(env) {
  const project = PROJECTS_CONFIG[env];
  if (!project) {
    console.error(`❌ Unknown environment: "${env}". Available: ${Object.keys(PROJECTS_CONFIG).join(', ')}`);
    process.exit(1);
  }
  return project;
}

/**
 * Get the absolute path for an environment's cookie file.
 * Supports `cookieEnv` override so environments can share a cookie file
 * (e.g., PROD_DESKTOP shares cookies-prod.json via `"cookieEnv": "PROD"`).
 * @param {string} env
 * @returns {string}
 */
function getCookiesFilePath(env) {
  const project = PROJECTS_CONFIG[env];
  const resolvedEnv = (project && project.cookieEnv) || env;
  return path.join(PROJECT_ROOT, `cookies-${resolvedEnv.toLowerCase()}.json`);
}

/**
 * Get the absolute project root path.
 * @returns {string}
 */
function getProjectRoot() {
  return PROJECT_ROOT;
}

module.exports = {
  parseEnvArg,
  loadProjectConfig,
  getCookiesFilePath,
  getProjectRoot,
  PROJECTS_CONFIG,
};
