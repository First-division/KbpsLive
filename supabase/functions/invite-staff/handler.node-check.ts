import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInviteHandler, type InviteDependencies } from './handler.ts';

const origin = 'https://admin.example.test';
function setup(overrides: Partial<InviteDependencies> = {}) {
  const calls: string[] = [];
  const deps: InviteDependencies = {
    origin,
    authenticate: async () => ({ data: { id: 'admin-id' }, error: null }),
    getRole: async () => ({ data: { role: 'admin', active: true }, error: null }),
    invite: async (email, redirect) => {
      calls.push(`invite:${email}:${redirect}`);
      return { data: { id: 'invitee-id' }, error: null };
    },
    grantAccess: async (_token, id, role) => {
      calls.push(`grant:${id}:${role}`);
      return { error: null };
    },
    logError: () => { calls.push('logged'); },
    ...overrides,
  };
  return { handler: createInviteHandler(deps), calls };
}
function request(body: unknown = { email: ' editor@example.test ', role: 'editor' }, headers: Record<string, string> = {}) {
  return new Request('https://function.example.test', {
    method: 'POST',
    headers: { origin, authorization: 'Bearer test-token', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('only an active administrator can invite', async () => {
  for (const getRole of [
    async () => ({ data: { role: 'editor', active: true }, error: null }),
    async () => ({ data: { role: 'admin', active: false }, error: null }),
    async () => ({ data: null, error: null }),
  ]) {
    const { handler, calls } = setup({ getRole });
    assert.equal((await handler(request())).status, 403);
    assert.deepEqual(calls, []);
  }
});

test('rejects invalid authentication, origin, methods and inputs', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request({}, { authorization: '' }))).status, 401);
  assert.equal((await handler(request({}, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handler(new Request('https://function.example.test'))).status, 405);
  assert.equal((await handler(request({ email: 'bad', role: 'admin' }))).status, 400);
  assert.equal((await handler(request({ email: 'a@example.test', role: 'owner' }))).status, 400);
  assert.deepEqual(calls, []);
});

test('verifies tokens and handles failed authorization queries', async () => {
  let state = setup({ authenticate: async () => ({ data: null, error: { message: 'bad token' } }) });
  assert.equal((await state.handler(request())).status, 401);
  assert.deepEqual(state.calls, []);
  state = setup({ getRole: async () => ({ data: null, error: { message: 'database error' } }) });
  assert.equal((await state.handler(request())).status, 500);
  assert.deepEqual(state.calls, ['logged']);
});

test('invites with fixed redirect and grants requested role', async () => {
  const { handler, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(calls, [`invite:editor@example.test:${origin}`, 'grant:invitee-id:editor']);
});

test('reports invitation or post-invitation role failures', async () => {
  let state = setup({ invite: async () => ({ data: null, error: { message: 'SMTP failure' } }) });
  let response = await state.handler(request());
  assert.equal(response.status, 502);
  assert.deepEqual(state.calls, ['logged']);
  state = setup({ grantAccess: async () => ({ error: { message: 'permission denied' } }) });
  response = await state.handler(request());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /may have been sent/);
  assert.equal(state.calls.at(-1), 'logged');
});

test('CORS preflight accepts only configured website', async () => {
  const { handler } = setup();
  const allowed = await handler(new Request('https://function.example.test', { method: 'OPTIONS', headers: { origin } }));
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
  const denied = await handler(new Request('https://function.example.test', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
