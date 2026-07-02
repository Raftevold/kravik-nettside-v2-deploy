/**
 * GitHub-basert persistens for Render sitt flyktige filsystem.
 *
 * Ved kvar lagring i admin blir endra filer under data/ committa til
 * GitHub-repoet via Contents API. Ved oppstart blir siste versjon henta
 * ned att. Slik overlever innhald og opplasta bilete både dvale, omstart
 * og redeploy på gratisplanen – utan ekstern database.
 *
 * Krev miljøvariablane GITHUB_TOKEN og GITHUB_REPO (t.d. "brukar/repo").
 * Utan desse køyrer sida vidare med berre lokal lagring (og ei åtvaring).
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || '';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API = 'https://api.github.com';

const enabled = Boolean(TOKEN && REPO);

let lastError = null;
let lastSyncAt = null;
let queue = Promise.resolve();

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'kravik-nettside',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function toRepoPath(p) {
  return p.split(path.sep).join('/');
}

async function getSha(repoPath) {
  const res = await fetch(
    `${API}/repos/${REPO}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}?ref=${BRANCH}`,
    { headers: headers() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${repoPath}: ${res.status}`);
  const json = await res.json();
  return json.sha || null;
}

async function putFileOnce(repoPath, buffer, message) {
  const sha = await getSha(repoPath);
  const body = {
    message,
    content: buffer.toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(
    `${API}/repos/${REPO}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}`,
    { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub PUT ${repoPath}: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function deleteFileOnce(repoPath, message) {
  const sha = await getSha(repoPath);
  if (!sha) return;
  const res = await fetch(
    `${API}/repos/${REPO}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}`,
    {
      method: 'DELETE',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sha, branch: BRANCH }),
    }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub DELETE ${repoPath}: ${res.status} ${text.slice(0, 200)}`);
  }
}

/** Legg ein synk-operasjon i kø (seriell, med eitt nytt forsøk ved konflikt). */
function enqueue(fn, label) {
  if (!enabled) return Promise.resolve(false);
  queue = queue
    .then(async () => {
      try {
        await fn();
        lastSyncAt = new Date().toISOString();
        lastError = null;
      } catch (err) {
        // Eitt nytt forsøk (typisk sha-konflikt ved samtidige skriv)
        try {
          await fn();
          lastSyncAt = new Date().toISOString();
          lastError = null;
        } catch (err2) {
          lastError = `${label}: ${err2.message}`;
          console.error('[github-sync]', lastError);
        }
      }
    });
  return queue;
}

function pushFile(localPath, repoRelPath, message) {
  const repoPath = toRepoPath(repoRelPath);
  return enqueue(async () => {
    const buffer = fs.readFileSync(localPath);
    await putFileOnce(repoPath, buffer, message);
  }, `push ${repoPath}`);
}

function pushBuffer(buffer, repoRelPath, message) {
  const repoPath = toRepoPath(repoRelPath);
  return enqueue(() => putFileOnce(repoPath, buffer, message), `push ${repoPath}`);
}

function removeFile(repoRelPath, message) {
  const repoPath = toRepoPath(repoRelPath);
  return enqueue(() => deleteFileOnce(repoPath, message), `delete ${repoPath}`);
}

async function listDir(repoRelPath) {
  const repoPath = toRepoPath(repoRelPath);
  const res = await fetch(`${API}/repos/${REPO}/contents/${repoPath}?ref=${BRANCH}`, { headers: headers() });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub LIST ${repoPath}: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function downloadTo(url, localPath) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`GitHub nedlasting: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buf);
}

/**
 * Hent siste innhald frå GitHub ved oppstart.
 * Repoet er fasit: content/meldingar/auth blir overskrivne lokalt,
 * og opplasta filer som manglar lokalt blir lasta ned.
 */
async function pullAll(dataDir) {
  if (!enabled) return false;
  try {
    const entries = await listDir('data');
    for (const e of entries) {
      if (e.type === 'file' && e.download_url) {
        await downloadTo(e.download_url, path.join(dataDir, e.name));
      }
    }
    const uploads = await listDir('data/uploads');
    for (const e of uploads) {
      if (e.type !== 'file' || !e.download_url) continue;
      const local = path.join(dataDir, 'uploads', e.name);
      if (!fs.existsSync(local) || fs.statSync(local).size !== e.size) {
        await downloadTo(e.download_url, local);
      }
    }
    lastSyncAt = new Date().toISOString();
    return true;
  } catch (err) {
    lastError = `pull: ${err.message}`;
    console.error('[github-sync]', lastError);
    return false;
  }
}

function status() {
  return { enabled, lastSyncAt, lastError, repo: enabled ? REPO : null, branch: BRANCH };
}

module.exports = { enabled, pushFile, pushBuffer, removeFile, pullAll, status };
