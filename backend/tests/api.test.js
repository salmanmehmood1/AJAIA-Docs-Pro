import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajaia-docs-'));
process.env.DB_FILE = path.join(tempDir, 'db.json');

const { default: app } = await import('../src/app.js');

test('creates a document and exposes it to a shared collaborator', async () => {
  const createResponse = await request(app)
    .post('/api/documents')
    .send({ ownerId: 'u1', title: 'Quarterly Plan' });

  assert.equal(createResponse.statusCode, 201);
  assert.ok(createResponse.body.id);

  const shareResponse = await request(app)
    .post(`/api/documents/${createResponse.body.id}/share`)
    .send({ ownerId: 'u1', targetUserId: 'u2' });

  assert.equal(shareResponse.statusCode, 200);

  const listResponse = await request(app)
    .get('/api/documents')
    .query({ userId: 'u2' });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(
    listResponse.body.shared.some((doc) => doc.id === createResponse.body.id),
    true
  );
});
