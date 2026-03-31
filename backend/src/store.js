import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

const DEFAULT_DB = {
  users: [
    { id: 'u1', name: 'Alice Johnson' },
    { id: 'u2', name: 'Bob Smith' },
    { id: 'u3', name: 'Carol Lee' }
  ],
  documents: [
    {
      id: 'welcome-doc',
      title: 'Welcome to Ajaia Docs',
      content:
        '<h1>Team Notes</h1><p>This seeded document demonstrates <strong>rich text</strong>, sharing, and persistence.</p><ul><li>Switch users in the UI</li><li>Open shared documents</li><li>Import a .txt or .md file</li></ul>',
      ownerId: 'u1',
      sharedWith: ['u2'],
      updatedAt: '2026-03-31T09:00:00.000Z'
    }
  ]
};

function getDbFile() {
  return process.env.DB_FILE || path.join(backendRoot, 'data', 'db.json');
}

export function ensureDb() {
  const dbFile = getDbFile();
  const dir = path.dirname(dbFile);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

export function readDb() {
  ensureDb();
  const dbFile = getDbFile();
  return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

export function writeDb(data) {
  ensureDb();
  const dbFile = getDbFile();
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
  return data;
}

export function getDefaultDb() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}
