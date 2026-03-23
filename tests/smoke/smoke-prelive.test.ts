import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const smokeScriptPath = path.join(repoRoot, 'scripts', 'smoke-prelive.mjs');

type RouteHandler = (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void;

async function withServer(
    handler: RouteHandler,
    callback: (baseUrl: string) => Promise<void>,
) {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');

    const address = server.address();
    assert.ok(address && typeof address === 'object');

    try {
        await callback(`http://127.0.0.1:${address.port}`);
    } finally {
        server.close();
        await once(server, 'close');
    }
}

async function runSmokeScript(env: Partial<NodeJS.ProcessEnv>) {
    const child = spawn(process.execPath, [smokeScriptPath], {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...env,
        },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
    });

    const [code] = await once(child, 'close');

    return {
        code,
        stdout,
        stderr,
    };
}

test('smoke-prelive passes when every required endpoint is healthy', async () => {
    await withServer((req, res) => {
        const statusCode = req.url === '/api/sap' ? 403 : 200;
        res.writeHead(statusCode, { 'content-type': 'text/plain' });
        res.end('ok');
    }, async (baseUrl) => {
        const result = await runSmokeScript({ BASE_URL: baseUrl });

        assert.equal(result.code, 0);
        assert.match(result.stdout, /PASS Login page: 200/);
        assert.match(result.stdout, /PASS SAP config endpoint: 403/);
        assert.match(result.stdout, /Smoke test passed\./);
    });
});

test('smoke-prelive fails when one of the required pages is unavailable', async () => {
    await withServer((req, res) => {
        const statusCode = req.url === '/support' ? 500 : req.url === '/api/sap' ? 403 : 200;
        res.writeHead(statusCode, { 'content-type': 'text/plain' });
        res.end('ok');
    }, async (baseUrl) => {
        const result = await runSmokeScript({ BASE_URL: baseUrl });

        assert.equal(result.code, 1);
        assert.match(result.stdout, /FAIL Support page: 500/);
        assert.match(result.stderr, /Smoke test failed with 1 failing checks\./);
    });
});

test('smoke-prelive fails fast when no base URL is configured', async () => {
    const result = await runSmokeScript({ BASE_URL: '', NEXTAUTH_URL: '' });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Missing BASE_URL or NEXTAUTH_URL for smoke test\./);
});
