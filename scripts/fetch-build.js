const fs = require('fs');
const path = require('path');
const { parseEnvArg, loadProjectConfig, getProjectRoot } = require('../lib/config');

const LHCI_DIR = path.join(getProjectRoot(), '.lighthouseci');

function parseArgs() {
  const args = process.argv.slice(2);
  const env = parseEnvArg();
  const project = loadProjectConfig(env);

  let buildId = null;
  for (const arg of args) {
    const match = arg.match(/^--build=(.+)$/i);
    if (match) {
      buildId = match[1];
      break;
    }
  }

  const listBuilds = args.includes('--list');

  return { env, project, buildId, listBuilds };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function findProjectId(serverBaseUrl, env) {
  const projects = await fetchJson(`${serverBaseUrl}/v1/projects`);

  const envLower = env.toLowerCase().replace(/_/g, '-');

  // Exact match first (slug or name equals envLower)
  const exactMatch = projects.find(p => p.slug === envLower || p.name.toLowerCase() === envLower);

  // Partial fallback: pick the shortest matching name to avoid prod matching prod-desktop
  const partialMatches = projects.filter(p => p.slug.includes(envLower) || p.name.toLowerCase().includes(envLower));
  const partialMatch = partialMatches.sort((a, b) => a.name.length - b.name.length)[0];

  const match = exactMatch || partialMatch;

  if (!match) {
    console.error(`❌ No LHCI project found matching "${env}".`);
    console.error(`   Available projects: ${projects.map(p => p.name).join(', ')}\n`);
    console.error('   Tip: run with one of these instead:');
    projects.forEach(p => {
      const slug = p.slug || p.name.toLowerCase().replace(/\s+/g, '-');
      console.error(`     npm run lhci:fetch -- --env=${slug.toUpperCase().replace(/-/g, '_')}`);
    });
    console.error('');
    process.exit(1);
  }

  return match;
}

async function listProjectBuilds(serverBaseUrl, projectId, projectName) {
  const builds = await fetchJson(`${serverBaseUrl}/v1/projects/${projectId}/builds`);

  if (builds.length === 0) {
    console.log(`No builds found for ${projectName}.`);
    return;
  }

  console.log(`\n📋 Builds for "${projectName}" (newest first):\n`);
  console.log('  #  Build ID (use with --build=)              Run ID                 Date');
  console.log('  ─  ────────────────────────────────────────  ─────────────────────  ────────────────────');

  builds.forEach((b, i) => {
    const date = new Date(b.runAt).toLocaleString();
    const shortId = b.id.slice(0, 12);
    console.log(`  ${i + 1}  ${shortId}                                ${b.hash.padEnd(23)} ${date}`);
  });

  console.log(`\nUsage: npm run lhci:fetch -- --env=${process.argv.find(a => a.match(/--env=/i)).split('=')[1]} --build=<build-id>`);
}

async function fetchAndSaveBuild(serverBaseUrl, projectId, buildId) {
  const fullBuildId = buildId;

  let builds = await fetchJson(`${serverBaseUrl}/v1/projects/${projectId}/builds`);
  let build = builds.find(b => b.id.startsWith(buildId));

  if (!build) {
    console.error(`❌ Build "${buildId}" not found. Use --list to see available builds.`);
    process.exit(1);
  }

  console.log(`\n📦 Fetching build: ${build.hash}`);
  console.log(`   Date: ${new Date(build.runAt).toLocaleString()}`);
  console.log(`   Message: ${build.commitMessage}\n`);

  const runs = await fetchJson(`${serverBaseUrl}/v1/projects/${projectId}/builds/${build.id}/runs`);
  console.log(`   Found ${runs.length} run(s)\n`);

  if (!fs.existsSync(LHCI_DIR)) {
    fs.mkdirSync(LHCI_DIR, { recursive: true });
  }

  const existingFiles = fs.readdirSync(LHCI_DIR).filter(f => f.startsWith('lhr-') && f.endsWith('.json'));
  existingFiles.forEach(f => fs.unlinkSync(path.join(LHCI_DIR, f)));

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const fileName = `lhr-${run.id}.json`;
    const filePath = path.join(LHCI_DIR, fileName);

    fs.writeFileSync(filePath, run.lhr, 'utf8');

    const urlShort = run.url.length > 60 ? run.url.slice(0, 57) + '...' : run.url;
    console.log(`   ✅ ${i + 1}/${runs.length} ${urlShort}`);
  }

  console.log(`\n📁 Saved ${runs.length} LHR report(s) to .lighthouseci/`);
  console.log(`\n💡 Now run: npm run lhci:carbon`);
}

async function main() {
  const { env, project, buildId, listBuilds } = parseArgs();
  const serverBaseUrl = project.serverBaseUrl;

  console.log(`🌐 Environment: ${env}`);

  const lhciProject = await findProjectId(serverBaseUrl, env);
  console.log(`📊 Project: ${lhciProject.name} (${lhciProject.id.slice(0, 8)}...)`);

  if (listBuilds || !buildId) {
    await listProjectBuilds(serverBaseUrl, lhciProject.id, lhciProject.name);
    return;
  }

  await fetchAndSaveBuild(serverBaseUrl, lhciProject.id, buildId);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
