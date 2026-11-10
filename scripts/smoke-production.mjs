import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

// Own the server lifecycle; never attach to an unrelated process on a fixed port.
const server = spawn(
   process.execPath,
   ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '0'],
   {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
         ...process.env,
         SUPABASE_URL: 'https://example.supabase.co',
         SUPABASE_ANON_KEY: 'smoke-test-key',
      },
   }
);
let output = '';
let origin;
let spawnError;
server.on('error', (error) => {
   spawnError = error;
});
for (const stream of [server.stdout, server.stderr]) {
   stream.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-16000);
      origin ??= output.match(/http:\/\/127\.0\.0\.1:(\d+)(?=\s|\u001b)/)?.[0];
   });
}

try {
   const deadline = Date.now() + 30000;
   let ready = false;
   while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (server.exitCode !== null || server.signalCode !== null)
         throw new Error('Production server exited during startup');
      if (origin) {
         try {
            const response = await fetch(origin, {
               signal: AbortSignal.timeout(2000),
               redirect: 'manual',
            });
            if (response.status === 200) {
               ready = true;
               break;
            }
         } catch {
            /* Allow bounded startup time. Route assertions below must still pass. */
         }
      }
      await delay(200);
   }
   assert.ok(ready, 'Production server must become ready within 30 seconds');
   const routes = [
      ['/', ['The work, in one clear record', 'Explore the demo']],
      ['/demo', ['Work overview', 'Demo data', '<title>EGA Work — Demo workspace</title>']],
      ['/login', ['Sign in to EGA Work']],
   ];
   for (const [path, markers] of routes) {
      const response = await fetch(new URL(path, origin), {
         signal: AbortSignal.timeout(10000),
         redirect: 'manual',
      });
      assert.equal(response.status, 200, `${path} must render without a redirect`);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      const html = await response.text();
      for (const marker of markers)
         assert.ok(html.includes(marker), `${path} must contain ${marker}`);
      console.log(`PASS ${path}`);
   }

   // Legacy Circle fixture routes and guessed workspace IDs must not render
   // private or demo records to a signed-out request.
   for (const path of [
      '/lndev-ui/my-issues',
      '/lndev-ui/projects',
      '/lndev-ui/reviews',
      '/w/00000000-0000-4000-8000-000000000000',
   ]) {
      const response = await fetch(new URL(path, origin), {
         signal: AbortSignal.timeout(10000),
         redirect: 'manual',
      });
      assert.equal(response.status, 307, `${path} must require a verified session`);
      const location = response.headers.get('location') ?? '';
      assert.ok(
         location === '/login' || location.startsWith('/login?'),
         `${path} must redirect to login, received ${location}`
      );
      console.log(`PASS ${path} requires login`);
   }

   const missing = await fetch(new URL('/ci-missing-route/nested', origin), {
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
   });
   assert.equal(missing.status, 307, 'Unknown nested routes must use the home fallback');
   assert.equal(
      missing.headers.get('location'),
      '/',
      'Unknown routes must redirect to the homepage'
   );
   console.log('PASS unknown route redirects to home');
   const callback = await fetch(new URL('/auth/callback?next=%2F..%2F%2Fevil.example', origin), {
      headers: { 'x-forwarded-host': 'public.example', 'x-forwarded-proto': 'https' },
      redirect: 'manual',
   });
   assert.equal(callback.status, 307);
   assert.equal(callback.headers.get('location'), '/login?error=link');
   const personalSpace = await fetch(new URL('/me', origin), { redirect: 'manual' });
   assert.equal(personalSpace.status, 307, 'Signed-out users must be redirected to login');
   assert.equal(personalSpace.headers.get('location'), '/login');
   const signout = await fetch(new URL('/auth/signout', origin), {
      method: 'POST',
      redirect: 'manual',
   });
   assert.equal(signout.status, 303);
   assert.equal(signout.headers.get('location'), '/login');
   console.log('PASS auth redirects remain relative behind a proxy');
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
