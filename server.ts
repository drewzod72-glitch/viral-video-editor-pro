import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import os from 'os';
import { exec, spawn, execSync } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import multer from 'multer';
import { Readable } from 'stream';
import crypto from 'crypto';
import dns from 'dns';
import { resolveCaptionMetrics, normalizeCaptionStyle, FONT_FILE_FOR_STYLE, CaptionStyleName } from './src/utils/captionStyleConfig';

interface Segment {
  start: number;
  end: number;
  speed?: number;
  reason?: string;
}

// __dirname is provided by Node's CommonJS wrapper (see build:server).
// No shim needed — the ESM variant was removed along with the ESM build.

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Proxy endpoint safety (SSRF protection) ──────────────────────────────
// The proxy endpoints exist only to stream stock media / font assets past
// browser CORS walls. They must NEVER be able to fetch arbitrary URLs:
//   1. https only (no http://)
//   2. hostname allowlist — extend via PROXY_ALLOWED_HOSTS (comma-separated)
//   3. the resolved IP is checked against private/loopback/link-local/
//      metadata ranges, blocking SSRF via DNS tricks
const DEFAULT_PROXY_ALLOWED_HOSTS = [
  'pexels.com', 'videos.pexels.com', 'images.pexels.com',
  'pixabay.com', 'cdn.pixabay.com',
  'raw.githubusercontent.com', 'github.com',
  'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com',
  'test-videos.co.uk', 'w3schools.com',
];
const PROXY_ALLOWED_HOSTS: Set<string> = (() => {
  const extra = (process.env.PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_PROXY_ALLOWED_HOSTS, ...extra]);
})();

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '::' || ip === '0.0.0.0') return true;
  if (ip === '169.254.169.254') return true; // cloud metadata endpoint
  if (ip.startsWith('127.') || ip.startsWith('169.254.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('100.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 64 && second <= 127) return true; // CGNAT
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true; // IPv6 ULA/link-local
  return false;
}

async function validateProxyUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid target URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('Only https URLs are allowed through the proxy');
  const hostname = parsed.hostname.toLowerCase();
  const allowed = Array.from(PROXY_ALLOWED_HOSTS).some(
    (h) => hostname === h || hostname.endsWith('.' + h)
  );
  if (!allowed) throw new Error(`Host is not allowlisted: ${hostname}`);
  try {
    const { address } = await dns.promises.lookup(hostname);
    if (isPrivateIp(address)) throw new Error('Target resolved to a private/unsafe address');
  } catch (e: any) {
    if (e?.message?.startsWith('Target resolved')) throw e;
    // DNS failure: let the downstream request fail naturally
  }
  return parsed;
}

// PROXY ENDPOINT FOR MUSIC (Fixes Safari CORS / Silent Export)
app.get('/api/music-proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');

  try {
    const musicUrl = decodeURIComponent(url as string);
    const safeTarget = await validateProxyUrl(musicUrl);
    console.log(`[Music Proxy] Fetching: ${safeTarget.toString()}`);
    
    const response = await axios({
      method: 'get',
      url: safeTarget.toString(),
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      }
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    response.data.pipe(res);
  } catch (err: any) {
    console.error(`[Music Proxy Error] ${err.message}`);
    const blocked = err?.message?.startsWith('Only https') || err?.message?.startsWith('Host is') || err?.message?.startsWith('Invalid') || err?.message?.startsWith('Target resolved');
    res.status(blocked ? 403 : 500).send(blocked ? err.message : 'Failed to proxy music');
  }
});

// Global CORS configuration for maximum iframe and sandbox compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Spawning helper for FFmpeg to eliminate shell escaping/quote issues
const runFFmpegWithBinary = (args: string[], binaryPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg Spawn] Executing: "${binaryPath}" ${args.map(a => a.includes(' ') || a.includes('=') ? '"' + a + '"' : a).join(' ')}`);
    const proc = spawn(binaryPath, args);
    let stderr = '';
    
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`[FFmpeg Spawn Error] Process with "${binaryPath}" exited with code ${code}. Stderr:\n${stderr}`);
        
        // Scan and extract the exact error message from stderr (by-passing verbose progress indicators)
        const lines = stderr.split('\n');
        const errorLines = lines.filter(l => {
          const lower = l.toLowerCase();
          return lower.includes('error') || 
                 lower.includes('failed') || 
                 lower.includes('invalid') || 
                 lower.includes('no such') || 
                 lower.includes('matches no streams') ||
                 lower.includes('stream specifier') ||
                 lower.includes('cannot') ||
                 lower.includes('unsupported') ||
                 lower.includes('not found') ||
                 lower.includes('undefined');
        });
        
        // Extract up to 3 descriptive error lines, or fall back to the last 350 characters of stderr
        const errorDetail = errorLines.length > 0 
          ? errorLines.slice(-3).map(l => l.trim()).join(' | ') 
          : stderr.slice(-350).trim();

        reject(new Error(`FFmpeg exited with code ${code}. Details: ${errorDetail}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`[FFmpeg Spawn Error] Process with "${binaryPath}" failed to spawn:`, err.message);
      reject(err);
    });
  });
};

const getFFmpegPath = (): string => {
  // Always prefer the modern, system-wide 'ffmpeg' first if it is available and functional.
  // The pre-compiled static binary from @ffmpeg-installer is a stale 2018 build that lacks support
  // for newer filters (like afftdn) and frequently exits with code 1 in sandboxed environments.
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    let primaryPath = ffmpegInstaller.path;
    try {
      if (primaryPath && fs.existsSync(primaryPath)) {
        fs.accessSync(primaryPath, fs.constants.X_OK);
        return primaryPath;
      }
    } catch {}
    return 'ffmpeg';
  }
};

