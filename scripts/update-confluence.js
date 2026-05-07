require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const { extractScores } = require('./extract-scores');
const { parseEnvArg, loadProjectConfig } = require('../lib/config');

const ENV = parseEnvArg();
const project = loadProjectConfig(ENV);

const CONFLUENCE = project.confluence;
const CONFLUENCE_BASE = CONFLUENCE.baseUrl;
const PAGE_ID = CONFLUENCE.pageId;
const SPACE_ID = CONFLUENCE.spaceId;
const TABLE_LOCAL_ID = CONFLUENCE.tableLocalId;

const EMAIL = process.env.CONFLUENCE_EMAIL;
const API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const ATTACH_MODE = process.argv.includes('--attach');
const DRY_RUN = process.argv.includes('--dry-run');

console.log(`🌐 Updating Confluence for environment: ${ENV}`);
console.log(`📄 Page ID: ${PAGE_ID}`);

function authHeader() {
  const token = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString('base64');
  return { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' };
}

async function fetchPage() {
  const url = `${CONFLUENCE_BASE}/wiki/api/v2/pages/${PAGE_ID}?body-format=storage`;
  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status} ${res.statusText}`);
  return res.json();
}

async function updatePage(newBody, currentVersion, pageTitle) {
  const url = `${CONFLUENCE_BASE}/wiki/api/v2/pages/${PAGE_ID}`;
  const payload = {
    id: PAGE_ID,
    status: 'current',
    title: pageTitle,
    spaceId: SPACE_ID,
    body: {
      representation: 'storage',
      value: newBody
    },
    version: { number: currentVersion + 1 }
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to update page: ${res.status} ${res.statusText}\n${errBody}`);
  }
  return res.json();
}

