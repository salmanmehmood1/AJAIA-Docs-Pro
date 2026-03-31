import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { readDb, writeDb, ensureDb } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ensureDb();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function getUserName(users, userId) {
  return users.find((user) => user.id === userId)?.name || 'Unknown user';
}

function stripHtml(value = '') {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSummary(doc, users) {
  return {
    id: doc.id,
    title: doc.title,
    ownerId: doc.ownerId,
    ownerName: getUserName(users, doc.ownerId),
    updatedAt: doc.updatedAt,
    sharedWith: doc.sharedWith,
    sharedCount: doc.sharedWith.length,
    preview: stripHtml(doc.content).slice(0, 110) || 'No content yet.'
  };
}

function getAccessibleDoc(db, docId, userId) {
  return db.documents.find(
    (doc) => doc.id === docId && (doc.ownerId === userId || doc.sharedWith.includes(userId))
  );
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br/>')}</p>`)
    .join('');
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Ajaia Docs API',
    status: 'ok',
    docs: ['/api/health', '/api/users', '/api/documents']
  });
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ajaia-docs-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (_req, res) => {
  const db = readDb();
  res.json(db.users);
});

app.get('/api/documents', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const db = readDb();
  const owned = db.documents
    .filter((doc) => doc.ownerId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((doc) => toSummary(doc, db.users));

  const shared = db.documents
    .filter((doc) => doc.ownerId !== userId && doc.sharedWith.includes(userId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((doc) => toSummary(doc, db.users));

  return res.json({ owned, shared });
});

app.get('/api/documents/:id', (req, res) => {
  const { userId } = req.query;
  const db = readDb();
  const doc = getAccessibleDoc(db, req.params.id, userId);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found or access denied.' });
  }

  return res.json({
    ...doc,
    ownerName: getUserName(db.users, doc.ownerId),
    sharedUsers: db.users.filter((user) => doc.sharedWith.includes(user.id))
  });
});

app.post('/api/documents', (req, res) => {
  const { ownerId, title = 'Untitled document', content = '<p>Start writing here...</p>' } = req.body;
  const db = readDb();

  if (!ownerId || !db.users.find((user) => user.id === ownerId)) {
    return res.status(400).json({ error: 'A valid ownerId is required.' });
  }

  const newDoc = {
    id: randomUUID(),
    title: String(title).trim() || 'Untitled document',
    content,
    ownerId,
    sharedWith: [],
    updatedAt: new Date().toISOString()
  };

  db.documents.unshift(newDoc);
  writeDb(db);
  return res.status(201).json(newDoc);
});

app.put('/api/documents/:id', (req, res) => {
  const { userId, title, content } = req.body;
  const db = readDb();
  const doc = getAccessibleDoc(db, req.params.id, userId);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found or access denied.' });
  }

  if (typeof title === 'string' && title.trim()) {
    doc.title = title.trim();
  }

  if (typeof content === 'string') {
    doc.content = content;
  }

  doc.updatedAt = new Date().toISOString();
  writeDb(db);

  return res.json({
    ...doc,
    ownerName: getUserName(db.users, doc.ownerId),
    sharedUsers: db.users.filter((user) => doc.sharedWith.includes(user.id))
  });
});

app.post('/api/documents/:id/share', (req, res) => {
  const { ownerId, targetUserId } = req.body;
  const db = readDb();
  const doc = db.documents.find((item) => item.id === req.params.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  if (doc.ownerId !== ownerId) {
    return res.status(403).json({ error: 'Only the owner can share this document.' });
  }

  if (!targetUserId || !db.users.find((user) => user.id === targetUserId)) {
    return res.status(400).json({ error: 'Pick a valid teammate to share with.' });
  }

  if (!doc.sharedWith.includes(targetUserId)) {
    doc.sharedWith.push(targetUserId);
    doc.updatedAt = new Date().toISOString();
    writeDb(db);
  }

  return res.json({
    message: 'Document shared successfully.',
    document: {
      ...doc,
      ownerName: getUserName(db.users, doc.ownerId),
      sharedUsers: db.users.filter((user) => doc.sharedWith.includes(user.id))
    }
  });
});

app.post('/api/documents/import', upload.single('file'), (req, res) => {
  const { ownerId } = req.body;
  const file = req.file;
  const db = readDb();

  if (!ownerId || !db.users.find((user) => user.id === ownerId)) {
    return res.status(400).json({ error: 'A valid ownerId is required.' });
  }

  if (!file) {
    return res.status(400).json({ error: 'Choose a .txt or .md file to import.' });
  }

  const extension = path.extname(file.originalname).toLowerCase();
  if (!['.txt', '.md'].includes(extension)) {
    return res.status(400).json({ error: 'Only .txt and .md files are supported in this demo.' });
  }

  const rawText = file.buffer.toString('utf8');

  const importedDoc = {
    id: randomUUID(),
    title: path.basename(file.originalname, extension),
    content: plainTextToHtml(rawText),
    ownerId,
    sharedWith: [],
    updatedAt: new Date().toISOString()
  };

  db.documents.unshift(importedDoc);
  writeDb(db);

  return res.status(201).json(importedDoc);
});

export default app;
