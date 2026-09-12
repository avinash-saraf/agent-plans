// Running Nest + frontend proxy + a real database. Uses only its own disposable group.
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const slug = 'qa-api-' + randomUUID().slice(0, 12);
const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:5173/api';
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  let data;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.$connect();
        await db.$queryRaw`SELECT 1`;
        break;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `HTTP ${response.status}: API returned a non-JSON response`,
    );
  }
  return { status: response.status, data };
}
(async () => {
  try {
    let result = await request('/groups', 'POST', { slug, city: 'Brooklyn' });
    assert.equal(result.status, 201);
    let room = result.data;
    assert.equal(
      (await request('/groups', 'POST', { slug, city: 'Other city' })).status,
      409,
    );
    assert.equal(
      (
        await request('/groups/' + slug + '/members', 'POST', {
          revision: 0,
          name: ' ',
          context: 'Context',
        })
      ).status,
      400,
    );
    for (let i = 0; i < 3; i++) {
      result = await request('/groups/' + slug + '/members', 'POST', {
        revision: room.revision,
        name: 'Person ' + i,
        context: 'A test context',
      });
      assert.equal(result.status, 201);
      room = result.data;
    }
    const racers = await Promise.all(
      ['One', 'Two'].map((name) =>
        request('/groups/' + slug + '/members', 'POST', {
          revision: room.revision,
          name,
          context: 'Final seat',
        }),
      ),
    );
    assert.deepEqual(racers.map((r) => r.status).sort(), [201, 409]);
    room = (await request('/groups/' + slug)).data;
    assert.equal(room.members.length, 4);
    assert.equal(
      (
        await request('/groups/' + slug + '/members', 'POST', {
          revision: room.revision,
          name: 'Fifth',
          context: 'No room',
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request('/groups/' + slug, 'PATCH', {
          revision: 0,
          city: 'Queens',
        })
      ).status,
      409,
    );
    result = await request(
      '/groups/' + slug + '/members/' + room.members[0].id,
      'PATCH',
      {
        revision: room.revision,
        name: 'Updated person',
        context: 'Updated context',
      },
    );
    assert.equal(result.status, 200);
    room = result.data;
    result = await request(
      '/groups/' + slug + '/members/' + room.members[0].id,
      'DELETE',
      { revision: room.revision },
    );
    assert.equal(result.status, 200);
    room = result.data;
    assert.equal(room.members.length, 3);
    result = await request('/groups/' + slug, 'PATCH', {
      revision: room.revision,
      city: 'Queens',
    });
    assert.equal(result.data.city, 'Queens');
    assert.equal(
      (
        await request('/groups/' + slug + '/plan', 'POST', {
          revision: result.data.revision,
        })
      ).status,
      400,
    );
    console.log(
      'PASS: create/read, duplicate slug, validation, simultaneous joins, seat limit, stale revision, edit/remove, city update, planning guard',
    );
  } finally {
    await db.group.deleteMany({ where: { slug } });
    await db.$disconnect();
    console.log('Disposable API group removed');
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
