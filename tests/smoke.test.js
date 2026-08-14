import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_SERVER = path.join(ROOT, 'dist-server', 'server.js');

function request(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: Number(u.port), path: u.pathname + u.search, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  // Build server if needed
  if (!fs.existsSync(DIST_SERVER)) {
    console.log('Building server...');
    const { execSync } = await import('child_process');
    execSync('npm run build:server', { cwd: ROOT, stdio: 'inherit' });
  }

  // Remove dist/ to test API-only backend mode (like Render deploy)
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }

  const PORT = 9877;
  const proc = spawn(process.execPath, [DIST_SERVER], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('listening') || msg.includes('running')) {
      // server is up
    }
  });

  proc.stderr.on('data', (d) => console.error('[test server stderr]', d.toString()));

  // Wait for server to boot
  for (let i = 0; i < 40; i++) {
    try {
      const res = await request(`http://127.0.0.1:${PORT}/`);
      if (res.status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  let failed = 0;

  // Test 1: Health check
  try {
    const res = await request(`http://127.0.0.1:${PORT}/`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${res.body}`);
    const json = JSON.parse(res.body);
    if (json.status !== 'ok') throw new Error(`Expected {status: "ok"}, got ${JSON.stringify(json)}`);
    console.log('✓ Health check returns JSON');
  } catch (e) {
    console.error('✗ Health check failed:', e.message);
    failed++;
  }

  // Test 2: Removed routes return 404
  for (const route of ['/api/analyze-video', '/api/copilot-optimize', '/api/detect-cuts']) {
    try {
      const res = await request(`http://127.0.0.1:${PORT}${route}`);
      if (res.status === 404) {
        console.log(`✓ ${route} returns 404 (removed)`);
      } else {
        throw new Error(`Expected 404, got ${res.status}`);
      }
    } catch (e) {
      console.error(`✗ ${route} test failed:`, e.message);
      failed++;
    }
  }

  // Test 3: SSRF guard blocks private IPs via proxy
  try {
    const target = encodeURIComponent('http://127.0.0.1/test');
    const res = await request(`http://127.0.0.1:${PORT}/api/music-proxy?url=${target}`);
    if (res.status === 403) {
      console.log('✓ SSRF guard blocks private IP');
    } else {
      throw new Error(`Expected 403, got ${res.status}: ${res.body}`);
    }
  } catch (e) {
    console.error('✗ SSRF guard test failed:', e.message);
    failed++;
  }

  // Test 4: Caption config parity (preview = export)
  try {
    const { resolveCaptionMetrics, normalizeCaptionStyle } = await import(
      path.join(ROOT, 'src', 'utils', 'captionStyleConfig.ts')
    );
    const styles = ['mrbeast', 'hormozi', 'minimalist', 'comic', 'impact'];
    const textLengths = [10, 30, 60];
    for (const style of styles) {
      for (const len of textLengths) {
        const normalized = normalizeCaptionStyle(style);
        const metrics = resolveCaptionMetrics(normalized, len, 1080);
        if (typeof metrics.fontSize !== 'number' || metrics.fontSize <= 0) throw new Error(`Invalid fontSize for ${style}`);
        if (typeof metrics.textColor !== 'string' || !metrics.textColor.startsWith('#')) throw new Error(`Invalid textColor for ${style}`);
        if (typeof metrics.yPositionFraction !== 'number' || metrics.yPositionFraction < 0 || metrics.yPositionFraction > 1) {
          throw new Error(`Invalid yPositionFraction for ${style}`);
        }
      }
    }
    console.log('✓ Caption config parity verified');
  } catch (e) {
    console.error('✗ Caption config parity failed:', e.message);
    failed++;
  }

  // Cleanup
  proc.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));

  if (failed > 0) {
    console.log(`\n${failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nAll tests passed.');
    process.exit(0);
  }
}

runTests().catch((e) => {
  console.error('Test runner error:', e);
  process.exit(1);
});