async function uploadAttachment(filePath, fileName) {
  const url = `${CONFLUENCE_BASE}/wiki/rest/api/content/${PAGE_ID}/child/attachment`;

  const fileBuffer = fs.readFileSync(filePath);
  const boundary = `----FormBoundary${Date.now()}`;
  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    `Content-Type: application/json\r\n\r\n`,
  ];

  const header = Buffer.from(bodyParts.join(''));
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipartBody = Buffer.concat([header, fileBuffer, footer]);

  const token = Buffer.from(`${EMAIL}:${API_TOKEN}`).toString('base64');
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-Atlassian-Token': 'nocheck'
    },
    body: multipartBody
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to upload attachment ${fileName}: ${res.status}\n${errBody}`);
  }

  const data = await res.json();
  const attachment = data.results ? data.results[0] : data;
  console.log(`  Uploaded: ${fileName}`);
  return attachment;
}

function buildScoreCell(score, attachmentFilename) {
  const localId = uuidv4();
  const pLocalId = uuidv4();

  let content = `<p local-id="${pLocalId}"><strong>${score}</strong></p>`;

  if (attachmentFilename) {
    const macroLocalId = uuidv4();
    const macroId = uuidv4();
    content += `<p class="media-group"><ac:structured-macro ac:name="view-file" ac:schema-version="1" ac:local-id="${macroLocalId}" ac:macro-id="${macroId}"><ac:parameter ac:name="name"><ri:attachment ri:filename="${attachmentFilename}" /></ac:parameter></ac:structured-macro></p>`;
  }

  return `<td ac:local-id="${localId}">${content}</td>`;
}

function buildEmptyCell() {
  const localId = uuidv4();
  const pLocalId = uuidv4();
  return `<td ac:local-id="${localId}"><p local-id="${pLocalId}" /></td>`;
}

function buildHeaderCell(dateText) {
  const localId = uuidv4();
  const pLocalId = uuidv4();
  return `<th ac:local-id="${localId}"><p local-id="${pLocalId}"><strong>${dateText}</strong></p></th>`;
}

function buildSubHeaderCell() {
  const localId = uuidv4();
  const pLocalId = uuidv4();
  return `<td ac:local-id="${localId}"><p local-id="${pLocalId}"><strong>Score &amp; Attachment</strong></p></td>`;
}

function addColumnToTable(html, scoreData, attachmentMap) {
  const $ = cheerio.load(html, { xmlMode: true, decodeEntities: false });

  const table = $(`table[ac\\:local-id="${TABLE_LOCAL_ID}"]`);
  if (table.length === 0) {
    throw new Error(`Could not find reporting table with ac:local-id="${TABLE_LOCAL_ID}"`);
  }

  const rows = table.find('tbody > tr');
  const scoreMap = {};
  for (const s of scoreData.scores) {
    scoreMap[s.url] = s;
  }

  rows.each((rowIndex, row) => {
    const $row = $(row);

    if (rowIndex === 0) {
      $row.append(buildHeaderCell(scoreData.formattedDate));
      return;
    }

    if (rowIndex === 1) {
      $row.append(buildSubHeaderCell());
      return;
    }

    const firstCell = $row.find('td').first();
    const cellText = firstCell.text().trim();

    if (!cellText) {
      $row.append(buildEmptyCell());
      return;
    }

    const matchedScore = scoreMap[cellText];
    if (matchedScore && matchedScore.score !== null) {
      const attachFilename = attachmentMap ? attachmentMap[cellText] : null;
      $row.append(buildScoreCell(matchedScore.score, attachFilename));
    } else {
      $row.append(buildEmptyCell());
    }
  });

  return $.xml();
}

async function main() {
  if (!EMAIL || !API_TOKEN) {
    console.error('Error: CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN must be set in .env');
    process.exit(1);
  }

  console.log('Extracting scores from LHR reports...');
  const scoreData = extractScores();
  console.log(`  Date: ${scoreData.formattedDate}`);
  console.log(`  URLs: ${scoreData.scores.length} reports found`);
  scoreData.scores.forEach(s => {
    console.log(`    ${s.url} => ${s.score}`);
  });

  let attachmentMap = null;
  if (ATTACH_MODE) {
    console.log('\nUploading LHR JSON attachments...');
    attachmentMap = {};
    const lhciDir = path.join(__dirname, '..', '.lighthouseci');

    for (const s of scoreData.scores) {
      const filePath = path.join(lhciDir, s.sourceFile);
      if (!fs.existsSync(filePath)) {
        console.log(`  Skipping ${s.sourceFile} (file not found)`);
        continue;
      }

      const timestamp = new Date(scoreData.date).toISOString().replace(/[:.]/g, '').slice(0, 15);
      const urlSlug = s.url
        .replace(/^https?:\/\//, '')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 100);
      const attachName = `${urlSlug}-${timestamp}.json`;

      if (!DRY_RUN) {
        await uploadAttachment(filePath, attachName);
        attachmentMap[s.url] = attachName;
      } else {
        console.log(`  [DRY RUN] Would upload: ${attachName}`);
        attachmentMap[s.url] = attachName;
      }
    }
  }

  console.log('\nFetching Confluence page...');
  const page = await fetchPage();
  const currentVersion = page.version.number;
  const currentBody = page.body.storage.value;
  const pageTitle = page.title;
  console.log(`  Page version: ${currentVersion}`);
  console.log(`  Body length: ${currentBody.length} chars`);

  console.log('\nAdding new column to reporting table...');
  const updatedBody = addColumnToTable(currentBody, scoreData, attachmentMap);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would update page with new body. Preview of changes:');
    console.log(`  Body length: ${currentBody.length} => ${updatedBody.length} chars`);
    console.log(`  New version would be: ${currentVersion + 1}`);
    return;
  }

  console.log('\nUpdating Confluence page...');
  const result = await updatePage(updatedBody, currentVersion, pageTitle);
  console.log(`  Page updated to version ${result.version.number}`);
  console.log('\nDone! Confluence table updated with scores' + (ATTACH_MODE ? ' and attachments.' : '.'));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
