const baseUrl = process.env.BASE_URL || process.env.NEXTAUTH_URL;

if (!baseUrl) {
  console.error('Missing BASE_URL or NEXTAUTH_URL for smoke test.');
  process.exit(1);
}

const checks = [
  { name: 'Login page', path: '/login', expectStatus: 200 },
  { name: 'Copilot page', path: '/copilot', expectStatus: 200 },
  { name: 'Support page', path: '/support', expectStatus: 200 },
  { name: 'SAP config endpoint', path: '/api/sap', expectStatus: [200, 403] },
];

function statusMatches(expected, actual) {
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

async function run() {
  let failed = 0;

  for (const check of checks) {
    const url = new URL(check.path, baseUrl).toString();
    try {
      const response = await fetch(url, { redirect: 'manual' });
      const ok = statusMatches(check.expectStatus, response.status);
      const marker = ok ? 'PASS' : 'FAIL';
      console.log(`${marker} ${check.name}: ${response.status} ${url}`);
      if (!ok) failed++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAIL ${check.name}: ${message}`);
    }
  }

  if (failed > 0) {
    console.error(`Smoke test failed with ${failed} failing checks.`);
    process.exit(1);
  }

  console.log('Smoke test passed.');
}

run();