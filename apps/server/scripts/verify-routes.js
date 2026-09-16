/**
 * Boots the compiled Express app WITHOUT a database connection to verify
 * wiring: route mounting, auth gating, security headers, 404 handling.
 * Anything that would touch Mongo is expected to be rejected by auth first.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const http = require('http');
const app = require(require('path').join(__dirname,'..','dist','app')).default;

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  -> ${detail}`}`);
};

const server = http.createServer(app);

const request = (method, path) =>
  new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request(
      { host: '127.0.0.1', port, method, path },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });

server.listen(0, async () => {
  try {
    console.log('\n--- App boots and serves ---');
    const root = await request('GET', '/');
    check('GET / returns 200', root.status === 200, `got ${root.status}`);
    check(
      'root message is rebranded (no "Kabir")',
      root.body.includes('New Lab') && !/kabir/i.test(root.body),
      root.body
    );

    console.log('\n--- Helmet security headers present ---');
    for (const header of [
      'x-content-type-options',
      'x-frame-options',
      'strict-transport-security',
    ]) {
      check(`${header} set`, Boolean(root.headers[header]), 'missing');
    }
    check(
      'x-powered-by hidden',
      root.headers['x-powered-by'] === undefined,
      root.headers['x-powered-by']
    );

    console.log('\n--- Rate limiter is mounted on /api ---');
    const limited = await request('GET', '/api/v1/patients');
    check(
      'ratelimit headers present',
      Boolean(limited.headers['ratelimit'] || limited.headers['ratelimit-limit']),
      JSON.stringify(limited.headers)
    );

    console.log('\n--- Every domain route is mounted and auth-gated ---');
    const routes = [
      '/api/v1/patients',
      '/api/v1/tests',
      '/api/v1/test-categories',
      '/api/v1/referrers',
      '/api/v1/invoices',
      '/api/v1/payments',
      '/api/v1/commission-payouts',
      '/api/v1/dashboard',
      '/api/v1/reports/patients',
      '/api/v1/reports/financial-summary',
      '/api/v1/reports/revenue',
      '/api/v1/reports/referral-commission',
      '/api/v1/reports/dues',
      '/api/v1/users',
    ];

    for (const route of routes) {
      const res = await request('GET', route);
      // 401 = mounted and requires a token. 404 would mean not mounted.
      check(
        `${route} -> 401 (mounted, auth required)`,
        res.status === 401,
        `got ${res.status}: ${res.body.slice(0, 120)}`
      );
    }

    console.log('\n--- No public self-registration ---');
    // This route used to exist, was unauthenticated, and hardcoded
    // role='admin'. Anyone could have minted themselves an admin account.
    const reg = await request('POST', '/api/v1/auth/register');
    check(
      'POST /api/v1/auth/register is gone (404)',
      reg.status === 404,
      `got ${reg.status}: ${reg.body.slice(0, 120)}`
    );

    console.log('\n--- Removed retail routes are gone ---');
    for (const gone of [
      '/api/v1/products',
      '/api/v1/orders',
      '/api/v1/suppliers',
      '/api/v1/purchases',
      '/api/v1/damages',
      '/api/v1/returns',
      '/api/v1/refunds',
      '/api/v1/expenses',
      '/api/v1/units',
      '/api/v1/customers',
    ]) {
      const res = await request('GET', gone);
      check(`${gone} -> 404`, res.status === 404, `got ${res.status}`);
    }

    console.log('\n--- Error body does not leak internals in production ---');
    const notFound = await request('GET', '/api/v1/nope');
    check(
      '404 body has no stack trace',
      !notFound.body.includes('stack') || !notFound.body.includes('at '),
      notFound.body.slice(0, 200)
    );
  } catch (error) {
    failures += 1;
    console.error('ERROR:', error.message);
  } finally {
    server.close();
    console.log(
      `\n${failures === 0 ? '*** ALL SMOKE CHECKS PASSED ***' : `*** ${failures} CHECK(S) FAILED ***`}\n`
    );
    process.exit(failures === 0 ? 0 : 1);
  }
});