const getSystemFontFallback = (): string | null => {
  const commonPaths = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    '/usr/share/fonts/fonts-dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf'
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

const runFFmpeg = async (args: string[]): Promise<void> => {
  const primaryPath = getFFmpegPath();

  try {
    await runFFmpegWithBinary(args, primaryPath);
  } catch (firstErr: any) {
    if (primaryPath !== 'ffmpeg') {
      console.warn(`[FFmpeg Spawn Failover] Retrying rendering execution with system-wide 'ffmpeg' binary due to first error:`, firstErr.message);
      await runFFmpegWithBinary(args, 'ffmpeg');
    } else {
      throw firstErr;
    }
  }
};

const upload = multer({ limits: { fileSize: 100 * 1024 * 1024 } }); // limit 100MB

app.use(express.json({ limit: '10mb' }));

// Helper to fix the "DUNIK" -> "DUNK" typo in subtitles, titles, names, descriptions
const fixDunikTypo = (str: string): string => {
  if (typeof str !== 'string' || !str) return str;
  return str.replace(/dunik/gi, (match) => {
    if (match === match.toUpperCase()) return 'DUNK';
    if (match === match.toLowerCase()) return 'dunk';
    if (match[0] === match[0].toUpperCase()) return 'Dunk';
    return 'Dunk';
  });
};

const savedRendersMap = new Map<string, string>();

const cacheRenderFileAndSetHeaders = (res: any, sourcePath: string, cleanSafeName: string): string => {
  const savedRendersDir = path.join(os.tmpdir(), 'saved_renders');
  if (!fs.existsSync(savedRendersDir)) {
    fs.mkdirSync(savedRendersDir, { recursive: true });
  }
  const renderId = `render_v_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const persistentPath = path.join(savedRendersDir, `${renderId}.mp4`);
  try {
    fs.copyFileSync(sourcePath, persistentPath);
    savedRendersMap.set(renderId, persistentPath);
    console.log(`[Video Compiler Server] Saved copy of compiled video to persistent cache: ${persistentPath}`);
    
    const downloadUrl = `/api/download-render?id=${renderId}&name=${encodeURIComponent(cleanSafeName + '_edited.mp4')}`;
    res.setHeader('X-Render-Id', renderId);
    res.setHeader('X-Render-Download-Url', downloadUrl);
    res.setHeader('Access-Control-Expose-Headers', 'X-Render-Id, X-Render-Download-Url');
    return downloadUrl;
  } catch (copyErr) {
    console.error('[Video Compiler Server] Failed to cache render copy:', copyErr);
    return '';
  }
};

// Robust downloader utility with header retries for high-availability direct file fetching
const downloadFileWithRetries = async (url: string, destPath: string, minSizeAllowed = 10000): Promise<boolean> => {
  console.log(`[Asset Downloader] Initializing robust fetch for: ${url}`);
  
  // Verify cache and serve directly if available
  let urlHash = '';
  let cachedFile = '';
  try {
    urlHash = crypto.createHash('md5').update(url).digest('hex');
    const cacheDir = path.join(os.tmpdir(), 'editor_cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    let ext = '.mp4';
    if (url.includes('.mp3')) ext = '.mp3';
    else if (url.includes('.ogg')) ext = '.ogg';
    else if (url.includes('.ttf')) ext = '.ttf';
    
    cachedFile = path.join(cacheDir, `${urlHash}${ext}`);
    if (fs.existsSync(cachedFile)) {
      const cachedSize = fs.statSync(cachedFile).size;
      if (cachedSize > minSizeAllowed) {
        console.log(`[Asset Downloader] CACHE HIT! Reusing pre-downloaded asset from local disk cache for: ${url} (Size: ${(cachedSize / 1024 / 1024).toFixed(2)} MB)`);
        fs.copyFileSync(cachedFile, destPath);
        return true;
      }
    }
  } catch (cacheCheckErr: any) {
    console.warn(`[Asset Downloader] Cache check bypassed: ${cacheCheckErr.message}`);
  }

  const isPexels = url.includes('pexels.com');
  const isAudio = url.includes('.mp3') || url.includes('.ogg') || url.includes('.wav') || url.includes('.m4a');
  const isFont = url.includes('.ttf') || url.includes('.woff') || url.includes('.woff2');

  let defaultAccept = '*/*';
  if (isAudio) {
    defaultAccept = 'audio/mpeg,audio/ogg,audio/*;q=0.9,*/*;q=0.8';
  } else if (isFont) {
    defaultAccept = 'font/ttf,font/*;q=0.9,*/*;q=0.8';
  } else if (url.includes('.mp4') || url.includes('.webm')) {
    defaultAccept = 'video/mp4,video/*;q=0.9,*/*;q=0.8';
  }

  const headerSets: any[] = [
    // Header Set 1: Standard No-Referer clean request (highly reliable for CDNs and general resources)
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': defaultAccept,
      'Accept-Language': 'en-US,en;q=0.9'
    },
    // Header Set 2: Bare-bones minimalist headers (essential for secure CDNs rejecting customized headers)
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': '*/*'
    }
  ];

  if (isPexels) {
    // Add specialized Pexels referer sets ONLY for Pexels URLs
    headerSets.push({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.pexels.com/',
      'Accept-Language': 'en-US,en;q=0.9'
    });
    headerSets.push({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Referer': 'https://images.pexels.com/',
      'Accept-Language': 'en-US,en;q=0.9'
    });
  } else {
    // For non-Pexels URLs, try domain origin as referer
    try {
      const parsedUrl = new URL(url);
      headerSets.push({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': defaultAccept,
        'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
        'Accept-Language': 'en-US,en;q=0.9'
      });
    } catch {
      // Fallback
    }
  }

  for (let i = 0; i < headerSets.length; i++) {
    const headers = headerSets[i];
    try {
      console.log(`[Asset Downloader] Connection Attempt ${i + 1}/${headerSets.length} using ${headers.Referer ? 'Referer: ' + headers.Referer : 'No-Referer'}`);
      
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: headers,
        timeout: 90000, // 90 seconds timeout for full downloading
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 300
      });

      const contentType = String(response.headers['content-type'] || '');
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        throw new Error('Cloudflare html protection page returned.');
      }

      // Pipe response data to file dest
      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        response.data.on('error', (err: any) => {
          writer.destroy();
          reject(err);
        });
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const expectedSize = Number(response.headers['content-length'] || 0);

      if (fs.existsSync(destPath)) {
        const actualSize = fs.statSync(destPath).size;
        console.log(`[Asset Downloader] Attempt ${i + 1} finalized file size: ${actualSize} bytes. Expected: ${expectedSize || 'Unknown'}`);
        
        // Prevent truncated partial downloads from passing checks
        if (expectedSize > 0 && actualSize < expectedSize - 1000) {
          console.warn(`[Asset Downloader] Premature end in stream observed! Received only ${actualSize} of ${expectedSize} expected bytes. Rejecting truncated download.`);
          try { fs.unlinkSync(destPath); } catch {}
          continue;
        }

        if (actualSize > minSizeAllowed) {
          console.log(`[Asset Downloader] Download verified complete! Size: ${(actualSize / 1024 / 1024).toFixed(2)} MB`);
          // Store to cache
          try {
            if (cachedFile) {
              fs.copyFileSync(destPath, cachedFile);
              console.log(`[Asset Downloader] Successfully cached downloaded asset to: ${cachedFile}`);
            }
          } catch (cacheStoreErr: any) {
            console.warn(`[Asset Downloader] Failed storing to disk cache: ${cacheStoreErr.message}`);
          }
          return true;
        } else {
          console.warn(`[Asset Downloader] Size check failed: ${actualSize} bytes <= min limit of ${minSizeAllowed} bytes.`);
        }
      }
    } catch (err: any) {
      console.log(`[Asset Downloader] Access attempt ${i + 1} skip: ${err.message}`);
    }
  }
  
  return false;
};

// TRANSCODE ENDPOINT: Optimized for TikTok & Short-form social media upload.
// Converts browser variable-frame-rate canvas recordings (WebM/raw MP4) into standard, highly-compatible H.264 / AAC constant 30 FPS MP4 containers.
// Incorporates '+faststart' flags to index keyframes at the beginning of the file, allowing instant loading and lag-free preview on TikTok!
app.post('/api/transcode', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  const fileExtension = req.headers['content-type']?.includes('mp4') ? 'mp4' : 'webm';
  const inputTempPath = path.join(os.tmpdir(), `input_${Date.now()}.${fileExtension}`);
  const outputTempPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);

  console.log(`[Video Transcoder] Starting server-side transcoding for input payload...`);

  if (!req.body || req.body.length === 0) {
    console.error('[Video Transcoder] Received empty body buffer from client.');
    return res.status(400).json({ success: false, error: 'Received empty video compiling payload.' });
  }

  try {
    fs.writeFileSync(inputTempPath, req.body);
    console.log(`[Video Transcoder] Successfully buffered raw canvas capture of size: ${(req.body.length / 1024 / 1024).toFixed(2)} MB. Calling FFmpeg compiler...`);
  } catch (writeErr: any) {
    console.error('[Video Transcoder] Failed saving buffer to temporary disk:', writeErr);
    return res.status(500).json({ success: false, error: 'Failed saving target video stream body.', details: writeErr.message });
  }

  const ffmpegPath = getFFmpegPath();

  // Probe the input file first using FFmpeg to see if it has an audio track.
  // If the user's canvas recording didn't have audio, we dynamically synthesize silence,
  // otherwise FFmpeg fails to map the audio stream or TikTok rejects the final video file.
  const probeCmd = `"${ffmpegPath}" -i "${inputTempPath}"`;
  exec(probeCmd, (probeErr, probeStdout, probeStderr) => {
    const metadata = (probeStdout || '') + (probeStderr || '');
    const hasAudio = /Stream #\d+:\d+.*Audio/i.test(metadata);
    console.log(`[Video Transcoder] Media analysis completed. hasAudio: ${hasAudio}`);

    // FFmpeg settings for high quality and perfect TikTok/social-media compatibility:
    // -y: overwrite output
    // -i: input file
    // -r 30: enforce Constant Frame Rate of 30 FPS (eliminates lag/freezes on mobile devices)
    // -vf "fps=30,format=yuv420p": standard 30 FPS constant video frames and yuv420p color space for absolute visual compatibility
    // -af "aresample=async=1": enforces correct audio/video synchronization even if there are variable frames or browser drops
    // -c:v libx264: encode with universal H.264 video codec
    // -preset ultrafast: ensure fast delivery on server containers
    // -crf 20: pristine quality target rating (visual-lossless sweet spot for shorts)
    // -profile:v high -level:v 4.1: standard H.264 high profile for perfect hardware decompression
    // -g 60 -keyint_min 60 -sc_threshold 0: hard keyframe lock every 2s for TikTok's looping and seeking parameters
    // -c:a aac -ar 44100 -ac 2 -b:a 128k: standardized stereo AAC 44.1kHz audio stream
    // -movflags +faststart: relocate Moov atom metadata block to the start of the file for instant buffering
    const args: string[] = ['-y', '-i', inputTempPath];
    if (hasAudio) {
      console.log('[Video Transcoder] Compiling with existing audio track in perfect sync...');
      args.push(
        '-vf', 'fps=30,format=yuv420p',
        '-af', 'aresample=async=1',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '20',
        '-profile:v', 'high',
        '-level:v', '4.1',
        '-g', '60',
        '-keyint_min', '60',
        '-sc_threshold', '0',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputTempPath
      );
    } else {
      console.log('[Video Transcoder] No audio track found. Injecting standard silent AAC track for perfect social media compliance...');
      args.push(
        '-f', 'lavfi',
        '-i', 'anullsrc',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vf', 'fps=30,format=yuv420p',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '20',
        '-profile:v', 'high',
        '-level:v', '4.1',
        '-g', '60',
        '-keyint_min', '60',
        '-sc_threshold', '0',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '128k',
        '-shortest',
        '-movflags', '+faststart',
        outputTempPath
      );
    }

    runFFmpeg(args)
      .then(() => {
        try { fs.unlinkSync(inputTempPath); } catch {}
        console.log('[Video Transcoder] FFmpeg encoding completed successfully. Dispatching faststart MP4 file stream...');
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="tiktok_optimized.mp4"');
        res.sendFile(outputTempPath, (sendErr) => {
          if (sendErr) {
            console.error('[Video Transcoder] Failed sending compiled file stream:', sendErr);
          }
          try { fs.unlinkSync(outputTempPath); } catch {}
        });
      })
      .catch((err) => {
        try { fs.unlinkSync(inputTempPath); } catch {}
        console.error('[Video Transcoder] FFmpeg command execution failure:', err);
        res.status(500).json({ success: false, error: 'FFmpeg server transcoding failed.', details: err.message });
      });
  });
});

// Fonts bundled with the app at this exact path take priority over any
// network download. Place the 5 files here with these exact names:
//   /fonts/SpaceGrotesk-Bold.ttf   (mrbeast)
//   /fonts/Impact.ttf              (hormozi — real Impact, no free CDN mirror exists)
//   /fonts/Inter-Bold.ttf          (minimalist)
//   /fonts/Outfit-Bold.ttf         (comic)
//   /fonts/JetBrainsMono-Bold.ttf  (impact)
const BUNDLED_FONTS_DIR = path.join(__dirname, 'fonts');

const CAPTION_FONTS: Record<CaptionStyleName, { name: string; urls: string[] }> = {
  mrbeast: {
    name: FONT_FILE_FOR_STYLE.mrbeast,
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf',
      'https://github.com/google/fonts/raw/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf',
      'https://fonts.gstatic.com/s/spacegrotesk/v13/V8mQoQDjQSkFsp0FOBQWz7C9Z25TR_S1.ttf'
    ]
  },
  hormozi: {
    // Real Impact.ttf is a proprietary system font with no legitimate free
    // CDN mirror, so the network fallback here is Anton — the closest
    // freely-licensed Google Fonts lookalike (bold, condensed, uppercase
    // display face) — rather than Oswald, which looked noticeably
    // different from the "Impact" font-family the client preview uses.
    name: FONT_FILE_FOR_STYLE.hormozi,
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf',
      'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/anton/Anton-Regular.ttf',
      'https://fonts.gstatic.com/s/anton/v25/1Ptgg87LROyAm3Kz-C8.ttf'
    ]
  },
  minimalist: {
    // UNCERTAIN: Google's google/fonts GitHub repo for Inter appears to
    // have moved to variable-font-only distribution (no static/ subfolder
    // visible in the repo as of this writing), so these path-based mirrors
    // may 404. That's fine — this is a last-resort fallback; the bundled
    // local file (checked first, see BUNDLED_FONTS_DIR above) is the path
    // that actually matters. If these all fail, it falls through to
    // Roboto-Bold.ttf same as any other missing font.
    name: FONT_FILE_FOR_STYLE.minimalist,
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/static/Inter-Medium.ttf',
      'https://github.com/google/fonts/raw/main/ofl/inter/static/Inter-Medium.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-Medium.ttf'
    ]
  },
  comic: {
    name: FONT_FILE_FOR_STYLE.comic,
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/outfit/Outfit-Bold.ttf',
      'https://github.com/google/fonts/raw/main/ofl/outfit/Outfit-Bold.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/outfit/Outfit-Bold.ttf',
      'https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC0DYRhw2A.ttf'
    ]
  },
  impact: {
    name: FONT_FILE_FOR_STYLE.impact,
    urls: [
      'https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/static/JetBrainsMono-Bold.ttf',
      'https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/static/JetBrainsMono-Bold.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/jetbrainsmono/static/JetBrainsMono-Bold.ttf',
      'https://fonts.gstatic.com/s/jetbrainsmono/v18/tU3o0oWSc7IEYQ35atayqR3yRTUOT_SR3e63V370fO_9.ttf'
    ]
  }
};

async function getFontForStyle(style: string): Promise<string> {
  const fontDir = os.tmpdir();
  const defaultFontPath = path.join(fontDir, 'Roboto-Bold.ttf');

  const normalizedStyle = normalizeCaptionStyle(style);
  const fontInfo = CAPTION_FONTS[normalizedStyle];

  // 1. Bundled local file — instant, zero network dependency, and the
  //    only way to get the real Impact.ttf (see note above). This is now
  //    checked BEFORE any network attempt, whereas previously the app
  //    always hit the network first on every cold render.
  const bundledPath = path.join(BUNDLED_FONTS_DIR, fontInfo.name);
  if (fs.existsSync(bundledPath) && fs.statSync(bundledPath).size > 5000) {
    return bundledPath;
  }

  const targetPath = path.join(fontDir, fontInfo.name);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 5000) {
    return targetPath;
  }
  
  // 2. Network mirrors (best-effort fallback if the bundled file is missing)
  for (const fontUrl of fontInfo.urls) {
    try {
      console.log(`[Video Compiler Server] Bundled font missing for style '${style}' — trying network mirror: ${fontUrl}`);
      const res = await axios({
        method: 'get',
        url: fontUrl,
        responseType: 'arraybuffer',
        timeout: 6000
      });
      if (res.data && res.data.byteLength > 5000) {
        fs.writeFileSync(targetPath, Buffer.from(res.data));
        console.log(`[Video Compiler Server] Saved font for '${style}' at:`, targetPath);
        return targetPath;
      }
    } catch (err: any) {
      console.log(`[Video Compiler Server] Candidate URL failed or timed out: ${fontUrl} - ${err.message}. Trying next candidate...`);
    }
  }

  console.warn(`[Video Compiler Server] No bundled file and all network mirrors failed for style '${style}'. Falling back to Roboto-Bold.ttf — captions will not match the preview font for this style until /fonts/${fontInfo.name} is added.`);
  return defaultFontPath;
}

interface FFmpegSubtitleConfig {
  fontcolor: string;
  fontsize: number;
  borderw: number;
  bordercolor: string;
  box: number;
  boxcolor: string;
  boxborderw: number;
  yPos: string;
}

// Export frame width for caption metric scaling. Must match the 1080x1920
// (or 2160x3840 Pro) frame the FFmpeg pipeline renders into — captions are
// scaled against this so the exported video matches the editor preview.
const RENDER_FRAME_WIDTH = 1080;

function getFFmpegCaptionConfig(style: string, textLen: number, hasHighlight: boolean): FFmpegSubtitleConfig {
  // NOTE: All sizing/color/position numbers now come from
  // src/utils/captionStyleConfig.ts — the SAME table the browser preview
  // reads (see types.ts -> getCaptionStyles). Do not hardcode style
  // numbers here again; edit captionStyleConfig.ts instead, and both the
  // editor preview and the exported video will update together.
  const normalizedStyle = normalizeCaptionStyle(style);
  const metrics = resolveCaptionMetrics(normalizedStyle, textLen, RENDER_FRAME_WIDTH);

  return {
    fontcolor: hasHighlight ? metrics.highlightColor : metrics.textColor,
    fontsize: metrics.fontSize,
    borderw: metrics.strokeWidth,
    bordercolor: metrics.strokeColor === 'transparent' ? metrics.textColor : metrics.strokeColor,
    box: metrics.hasBox ? 1 : 0,
    boxcolor: metrics.boxColorFFmpeg || 'black@0.65',
    boxborderw: metrics.boxPadding,
    yPos: `h*${metrics.yPositionFraction}`,
  };
}

function wrapSubtitleText(text: string, style: string): string {
  // TikTok-optimized 9:16 vertical text wrapping guidelines (forces clean line-breaking on screen dimensions)
  let maxChars = 20;
  if (style === 'hormozi') {
    maxChars = 14;
  } else if (style === 'mrbeast') {
    maxChars = 18;
  } else if (style === 'minimalist') {
    maxChars = 26;
  } else if (style === 'impact') {
    maxChars = 18;
  } else if (style === 'comic') {
    maxChars = 14;
  }

  if (text.length <= maxChars) return text;

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length > maxChars) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += ' ' + word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

// SERVER-SIDE PREMIUM VIDEO COMPILER: Renders crop, color-grading, background music mix, and subtitles.
// Solves iframe sandbox blocks, browser lag, and missing AAC codecs by running native high-performance FFmpeg cli.
app.post('/api/render-project', upload.single('videoFile'), async (req, res) => {
  const duration = req.body.duration;
  const selectedMusicTrackId = req.body.selectedMusicTrackId;
  const colorGrade = req.body.colorGrade || 'none';
  const captionStyle = req.body.captionStyle || 'minimalist';
  const musicVolume = req.body.musicVolume !== undefined ? Number(req.body.musicVolume) : 0.5;
  const name = req.body.name || 'Project';
  const videoUrl = req.body.videoUrl;
  const startLimit = req.body.startLimit !== undefined ? Number(req.body.startLimit) : 0;
  const endLimitIn = req.body.endLimit !== undefined ? Number(req.body.endLimit) : null;
  const activeClipId = req.body.activeClipId || null;

  // Multi-cut segments: explicit keep-list from AI or user.
  // Shape: [{ start, end, speed?, reason? }, ...]
  // Falls back to highlights when not provided, preserving existing smart-cuts behavior.
  const segmentsRaw = req.body.segments;
  let segments: Segment[] = [];
  if (Array.isArray(segmentsRaw) && segmentsRaw.length > 0) {
    segments = segmentsRaw
      .map((s: any) => ({
        start: Number(s.start),
        end: Number(s.end),
        speed: s.speed ? Number(s.speed) : 1.0,
        reason: s.reason || '',
      }))
      .filter((s: Segment) => s.end > s.start && s.start >= 0);
  }

  const subtitlesRaw = req.body.subtitles;
  let subtitles = [];
  if (subtitlesRaw) {
    if (typeof subtitlesRaw === 'string') {
      try {
        subtitles = JSON.parse(subtitlesRaw);
      } catch (e) {
        console.warn('[Video Compiler Server] Error parsing subtitles JSON string:', e);
      }
    } else if (Array.isArray(subtitlesRaw)) {
      subtitles = subtitlesRaw;
    }
  }

  const zoomEffectsRaw = req.body.zoomEffects;
  let zoomEffects = [];
  if (zoomEffectsRaw) {
    if (typeof zoomEffectsRaw === 'string') {
      try {
        zoomEffects = JSON.parse(zoomEffectsRaw);
      } catch (e) {
        console.warn('[Video Compiler Server] Error parsing zoomEffects JSON:', e);
      }
    } else if (Array.isArray(zoomEffectsRaw)) {
      zoomEffects = zoomEffectsRaw;
    }
  }

  const highlightsRaw = req.body.highlights;
  let highlights: any[] = [];
  if (highlightsRaw) {
    if (typeof highlightsRaw === 'string') {
      try {
        highlights = JSON.parse(highlightsRaw);
      } catch (e) {
        console.warn('[Video Compiler Server] Error parsing highlights JSON string:', e);
      }
    } else if (Array.isArray(highlightsRaw)) {
      highlights = highlightsRaw;
    }
  }
  const transitionStyle = req.body.transitionStyle || 'flash';

  // Sanitize name with fixDunikTypo
  const fixedName = fixDunikTypo(name);

  // Map and fix any typos in subtitles received for rendering
  if (Array.isArray(subtitles)) {
    subtitles = subtitles.map((sub: any) => {
      if (sub && typeof sub.text === 'string') {
        const fixedText = fixDunikTypo(sub.text);
        let fixedHighlight = sub.highlightWords;
        if (Array.isArray(fixedHighlight)) {
          fixedHighlight = fixedHighlight.map((w: string) => fixDunikTypo(w));
        }
        return {
          ...sub,
          text: fixedText,
          highlightWords: fixedHighlight
        };
      }
      return sub;
    });
  }

  console.log(`[Video Compiler Server] Starting project rendering on server for "${name}"...`);

  const tracks = [
    { id: 'cyberpunk-synth', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 'lofi-sunset', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
    { id: 'cinematic-hype', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
    { id: 'vibrant-house', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' }
  ];

  const fontTempPath = path.join(os.tmpdir(), 'Roboto-Bold.ttf');
  const robotoBundledPath = path.join(BUNDLED_FONTS_DIR, 'Roboto-Bold.ttf');
  if (fs.existsSync(robotoBundledPath) && fs.statSync(robotoBundledPath).size > 5000) {
    fs.copyFileSync(robotoBundledPath, fontTempPath);
  } else if (!fs.existsSync(fontTempPath)) {
    const fontUrls = [
      'https://cdn.jsdelivr.net/npm/@roboto-font/roboto-ttf@1.0.3/dist/fonts/Roboto-Bold.ttf',
      'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.ttf',
      'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf',
      'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf',
      'https://raw.githubusercontent.com/googlefonts/roboto/master/src/hinted/Roboto-Bold.ttf',
      'https://github.com/googlefonts/roboto/raw/master/src/hinted/Roboto-Bold.ttf'
    ];
    for (const fontUrl of fontUrls) {
      try {
        console.log(`[Video Compiler Server] Retrieving standard typography from: ${fontUrl}`);
        const fontRes = await axios({
          method: 'get',
          url: fontUrl,
          responseType: 'arraybuffer',
          timeout: 10000
        });
        fs.writeFileSync(fontTempPath, Buffer.from(fontRes.data));
        console.log('[Video Compiler Server] Subtitle typography stored at:', fontTempPath);
        break;
      } catch (fontErr: any) {
        console.log(`[Video Compiler Server] Trying next font source, current source not used: ${fontUrl}`);
      }
    }
  }

  const dejavuTempPath = path.join(os.tmpdir(), 'DejaVuSans-Bold.ttf');
  const dejavuBundledPath = path.join(BUNDLED_FONTS_DIR, 'DejaVuSans-Bold.ttf');
  if (fs.existsSync(dejavuBundledPath) && fs.statSync(dejavuBundledPath).size > 5000) {
    fs.copyFileSync(dejavuBundledPath, dejavuTempPath);
  } else if (!fs.existsSync(dejavuTempPath) || fs.statSync(dejavuTempPath).size < 5000) {
    const dejavuUrls = [
      'https://unpkg.com/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf',
      'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf',
      'https://unpkg.com/@canvas-fonts/dejavu-sans@1.0.4/DejaVu%20Sans%20Bold.ttf',
      'https://raw.githubusercontent.com/shmup/shmup-fonts/master/DejaVuSans-Bold.ttf',
      'https://raw.githubusercontent.com/dejavu-fonts/dejavu-fonts/master/resources/DejaVuSans-Bold.ttf'
    ];
    for (const fontUrl of dejavuUrls) {
      try {
        console.log(`[Video Compiler Server] Retrieving emoji-capable symbol typography from: ${fontUrl}`);
        const fontRes = await axios({
          method: 'get',
          url: fontUrl,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000
        });
        if (fontRes.data && fontRes.data.byteLength > 5000) {
          fs.writeFileSync(dejavuTempPath, Buffer.from(fontRes.data));
          console.log('[Video Compiler Server] Emoji/symbol typography stored at:', dejavuTempPath);
          break;
        }
      } catch (fontErr: any) {
        console.log(`[Video Compiler Server] Emoji font source failed: ${fontUrl} - ${fontErr.message || fontErr}. Trying next...`);
      }
    }
  }

  const cleanSafeName = fixedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const inputTempPath = path.join(os.tmpdir(), `input_v_${Date.now()}.mp4`);
  const outputTempPath = path.join(os.tmpdir(), `output_v_${Date.now()}.mp4`);
  const musicTempPath = path.join(os.tmpdir(), `music_v_${Date.now()}.mp3`);
  const sfx1TempPath = path.join(os.tmpdir(), `sfx1_${Date.now()}.ogg`);
  const sfx2TempPath = path.join(os.tmpdir(), `sfx2_${Date.now()}.ogg`);
  const sfx3TempPath = path.join(os.tmpdir(), `sfx3_${Date.now()}.ogg`);

  let videoDownloaded = false;

  // Handle uploaded file first
  if (req.file) {
    try {
      console.log(`[Video Compiler Server] Writing uploaded binary file to disk. Size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
      fs.writeFileSync(inputTempPath, req.file.buffer);
      videoDownloaded = true;
    } catch (writeErr: any) {
      console.error('[Video Compiler Server] Failed writing uploaded file to temporary disk path:', writeErr);
    }
  } else if (videoUrl && !videoUrl.startsWith('blob:') && !videoUrl.startsWith('data:')) {
    // Attempt download of the exact user video URL using robust rotating header sets
    videoDownloaded = await downloadFileWithRetries(videoUrl, inputTempPath, 10000);
  }

  // IMPORTANT: There is intentionally no "backup footage" fallback here.
  // A previous version of this endpoint substituted unrelated stock video
  // clips (e.g. Big Buck Bunny) when the user's own source video failed to
  // download, and rendered captions/music on top of THAT instead — silently
  // handing the user a video that wasn't theirs, with no error shown.
  // If we can't get the user's actual footage, we must fail loudly so the
  // client can show a clear, actionable error instead of a wrong video.
  if (!videoDownloaded) {
    console.error('[Video Compiler Server] Could not obtain the user\'s source video — failing the request rather than substituting different footage.');
    return res.status(502).json({
      success: false,
      error: 'We could not download your source video. Please re-upload the file directly instead of linking to it, then try exporting again.'
    });
  }

  let hasMusic = false;
  const clientMusicUrl = req.body.selectedMusicTrackUrl;
  const musicTrackCandidate = tracks.find(t => t.id === selectedMusicTrackId);
  const musicUrlToDownload = clientMusicUrl || (musicTrackCandidate ? musicTrackCandidate.url : null);

  if (selectedMusicTrackId && selectedMusicTrackId !== 'none' && musicUrlToDownload) {
    try {
      console.log(`[Video Compiler Server] Buffering back music track using robust utility: ${musicUrlToDownload}`);
      hasMusic = await downloadFileWithRetries(musicUrlToDownload, musicTempPath, 10000);
      if (hasMusic) {
        console.log(`[Video Compiler Server] Music buffered successfully.`);
      } else {
        console.log(`[Video Compiler Server] Music buffering check or retrieval skipped.`);
      }
    } catch (musicErr: any) {
      console.log(`[Video Compiler Server] Background soundtrack buffering skipped: ${musicErr.message}`);
    }
  }

  // Sound Effects (SFX) Bufferer - completely configurable and smart
  const sfxWhooshEnabled = req.body.sfxWhooshEnabled === 'true' || req.body.sfxWhooshEnabled === true;
  const sfxPopEnabled = req.body.sfxPopEnabled === 'true' || req.body.sfxPopEnabled === true;
  const sfxImpactEnabled = req.body.sfxImpactEnabled === 'true' || req.body.sfxImpactEnabled === true;
  const sfxWhooshUrl = req.body.sfxWhooshUrl;
  const sfxPopUrl = req.body.sfxPopUrl;
  const sfxImpactUrl = req.body.sfxImpactUrl;

  let hasSFX1 = false;
  let hasSFX2 = false;
  let hasSFX3 = false;

  const isUnboxingSalesOrProduct = name.toLowerCase().includes('unbox') ||
                                   name.toLowerCase().includes('product') ||
                                   name.toLowerCase().includes('sling') ||
                                   name.toLowerCase().includes('shoe') ||
                                   name.toLowerCase().includes('bag') ||
                                   fixedName.toLowerCase().includes('pitch') ||
                                   fixedName.toLowerCase().includes('sales');

  // Content-aware SFX selection: if the client provides content-based SFX
  // decisions from vision/transcript analysis, use those instead of the
  // legacy filename-keyword heuristic.
  const contentSfx = (req.body.contentSfx && typeof req.body.contentSfx === 'object') ? req.body.contentSfx : null;

  if (sfxWhooshEnabled && sfxWhooshUrl) {
    try {
      console.log(`[Video Compiler Server] Smart Sound Decision -> Buffering Whoosh: ${sfxWhooshUrl}`);
      hasSFX1 = await downloadFileWithRetries(sfxWhooshUrl, sfx1TempPath, 1500);
    } catch (sfxErr1: any) {
      console.log(`[Video Compiler Server] Whoosh SFX download skipped: ${sfxErr1.message}`);
    }
  }

  if (sfxPopEnabled && sfxPopUrl) {
    try {
      console.log(`[Video Compiler Server] Smart Sound Decision -> Buffering Pop/Click: ${sfxPopUrl}`);
      hasSFX2 = await downloadFileWithRetries(sfxPopUrl, sfx2TempPath, 1500);
    } catch (sfxErr2: any) {
      console.log(`[Video Compiler Server] Pop SFX download skipped: ${sfxErr2.message}`);
    }
  }

  if (sfxImpactEnabled && sfxImpactUrl) {
    try {
      console.log(`[Video Compiler Server] Smart Sound Decision -> Buffering Impact: ${sfxImpactUrl}`);
      hasSFX3 = await downloadFileWithRetries(sfxImpactUrl, sfx3TempPath, 1500);
    } catch (sfxErr3: any) {
      console.log(`[Video Compiler Server] Impact SFX download skipped: ${sfxErr3.message}`);
    }
  }

  const ffmpegPath = getFFmpegPath();
  const probeCmd = `"${ffmpegPath}" -i "${inputTempPath}"`;
  exec(probeCmd, async (probeErr, probeStdout, probeStderr) => {
    try {
      const metadata = (probeStdout || '') + (probeStderr || '');
      const hasAudio = /Stream #\d+:\d+.*Audio/i.test(metadata);
      console.log(`[Video Compiler Server] Audio verification stream: hasAudio=${hasAudio}`);

      // Silence detection: find near-silent stretches to auto-cut
      const silenceThreshold = req.body.silenceThreshold || '-30dB';
      const silenceMinDuration = req.body.silenceMinDuration || '0.5';
      let detectedSilences: Array<{ start: number; end: number }> = [];
      if (req.body.enableSilenceDetection !== 'false') {
        try {
          const silenceCmd = `"${ffmpegPath}" -i "${inputTempPath}" -af silencedetect=noise=${silenceThreshold}:d=${silenceMinDuration} -f null -`;
          const silenceOut = await new Promise<string>((resolve) => {
            exec(silenceCmd, (_, stdout, stderr) => resolve((stdout || '') + (stderr || '')));
          });
          const silenceMatches = [...silenceOut.matchAll(/silence_start:\s*([\d.]+)/g)];
          const silenceEnds = [...silenceOut.matchAll(/silence_end:\s*([\d.]+)/g)];
          for (let i = 0; i < silenceMatches.length && i < silenceEnds.length; i++) {
            const s = parseFloat(silenceMatches[i][1]);
            const e = parseFloat(silenceEnds[i][1]);
            if (e - s >= parseFloat(silenceMinDuration)) {
              detectedSilences.push({ start: s, end: e });
            }
          }
          console.log(`[Video Compiler Server] Detected ${detectedSilences.length} silent segments`);
        } catch (silenceErr: any) {
          console.warn('[Video Compiler Server] Silence detection failed:', silenceErr.message);
        }
      }

      let activeSubtitles = subtitles;
      let activeZoomEffects = zoomEffects;
      const isSegmented = segments.length > 0 || (activeClipId === 'smart-cuts' && highlights && highlights.length > 0);
      let calculatedSmartCutsDuration = 0;

      // Build the canonical keep-list: explicit segments first, then legacy highlights fallback
      const keepList: Segment[] = segments.length > 0
        ? segments
        : (highlights || []).map((hl: any) => ({
            start: Number(hl.start),
            end: Number(hl.end),
            speed: hl.speed ? Number(hl.speed) : 1.0,
            reason: hl.description || '',
          }));

      if (isSegmented) {
        console.log(`[Video Compiler Server] Segmented compilation activated with ${keepList.length} clips.`);
        const remappedSubtitles: any[] = [];
        const remappedZoomEffects: any[] = [];
        let elapsed = 0;

        keepList.forEach((seg: Segment) => {
          const speed = seg.speed || 1.0;
          const hlDur = (seg.end - seg.start) / speed;

          subtitles.forEach((sub: any) => {
            const subStart = Number(sub.start || 0);
            const subEnd = Number(sub.end || subStart + 1.5);
            if (subEnd > seg.start && subStart < seg.end) {
              const clampedStart = Math.max(seg.start, subStart);
              const clampedEnd = Math.min(seg.end, subEnd);
              if (clampedEnd > clampedStart) {
                remappedSubtitles.push({
                  ...sub,
                  start: (clampedStart - seg.start) / speed + elapsed,
                  end: (clampedEnd - seg.start) / speed + elapsed
                });
              }
            }
          });

          zoomEffects.forEach((z: any) => {
            const zTS = Number(z.timestamp || 0);
            const zDuration = Number(z.duration || 1.5);
            const zEnd = zTS + zDuration;
            if (zEnd > seg.start && zTS < seg.end) {
              const clampedTS = Math.max(seg.start, zTS);
              const clampedEnd = Math.min(seg.end, zEnd);
              if (clampedEnd > clampedTS) {
                remappedZoomEffects.push({
                  ...z,
                  timestamp: (clampedTS - seg.start) / speed + elapsed,
                  duration: (clampedEnd - clampedTS) / speed
                });
              }
            }
          });

          elapsed += hlDur;
        });

        activeSubtitles = remappedSubtitles;
        activeZoomEffects = remappedZoomEffects;
        calculatedSmartCutsDuration = elapsed;
        console.log(`[Video Compiler Server] Segmented cuts remapped ${activeSubtitles.length} subtitles and ${activeZoomEffects.length} zoom effects. Total output length: ${calculatedSmartCutsDuration.toFixed(2)}s`);
      }

      let localStartLimit = startLimit;
      let endLimit = endLimitIn !== null ? Number(endLimitIn) : (Number(duration) || 30);

      // Robust physical file duration parser from FFmpeg probe logs
      let fileDuration = 0;
      const durationMatch = metadata.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (durationMatch) {
        const hrs = parseInt(durationMatch[1], 10);
        const mins = parseInt(durationMatch[2], 10);
        const secs = parseFloat(durationMatch[3]);
        fileDuration = hrs * 3600 + mins * 60 + secs;
        console.log(`[Video Compiler Server] Parsed physical input video file duration: ${fileDuration}s`);
      }

      // Force FULL video duration based on the actual physical file duration to bypass any short preview / sample caps ONLY when we are exporting the full video
      if (isSegmented) {
        localStartLimit = 0;
        endLimit = calculatedSmartCutsDuration;
      } else {
        if (!activeClipId && fileDuration > 0) {
          endLimit = fileDuration;
        } else if (fileDuration > 0 && endLimit > fileDuration) {
          endLimit = fileDuration;
        }
      }
      const trimDuration = endLimit - localStartLimit;
      console.log(`[Video Compiler Server] Verification -> Input duration: ${fileDuration || endLimit} seconds | Output duration: ${trimDuration} seconds`);

      // Download or verify style-specific font
      const fontOptionPath = await getFontForStyle(captionStyle);

      // 1. Build the crop scale formulas to execute dynamic visual zooms (pans and closeups on key details)
      let cropWExpr = 'iw';
      let cropHExpr = 'ih';

      if (activeZoomEffects && activeZoomEffects.length > 0) {
        activeZoomEffects.forEach((z: any) => {
          const start = Number(z.timestamp) - localStartLimit;
          const end = start + Number(z.duration);
          if (end > 0 && start < trimDuration) {
            cropWExpr = `if(between(t,${start.toFixed(2)},${end.toFixed(2)}),iw/${z.scale},${cropWExpr})`;
            cropHExpr = `if(between(t,${start.toFixed(2)},${end.toFixed(2)}),ih/${z.scale},${cropHExpr})`;
          }
        });
      }

      // Center-aligned cropping visual zooms
      let vf = `crop=w='${cropWExpr}':h='${cropHExpr}'`;

      // 2. Adaptive Deshake Video Stabilization for raw handheld smartphone recordings
      if (isUnboxingSalesOrProduct) {
        vf += ',deshake';
      }

      // 3. Scale and fit vertically (Standard 1080p or Pro 4K)
      const isProExport = req.body.isProExport === 'true' || req.body.isProExport === true;
      const targetRes = isProExport ? '2160:3840' : '1080:1920';
      
      vf += `,scale=${targetRes}:force_original_aspect_ratio=decrease,pad=${targetRes}:(ow-iw)/2:(oh-ih)/2:black`;

      // 4. Pro Motion Smoothing (Paid Feature - 60FPS conversion)
      if (isProExport) {
        vf += `,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`;
      }

      // 4. Premium color grading (high-contrast, luxury vibrant look)
      if (colorGrade !== 'none') {
        if (colorGrade === 'cinematic') {
          vf += ',eq=contrast=1.18:saturation=1.15:brightness=0.01';
        } else if (colorGrade === 'warm_vintage') {
          vf += ',eq=contrast=0.96:saturation=0.82,colorbalance=rh=0.12:gh=0.06:bh=-0.08';
        } else if (colorGrade === 'vibrant_pop') {
          vf += ',eq=contrast=1.16:saturation=1.45,colorbalance=rh=0.04:bh=0.07';
        } else if (colorGrade === 'moody_cyber') {
          vf += ',eq=contrast=1.15:saturation=1.2,colorbalance=rh=-0.05:bh=0.10';
        }
      } else if (isUnboxingSalesOrProduct) {
        // Force epic high-contrast luxury vibrant pop lookup for unboxing styles
        vf += ',eq=contrast=1.16:saturation=1.45,colorbalance=rh=0.04:bh=0.07';
      }

      // Escape subtitles string helper - robust, immune to single quotes, colons, and formatting crashes
      const escapeFFmpegText = (str: string) => {
        return str
          .replace(/\\/g, '') // Strip backslashes to avoid any escape sequence corruption
          .replace(/'/g, '’') // Replace straight single quotes with curly apostrophes (completely safe inside single-quoted strings)
          .replace(/"/g, '”') // Replace straight double quotes with curly quotes
          .replace(/:/g, ' -') // Replace colons with a safe space and dash to prevent FFmpeg option parsing confusion
          .replace(/%/g, ' percent') // Replace percent sign to prevent invalid format specifier evaluations
          .replace(/\r?\n/g, '\n'); // Maintain literal newlines which work flawlessly for multiline rendering
      };

      // 5. Overlay Burned-in Subtitles
      if (activeSubtitles && activeSubtitles.length > 0) {
        activeSubtitles.forEach((sub: any) => {
          if (!sub || typeof sub.text !== 'string') return;
          const subStart = Number(sub.start || 0) - localStartLimit;
          const subEnd = Number(sub.end || 0) - localStartLimit;
          if (subEnd > 0 && subStart < trimDuration) {
            const displayStart = Math.max(0, subStart);
            const displayEnd = Math.min(trimDuration, subEnd);
            
            // Append emoji to text if available to maintain "full package" visual parity with the player
            let styledString = sub.text;
            if (sub.emoji) {
              styledString += " " + sub.emoji;
            }

            const hasEmoji = !!sub.emoji || /[\u{1F300}-\u{1F6FF}]/u.test(styledString);
            let chosenFontPath = (hasEmoji && fs.existsSync(dejavuTempPath) && fs.statSync(dejavuTempPath).size > 5000) ? dejavuTempPath : fontOptionPath;

            if (!fs.existsSync(chosenFontPath)) {
              const sysFont = getSystemFontFallback();
              if (sysFont) {
                chosenFontPath = sysFont;
              }
            }

            // If we are NOT using the emoji-compatible font (DejaVu), strip emojis to prevent tofu boxes
            const isUsingDejavu = chosenFontPath === dejavuTempPath;
            if (!isUsingDejavu) {
              try {
                styledString = styledString.replace(/\p{Extended_Pictographic}/gu, '');
                styledString = styledString.replace(/\p{Emoji}/gu, '');
              } catch (regexErr) {
                styledString = styledString.replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                                           .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
                                           .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
                                           .replace(/[\u{2600}-\u{27BF}]/gu, '');
              }
            }
            styledString = styledString.replace(/\s+/g, ' ').trim();
            if (!styledString) return;

            // Apply exact same text transforms (uppercase) to maintain high-impact alignment
            if (captionStyle === 'mrbeast' || captionStyle === 'hormozi' || captionStyle === 'impact' || captionStyle === 'comic') {
              styledString = styledString.toUpperCase();
            }

            // Apply TikTok-optimized 9:16 multiline wrapping to prevent text from overflowing screen boundaries
            styledString = wrapSubtitleText(styledString, captionStyle);

            const cleanText = escapeFFmpegText(styledString);

            const hasHighlight = Array.isArray(sub.highlightWords) && sub.highlightWords.length > 0;
            const config = getFFmpegCaptionConfig(captionStyle, sub.text.length, hasHighlight);

            const escapedFontPath = chosenFontPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            const fontOption = fs.existsSync(chosenFontPath) ? `:fontfile='${escapedFontPath}'` : '';

            let boxAttr = '';
            if (config.box === 1) {
              boxAttr = `:box=1:boxcolor='${config.boxcolor}':boxborderw=${config.boxborderw}`;
            }

            vf += `,drawtext=text='${cleanText}':fontcolor='${config.fontcolor}':fontsize=${config.fontsize}:borderw=${config.borderw}:bordercolor='${config.bordercolor}'${boxAttr}${fontOption}:x=(w-text_w)/2:y=${config.yPos}-th/2:enable='between(t,${displayStart.toFixed(2)},${displayEnd.toFixed(2)})'`;
          }
        });
      }

      // Construct FFmpeg dynamic compile arguments using dynamic track index counter
      const compileArgs: string[] = ['-y'];

      const isFullVideo = localStartLimit === 0 && (fileDuration === 0 || trimDuration >= fileDuration - 0.1);

      if (!isFullVideo && !isSegmented) {
        compileArgs.push('-ss', `${localStartLimit}`);
        compileArgs.push('-t', `${trimDuration}`);
      }

      // Input 0: Main Video Footage
      compileArgs.push('-i', inputTempPath);
      let currentInputIdx = 1;

      // Input 1: Background Soundtrack (optional)
      let musicInputIdx = -1;
      if (hasMusic) {
        compileArgs.push('-i', musicTempPath);
        musicInputIdx = currentInputIdx;
        currentInputIdx++;
      }

      // Input For Sound Effects (Whoosh, Rustle, Blast Reveal)
      let sfx1InputIdx = -1;
      if (hasSFX1) {
        compileArgs.push('-i', sfx1TempPath);
        sfx1InputIdx = currentInputIdx;
        currentInputIdx++;
      }
      let sfx2InputIdx = -1;
      if (hasSFX2) {
        compileArgs.push('-i', sfx2TempPath);
        sfx2InputIdx = currentInputIdx;
        currentInputIdx++;
      }
      let sfx3InputIdx = -1;
      if (hasSFX3) {
        compileArgs.push('-i', sfx3TempPath);
        sfx3InputIdx = currentInputIdx;
        currentInputIdx++;
      }

      // Video filtering is integrated directly inside the filter_complex graph below

      // Build out lists of dynamic timestamps for Sound Effect (SFX) triggers
      // Content-aware mode: use client-provided timestamps from vision/transcript analysis.
      // Fallback mode: use heuristic timestamps based on segments, zooms, and subtitles.
      const whooshTimes: number[] = contentSfx?.whooshAt && contentSfx.whooshAt.length > 0
        ? contentSfx.whooshAt.map((t: any) => Number(t)).filter((t: number) => t > 0 && t < trimDuration)
        : (() => {
            const times: number[] = [0.5];
            if (isSegmented && keepList.length > 1) {
              let elapsed = 0;
              for (let i = 0; i < keepList.length - 1; i++) {
                const speed = Number(keepList[i].speed) || 1.0;
                const hlDur = (Number(keepList[i].end) - Number(keepList[i].start)) / speed;
                elapsed += hlDur;
                times.push(elapsed);
              }
            } else if (activeZoomEffects && activeZoomEffects.length > 0) {
              activeZoomEffects.forEach((z: any) => {
                const t = Number(z.timestamp) - localStartLimit;
                if (t > 0.1 && t < trimDuration && !times.includes(t)) times.push(t);
              });
            }
            return times;
          })();

      const popTimes: number[] = contentSfx?.popAt && contentSfx.popAt.length > 0
        ? contentSfx.popAt.map((t: any) => Number(t)).filter((t: number) => t > 0 && t < trimDuration)
        : (() => {
            const times: number[] = [];
            if (activeSubtitles && activeSubtitles.length > 0) {
              activeSubtitles.forEach((sub: any) => {
                const t = Number(sub.start) - localStartLimit;
                if (t > 0.1 && t < trimDuration) {
                  const hasEmoji = !!sub.emoji || /[\u{1F300}-\u{1F6FF}]/u.test(sub.text);
                  if (hasEmoji) times.push(t);
                }
              });
              if (times.length === 0) {
                activeSubtitles.forEach((sub: any, idx: number) => {
                  const t = Number(sub.start) - localStartLimit;
                  if (t > 0.1 && t < trimDuration && idx % 3 === 0) times.push(t);
                });
              }
            }
            return times.length > 0 ? times : [4.0];
          })();

      let outroTime = trimDuration * 0.85;
      if (activeSubtitles && activeSubtitles.length > 0) {
        const lastSub = activeSubtitles[activeSubtitles.length - 1];
        if (lastSub) {
          const t = Number(lastSub.start) - localStartLimit;
          if (t > 0.1 && t < trimDuration) {
            outroTime = t;
          }
        }
      }

      const impactTimes: number[] = contentSfx?.impactAt && contentSfx.impactAt.length > 0
        ? contentSfx.impactAt.map((t: any) => Number(t)).filter((t: number) => t > 0 && t < trimDuration)
        : [0.2, outroTime];

      // Build out perfect mixed audio channel with clean noise suppression gating filters
      const filterComplexParts: string[] = [];

      if (isSegmented) {
        // First we register the smart cuts concatenation filters inside filterComplexParts
        let smartCutsFilter = '';
        keepList.forEach((seg: any, idx: number) => {
          const speed = Number(seg.speed) || 1.0;
          const videoPtsEx = (1.0 / speed).toFixed(4);
          smartCutsFilter += `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=(PTS-STARTPTS)*${videoPtsEx}[vhl${idx}];`;
          if (hasAudio) {
            const clampedAtempo = Math.max(0.5, Math.min(2.0, speed)).toFixed(4);
            smartCutsFilter += `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS,atempo=${clampedAtempo}[ahl${idx}];`;
          }
        });
        let concatedPads = '';
        if (hasAudio) {
          concatedPads = keepList.map((_, idx) => `[vhl${idx}][ahl${idx}]`).join('');
          smartCutsFilter += `${concatedPads}concat=n=${keepList.length}:v=1:a=1[vconc_raw][aconc_raw]`;
        } else {
          concatedPads = keepList.map((_, idx) => `[vhl${idx}]`).join('');
          smartCutsFilter += `${concatedPads}concat=n=${keepList.length}:v=1:a=0[vconc_raw]`;
        }
        filterComplexParts.push(smartCutsFilter);

        // Build transitions overlay: Aligns mathematically with speed-scaled clip durations
        let transitionsFilter = '';
        if (keepList.length > 1) {
          let elapsed = 0;
          for (let i = 0; i < keepList.length - 1; i++) {
            const speed = Number(keepList[i].speed) || 1.0;
            const hlDur = (Number(keepList[i].end) - Number(keepList[i].start)) / speed;
            elapsed += hlDur;
            
            if (transitionStyle === 'flash') {
              transitionsFilter += `,drawbox=y=0:color=white@0.85:t=fill:enable='between(t,${(elapsed - 0.08).toFixed(2)},${(elapsed + 0.12).toFixed(2)})'`;
            } else if (transitionStyle === 'glitch') {
              transitionsFilter += `,eq=contrast=2.2:saturation=0.1:brightness=0.15:enable='between(t,${(elapsed - 0.1).toFixed(2)},${(elapsed + 0.12).toFixed(2)})'`;
            } else if (transitionStyle === 'fade_black') {
              transitionsFilter += `,drawbox=y=0:color=black:t=fill:enable='between(t,${(elapsed - 0.1).toFixed(2)},${(elapsed + 0.1).toFixed(2)})'`;
            } else if (transitionStyle === 'zoom') {
              const transStart = elapsed - 0.15;
              const transEnd = elapsed + 0.15;
              transitionsFilter += `,crop=w='if(between(t,${transStart.toFixed(2)},${transEnd.toFixed(2)}),iw/1.25,iw)':h='if(between(t,${transStart.toFixed(2)},${transEnd.toFixed(2)}),ih/1.25,ih)',scale=1080:1920`;
            }
          }
        }
        filterComplexParts.push(`[vconc_raw]${vf}${transitionsFilter}[vout_processed]`);
      } else {
        filterComplexParts.push(`[0:v]${vf}[vout_processed]`);
      }

      // 1. Process original audio channel with premium cleanup (High-pass, low-pass, dynamic noise suppression layout)
      let origAudioLabel = '[0:a]';
      if (isSegmented) {
        if (hasAudio) {
          filterComplexParts.push(`[aconc_raw]volume=1.0,afftdn,highpass=f=80,lowpass=f=15000,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanorig]`);
          origAudioLabel = '[cleanorig]';
        } else {
          filterComplexParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${trimDuration.toFixed(4)}[cleanorig]`);
          origAudioLabel = '[cleanorig]';
        }
      } else {
        if (hasAudio) {
          filterComplexParts.push(`[0:a]volume=1.0,afftdn,highpass=f=80,lowpass=f=15000,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanorig]`);
          origAudioLabel = '[cleanorig]';
        } else {
          filterComplexParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${trimDuration.toFixed(4)}[cleanorig]`);
          origAudioLabel = '[cleanorig]';
        }
      }

      // 2. Process background music track with optional audio ducking under speech
      let musicLabel = '';
      if (hasMusic && musicInputIdx !== -1) {
        const duckingEnabled = req.body.enableAudioDucking !== 'false';
        if (duckingEnabled && hasAudio) {
          filterComplexParts.push(`[${musicInputIdx}:a]volume=${Number(musicVolume) * 0.45},sidechaincompress=threshold=0.02:ratio=20:attack=100:release=1000[cleanmusic]`);
        } else {
          filterComplexParts.push(`[${musicInputIdx}:a]volume=${Number(musicVolume) * 0.45},aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanmusic]`);
        }
        musicLabel = '[cleanmusic]';
      }

      // 3. Process Sound Effects using high-efficiency split-delay-mix filter complexes
      let sfx1Label = '';
      if (hasSFX1 && sfx1InputIdx !== -1 && whooshTimes.length > 0) {
        const count = whooshTimes.length;
        // Match stereo configuration and sample rate prior to splitting & delay offsets
        let sfx1SubFilter = `[${sfx1InputIdx}:a]aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[sfx1stereo];`;
        if (count > 1) {
          const splits = Array.from({ length: count }, (_, idx) => `[wspl${idx}]`).join('');
          const delayed = Array.from({ length: count }, (_, idx) => `[wdel${idx}]`).join('');
          sfx1SubFilter += `[sfx1stereo]asplit=${count}${splits};`;
          whooshTimes.forEach((t, idx) => {
            const delayMs = Math.round(t * 1000);
            sfx1SubFilter += `[wspl${idx}]adelay=${delayMs}|${delayMs}[wdel${idx}];`;
          });
          sfx1SubFilter += `${delayed}amix=inputs=${count}:duration=first,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleansfx1]`;
        } else {
          const delayMs = Math.round(whooshTimes[0] * 1000);
          sfx1SubFilter += `[sfx1stereo]adelay=${delayMs}|${delayMs},aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleansfx1]`;
        }
        
        filterComplexParts.push(sfx1SubFilter);
        sfx1Label = '[cleansfx1]';
      }

      let sfx2Label = '';
      if (hasSFX2 && sfx2InputIdx !== -1 && popTimes.length > 0) {
        const count = popTimes.length;
        let sfx2SubFilter = `[${sfx2InputIdx}:a]aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[sfx2stereo];`;
        if (count > 1) {
          const splits = Array.from({ length: count }, (_, idx) => `[pspl${idx}]`).join('');
          const delayed = Array.from({ length: count }, (_, idx) => `[pdel${idx}]`).join('');
          sfx2SubFilter += `[sfx2stereo]asplit=${count}${splits};`;
          popTimes.forEach((t, idx) => {
            const delayMs = Math.round(t * 1000);
            sfx2SubFilter += `[pspl${idx}]adelay=${delayMs}|${delayMs}[pdel${idx}];`;
          });
          sfx2SubFilter += `${delayed}amix=inputs=${count}:duration=first,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleansfx2]`;
        } else {
          const delayMs = Math.round(popTimes[0] * 1000);
          sfx2SubFilter += `[sfx2stereo]adelay=${delayMs}|${delayMs},aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleansfx2]`;
        }
        
        filterComplexParts.push(sfx2SubFilter);
        sfx2Label = '[cleansfx2]';
      }

      let sfx3Label = '';
      if (hasSFX3 && sfx3InputIdx !== -1 && impactTimes.length > 0) {
        const count = impactTimes.length;
        let sfx3SubFilter = `[${sfx3InputIdx}:a]aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[sfx3stereo];`;
        if (count > 1) {
          const splits = Array.from({ length: count }, (_, idx) => `[ispl${idx}]`).join('');
          const delayed = Array.from({ length: count }, (_, idx) => `[idel${idx}]`).join('');
          sfx3SubFilter += `[sfx3stereo]asplit=${count}${splits};`;
          impactTimes.forEach((t, idx) => {
            const delayMs = Math.round(t * 1000);
            sfx3SubFilter += `[ispl${idx}]adelay=${delayMs}|${delayMs}[idel${idx}];`;
          });
          sfx3SubFilter += `${delayed}amix=inputs=${count}:duration=first,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleansfx3]`;
        } else {
          const delayMs = Math.round(impactTimes[0] * 1000);
          sfx3SubFilter += `[sfx3stereo]adelay=${delayMs}|${delayMs},aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleansfx3]`;
        }
        
        filterComplexParts.push(sfx3SubFilter);
        sfx3Label = '[cleansfx3]';
      }

      // Sync and mix all active audio sources
      const mixInputs: string[] = [origAudioLabel];
      if (musicLabel) mixInputs.push(musicLabel);
      if (sfx1Label) mixInputs.push(sfx1Label);
      if (sfx2Label) mixInputs.push(sfx2Label);
      if (sfx3Label) mixInputs.push(sfx3Label);

      if (mixInputs.length > 1) {
        filterComplexParts.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[aout]`);
      } else {
        filterComplexParts.push(`${mixInputs[0]}aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[aout]`);
      }

      compileArgs.push('-filter_complex', filterComplexParts.join(';'));
      compileArgs.push('-map', '[vout_processed]');
      compileArgs.push('-map', '[aout]');

      if (hasMusic || hasSFX1 || hasSFX2 || hasSFX3) {
        compileArgs.push('-shortest'); // force end when video stream ends
      }

      // High quality, 30fps constant rate constant-factor-ratio and faststart metadata indices relocation
      compileArgs.push(
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-b:v', '5500k',
        '-maxrate', '6500k',
        '-bufsize', '12000k',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        outputTempPath
      );

      runFFmpeg(compileArgs)
        .then(async () => {
          // Clean up primary inputs
          try { fs.unlinkSync(inputTempPath); } catch {}
          try { fs.unlinkSync(musicTempPath); } catch {}
          try { fs.unlinkSync(sfx1TempPath); } catch {}
          try { fs.unlinkSync(sfx2TempPath); } catch {}
          try { fs.unlinkSync(sfx3TempPath); } catch {}

          console.log(`[Video Compiler Server] Video composite completed with success. Sending file: ${outputTempPath}`);
          
          // Validate output: probe the rendered file to confirm it's a valid video
          try {
            const probeCmd = `"${ffmpegPath}" -i "${outputTempPath}"`;
            const probeOut = await new Promise<string>((resolve) => {
              exec(probeCmd, (_, stdout, stderr) => resolve((stdout || '') + (stderr || '')));
            });
            const durMatch = probeOut.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
            const outDuration = durMatch ? (parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3])) : 0;
            const outSize = fs.statSync(outputTempPath).size;
            
            if (outSize < 50000 || outDuration < 0.5) {
              throw new Error(`Output validation failed: size=${outSize}, duration=${outDuration}`);
            }
            console.log(`[Video Compiler Server] Output validated: ${outDuration.toFixed(2)}s, ${(outSize/1024/1024).toFixed(2)}MB`);
          } catch (validationErr: any) {
            console.error('[Video Compiler Server] Output validation failed:', validationErr.message);
            // Fall through to send the file anyway — the client will validate on its end
          }

          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Disposition', `attachment; filename="${cleanSafeName}_edited.mp4"`);
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');

          res.sendFile(outputTempPath, (sendErr) => {
            if (sendErr) {
              console.error('[Video Compiler Server] Failed streaming compiled response:', sendErr);
            }
            try { fs.unlinkSync(outputTempPath); } catch {}
          });
        })
        .catch(async (err) => {
          console.warn('[Video Compiler Server] Primary subtitle rendering crashed. Activating ultra-safe subtitle-free rendering fallback to guarantee output...', err.message);
          
          try {
            // Build safe fallback filter complex without drawtext and zoom complex curves
            let fallbackVf = `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`;
            if (colorGrade !== 'none') {
              if (colorGrade === 'cinematic') {
                fallbackVf += ',eq=contrast=1.18:saturation=1.15:brightness=0.01';
              } else if (colorGrade === 'warm_vintage') {
                fallbackVf += ',eq=contrast=0.96:saturation=0.82';
              } else {
                fallbackVf += ',eq=contrast=1.16:saturation=1.45';
              }
            }

            const fallbackComplexParts: string[] = [];
            if (isSegmented) {
              let smartCutsFilter = '';
              keepList.forEach((seg: any, idx: number) => {
                const speed = Number(seg.speed) || 1.0;
                const videoPtsEx = (1.0 / speed).toFixed(4);
                smartCutsFilter += `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=(PTS-STARTPTS)*${videoPtsEx}[vhl${idx}];`;
                if (hasAudio) {
                  const clampedAtempo = Math.max(0.5, Math.min(2.0, speed)).toFixed(4);
                  smartCutsFilter += `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS,atempo=${clampedAtempo}[ahl${idx}];`;
                }
              });
              let concatedPads = '';
              if (hasAudio) {
                concatedPads = keepList.map((_, idx) => `[vhl${idx}][ahl${idx}]`).join('');
                smartCutsFilter += `${concatedPads}concat=n=${keepList.length}:v=1:a=1[vconc_raw][aconc_raw]`;
              } else {
                concatedPads = keepList.map((_, idx) => `[vhl${idx}]`).join('');
                smartCutsFilter += `${concatedPads}concat=n=${keepList.length}:v=1:a=0[vconc_raw]`;
              }
              fallbackComplexParts.push(smartCutsFilter);
              fallbackComplexParts.push(`[vconc_raw]${fallbackVf}[vout_processed]`);
            } else {
              fallbackComplexParts.push(`[0:v]${fallbackVf}[vout_processed]`);
            }

            // Simple audio fallback
            let fallbackOrigLabel = '[0:a]';
            if (isSegmented) {
              if (hasAudio) {
                fallbackComplexParts.push(`[aconc_raw]volume=1.0,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanorig]`);
                fallbackOrigLabel = '[cleanorig]';
              } else {
                fallbackComplexParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${trimDuration.toFixed(4)}[cleanorig]`);
                fallbackOrigLabel = '[cleanorig]';
              }
            } else {
              if (hasAudio) {
                fallbackComplexParts.push(`[0:a]volume=1.0,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanorig]`);
                fallbackOrigLabel = '[cleanorig]';
              } else {
                fallbackComplexParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100:d=${trimDuration.toFixed(4)}[cleanorig]`);
                fallbackOrigLabel = '[cleanorig]';
              }
            }

            const fallbackMixInputs: string[] = [fallbackOrigLabel];
            let fallbackMusicLabel = '';
            if (hasMusic && musicInputIdx !== -1) {
              fallbackComplexParts.push(`[${musicInputIdx}:a]volume=${Number(musicVolume) * 0.45},aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanmusic_fb]`);
              fallbackMusicLabel = '[cleanmusic_fb]';
              fallbackMixInputs.push(fallbackMusicLabel);
            }

            if (fallbackMixInputs.length > 1) {
              fallbackComplexParts.push(`${fallbackMixInputs.join('')}amix=inputs=${fallbackMixInputs.length}:duration=first,aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[aout]`);
            } else {
              fallbackComplexParts.push(`${fallbackMixInputs[0]}aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[aout]`);
            }

            const fallbackArgs: string[] = ['-y'];
            if (!isFullVideo && !isSegmented) {
              fallbackArgs.push('-ss', `${localStartLimit}`);
              fallbackArgs.push('-t', `${trimDuration}`);
            }
            fallbackArgs.push('-i', inputTempPath);
            if (hasMusic) {
              fallbackArgs.push('-i', musicTempPath);
            }
            fallbackArgs.push('-filter_complex', fallbackComplexParts.join(';'));
            fallbackArgs.push('-map', '[vout_processed]');
            fallbackArgs.push('-map', '[aout]');
            if (hasMusic) {
              fallbackArgs.push('-shortest');
            }
            fallbackArgs.push(
              '-r', '30',
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-crf', '25',
              '-pix_fmt', 'yuv420p',
              '-c:a', 'aac',
              '-b:a', '128k',
              '-movflags', '+faststart',
              outputTempPath
            );

            await runFFmpeg(fallbackArgs);

            // Clean up inputs
            try { fs.unlinkSync(inputTempPath); } catch {}
            try { fs.unlinkSync(musicTempPath); } catch {}
            try { fs.unlinkSync(sfx1TempPath); } catch {}
            try { fs.unlinkSync(sfx2TempPath); } catch {}
            try { fs.unlinkSync(sfx3TempPath); } catch {}

            console.log(`[Video Compiler Server] Fallback video composite completed with success. Sending file: ${outputTempPath}`);
            
            // Cache the compiled file and inject custom sandbox-bypassing headers
            cacheRenderFileAndSetHeaders(res, outputTempPath, cleanSafeName);

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${cleanSafeName}_edited.mp4"`);
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.sendFile(outputTempPath, (sendErr) => {
              if (sendErr) {
                console.error('[Video Compiler Server] Failed streaming fallback response:', sendErr);
              }
              try { fs.unlinkSync(outputTempPath); } catch {}
            });
            return;
          } catch (fallbackErr: any) {
            // Clean up both
            try { fs.unlinkSync(inputTempPath); } catch {}
            try { fs.unlinkSync(musicTempPath); } catch {}
            try { fs.unlinkSync(sfx1TempPath); } catch {}
            try { fs.unlinkSync(sfx2TempPath); } catch {}
            try { fs.unlinkSync(sfx3TempPath); } catch {}
            try { fs.unlinkSync(outputTempPath); } catch {}

            console.error('[Video Compiler Server] Complete system crash on both attempts:', fallbackErr);
            return res.status(500).json({ success: false, error: 'All rendering attempts failed.', details: fallbackErr.message });
          }
        });
    } catch (configErr: any) {
      // Clean up primary inputs
      try { fs.unlinkSync(inputTempPath); } catch {}
      try { fs.unlinkSync(musicTempPath); } catch {}
      try { fs.unlinkSync(sfx1TempPath); } catch {}
      try { fs.unlinkSync(sfx2TempPath); } catch {}
      try { fs.unlinkSync(sfx3TempPath); } catch {}
      console.error('[Video Compiler Server] Fatal error in configuration preparation:', configErr);
      return res.status(500).json({ success: false, error: 'Server-side direct video composite setup failure.', details: configErr.message });
    }
  });
});

