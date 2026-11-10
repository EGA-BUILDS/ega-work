import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

// Own the server lifecycle; never attach to an unrelated process on a fixed port.
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '0'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let origin;
let spawnError;
server.on('error', (error) => { spawnError = error; });
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', (chunk) => {
    output = (output + chunk.toString()).slice(-16000);
    origin ??= output.match(/http:\/\/127\.0\.0\.1:(\d+)/)?.[0];
  });
}

try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('Production server exited during startup');
    if (origin) {
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(2000), redirect: 'manual' });
        if (response.status === 200) { ready = true; break; }
      } catch { /* Allow bounded startup time. Route assertions below must still pass. */ }
    }
    await delay(200);
  }
  assert.ok(ready, 'Production server must become ready within 30 seconds');
  const routes = [
    ['/', ['Work overview', 'Demo data']],
    ['/lndev-ui/my-issues', ['<main']],
    ['/lndev-ui/projects', ['<main']],
    ['/lndev-ui/reviews', ['<main']],
  ];
  for (const [path, markers] of routes) {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10000), redirect: 'manual' });
    assert.equal(response.status, 200, `${path} must render without a redirect`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    const html = await response.text();
    for (const marker of markers) assert.ok(html.includes(marker), `${path} must contain ${marker}`);
    console.log(`PASS ${path}`);
  }
  const missing = await fetch(new URL('/__ci_missing_route__', origin), { signal: AbortSignal.timeout(10000), redirect: 'manual' });
  assert.equal(missing.status, 404, 'Unknown routes must not return a successful page');
  console.log('PASS unknown route returns 404');
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server.pid && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    timer.unref();
    await exited;
    clearTimeout(timer);
  }
}