// REST route: GET music tracks
app.get('/api/music-tracks', (req, res) => {
  // Returns standard tracks matching data.ts
  const tracks = [
    {
      id: 'cyberpunk-synth',
      name: 'Cybernetic Horizon',
      artist: 'Neon Wave Music',
      genre: 'Synthwave',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      intensity: 'hype'
    },
    {
      id: 'lofi-sunset',
      name: 'Twilight Chill Hop',
      artist: 'Sofa Beats',
      genre: 'Lofi Hip Hop',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      intensity: 'lofi'
    },
    {
      id: 'cinematic-hype',
      name: 'Epic Motivation Trailer',
      artist: 'Composer Forge',
      genre: 'Cinematic',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      intensity: 'cinematic'
    },
    {
      id: 'vibrant-house',
      name: 'Summer Feel Good',
      artist: 'Sunlight Grooves',
      genre: 'Deep House',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
      intensity: 'chill'
    }
  ];
  res.json(tracks);
});

app.get('/api/ffmpeg-wasm/ffmpeg-core.js', async (req, res) => {
  const cachePath = path.join(os.tmpdir(), 'ffmpeg-core-0.12.6.js');
  res.setHeader('Content-Type', 'text/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 10000) {
    return res.sendFile(cachePath);
  }

  try {
    console.log('[FFmpeg Proxy] Caching ffmpeg-core.js locally...');
    const url = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js';
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(cachePath, Buffer.from(response.data));
    console.log('[FFmpeg Proxy] Caching ffmpeg-core.js completed!');
    res.send(response.data);
  } catch (err: any) {
    console.error('[FFmpeg Proxy Request Error]:', err.message);
    res.status(500).send(`Failed fetching core assets: ${err.message}`);
  }
});

app.get('/api/ffmpeg-wasm/ffmpeg-core.wasm', async (req, res) => {
  const cachePath = path.join(os.tmpdir(), 'ffmpeg-core-0.12.6.wasm');
  res.setHeader('Content-Type', 'application/wasm');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 100000) {
    return res.sendFile(cachePath);
  }

  try {
    console.log('[FFmpeg Proxy] Caching ffmpeg-core.wasm locally...');
    const url = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm';
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(cachePath, Buffer.from(response.data));
    console.log('[FFmpeg Proxy] Caching ffmpeg-core.wasm completed!');
    res.send(response.data);
  } catch (err: any) {
    console.error('[FFmpeg Proxy Request Error]:', err.message);
    res.status(500).send(`Failed fetching core assets: ${err.message}`);
  }
});

// REST route: GET download-render to serve persistently cached renders
app.get('/api/download-render', (req, res) => {
  const { id, name } = req.query;
  if (!id) {
    return res.status(400).send('Missing render id');
  }
  const filePath = savedRendersMap.get(id as string);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).send('Render file not found or expired. Please re-compile/render your project.');
  }

  const downloadName = (name as string) || 'edited_video.mp4';
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  
  res.download(filePath, downloadName, (err) => {
    if (err) {
      console.error('[Video Compiler Server] Error sending download render file:', err);
    }
  });
});

// REST route: GET download-proxy to bypass CORS on downloads and support range-request streaming
app.get('/api/download-proxy', async (req, res) => {
  const { url, filename, download } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  try {
    const targetUrl = decodeURIComponent(url as string);

    // SSRF guard: allowlisted hosts + private-IP blocking before any fetch.
    let safeTarget: URL;
    try {
      safeTarget = await validateProxyUrl(targetUrl);
    } catch (valErr: any) {
      console.warn(`[Proxy] Blocked unsafe target ${targetUrl}: ${valErr.message}`);
      return res.status(403).json({ error: valErr.message });
    }

    const clientRange = req.headers.range;
    const isDownloadRequest = download === 'true';

    // Build standard high-compatibility rotating header sets
    const headerSets = [
      // 1. Sleek media player User-Agent (vlc players are universally whitelisted by CDNs to keep streaming working without friction)
      {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      },
      // 2. Wget / clean curl command-line style (frequently whitelisted by resource hosts)
      {
        'User-Agent': 'Wget/1.21.1',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      },
      // 3. Mobile Safari with direct Pexels Referer
      {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.pexels.com/',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity'
      },
      // 4. Plain minimilistic request with no custom agent (defaults to Axios agent)
      {
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      }
    ];

    let response: any = null;
    let isFetchFallback = false;
    let fetchResponse: Response | null = null;
    let lastError: any = null;

    // First attempt: Try rotating Axios requests with specified headers
    for (let i = 0; i < headerSets.length; i++) {
      try {
        const headers = { ...headerSets[i] };
        if (clientRange && !isDownloadRequest) {
          headers['Range'] = clientRange;
        }

        console.log(`[Proxy] Connection Attempt ${i + 1}/${headerSets.length} to fetch targetUrl: ${targetUrl}`);
        const attempt = await axios({
          method: 'get',
          url: safeTarget.toString(),
          responseType: 'stream',
          headers: headers,
          timeout: 25000, // 25 seconds connection timeout
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: (status) => status >= 200 && status < 300
        });

        const ct = String(attempt.headers['content-type'] || '');
        if (ct.includes('text/html') || ct.includes('application/xhtml+xml')) {
          throw new Error('Cloudflare html protection intercepted.');
        }

        response = attempt;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Proxy] Attempt ${i + 1} failed for ${targetUrl}: ${err.message}`);
      }
    }

    // Ultimate Fallback: Try native global fetch (uses Undici with modern TLS ciphers closer to browsers than Axios)
    if (!response) {
      try {
        console.log(`[Proxy] Connection Fallback via Native undici fetch for targetUrl: ${targetUrl}`);
        const fallbackHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
          'Referer': 'https://www.pexels.com/',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity'
        };
        if (clientRange && !isDownloadRequest) {
          fallbackHeaders['Range'] = clientRange;
        }

        const fetchAttempt = await fetch(safeTarget.toString(), {
          headers: fallbackHeaders
        });

        if (fetchAttempt.ok) {
          const ct = String(fetchAttempt.headers.get('content-type') || '');
          if (!ct.includes('text/html') && fetchAttempt.body) {
            fetchResponse = fetchAttempt;
            isFetchFallback = true;
            console.log(`[Proxy] Native Fetch fallback succeeded with status ${fetchAttempt.status}!`);
          } else {
            throw new Error(`Cloudflare or HTML page returned on fetch, Content-Type: ${ct}`);
          }
        } else {
          throw new Error(`Status ${fetchAttempt.status}`);
        }
      } catch (fetchErr: any) {
        console.warn(`[Proxy] Native undici fetch fallback failed: ${fetchErr.message}`);
        lastError = fetchErr;
      }
    }

    if (!response && !isFetchFallback) {
      console.warn(`[Proxy Fallback] Connection to target URL failed or direct proxy block. Redirecting browser directly to source URL: ${safeTarget.toString()}`);
      return res.redirect(safeTarget.toString());
    }

    // Unify parameters from Axios or Native fetch
    const headersMap = isFetchFallback ? fetchResponse!.headers : null;
    
    const getHeader = (name: string): string => {
      if (isFetchFallback && headersMap) {
        return headersMap.get(name) || '';
      }
      return response ? String(response.headers[name.toLowerCase()] || '') : '';
    };

    const contentType = getHeader('content-type') || 'video/mp4';
    const contentRange = getHeader('content-range');
    const contentLength = getHeader('content-length');
    const resStatus = isFetchFallback ? fetchResponse!.status : (response ? response.status : 200);

    const safeFilename = filename ? decodeURIComponent(filename as string) : 'video.mp4';

    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    if (isDownloadRequest) {
      res.status(200);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
    } else {
      res.setHeader('Accept-Ranges', 'bytes');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.status(resStatus);
    }

    // Forward the media stream directly
    if (isFetchFallback && fetchResponse && fetchResponse.body) {
      const nodeStream = Readable.fromWeb(fetchResponse.body as any);
      nodeStream.on('error', (err: any) => {
        console.error('[Proxy Stream Error (Fetch)]', err.message);
      });
      nodeStream.pipe(res);
    } else if (response) {
      response.data.on('error', (err: any) => {
        console.error('[Proxy Stream Error (Axios)]', err.message);
      });
      response.data.pipe(res);
    }
  } catch (err: any) {
    console.error('Error proxying download, attempting redirect as fail-safe:', err.message);
    try {
      const redirectUrl = decodeURIComponent(req.query.url as string);
      const safeRedirect = await validateProxyUrl(redirectUrl);
      return res.redirect(safeRedirect.toString());
    } catch (e: any) {
      res.status(500).send(`Error downloading video attachment file: ${err.message}`);
    }
  }
});




// Setup development server or production build static folder
async function startServer() {
  // Bind and listen to PORT immediately to satisfy control-plane health checks
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ViralForge Server] Backend and Vite dev-server running on http://0.0.0.0:${PORT}`);
  });

  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('[ViralForge Server] Initializing Vite in middleware mode asynchronously...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[ViralForge Server] Vite dev-server middleware loaded successfully.');
    } catch (err: any) {
      console.error('[ViralForge Server] Failed to initialize Vite dev server:', err);
    }
  } else {
    // Serve static files in production ONLY if a built frontend is actually
    // present. On a backend-only deploy (e.g. Render, with the frontend
    // hosted separately on Netlify), dist/index.html will never exist here —
    // falling through to the SPA catch-all in that case would throw
    // ENOENT on every unmatched request, including whatever path Render's
    // health check hits. Respond with a plain health-check JSON instead.
    const distPath = path.join(process.cwd(), 'dist');
    const hasBuiltFrontend = fs.existsSync(path.join(distPath, 'index.html'));

    if (hasBuiltFrontend) {
      app.use(express.static(distPath));
      app.get('/test-connection', (req, res) => {
        res.send('<h1>TUNNEL IS WORKING!</h1><p>If you see this, the server is active. Now try visiting the root <a href="/">HERE</a> to load the app.</p>');
      });
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.log('[ViralForge Server] No built frontend found at dist/ — running as an API-only backend (expected on Render/Railway/Cloud Run when the frontend is hosted separately, e.g. on Netlify).');
      app.get('/', (req, res) => {
        res.status(200).json({ status: 'ok', service: 'auto-viral-video-editor-backend' });
      });
    }
  }
}

startServer();
