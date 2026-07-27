import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import axios from 'axios';
import os from 'os';
import { exec, spawn, execSync } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import multer from 'multer';
import { Readable } from 'stream';
import crypto from 'crypto';
import { resolveCaptionMetrics, normalizeCaptionStyle, FONT_FILE_FOR_STYLE, CaptionStyleName } from './src/utils/captionStyleConfig';

// Fix for __dirname in ES modules vs CommonJS
let __dirname = '';
try {
  if (typeof process !== 'undefined' && typeof __filename !== 'undefined') {
    __dirname = path.dirname(__filename);
  } else {
    const __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
  }
} catch (e) {
  // Fallback for some environments
}

// Load environment variables
dotenv.config();

// Output frame width used for every rendered short (9:16 @ 1080x1920).
// Caption metrics are resolved against this exact width so the burned-in
// captions match the browser preview pixel-for-pixel (see captionStyleConfig.ts).
const RENDER_FRAME_WIDTH = 1080;

const app = express();
// Render (and most cloud hosts) assign their own port via process.env.PORT
// and expect the app to bind to it — a hardcoded port here means the
// platform's health check never succeeds and the service never comes up.
// 3000 remains the local/AI-Studio-sandbox dev default.
const PORT = process.env.PORT || 3000;

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

      let activeSubtitles = subtitles;
      let activeZoomEffects = zoomEffects;
      const isSmartCuts = activeClipId === 'smart-cuts' && highlights && highlights.length > 0;
      let calculatedSmartCutsDuration = 0;

      if (isSmartCuts) {
        console.log(`[Video Compiler Server] Smart Cuts Compilation activated with ${highlights.length} clips.`);
        const remappedSubtitles: any[] = [];
        const remappedZoomEffects: any[] = [];
        let elapsed = 0;

        highlights.forEach((hl: any) => {
          const speed = Number(hl.speed) || 1.0;
          const hlDur = (Number(hl.end) - Number(hl.start)) / speed;

          // Subtitles mapping: Handle any overlapping subtitle interval cleanly
          subtitles.forEach((sub: any) => {
            const subStart = Number(sub.start || 0);
            const subEnd = Number(sub.end || subStart + 1.5);
            if (subEnd > hl.start && subStart < hl.end) {
              const clampedStart = Math.max(hl.start, subStart);
              const clampedEnd = Math.min(hl.end, subEnd);
              if (clampedEnd > clampedStart) {
                remappedSubtitles.push({
                  ...sub,
                  start: (clampedStart - hl.start) / speed + elapsed,
                  end: (clampedEnd - hl.start) / speed + elapsed
                });
              }
            }
          });

          // Zoom effects mapping: Handle any overlapping zoom effects interval cleanly
          zoomEffects.forEach((z: any) => {
            const zTS = Number(z.timestamp || 0);
            const zDuration = Number(z.duration || 1.5);
            const zEnd = zTS + zDuration;
            if (zEnd > hl.start && zTS < hl.end) {
              const clampedTS = Math.max(hl.start, zTS);
              const clampedEnd = Math.min(hl.end, zEnd);
              if (clampedEnd > clampedTS) {
                remappedZoomEffects.push({
                  ...z,
                  timestamp: (clampedTS - hl.start) / speed + elapsed,
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
        console.log(`[Video Compiler Server] Smart cuts remapped ${activeSubtitles.length} subtitles and ${activeZoomEffects.length} zoom effects. Total output length: ${calculatedSmartCutsDuration.toFixed(2)}s`);
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
      if (isSmartCuts) {
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

      // 3. Scale and fit vertically to 1080x1920 (TikTok optimization viewport)
      vf += ',scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';

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

      if (!isFullVideo && !isSmartCuts) {
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
      const whooshTimes: number[] = [0.5];
      if (isSmartCuts && highlights.length > 1) {
        let elapsed = 0;
        for (let i = 0; i < highlights.length - 1; i++) {
          const speed = Number(highlights[i].speed) || 1.0;
          const hlDur = (Number(highlights[i].end) - Number(highlights[i].start)) / speed;
          elapsed += hlDur;
          whooshTimes.push(elapsed);
        }
      } else if (activeZoomEffects && activeZoomEffects.length > 0) {
        activeZoomEffects.forEach((z: any) => {
          const t = Number(z.timestamp) - localStartLimit;
          if (t > 0.1 && t < trimDuration && !whooshTimes.includes(t)) {
            whooshTimes.push(t);
          }
        });
      }

      const popTimes: number[] = [];
      if (activeSubtitles && activeSubtitles.length > 0) {
        activeSubtitles.forEach((sub: any) => {
          const t = Number(sub.start) - localStartLimit;
          if (t > 0.1 && t < trimDuration) {
            const hasEmoji = !!sub.emoji || /[\u{1F300}-\u{1F6FF}]/u.test(sub.text);
            if (hasEmoji) {
              popTimes.push(t);
            }
          }
        });
        if (popTimes.length === 0) {
          activeSubtitles.forEach((sub: any, idx: number) => {
            const t = Number(sub.start) - localStartLimit;
            if (t > 0.1 && t < trimDuration && idx % 3 === 0) {
              popTimes.push(t);
            }
          });
        }
      }
      if (popTimes.length === 0) {
        popTimes.push(4.0);
      }

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
      const impactTimes: number[] = [0.2, outroTime];

      // Build out perfect mixed audio channel with clean noise suppression gating filters
      const filterComplexParts: string[] = [];

      if (isSmartCuts) {
        // First we register the smart cuts concatenation filters inside filterComplexParts
        let smartCutsFilter = '';
        highlights.forEach((hl: any, idx: number) => {
          const speed = Number(hl.speed) || 1.0;
          const videoPtsEx = (1.0 / speed).toFixed(4);
          smartCutsFilter += `[0:v]trim=start=${hl.start}:end=${hl.end},setpts=(PTS-STARTPTS)*${videoPtsEx}[vhl${idx}];`;
          if (hasAudio) {
            const clampedAtempo = Math.max(0.5, Math.min(2.0, speed)).toFixed(4);
            smartCutsFilter += `[0:a]atrim=start=${hl.start}:end=${hl.end},asetpts=PTS-STARTPTS,atempo=${clampedAtempo}[ahl${idx}];`;
          }
        });
        let concatedPads = '';
        if (hasAudio) {
          concatedPads = highlights.map((_, idx) => `[vhl${idx}][ahl${idx}]`).join('');
          smartCutsFilter += `${concatedPads}concat=n=${highlights.length}:v=1:a=1[vconc_raw][aconc_raw]`;
        } else {
          concatedPads = highlights.map((_, idx) => `[vhl${idx}]`).join('');
          smartCutsFilter += `${concatedPads}concat=n=${highlights.length}:v=1:a=0[vconc_raw]`;
        }
        filterComplexParts.push(smartCutsFilter);

        // Build transitions overlay: Aligns mathematically with speed-scaled clip durations
        let transitionsFilter = '';
        if (highlights.length > 1) {
          let elapsed = 0;
          for (let i = 0; i < highlights.length - 1; i++) {
            const speed = Number(highlights[i].speed) || 1.0;
            const hlDur = (Number(highlights[i].end) - Number(highlights[i].start)) / speed;
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
      if (isSmartCuts) {
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

      // 2. Process background music track
      let musicLabel = '';
      if (hasMusic && musicInputIdx !== -1) {
        filterComplexParts.push(`[${musicInputIdx}:a]volume=${Number(musicVolume) * 0.45},aresample=async=1:sample_rate=44100,aformat=channel_layouts=stereo[cleanmusic]`);
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
        .then(() => {
          // Clean up primary inputs
          try { fs.unlinkSync(inputTempPath); } catch {}
          try { fs.unlinkSync(musicTempPath); } catch {}
          try { fs.unlinkSync(sfx1TempPath); } catch {}
          try { fs.unlinkSync(sfx2TempPath); } catch {}
          try { fs.unlinkSync(sfx3TempPath); } catch {}

          console.log(`[Video Compiler Server] Video composite completed with success. Sending file: ${outputTempPath}`);
          
          // Cache the compiled file and inject custom sandbox-bypassing headers
          cacheRenderFileAndSetHeaders(res, outputTempPath, cleanSafeName);

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
            if (isSmartCuts) {
              let smartCutsFilter = '';
              highlights.forEach((hl: any, idx: number) => {
                const speed = Number(hl.speed) || 1.0;
                const videoPtsEx = (1.0 / speed).toFixed(4);
                smartCutsFilter += `[0:v]trim=start=${hl.start}:end=${hl.end},setpts=(PTS-STARTPTS)*${videoPtsEx}[vhl${idx}];`;
                if (hasAudio) {
                  const clampedAtempo = Math.max(0.5, Math.min(2.0, speed)).toFixed(4);
                  smartCutsFilter += `[0:a]atrim=start=${hl.start}:end=${hl.end},asetpts=PTS-STARTPTS,atempo=${clampedAtempo}[ahl${idx}];`;
                }
              });
              let concatedPads = '';
              if (hasAudio) {
                concatedPads = highlights.map((_, idx) => `[vhl${idx}][ahl${idx}]`).join('');
                smartCutsFilter += `${concatedPads}concat=n=${highlights.length}:v=1:a=1[vconc_raw][aconc_raw]`;
              } else {
                concatedPads = highlights.map((_, idx) => `[vhl${idx}]`).join('');
                smartCutsFilter += `${concatedPads}concat=n=${highlights.length}:v=1:a=0[vconc_raw]`;
              }
              fallbackComplexParts.push(smartCutsFilter);
              fallbackComplexParts.push(`[vconc_raw]${fallbackVf}[vout_processed]`);
            } else {
              fallbackComplexParts.push(`[0:v]${fallbackVf}[vout_processed]`);
            }

            // Simple audio fallback
            let fallbackOrigLabel = '[0:a]';
            if (isSmartCuts) {
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
            if (!isFullVideo && !isSmartCuts) {
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

// Helper to lazy-initialize Gemini API
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not set or holds placeholder value.');
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

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
          url: targetUrl,
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

        const fetchAttempt = await fetch(targetUrl, {
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
      console.warn(`[Proxy Fallback] Connection to target URL failed or direct proxy block. Redirecting browser directly to source URL: ${targetUrl}`);
      return res.redirect(targetUrl);
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
      const targetUrl = decodeURIComponent(req.query.url as string);
      return res.redirect(targetUrl);
    } catch (e: any) {
      res.status(500).send(`Error downloading video attachment file: ${err.message}`);
    }
  }
});

// REST route: POST analyze-video
app.post('/api/analyze-video', upload.single('videoFile'), async (req, res) => {
  // If parsing multipart form, some fields may need deserialization
  const { name, niche, originalDuration, userDescription, defaultTranscribe, isFallbackRequested, videoUrl } = req.body;
  let imitationOptions = req.body.imitationOptions;
  if (typeof imitationOptions === 'string') {
    try {
      imitationOptions = JSON.parse(imitationOptions);
    } catch (_) {}
  }

  const resolvedNiche = niche || 'general';
  const resolvedDuration = Number(originalDuration) || 30;
  const descriptionText = userDescription || 'Raw smartphone video capture';
  const subtitleFallbackText = defaultTranscribe || '';
  const resolvedName = typeof name === 'string' && name ? name : (req.file ? req.file.originalname : 'My Viral Video');

  console.log(`[Video AI Engine] Starting content-aware analysis for video: "${resolvedName}" Niche: [${resolvedNiche}]`);

  let inputTempPath: string | null = null;
  let audioTempPath: string | null = null;
  const keyframeTempPaths: string[] = [];

  try {
    if (isFallbackRequested) {
      throw new Error('Force high fidelity simulated pacing engine');
    }

    // Determine the local input file (upload or remote URL)
    if (req.file) {
      console.log(`[Video AI Engine] Custom video file uploaded: "${req.file.originalname}" (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
      inputTempPath = path.join(os.tmpdir(), `analyze_input_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);
      fs.writeFileSync(inputTempPath, req.file.buffer);
    } else if (videoUrl) {
      console.log(`[Video AI Engine] Preset video URL requested: ${videoUrl}`);
      inputTempPath = path.join(os.tmpdir(), `analyze_download_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);
      const downloadSuccess = await downloadFileWithRetries(videoUrl, inputTempPath, 5000);
      if (!downloadSuccess || !fs.existsSync(inputTempPath) || fs.statSync(inputTempPath).size < 1000) {
        inputTempPath = null;
      }
    }

    let audioBase64: string | null = null;
    const keyframesBase64: string[] = [];

    // Extract audio and visual keyframes for true content-aware AI understanding
    if (inputTempPath) {
      console.log(`[Video AI Engine] Local video located. Extracting media cues for Gemini Multimodal Analysis...`);

      // 1. Audio Track Extraction (first 45 seconds max)
      audioTempPath = path.join(os.tmpdir(), `analyze_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
      try {
        await runFFmpeg([
          '-y',
          '-i', inputTempPath,
          '-vn',
          '-ss', '0',
          '-t', '45',
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          audioTempPath
        ]);
        if (fs.existsSync(audioTempPath) && fs.statSync(audioTempPath).size > 1000) {
          audioBase64 = fs.readFileSync(audioTempPath).toString('base64');
          console.log(`[Video AI Engine] Audio track successfully extracted: ${(audioBase64.length / 1024).toFixed(1)} KB`);
        }
      } catch (err: any) {
        console.warn(`[Video AI Engine] Audio extraction failed (falling back to visual-only):`, err.message);
      }

      // 2. Visual Keyframes Extraction (3 evenly spaced snapshots)
      const timestamps = [resolvedDuration * 0.15, resolvedDuration * 0.50, resolvedDuration * 0.85];
      for (let i = 0; i < timestamps.length; i++) {
        const t = timestamps[i];
        const framePath = path.join(os.tmpdir(), `analyze_frame_${Date.now()}_${i}.jpg`);
        try {
          await runFFmpeg([
            '-y',
            '-ss', t.toFixed(2),
            '-i', inputTempPath,
            '-vframes', '1',
            '-vf', 'scale=360:-1',
            framePath
          ]);
          if (fs.existsSync(framePath) && fs.statSync(framePath).size > 500) {
            keyframeTempPaths.push(framePath);
            keyframesBase64.push(fs.readFileSync(framePath).toString('base64'));
          }
        } catch (err: any) {
          console.warn(`[Video AI Engine] Frame extraction at ${t.toFixed(1)}s failed:`, err.message);
        }
      }
      console.log(`[Video AI Engine] Visual snapshots extracted: ${keyframesBase64.length} frames.`);
    }

    const ai = getGeminiClient();

    let systemPrompt = `You are the Google AI Studio Auto Editor — a world-class Viral Video Director, Social Media Algorithm Engineer, and Professional Video Editor.
Analyze this raw video metadata, visual keyframe snapshots, and audio soundtrack thoroughly. Understand the main subject, key moments, visual highlights, emotion/vibe, and what makes it engaging. Then, fully optimize and edit it for maximum virality on TikTok, Instagram Reels, and YouTube Shorts.
Adapt all creative decisions intelligently to THIS specific video’s content — DO NOT use generic or repeated phrases across different videos.

=== SITUATIONAL MULTI-ARCHETYPE EDITING PROTOCOLS ===
You must classify the video content into one of the following archetypes based on your visual & audio analysis, then apply the corresponding professional protocols:

1. SNEAKERS & PRODUCT UNBOXING ARCHETYPE:
   - Visual Focus: Macro closeups on materials, box opening, tissue paper crinkling, satisfying ASMR reveals.
   - Pacing: Snappy opening hook in first 1.5s, slow-motion speed (0.5x-0.75x) for the main reveal climax.
   - Copywriting style: Elite Direct-to-Consumer (DTC) Direct Response. Create persuasive, psychologically-targeted caption overlays with high-energy emojis (💰, 👑, 💎) highlighting scarcity, premium texture, and risk reversal.

2. FOOD & COOKING / CULINARY ARCHETYPE:
   - Visual Focus: Food browning, butter foaming, meat slicing, sauce drizzling, crisp textures.
   - Pacing: Instant sensory trigger hook in first 2s (sizzle, chop, pour). Slow-mo (0.5x) on pours/slices to maximize satisfaction and salivary response.
   - Copywriting style: Highly descriptive, mouth-watering caption overlays. Use sensory, evocative terms ("unbelievably crispy", "perfectly medium rare", "buttery garlic glaze") with cooking emojis (🍳, 🥩, 🤤). Include key recipe callouts.

3. SPORTS, FITNESS & HIGH-ENERGY ARCHETYPE:
   - Visual Focus: Climax of physical exertion, dynamic body motions, gravity-defying moves, perfect gym reps, skate land, or goal kicks.
   - Pacing: Fast, hard-hitting transition cuts timed with musical beats or motion peaks. Avoid slow idle setup times.
   - Copywriting style: High-impact, motivational, short phrases (e.g., "NO EXCUSES", "THE CLIMAX", "WAIT FOR IT..."). Use energetic accents (⚡, 🔥, 💪, 💥) with minimal, bold text.

4. FASHION, BEAUTY, CELEBRITIES & PORTRAITS ARCHETYPE:
   - Visual Focus: Outfits, runway strides, fabric flow, makeup transitions, portrait framing, hair flow.
   - Pacing: Smooth, elegant, and visually pleasing cuts. Use subtle zooms and cinematic fades.
   - Copywriting style: Aesthetic styling commentary, brand callouts, design inspiration, or the celebrity's actual speech transcript styled beautifully. Emphasize elegance (✨, 💅, 👗, 💄).

5. PETS & CUTE ANIMALS ARCHETYPE:
   - Visual Focus: Closeups on cute eyes, tail wags, adorable head tilts, playful paws.
   - Pacing: Gentle, playful zoom effects and cozy transitions.
   - Copywriting style: Adorable, heart-melting commentary ("Look at those giant eyes!", "Pure happiness"), using cute accents (🐾, 🥺, 🧸, 💖).

6. GENERAL TALKING-HEAD / SPEECH / DISCUSSION ARCHETYPE:
   - Visual Focus: The speaker's face, active gestures.
   - Pacing: Tight cuts removing long silences or filler words. Zoom in 10-15% dynamically on key statements to break visual monotony.
   - Copywriting style: Accurate, rapid-fire speech subtitles (MrBeast or Hormozi style, 1-3 words per subtitle block). Use highlighted text for peak emotional words.

=== ⚠️ CRITICAL RULES FOR VIDEOS WITH NO SPEECH (CINEMATIC / VISUAL / ASMR) ⚠️ ===
If your analysis of the audio and video indicates there is NO spoken commentary, dialog, or voiceover (or if the user states this is a visual compilation):
- DO NOT fabricate fake spoken subtitles as if someone is talking! This looks extremely amateur and robotic.
- Instead, act like a professional human editor: use the "subtitles" array to render clean, cinematic on-screen GRAPHIC DESCRIPTORS / commentary labels (e.g., "[ 🔥 THE HOOK ]", "[ ⚡ BUTTERY SMOOTH SLICE ]", "[ ✨ REVEAL ]") at key timestamps to guide the viewer's focus.
- If the video is purely aesthetic and does not benefit from text overlays, you can leave the "subtitles" array empty, focusing your mastery on the "zoomEffects", "highlights", "tags", and "endingCTA" to let the visuals speak for themselves!

=== CORE AUTOMATED EDITING REQUIREMENTS ===
1. HOOK DETECTION (first 1-3 seconds):
   - Detect the single most exciting, visually striking, or surprising moment.
   - Start or configure the first highlight clip there. Recommend video zoom-in or dramatic entry effects to immediately stop the scrolling thumb.
2. STABILIZATION & POLISH:
   - Identify shaky visual areas and recommend camera framing, color stabilization, lighting adjustments, or slow-motion overlays to produce a ultra-premium visual feel.
3. AUTONOMOUS HUMAN-GRADE STYLING DECISIONS:
   - You MUST make dynamic, high-quality, professional styling choices customized exactly for this video's visual flow and mood. Do NOT rely on static defaults.
   - "captionStyle": Choose the styling preset that matches perfectly:
     * 'minimalist': Use for food/cooking, luxury, beauty, fashion, or serene/aesthetic visual vlogs.
     * 'comic': Use for cute pets, playful, comedic, or wholesome content.
     * 'impact': Use for heavy fitness workouts, action sports, gaming, and technical content.
     * 'mrbeast' / 'hormozi': Use for rapid-fire talking-head commentary, educational facts, unboxings, or highly energetic vlogs.
   - "selectedMusicTrackId": Choose the soundtrack ID that elevates the emotional curve:
     * 'cyberpunk-synth' / 'tech-house': Use for fast, high-tech, action, or high-energy workouts.
     * 'beautiful-dream' / 'serene-view': Use for peaceful, cinematic, luxury, relaxing, or aesthetic vlogs.
     * 'lofi-sunset' / 'serene-view': Use for chill vlogs, study/work routines, slow cooking, or cute animals.
     * 'holliday-jam' / 'hip-hop-vibe': Use for fun, upbeat, unboxings, streetwear fashion, or general lifestyle.
     * 'forest-trail' / 'dreaming-big': Use for epic outdoor sports, fitness drive, cooking prep, or cinematic nature.
   - "colorGrade": Select the filter that complements the visuals:
     * 'vibrant_pop': Perfect for food/cooking to make ingredients pop, cute animals, and colorful outfits.
     * 'moody_cyber': Best for mechanical keyboards, night-time fitness, coding setups, gaming, and high-tech gear.
     * 'warm_vintage': Ideal for golden-hour vlogs, cute pets, nostalgic lifestyle, and retro unboxings.
     * 'cinematic': Standard professional editorial grade for high-contrast, dramatic lighting, premium goods, and athletic performance.
     * 'none': Use only if the original colors are already absolute perfection.
   - "transitionStyle": Select the dynamic transition to weld highlights together:
     * 'glitch' / 'flash': Perfect for hard cuts, high energy drops, sports edits, and rapid-fire beat drops.
     * 'zoom' / 'slide_left': Ideal for unboxing sliding covers, camera pan-reveals, or scrolling lifestyle edits.
     * 'crossfade' / 'fade_black': Excellent for elegant transitions, food prep, aesthetic vlogs, and smooth relaxing vibes.
4. TEXT OVERLAYS & CAPTIONS:
   - Create bold, interactive text overlays (supporting high-contrast, yellow/pink color notes with outlines matching the style) that align perfectly with the tone.
   - Subtitle words/phrases MUST be short, punchy, and timed perfectly with actions or sound spikes.
   - Generate custom hype or peak curiosity overlay texts depicting what is happening (e.g., specific reaction comments, key call-outs), and NEVER reuse simple repetitive phrases.
5. AUDIO SYNCHRONIZATION:
   - Suggest a specific trending background sound track (specify standard audio track name or type matching the vibe: chill, hype, motivational, cinematic, ASMR beat) to carry the video's energy.
   - SILLY CARTOON SOUND EFFECTS (such as slide whistle or boing) ARE STRICTLY FORBIDDEN on high-end, aesthetic, fashion, luxury, cooking, modeling, and professional cinematic videos (e.g., photoshoots, food preparation, runway vlogs).
   - Choose intelligent, human-grade sound effect combinations:
     * "sfxWhooshEnabled": Set to true only if there is a fast zoom-in, camera pan, or transition. Use wind_swoosh ('https://actions.google.com/sounds/v1/foley/wind_swoosh.ogg') for luxury/fashion/cooking, or slide_whistle ('https://actions.google.com/sounds/v1/cartoon/slide_whistle.ogg') only for goofy cartoon/comedy/animals.
     * "sfxPopEnabled": Set to true only if there are text reveals or emojis on screen. For beauty photoshoots, modeling, runway, use professional camera shutter clicks: 'https://actions.google.com/sounds/v1/foley/camera_shutter.ogg'. For tech linear keyboard ASMR, use keyboard clicks: 'https://actions.google.com/sounds/v1/foley/keyboard_click.ogg'. For goofy content, use boing: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'.
     * "sfxImpactEnabled": Set to true only for gym lifts or sports transitions using crash: 'https://actions.google.com/sounds/v1/impacts/crash_impact_sweetener.ogg'. Set to false for all beauty, cooking, fashion, and soft aesthetic videos to keep them clean.
6. PACING & LENGTH:
   - Force dynamic pacing based on content: fast explosive cuts during hooks/setups, paired with slower luxury shots on major highlights.
7. TAILORED CTA & OUTRO ENDING:
   - Formulate a tailored call-to-action screen suited directly to the video's specific contents (e.g. “Would you try this? 👇”, “Rate this fit 1-10 ✨”, “Drop your thoughts below!”) plus handle placeholders.
8. SCROLL-STOPPING THUMBNAIL:
   - Pick the perfect aesthetic frame (provide accurate timestamp recommendation) and suggest a highly bold, curiosity-driven visual text overlay to maximize click-through rate.

=== VIRAL COPYWRITING TEMPLATES (STRICT ADHERENCE REQUIRED) ===
CRITICAL: You MUST base EVERYTHING strictly on the actual visual content of the uploaded video (using the filename, user description, transcript, and niche). Do NOT hallucinate, guess, or assume products like handbags or sneakers if the visual cues and description clearly show food, gym lifts, puppies, or other domains.

You MUST generate the following string outputs inside the JSON fields:
1. "title": The main, highest-converting title under 70 characters with relevant emojis. Curiosity-driven.
2. "alternativeTitles": Provide exactly 2 alternative title options under 70 characters.

3. "description": This field holds the entire scroll-stopping meta spec. You MUST strictly construct this field to match the following multi-line Output Format layout exactly (including custom line breaks and section headers):

Video Analysis: This video shows [provide 2-3 sentences of extremely accurate visual description summarizing exactly what product, actions, and subject are in the video based on the snapshots. Key visuals include...].

Recommended Title: [Your main title here]

Alternative Titles:
1. [Alternative option 1]
2. [Alternative option 2]

Optimized Description:
[120-200 word highly natural & engaging caption. Start with a catchy intro based on what is shown. Highlight 2-3 specific features visible. Add a strong CTA tailored specifically to the video context. End with 6-8 relevant hashtags like #FYP #Reels specific to the video content.]

Raw Video Info:
- File Name: "${name}"
- Niche target: "${resolvedNiche}"
- Duration: ${resolvedDuration} seconds.
- User Description of events: "${descriptionText}"
- Transcribed Transcript raw: "${subtitleFallbackText}"`;;

    if (imitationOptions) {
      systemPrompt += `\n\n=== VIRAL INSPIRATION REPLICA ENGINE ACTIVATED ===
You MUST replicate the visual and pacing style of the following reference source:
- Imitation Archetype Profile: "${imitationOptions.archetype}"
- Cloned Source Target: "${imitationOptions.referenceSource}"
- Direct copycat directives: "${imitationOptions.copyInstructions}"
Make sure to customize subtitle layout density, emoji selection, and highlight durations to match this creator's energy and timing patterns.`;
    }

    const outputSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        alternativeTitles: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        description: { type: Type.STRING },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        viralityScore: { type: Type.INTEGER },
        viralityCriteria: {
          type: Type.OBJECT,
          properties: {
            hook: { type: Type.INTEGER },
            pacing: { type: Type.INTEGER },
            emotion: { type: Type.INTEGER },
            visualContrast: { type: Type.INTEGER }
          }
        },
        viralityFeedback: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        highlights: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              duration: { type: Type.NUMBER },
              viralityScore: { type: Type.INTEGER },
              description: { type: Type.STRING },
              whyEngaging: { type: Type.STRING },
              speed: { type: Type.NUMBER }
            },
            required: ['id', 'title', 'start', 'end']
          }
        },
        subtitles: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              start: { type: Type.NUMBER },
              end: { type: Type.NUMBER },
              emoji: { type: Type.STRING },
              highlightWords: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ['id', 'text', 'start', 'end']
          }
        },
        zoomEffects: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timestamp: { type: Type.NUMBER },
              scale: { type: Type.NUMBER },
              duration: { type: Type.NUMBER }
            }
          }
        },
        endingCTA: {
          type: Type.STRING
        },
        thumbnailRecommendation: {
          type: Type.STRING
        },
        captionStyle: {
          type: Type.STRING,
          description: "The recommended subtitle overlay style: 'mrbeast', 'hormozi', 'minimalist', 'impact', or 'comic'. Decide based on the archetype."
        },
        selectedMusicTrackId: {
          type: Type.STRING,
          description: "The recommended background royalty-free music track: 'beautiful-dream', 'lofi-sunset', 'cyberpunk-synth', 'holliday-jam', 'forest-trail', 'tech-house', 'sun-weather', 'dreaming-big', 'serene-view', or 'hip-hop-vibe'. Decide based on the mood."
        },
        colorGrade: {
          type: Type.STRING,
          description: "The recommended color grade filter: 'none', 'cinematic', 'warm_vintage', 'vibrant_pop', or 'moody_cyber'."
        },
        transitionStyle: {
          type: Type.STRING,
          description: "The recommended video highlight transition style: 'none', 'crossfade', 'glitch', 'flash', 'zoom', 'fade_black', or 'slide_left'."
        },
        sfxWhooshEnabled: {
          type: Type.BOOLEAN,
          description: "Whether to enable whoosh sound effects (slide whistles/wind swooshes) for transitions. Select based on the archetype."
        },
        sfxPopEnabled: {
          type: Type.BOOLEAN,
          description: "Whether to enable pop/click sound effects (boings/camera shutter clicks) for subtitles/emojis. Select based on the archetype."
        },
        sfxImpactEnabled: {
          type: Type.BOOLEAN,
          description: "Whether to enable deep impact / crash sweetener sound effects at the beginning/outro. Select based on the archetype."
        },
        sfxWhooshUrl: {
          type: Type.STRING,
          description: "The specific URL of the whoosh sound. For cartoon/comedy/cute pets use slide_whistle: 'https://actions.google.com/sounds/v1/cartoon/slide_whistle.ogg'. For professional/fashion/cooking/sports use wind_swoosh: 'https://actions.google.com/sounds/v1/foley/wind_swoosh.ogg'."
        },
        sfxPopUrl: {
          type: Type.STRING,
          description: "The specific URL of the pop sound. For cartoon/comedy/cute pets use boing: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'. For high-fashion/beauty/runway/photography use camera shutter click: 'https://actions.google.com/sounds/v1/foley/camera_shutter.ogg'. For tech/mechanical builds use keyboard click: 'https://actions.google.com/sounds/v1/foley/keyboard_click.ogg'."
        },
        sfxImpactUrl: {
          type: Type.STRING,
          description: "The specific URL of the impact sound. For action/sports/epic build-ups use crash: 'https://actions.google.com/sounds/v1/impacts/crash_impact_sweetener.ogg'. Otherwise use none or a subtle foley sound."
        }
      },
      required: ['title', 'alternativeTitles', 'description', 'tags', 'viralityScore', 'viralityCriteria', 'viralityFeedback', 'highlights', 'subtitles', 'zoomEffects', 'endingCTA', 'thumbnailRecommendation', 'captionStyle', 'selectedMusicTrackId', 'colorGrade', 'transitionStyle', 'sfxWhooshEnabled', 'sfxPopEnabled', 'sfxImpactEnabled', 'sfxWhooshUrl', 'sfxPopUrl', 'sfxImpactUrl']
    };

    // Build perfect multi-part content payload containing the extracted media cues
    const promptParts: any[] = [{ text: systemPrompt }];

    if (audioBase64) {
      console.log(`[Video AI Engine] Bundling audio track part into Gemini multimodal request...`);
      promptParts.push({
        inlineData: {
          mimeType: "audio/wav",
          data: audioBase64
        }
      });
    }

    keyframesBase64.forEach((frame, idx) => {
      console.log(`[Video AI Engine] Bundling keyframe snapshot #${idx + 1} into Gemini multimodal request...`);
      promptParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: frame
        }
      });
    });

    let response;
    let fallbackSuccess = false;
    let apiError: any = null;
    const modelOptions = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const targetModel of modelOptions) {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[Video AI Engine] Requesting multimodal analysis from: ${targetModel} (Attempt ${attempt}/${maxAttempts})`);
          response = await ai.models.generateContent({
            model: targetModel,
            contents: { parts: promptParts },
            config: {
              responseMimeType: 'application/json',
              responseSchema: outputSchema
            }
          });
          
          if (response && response.text) {
            fallbackSuccess = true;
            console.log(`[Video AI Engine] Analysis successfully generated by model: ${targetModel} on attempt ${attempt}`);
            break;
          }
        } catch (err: any) {
          apiError = err;
          const rawMsg = err?.message || String(err);
          const isThrottle = rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota') || rawMsg.includes('429');
          const isOverloaded = rawMsg.includes('503') || rawMsg.includes('temp') || rawMsg.includes('demand') || rawMsg.includes('overloaded');
          
          if (isThrottle) {
            console.log(`[Video AI Engine] Model ${targetModel} is throttled/rate-limited.`);
          } else if (isOverloaded) {
            console.log(`[Video AI Engine] Model ${targetModel} is experiencing temporary high demand (503).`);
          } else {
            console.log(`[Video AI Engine] Model ${targetModel} error (attempt ${attempt}): ${rawMsg.slice(0, 150)}`);
          }

          if (attempt < maxAttempts) {
            const delay = 500 * Math.pow(2, attempt - 1);
            console.log(`[Video AI Engine] Waiting ${delay}ms before retry...`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      if (fallbackSuccess) {
        break;
      }
    }

    if (!fallbackSuccess || !response) {
      throw apiError || new Error('All high-fidelity AI models are currently experiencing heavy demand.');
    }

    const outputText = response.text;
    if (!outputText) {
      throw new Error('Received empty response from Gemini API');
    }

    const compiledProject = JSON.parse(outputText);
    if (compiledProject) {
      if (typeof compiledProject.title === 'string') {
        compiledProject.title = fixDunikTypo(compiledProject.title);
      }
      if (typeof compiledProject.description === 'string') {
        compiledProject.description = fixDunikTypo(compiledProject.description);
      }
      if (Array.isArray(compiledProject.subtitles)) {
        compiledProject.subtitles = compiledProject.subtitles.map((sub: any) => {
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
    }

    res.json({
      success: true,
      mode: 'live-gemini',
      project: compiledProject
    });

  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota') || errorMsg.includes('429')) {
      console.log('[Video AI Engine Info] Gemini API quota limit reached. Activating zero-delay local fallback engine.');
    } else {
      console.log(`[Video AI Engine Info] Connection issue fallback activated: ${errorMsg.slice(0, 150)}`);
    }

    // Dynamic high-quality synthesis based on selected niche to guarantee perfect zero-wait offline operation!
    const simulatedSubtitles: any[] = [];
    const descLower = `${userDescription || ''} ${name || ''} ${resolvedNiche || ''} ${subtitleFallbackText || ''}`.toLowerCase();
    
    const isShoe = descLower.includes('shoe') || descLower.includes('sneaker') || descLower.includes('footwear') || descLower.includes('kick') || descLower.includes('jordan') || descLower.includes('heel') || descLower.includes('slide') || descLower.includes('unbox-sneakers');
    const isCooking = descLower.includes('cook') || descLower.includes('steak') || descLower.includes('food') || descLower.includes('recipe') || descLower.includes('matcha') || descLower.includes('kitchen') || descLower.includes('bake');
    const isPet = descLower.includes('pet') || descLower.includes('puppy') || descLower.includes('dog') || descLower.includes('cat') || descLower.includes('kitten') || descLower.includes('animal') || descLower.includes('golden');
    const isSports = descLower.includes('sport') || descLower.includes('fitness') || descLower.includes('gym') || descLower.includes('workout') || descLower.includes('skate') || descLower.includes('football') || descLower.includes('soccer') || descLower.includes('basketball') || descLower.includes('jump') || descLower.includes('run') || descLower.includes('athletics') || resolvedNiche === 'fitness';

    if (isShoe) {
      const shoeCaptions = [
        { text: "🚨 STOP SCROLLING! Wait till you see these clean kicks", start: 0, end: 1.8, emoji: "👟", highlight: ["STOP", "kicks"] },
        { text: "We literally just got this exclusive shipment in!", start: 1.8, end: 3.5, emoji: "📦", highlight: ["exclusive", "shipment"] },
        { text: "We are unboxing the absolute cleanest retro suede!", start: 3.5, end: 5.2, emoji: "👑", highlight: ["cleanest", "suede"] },
        { text: "This colorway is extremely limited and drops soon", start: 5.2, end: 7.0, emoji: "🔥", highlight: ["limited", "colorway"] },
        { text: "Sliding off this vintage premium drawer box... butter", start: 7.0, end: 8.8, emoji: "💎", highlight: ["premium", "drawer"] },
        { text: "The packaging alone feels like a hundred bucks", start: 8.8, end: 10.5, emoji: "💰", highlight: ["packaging", "hundred"] },
        { text: "Tearing back the crisp tissue paper... there they are!", start: 10.5, end: 12.0, emoji: "✨", highlight: ["tissue", "crisp"] },
        { text: "Look at the detail! The quality is absolutely next-level", start: 12.0, end: 13.0, emoji: "🔍", highlight: ["detail", "quality"] },
        { text: "The texture on this genuine suede is unreal... rich grain!", start: 13.0, end: 14.8, emoji: "👍", highlight: ["texture", "suede"] },
        { text: "No synthetic artificial materials used here at all", start: 14.8, end: 16.0, emoji: "🌿", highlight: ["synthetic", "materials"] },
        { text: "Flawless stitching, premium laces, and real brand tag", start: 16.0, end: 17.5, emoji: "👌", highlight: ["Flawless", "stitching"] },
        { text: "Every single millimeter is hand-crafted perfection", start: 17.5, end: 18.5, emoji: "💯", highlight: ["precision", "perfection"] },
        { text: "Classic throwback comfort with a modern cushy bounce!", start: 18.5, end: 19.8, emoji: "⚡", highlight: ["comfort", "bounce"] },
        { text: "They literally look crazy on-feet with standard street style", start: 19.8, end: 21.2, emoji: "👟", highlight: ["on-feet", "style"] },
        { text: "Sizing advice: go true-to-size or half up for wider feet!", start: 21.2, end: 22.5, emoji: "📏", highlight: ["true-to-size", "Sizing"] },
        { text: "Honestly, at this retail price, they are a complete steal", start: 22.5, end: 23.5, emoji: "💥", highlight: ["steal", "retail"] },
        { text: "👇 Drop your thoughts! Cop or drop? Drop comment now 👇", start: 23.5, end: 24.5, emoji: "🚀", highlight: ["Cop", "drop"] }
      ];
      const nativeScale = resolvedDuration / 24.5;
      shoeCaptions.forEach((cap, i) => {
        simulatedSubtitles.push({
          id: `sub-shoe-${i}`,
          text: cap.text,
          start: Number((cap.start * nativeScale).toFixed(1)),
          end: i === shoeCaptions.length - 1 ? resolvedDuration : Number((cap.end * nativeScale).toFixed(1)),
          emoji: cap.emoji,
          highlightWords: cap.highlight
        });
      });
    } else if (isCooking) {
      const cookingCaptions = [
        { text: "🥩 Stop scrolling! This is officially cooking perfection", start: 0, end: 3.5, emoji: "🍳", highlight: ["perfection", "cooking"] },
        { text: "🔥 Searing down beautiful marbling at a smoking high heat", start: 3.5, end: 7.0, emoji: "🥩", highlight: ["Searing", "heat"] },
        { text: "✨ Golden crispy crust forms as the garlic rosemary bakes", start: 7.0, end: 11.5, emoji: "🧄", highlight: ["crust", "garlic"] },
        { text: "🧈 Basting in foaming brown butter feeds maximum savory flavor", start: 11.5, end: 15.0, emoji: "🧈", highlight: ["Basting", "flavor"] },
        { text: "😲 Let it repose for 5 minutes... look at that juicy center!", start: 15.0, end: 18.0, emoji: "🔪", highlight: ["juicy", "repose"] },
        { text: "🍽️ Plating premium slices with fresh herbs and flaky sea salt", start: 18.0, end: 19.8, emoji: "🧂", highlight: ["plating", "salt"] },
        { text: "😋 First bite crunch test... absolutely melt in your mouth!", start: 19.8, end: 22.0, emoji: "🤤", highlight: ["bite", "melt"] },
        { text: "👇 Drop a comment if you want the full recipe ingredient list", start: 22.0, end: 22.0, emoji: "🚀", highlight: ["recipe", "comment"] }
      ];
      const nativeScale = resolvedDuration / 22.0;
      cookingCaptions.forEach((cap, i) => {
        simulatedSubtitles.push({
          id: `sub-cooking-${i}`,
          text: cap.text,
          start: Number((cap.start * nativeScale).toFixed(1)),
          end: i === cookingCaptions.length - 1 ? resolvedDuration : Number((cap.end * nativeScale).toFixed(1)),
          emoji: cap.emoji,
          highlightWords: cap.highlight
        });
      });
    } else if (isPet) {
      const petCaptions = [
        { text: "🐾 Halts feed! Meet the absolute cutest puppy on this planet", start: 0, end: 3.5, emoji: "🥺", highlight: ["cutest", "puppy"] },
        { text: "🌅 Catching beautiful golden hour sun warming up the grass", start: 3.5, end: 7.0, emoji: "☀️", highlight: ["golden", "sun"] },
        { text: "🌟 Look at those giant brown expressive puppy eyes looking at you", start: 7.0, end: 11.5, emoji: "🐶", highlight: ["puppy", "eyes"] },
        { text: "🥰 That gentle little adorable head tilt is pure heart-melting magic", start: 11.5, end: 15.0, emoji: "✨", highlight: ["tilt", "magic"] },
        { text: "💖 Reminding you that whatever you are stressed about will be fine", start: 15.0, end: 18.0, emoji: "🌸", highlight: ["stressed", "fine"] },
        { text: "🍪 Giving him his favorite beef treat for being such a good boy", start: 18.0, end: 19.8, emoji: "🦴", highlight: ["treat", "boy"] },
        { text: "🐾 Tap the heart and have a completely beautiful day!", start: 19.8, end: 22.0, emoji: "🧸", highlight: ["heart", "beautiful"] },
        { text: "👇 Like Cooper and comment your pet's name to match", start: 22.0, end: 22.0, emoji: "🚀", highlight: ["comment", "Like"] }
      ];
      const nativeScale = resolvedDuration / 22.0;
      petCaptions.forEach((cap, i) => {
        simulatedSubtitles.push({
          id: `sub-pet-${i}`,
          text: cap.text,
          start: Number((cap.start * nativeScale).toFixed(1)),
          end: i === petCaptions.length - 1 ? resolvedDuration : Number((cap.end * nativeScale).toFixed(1)),
          emoji: cap.emoji,
          highlightWords: cap.highlight
        });
      });
    } else if (isSports) {
      const sportsCaptions = [
        { text: "⚡ Stop scrolling! Watch this incredible action highlight", start: 0, end: 3.5, emoji: "🔥", highlight: ["Stop", "highlight"] },
        { text: "💪 Perfect form and absolute extreme focus right here", start: 3.5, end: 7.0, emoji: "🏋️", highlight: ["form", "focus"] },
        { text: "💥 Raising the bar and breaking all personal limits today", start: 7.0, end: 11.5, emoji: "⚡", highlight: ["limits", "bar"] },
        { text: "🚀 Synchronization on point! The hard work pays off", start: 11.5, end: 15.0, emoji: "💯", highlight: ["point", "pays"] },
        { text: "😲 Wait for the climax... this ending is purely mind-blowing", start: 15.0, end: 18.0, emoji: "👀", highlight: ["climax", "ending"] },
        { text: "🏆 Real champion mindset requires absolute full dedication", start: 18.0, end: 19.8, emoji: "🥇", highlight: ["mindset", "dedication"] },
        { text: "✨ Share this video and challenge your training partner now", start: 19.8, end: 22.0, emoji: "👥", highlight: ["challenge", "partner"] },
        { text: "👇 Drop a comment with your fitness goal or favorite sport!", start: 22.0, end: 22.0, emoji: "🚀", highlight: ["goal", "sport"] }
      ];
      const nativeScale = resolvedDuration / 22.0;
      sportsCaptions.forEach((cap, i) => {
        simulatedSubtitles.push({
          id: `sub-sports-${i}`,
          text: cap.text,
          start: Number((cap.start * nativeScale).toFixed(1)),
          end: i === sportsCaptions.length - 1 ? resolvedDuration : Number((cap.end * nativeScale).toFixed(1)),
          emoji: cap.emoji,
          highlightWords: cap.highlight
        });
      });
    } else if (resolvedNiche === 'sales') {
      const salesCaptions = [
        { text: "❌ Bulk backpack posture is OBSOLETE in 2026", start: 0, end: 4.0, emoji: "🎒", highlight: ["OBSOLETE", "❌"] },
        { text: "👑 Check out the ultimate minimalist handmade sling", start: 4.0, end: 8.0, emoji: "💼", highlight: ["minimalist", "sling"] },
        { text: "💧 Waterproof full-grain Italian leather gets better with age", start: 8.0, end: 12.5, emoji: "💎", highlight: ["Waterproof", "Italian"] },
        { text: "🔒 Custom magnetic brass snaps plus anti-theft back pocket", start: 12.5, end: 16.5, emoji: "🔑", highlight: ["anti-theft", "brass"] },
        { text: "💼 Sleek, hyper-functional, and built to last a lifetime", start: 16.5, end: 20.0, emoji: "⚡", highlight: ["lifetime", "Sleek"] },
        { text: "✈️ Free express worldwide shipping and lifetime replacement warranty", start: 20.0, end: 23.0, emoji: "📦", highlight: ["shipping", "warranty"] },
        { text: "⏰ LIMITED FLASH OFFER: Get 30% OFF today only!", start: 23.0, end: 26.0, emoji: "🎁", highlight: ["30%", "⏰"] },
        { text: "🚀 Secure yours right now before this coupon expires", start: 26.0, end: 26.0, emoji: "👇", highlight: ["expires", "coupon"] }
      ];
      
      const nativeScale = resolvedDuration / 26.0;
      salesCaptions.forEach((cap, i) => {
        simulatedSubtitles.push({
          id: `sub-sales-${i}`,
          text: cap.text,
          start: Number((cap.start * nativeScale).toFixed(1)),
          end: i === salesCaptions.length - 1 ? resolvedDuration : Number((cap.end * nativeScale).toFixed(1)),
          emoji: cap.emoji,
          highlightWords: cap.highlight
        });
      });
    } else {
      if (subtitleFallbackText && subtitleFallbackText.trim().length > 0) {
        const words = subtitleFallbackText.split(/\s+/);
        const numWordsPerGroup = 3;
        const durationPerGroup = resolvedDuration / Math.ceil(words.length / numWordsPerGroup);
 
        for (let i = 0; i < words.length; i += numWordsPerGroup) {
          const groupWords = words.slice(i, i + numWordsPerGroup);
          const textGroup = groupWords.join(' ');
          const startSec = Number(((i / numWordsPerGroup) * durationPerGroup).toFixed(2));
          const endSec = Number((startSec + durationPerGroup).toFixed(2));
 
          const emojis = ['🔥', '✨', '⚡', '💯', '🚀', '📦', '💰', '🧠', '🤯', '🎨', '🍳', '💪', '💥'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
 
          simulatedSubtitles.push({
            id: `sub-${i}-${Date.now()}`,
            text: textGroup,
            start: startSec,
            end: endSec > resolvedDuration ? resolvedDuration : endSec,
            emoji: groupWords.length > 1 && Math.random() > 0.4 ? randomEmoji : undefined,
            highlightWords: [groupWords[Math.floor(Math.random() * groupWords.length)]]
          });
        }
      } else {
        // High-converting general social-vlog captions
        const generatedScript = [
          { text: "⏰ SCROLL STOP! You literally need to watch this custom video", start: 0, end: 4.0, emoji: "💥", highlight: ["literally", "STOP"] },
          { text: "⚡ We are breaking down the absolute gamechanger solution", start: 4.0, end: 8.5, emoji: "🚀", highlight: ["gamechanger", "breaking"] },
          { text: "✨ The sheer attention to detail here is completely unmatched", start: 8.5, end: 13.0, emoji: "🏆", highlight: ["unmatched", "detail"] },
          { text: "😲 Real-time retention focus syncs the speed curves instantly", start: 13.0, end: 18.0, emoji: "⚡", highlight: ["retention", "speed"] },
          { text: "🔥 It honestly feels completely illegal to use this tool for free", start: 18.0, end: 23.0, emoji: "💯", highlight: ["illegal", "free"] },
          { text: "👇 Like and drop a comment below with your own channel niche", start: 23.0, end: 23.0, emoji: "💬", highlight: ["niche", "comment"] }
        ];
 
        const nativeScale = resolvedDuration / 23.0;
        generatedScript.forEach((cap, i) => {
          simulatedSubtitles.push({
            id: `sub-${i}-${Date.now()}`,
            text: cap.text,
            start: Number((cap.start * nativeScale).toFixed(1)),
            end: i === generatedScript.length - 1 ? resolvedDuration : Number((cap.end * nativeScale).toFixed(1)),
            emoji: cap.emoji,
            highlightWords: cap.highlight
          });
        });
      }
    }

    // Curated high-impact highlight markers based on the niche
    let simulatedHighlights = [];
    if (isShoe || resolvedNiche === 'unboxing') {
      const scale = resolvedDuration / 24.5;
      simulatedHighlights = [
        {
          id: 'clip-hook',
          title: '🔥 TikTok 3s Hook',
          start: 0,
          end: Number((1.8 * scale).toFixed(1)),
          duration: Number((1.8 * scale).toFixed(1)),
          viralityScore: 99,
          description: 'High-energy curiosity hook to freeze scrolling fingers.',
          whyEngaging: 'Bold physical sneaker package teaser with deep zoom.',
          speed: 1.15
        },
        {
          id: 'clip-reveal',
          title: '👟 Shoe Suede Reveal',
          start: Number((3.5 * scale).toFixed(1)),
          end: Number((5.2 * scale).toFixed(1)),
          duration: Number(((5.2 - 3.5) * scale).toFixed(1)),
          viralityScore: 98,
          description: 'Major shoe reveal dopamine climax.',
          whyEngaging: 'Exclusivity trigger paired with visual contrast pop.',
          speed: 0.50
        },
        {
          id: 'clip-box-slide',
          title: '📦 Butter Drawer Slide',
          start: Number((7.0 * scale).toFixed(1)),
          end: Number((8.8 * scale).toFixed(1)),
          duration: Number(((8.8 - 7.0) * scale).toFixed(1)),
          viralityScore: 96,
          description: 'Aesthetic luxury unboxing slide.',
          whyEngaging: 'Tactile satisfaction movement at high-energy pace.',
          speed: 1.0
        },
        {
          id: 'clip-tissue-tear',
          title: '⚡ Crisp Wrapping Tear',
          start: Number((10.5 * scale).toFixed(1)),
          end: Number((12.0 * scale).toFixed(1)),
          duration: Number(((12.0 - 10.5) * scale).toFixed(1)),
          viralityScore: 95,
          description: 'Tactile sound beat tear action.',
          whyEngaging: 'ASMR response triggers luxury expectation.',
          speed: 1.0
        },
        {
          id: 'clip-texture-closeup',
          title: '🔍 Suede Texture Macro Review (Middle)',
          start: Number((13.0 * scale).toFixed(1)),
          end: Number((14.8 * scale).toFixed(1)),
          duration: Number(((14.8 - 13.0) * scale).toFixed(1)),
          viralityScore: 97,
          description: 'Deep macro zoom closeup of premium fabric.',
          whyEngaging: 'Displays authenticity and high-quality premium grain.',
          speed: 0.60
        },
        {
          id: 'clip-stitching-logo',
          title: '💎 Brand Logo Close-Up (Middle-End)',
          start: Number((16.0 * scale).toFixed(1)),
          end: Number((17.5 * scale).toFixed(1)),
          duration: Number(((17.5 - 16.0) * scale).toFixed(1)),
          viralityScore: 97,
          description: 'Focus camera angle on stitching and tags.',
          whyEngaging: 'High-value brand indicator visual details.',
          speed: 0.75
        },
        {
          id: 'clip-sole-bounce',
          title: '⚡ Cushion Sole Details (Ending)',
          start: Number((18.5 * scale).toFixed(1)),
          end: Number((19.8 * scale).toFixed(1)),
          duration: Number(((19.8 - 18.5) * scale).toFixed(1)),
          viralityScore: 94,
          description: 'Reviewing retro cushy soles and bounce.',
          whyEngaging: 'Visualizes daily utility comfort benefits directly.',
          speed: 1.0
        },
        {
          id: 'clip-on-feet',
          title: '👟 On-Feet Styling Look (Ending)',
          start: Number((19.8 * scale).toFixed(1)),
          end: Number((21.2 * scale).toFixed(1)),
          duration: Number(((21.2 - 19.8) * scale).toFixed(1)),
          viralityScore: 98,
          description: 'Dynamic style walkthrough and aesthetic modeling look on feet.',
          whyEngaging: 'Allows viewer to visualize actual streetwear combination.',
          speed: 0.75
        },
        {
          id: 'clip-sizing-tip',
          title: '📏 Sizing & Fit Tip (Ending)',
          start: Number((21.2 * scale).toFixed(1)),
          end: Number((22.5 * scale).toFixed(1)),
          duration: Number(((22.5 - 21.2) * scale).toFixed(1)),
          viralityScore: 96,
          description: 'True-to-size vs sizing-up advice for wide feet.',
          whyEngaging: 'Highly useful practical decision aid that drives high retention.',
          speed: 1.0
        },
        {
          id: 'clip-cta-steal',
          title: '💰 Double Tap CTA Outro',
          start: Number((22.5 * scale).toFixed(1)),
          end: resolvedDuration,
          duration: Number((resolvedDuration - (22.5 * scale)).toFixed(1)),
          viralityScore: 99,
          description: 'Viral direct-response cop or drop ending.',
          whyEngaging: 'High-converting interactive CTA driving comments.',
          speed: 1.0
        }
      ];
    } else {
      simulatedHighlights = [
        {
          id: 'clip-hook',
          title: 'Ultimate 3s Hook Opt',
          start: 0,
          end: Math.min(resolvedDuration, 5),
          duration: Math.min(resolvedDuration, 5),
          viralityScore: resolvedNiche === 'sales' ? 99 : 98,
          description: 'First 3 seconds immediate pattern interrupt.',
          whyEngaging: 'High frequency words and immediate dynamic zoom.'
        }
      ];

      if (resolvedDuration > 15) {
        simulatedHighlights.push({
          id: 'clip-peak-mid',
          title: '🔥 Viral Highlight (Middle Review)',
          start: Number((resolvedDuration * 0.25).toFixed(1)),
          end: Number((resolvedDuration * 0.55).toFixed(1)),
          duration: Number((resolvedDuration * 0.30).toFixed(1)),
          viralityScore: 94,
          description: 'Mid-roll peak product inspection and user value breakdown.',
          whyEngaging: 'Displays actual item benefits and satisfying physical actions.',
          speed: 1.0
        });
        simulatedHighlights.push({
          id: 'clip-peak-end',
          title: '⚡ Epic Closeup Details',
          start: Number((resolvedDuration * 0.60).toFixed(1)),
          end: Number((resolvedDuration * 0.85).toFixed(1)),
          duration: Number((resolvedDuration * 0.25).toFixed(1)),
          viralityScore: 95,
          description: 'High close-up detail showcasing the premium finish before call to action.',
          whyEngaging: 'Drives high end-of-video attention and satisfaction loops.',
          speed: 0.80
        });
        simulatedHighlights.push({
          id: 'clip-outro-cta',
          title: '🎯 Viral CTA Outro',
          start: Number((resolvedDuration * 0.88).toFixed(1)),
          end: resolvedDuration,
          duration: Number((resolvedDuration * 0.12).toFixed(1)),
          viralityScore: 99,
          description: 'High converting direct response loop comment trigger.',
          whyEngaging: 'Interactive overlays asking users to interact.',
          speed: 1.0
        });
      }
    }

    // Create realistic zoom markers
    let simulatedZooms = [];
    if (isShoe || resolvedNiche === 'unboxing') {
      simulatedZooms = [
        { timestamp: 0.1, scale: 1.18, duration: 1.5 },
        { timestamp: 3.8, scale: 1.25, duration: 1.3 },
        { timestamp: 7.2, scale: 1.15, duration: 1.2 },
        { timestamp: 10.6, scale: 1.22, duration: 1.0 },
        { timestamp: 13.5, scale: 1.3, duration: 1.2 },
        { timestamp: 16.2, scale: 1.35, duration: 1.1 },
        { timestamp: 18.8, scale: 1.18, duration: 1.1 },
        { timestamp: 22.5, scale: 1.1, duration: 2.0 }
      ];
    } else {
      simulatedZooms = [
        { timestamp: 0.5, scale: 1.15, duration: 2.0 },
        { timestamp: Math.min(resolvedDuration - 2, 8.2), scale: 1.1, duration: 1.5 }
      ];
      if (resolvedDuration > 20) {
        simulatedZooms.push({ timestamp: Math.floor(resolvedDuration * 0.6), scale: 1.2, duration: 2.2 });
      }
    }

    // Default static metrics tailored dynamically to the niche
    const viralityMetrics: Record<string, { title: string; score: number; tags: string[]; feedback: string[] }> = {
      unboxing: {
        title: `Slide & Snip: Luxury Unboxing Review`,
        score: 96,
        tags: ['#unboxing', '#productreview', '#satisfying', '#asmrsounds', '#unboxingvideo', '#sneakers'],
        feedback: [
          'Emphasize satisfying sound frequencies (wrapping tissue rips, solid cardboard sliders).',
          'Utilize macro close-ups on tactile product textures during highlight zooms.',
          'Inject sweet, warm-lounge acoustic guitar backing track at 15% volume.'
        ]
      },
      sales: {
        title: `Backpacks are Obsolete: The Minimalist Slide Presentation`,
        score: 98,
        tags: ['#salespitch', '#minimalism', '#dtcbrand', '#leathercraft', '#usefulhacks', '#buyitnow'],
        feedback: [
          'Lead with strong FOMO hook addressing backpack discomfort in first 1.5s.',
          'Highlight discount incentives and CTA triggers using vivid yellow-green subtitles.',
          'Sync microcuts perfectly with brass snap closing points to sustain pacing flow.'
        ]
      },
      cooking: {
        title: `CRUST & SIZZLE: The Perfect Ribeye Roast`,
        score: 95,
        tags: ['#steaks', '#cookinghacks', '#satisfyingfood', '#steaktok', '#foryou'],
        feedback: [
          'Add crisp sizzle audio feedback immediately in the first 0.5 seconds.',
          'Emphasize the butter spoon sequence for an aesthetic slow-motion release.',
          'Format with high contrast warm-vintage color graded pop.'
        ]
      },
      education: {
        title: `AI Creator Secrets Node Revealed`,
        score: 91,
        tags: ['#aitools', '#creatortips', '#viralgrowth', '#businesstok', '#learnontiktok'],
        feedback: [
          'Keep structural dual zoom transitions active to prevent scrolling away.',
          'Highlight phrases addressing creator cost triggers: (Hormozi styled yellow).',
          'Use Minimalist caption aesthetics to maintain a reliable authority profile.'
        ]
      },
      fitness: {
        title: `AM Grind: Stop Making Excuses`,
        score: 97,
        tags: ['#fitnessmotivation', '#gogetit', '#noexcuses', '#5amclub', '#morningroutine'],
        feedback: [
          'Match heavy bass lines precisely at timestamp drops (5.3s).',
          'Inject extreme high energy emoji icons on caption highlights.',
          'Inject dynamic vibrant grading to make raw focus stand out.'
        ]
      },
      tech: {
        title: `satisfying click-thock retro keyboard`,
        score: 94,
        tags: ['#mechanicalkeyboard', '#asmrsounds', '#satisfyingtech', '#desksetup', '#retrostyle'],
        feedback: [
          'Highlight ASMR click frequencies using specialized high-pass treble cuts.',
          'Apply moody cyber cyan/pink color grades to retro keycaps.',
          'Keep spacing very tight with continuous microcuts.'
        ]
      },
      pets: {
        title: `Golden Hour With Cooper the Happy Retreiver`,
        score: 96,
        tags: ['#puppylove', '#goldenretriever', '#petsontiktok', '#doggo', '#wholesome'],
        feedback: [
          'Trigger smooth cinematic zooms on Cooper\'s head-tilt sequence.',
          'Bake soft minimalist caption layouts to prevent masking the puppy face.',
          'Merge slow-paced lofi beats with background wind elements.'
        ]
      },
      general: {
        title: `${resolvedName.replace(/\.[^/.]+$/, '') || 'My Viral Video'} (Optimized)`,
        score: 88,
        tags: ['#viralhack', '#trendingnow', '#fyp', '#editgoals', '#tiktokcreator'],
        feedback: [
          'Utilize bold dual-colored captions (green + yellow) on highlight keypoints.',
          'Keep your video centered to support safe-zone constraints on Reels.',
          'Inject lofi or energetic background tracking to sustain attention span.'
        ]
      }
    };

    const currentNicheConfig = viralityMetrics[resolvedNiche] || viralityMetrics.general;

    // Apply custom imitation metrics in offline fallback mode if specified to make simulation 100% responsive
    let finalTitle = currentNicheConfig.title;
    let finalFeedback = [...currentNicheConfig.feedback];
    let finalScore = currentNicheConfig.score;

    if (imitationOptions) {
      finalTitle = `[CLONED ${imitationOptions.archetype.toUpperCase()}] ${currentNicheConfig.title}`;
      finalScore = Math.min(100, currentNicheConfig.score + 2);
      finalFeedback.unshift(`[Copycat Mimicry Engine] Actively replicating pacing pattern: "${imitationOptions.archetype}"`);
      if (imitationOptions.copyInstructions) {
        finalFeedback.push(`[Cloning Rule Applied] Replicating: "${imitationOptions.copyInstructions}"`);
      }
    }

    // Build simulated structured title and description matching user's exact social-viral templates:
    let simulatedTitle = "";
    let simulatedAltTitles: string[] = [];
    let simulatedAnalysis = "";
    let simulatedDescriptionBody = "";
    let simulatedHashtags: string[] = [];

    const nicheLower = resolvedNiche.toLowerCase();
    if (nicheLower === 'unboxing') {
      const catchy = userDescription || 'Tearing back crisp tissue wraps on these ultra-clean retro suede kicks';
      simulatedTitle = "[Premium Butter Suede Review] Vintage Suede Sneakers 🔥 You NEED to See This!";
      simulatedAltTitles = [
        "Vintage Suede Sneakers Review – Wait Till You See This 😱",
        "INSANE Unboxing Vlog | Pure Butter-Smooth Aesthetic Vibes"
      ];
      simulatedAnalysis = "a black premium suede sneaker being smoothly unboxed from a sleek sliding drawer shoebox, showing the sole, logo, and textures. Key visuals include the beautifully finished vulcanized rubber sole, clean hand-stitched leather panels, and crisp paper insert wraps.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Suede texture holds up incredibly under camera lighting. Perfect fit and flawless overlays for premium street styles.`;
      simulatedHashtags = ['unboxing', 'sneakers', 'sneakerhead', 'shoes', 'streetstyle', 'FYP', 'Reels'];
    } else if (nicheLower === 'sales') {
      const catchy = userDescription || 'Stop carrying bulky backpacks in 2026. This is the ultimate posture and carry hack';
      simulatedTitle = "Handcrafted Minimalist Leather Sling [Built to Last a Lifetime with 30% Off] – Wait Till You See This 😱";
      simulatedAltTitles = [
        "Stop Carrying Bulky Backpacks in 2026! 😱",
        "INSANE Minimalist Leather Gear | Pure Leathercraft Vibes"
      ];
      simulatedAnalysis = "a premium full-grain Italian leather sling bag being modeled in real time, focusing on custom brass snap clips and secure compartments. Key visuals include high-contrast detailed textures, neat edge paint work, and water-repellent zipper liners.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 If you love clean, functional, secure gear, these slings are built from waterproof full-grain leather to hold all daily essentials. Sleek fit and lifetime durability.`;
      simulatedHashtags = ['salespitch', 'minimalism', 'dtcbrand', 'leathercraft', 'usefulhacks', 'styleinspo', 'FYP', 'Reels'];
    } else if (nicheLower === 'cooking') {
      const catchy = userDescription || 'Searing a thick prime garlic butter-basted ribeye on a piping hot cast iron skillet';
      simulatedTitle = "INSANE Steak Cooking ASMR | Pure Savory & Satisfying Vibes";
      simulatedAltTitles = [
        "Basting Thick Juicy Garlic Butter Ribeye 🔥 You NEED to See This!",
        "Perfect Sear Ribeye Cast Iron Hack – Wait Till You See This 😱"
      ];
      simulatedAnalysis = "a thick prime garlic butter-basted ribeye sizzling in a piping hot cast iron skillet. Key visuals include foaming melted butter cascades, fresh green rosemary twigs, cracked garlic cloves, and the perfect rich golden-brown beef sear crust.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Continuous basting with crushed fresh garlic, savory foaming butter, and fresh rosemary sprigs makes this ribeye melt in your mouth delicious. Simple cast iron technique for flawless steak.`;
      simulatedHashtags = ['cooking', 'steaks', 'recipe', 'foodasmr', 'satisfyingfood', 'FYP', 'Reels'];
    } else if (nicheLower === 'education') {
      const catchy = userDescription || 'Auto-generate scroll-stopping hooks and smart caption clips at the click of a button';
      simulatedTitle = "[Automate Subtitles & Zoom Cuts Instantly] AI Creator Editing Tools 🔥 You NEED to See This!";
      simulatedAltTitles = [
        "Ultimate Editing Strategy – Wait Till You See This 😱",
        "INSANE Education Edit Tutorial | Pure Viral Vibes"
      ];
      simulatedAnalysis = "a creator dashboard automatically syncing high-impact subtitles and cinematic zoom cuts onto vertical shorts. Key visuals include dynamic glowing text color previews, easy drag-and-drop video layers, and instant layout options.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Auto-generate scroll-stopping hooks and smart zoom cuts at the click of a button! Completely bypass hiring expensive video editors or spending hours in manual software.`;
      simulatedHashtags = ['aitools', 'creatortips', 'viralgrowth', 'businesstok', 'learnontiktok', 'FYP', 'Reels'];
    } else if (nicheLower === 'fitness') {
      const catchy = userDescription || 'Crushing high-intensity heavy workout repetitions while the whole world is still sleeping';
      simulatedTitle = "Kinetic 5AM Core Routine [No Excuses Motivation Drive] – Wait Till You See This 😱";
      simulatedAltTitles = [
        "Stop Making Excuses & Build Today! 🔥 You NEED to See This!",
        "Morning Motivation Routine – Wait Till You See This 😱"
      ];
      simulatedAnalysis = "heavy calorie-shredding workout core repetitions done under focused gym training lights. Key visuals include sharp form capture patterns, sweat drops, and timed high-intensity sets.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Crushing high-intensity heavy physical training repetitions while the whole world is still sleeping. Testing absolute boundaries, building deep mental stamina, and letting discipline carry us forward.`;
      simulatedHashtags = ['fitnessmotivation', 'gymtok', 'noexcuses', 'morningroutine', 'discipline', 'FYP', 'Reels'];
    } else if (nicheLower === 'tech') {
      const catchy = userDescription || 'Hand-lubricating linear switches and snapping keycaps onto a retro desk setup';
      simulatedTitle = "INSANE Custom Mechanical Keyboard ASMR | Pure Pure Tactile Obsession Vibes";
      simulatedAltTitles = [
        "Retro Mechanical Keyboard Mod – Wait Till You See This 😱",
        "Pure Tactile Keyboard Click ASMR | You NEED to See This! 🔥"
      ];
      simulatedAnalysis = "hand-lubricated linear switch housings and textured retro keycaps snapping onto a heavy aluminum case. Key visuals include individual keyboard stem fittings, gold-plated spring actions, and premium brass plate highlights.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Snapping these custom linear retro keycaps onto a heavy sound-dampened mechanical keyboard setup. Listen closely to this incredibly rich, thocky and pure auditory feedback.`;
      simulatedHashtags = ['mechanicalkeyboard', 'asmrsounds', 'desksetup', 'satisfyingtech', 'clicky', 'FYP', 'Reels'];
    } else if (nicheLower === 'pets') {
      const catchy = userDescription || 'Spending a tranquil sunset watching the sweetest retriever pup play in fresh meadows';
      simulatedTitle = "Cooper the Golden Retriever Puppy [Pure heart-melting wholesome puppy bliss] – Wait Till You See This 😱";
      simulatedAltTitles = [
        "This Puppy's Adorable Head-Tilt 🔥 You NEED to See This!",
        "Pure Golden Retriever Puppy Bliss | Pure Wholesome Puppy Vibes"
      ];
      simulatedAnalysis = "a gorgeous, playful golden retriever puppy tilting its head inquisitively while playing in sunny fresh meadows. Key visuals include bright puppy eyes, a glossy golden-cream fur coat, and a joyful tiny wagging tail in the grass.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Spending a tranquil afternoon with the sweetest golden retriever pup! That adorable, soft head-tilt is guaranteed to instantly melt all of your worries away.`;
      simulatedHashtags = ['puppylove', 'goldenretriever', 'petsontiktok', 'cuteanimals', 'wholesome', 'FYP', 'Reels'];
    } else {
      const catchy = userDescription || 'Instantly optimizing raw camera shots to grab social media feeds with speed curves';
      simulatedTitle = `INSANE ${resolvedName.replace(/\.[^/.]+$/, '') || 'Self-Made'} Short Video | Pure Ultra-High Retention Vibes`;
      simulatedAltTitles = [
        `Viral ${resolvedNiche} Secrets Revealed – Wait Till You See This 😱`,
        `INSANE ${resolvedNiche} Copy Tutorial | Pure Viral Vibes`
      ];
      simulatedAnalysis = "customized quick-cut visual edits overlayed with dual-toned high contrast text layouts optimized for TikTok. Key visuals include sleek timeline zoom cues, rich graphics assets, and professional frame transitions.";
      simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Instantly optimizing raw smartphone capture coordinates using speed curves to keep users locked to your social media stream. Tailoring colors, contrast, and layout blocks for massive attention retention.`;
      simulatedHashtags = ['viralhack', 'trendingnow', 'editgoals', 'tiktokcreator', 'contentcreator', 'FYP', 'Reels'];
    }

    if (imitationOptions) {
      simulatedTitle = `[CLONED ${imitationOptions.archetype.toUpperCase()}] ` + simulatedTitle;
    }

    // Build the exact structured layout required
    const simulatedCTA = (nicheLower === 'unboxing' || nicheLower === 'sales')
      ? "What do you think? Cop or drop? Drop your size/thoughts below 👇"
      : "What do you think? Drop your thoughts below 👇";

    const hashtagsStr = simulatedHashtags.map(t => `#${t}`).join(' ');

    const simulatedDescription = `Video Analysis: This video shows ${simulatedAnalysis}

Recommended Title: ${simulatedTitle}

Alternative Titles:
1. ${simulatedAltTitles[0]}
2. ${simulatedAltTitles[1]}

Optimized Description:
${simulatedDescriptionBody}

${simulatedCTA}

${hashtagsStr}`;

    // Generate simulated dynamic endingCTA and thumbnail recommendations matching the prompt rules
    let simulatedEndingCTA = "Comment 'VIP' below to get the direct access link instantly! 👇 Plus follow for daily drops/tricks.";
    let simulatedThumbnail = "Aesthetic high-contrast product detail shot with bold yellow/pink overlay: 'THIS CHANGES EVERYTHING 😲'";

    if (resolvedNiche === 'cooking') {
      simulatedEndingCTA = "Would you eat this? Comment 'RECIPE' below to get the immediate ingredients! 👇 Plus follow for daily eats.";
      simulatedThumbnail = "Close-up of the sizzling brown butter spoon drizzle with pink bold text overlay: 'ULTIMATE JUICY SEAR 🥩'";
    } else if (resolvedNiche === 'sales' || resolvedNiche === 'unboxing') {
      simulatedEndingCTA = "Is this cop or drop? Let me know 👇 Comment 'LINK' now to steal this VIP deal!";
      simulatedThumbnail = "Macro texture slide box reveal with yellow bold text overlay: 'INSANE DEAL! GONE TOMORROW ⏰'";
    } else if (resolvedNiche === 'pets') {
      simulatedEndingCTA = "What's your pet's name? Drop your comments below 👇 Follow for daily cute vids!";
      simulatedThumbnail = "Expressive puppy head-tilt close up with cyan text overlay: 'SHE DID NOT JUST DO THAT 🥺'";
    } else if (resolvedNiche === 'fitness') {
      simulatedEndingCTA = "No excuses! Are you starting today? Comment your fitness goals 👇 and subscribe!";
      simulatedThumbnail = "Sweaty finish line achievement look with yellow text overlay: 'STOP MAKING EXCUSES 🔥'";
    }

    let simCaptionStyle = 'mrbeast';
    let simMusicTrack = 'lofi-sunset';
    let simColorGrade = 'cinematic';
    let simTransition = 'crossfade';

    let simWhoosh = false;
    let simPop = false;
    let simImpact = false;
    let simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
    let simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
    let simImpactUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/bass.mp3';

    const isFashion = name.toLowerCase().includes('fashion') || name.toLowerCase().includes('runway') || name.toLowerCase().includes('model') || name.toLowerCase().includes('photo') || name.toLowerCase().includes('zendaya') || descriptionText.toLowerCase().includes('fashion') || descriptionText.toLowerCase().includes('runway') || descriptionText.toLowerCase().includes('model') || descriptionText.toLowerCase().includes('photo') || descriptionText.toLowerCase().includes('zendaya');

    if (isCooking) {
      simCaptionStyle = 'minimalist';
      simMusicTrack = 'serene-view';
      simColorGrade = 'vibrant_pop';
      simTransition = 'crossfade';
      simWhoosh = false;
      simPop = false;
      simImpact = false;
    } else if (isSports) {
      simCaptionStyle = 'impact';
      simMusicTrack = 'cyberpunk-synth';
      simColorGrade = 'cinematic';
      simTransition = 'glitch';
      simWhoosh = true;
      simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
      simPop = false;
      simImpact = true;
    } else if (isFashion) {
      simCaptionStyle = 'minimalist';
      simMusicTrack = 'serene-view';
      simColorGrade = 'cinematic';
      simTransition = 'crossfade';
      simWhoosh = false;
      simPop = true; // YES! Camera shutter clicks for fashion photoshoot/runway modeling poses!
      simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
      simImpact = false;
    } else if (isPet) {
      simCaptionStyle = 'comic';
      simMusicTrack = 'lofi-sunset';
      simColorGrade = 'warm_vintage';
      simTransition = 'zoom';
      simWhoosh = true;
      simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-high.mp3';
      simPop = true;
      simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/fancy-beer-bottle-pop.mp3';
      simImpact = false;
    } else if (isShoe) {
      simCaptionStyle = 'hormozi';
      simMusicTrack = 'hip-hop-vibe';
      simColorGrade = 'warm_vintage';
      simTransition = 'zoom';
      simWhoosh = true;
      simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
      simPop = true;
      simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
      simImpact = false;
    } else if (resolvedNiche === 'sales') {
      simCaptionStyle = 'mrbeast';
      simMusicTrack = 'holliday-jam';
      simColorGrade = 'cinematic';
      simTransition = 'slide_left';
      simWhoosh = true;
      simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
      simPop = true;
      simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
      simImpact = false;
    } else if (resolvedNiche === 'tech') {
      simCaptionStyle = 'impact';
      simMusicTrack = 'cyberpunk-synth';
      simColorGrade = 'moody_cyber';
      simTransition = 'glitch';
      simWhoosh = true;
      simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
      simPop = true;
      simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
      simImpact = false;
    }

    const simulatedProject = {
      title: fixDunikTypo(simulatedTitle),
      alternativeTitles: simulatedAltTitles,
      description: fixDunikTypo(simulatedDescription),
      tags: currentNicheConfig.tags,
      viralityScore: finalScore,
      viralityCriteria: {
        hook: Math.floor(Math.random() * 15) + 85,
        pacing: Math.floor(Math.random() * 12) + 84,
        emotion: Math.floor(Math.random() * 15) + 80,
        visualContrast: Math.floor(Math.random() * 18) + 80
      },
      viralityFeedback: finalFeedback,
      highlights: simulatedHighlights,
      subtitles: simulatedSubtitles.map((sub: any) => {
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
      }),
      zoomEffects: simulatedZooms,
      endingCTA: simulatedEndingCTA,
      thumbnailRecommendation: simulatedThumbnail,
      captionStyle: simCaptionStyle,
      selectedMusicTrackId: simMusicTrack,
      colorGrade: simColorGrade,
      transitionStyle: simTransition,
      sfxWhooshEnabled: simWhoosh,
      sfxPopEnabled: simPop,
      sfxImpactEnabled: simImpact,
      sfxWhooshUrl: simWhooshUrl,
      sfxPopUrl: simPopUrl,
      sfxImpactUrl: simImpactUrl
    };

    res.json({
      success: true,
      mode: 'simulated-engine',
      project: simulatedProject
    });
  } finally {
    // Gracefully clean up all local transient analysis assets
    if (inputTempPath) {
      try { fs.unlinkSync(inputTempPath); console.log('[Cleanup] Deleted input temp file:', inputTempPath); } catch (_) {}
    }
    if (audioTempPath) {
      try { fs.unlinkSync(audioTempPath); console.log('[Cleanup] Deleted audio temp file:', audioTempPath); } catch (_) {}
    }
    keyframeTempPaths.forEach((kp) => {
      try { fs.unlinkSync(kp); console.log('[Cleanup] Deleted keyframe temp file:', kp); } catch (_) {}
    });
  }
});

// REST route: POST copilot-optimize
app.post('/api/copilot-optimize', async (req, res) => {
  const { subtitles, title, description, niche, command, actionType, isFallbackRequested } = req.body;
  const resolvedNiche = niche || 'general';
  const resolvedTitle = title || 'Untitled Clip';
  const resolvedDesc = description || '';
  const resolvedSubtitles = subtitles || [];
  const resolvedCommand = command || '';
  const resolvedAction = actionType || 'chat';

  console.log(`[AI Copilot Engine] Action: [${resolvedAction}] Niche: [${resolvedNiche}] Command: "${resolvedCommand}"`);

  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && process.env.GEMINI_API_KEY.trim() !== '';

    if (isFallbackRequested || !hasApiKey) {
      throw new Error('Fallback simulation mode or missing Gemini API key');
    }

    const ai = getGeminiClient();

    const systemPrompt = `You are the chief AI Video optimization and self-healing engineer inside the "Auto Viral Video Editor".
Your goal is to optimize, refine, correct, or dramatically improve the text metrics of the current short-form video project.

You are given:
1. Current Subtitles: ${JSON.stringify(resolvedSubtitles, null, 2)}
2. Current Video Title: "${resolvedTitle}"
3. Current Video Description/Captions: "${resolvedDesc}"
4. Active Creator Niche: "${resolvedNiche}"

Perform the specified optimization task:
- "spellcheck": Scan subtitles for grammatical mistakes, punctuation errors, capitalization fixes, or spelling issues. Fix them. Preserve original start/end timestamps exactly.
- "gaprepair": Repair timing issues. If adjacent subtitles overlap (i.e. subtitle i end is greater than subtitle i+1 start), adjust the ends/starts so they meet smoothly with zero overlap. If there are massive gaps, keep them but ensure timing flow is clean.
- "pacing": High-retention short form requires snappy pacing. Split any subtitle elements that contain more than 5 words or take longer than 3 seconds into multiple smaller, highly responsive consecutive segments. Linearly interpolate their timestamps.
- "hookboost": Grip viewer attention in the first 3 seconds! Optimize the title to be extremely high click-through-rate (using viral formats). Rewrite the first 2-3 subtitle lines to start with high-curiosity or pattern-interrupt hooks. Create an irresistible caption for description.
- "chat": Interpret and execute the user's custom instruction: "${resolvedCommand}". Apply the requested modifications (e.g. adding relevant high-retention emojis to all subtitle lines, rewriting in a funny/sales/sarcastic tone, translating keywords, or shifting formatting style).

Ensure that:
1. Every modified subtitle element retains a unique "id".
2. The timestamps are valid numbers and sorted chronologically.
3. Every word in the modified subtitles has corresponding timestamps if requested, or keep the subtitle-level timing clean.
4. Return a detailed, encouraging "advice" summarizing exactly what you healed, polished, or improved.

Return ONLY a JSON response matching the requested schema.`;

    let response;
    let fallbackSuccess = false;
    let apiError: any = null;
    const modelOptions = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const targetModel of modelOptions) {
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[AI Copilot Engine] Querying ${targetModel} (Attempt ${attempt}/${maxAttempts})`);
          response = await ai.models.generateContent({
            model: targetModel,
            contents: systemPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  subtitles: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING },
                        start: { type: Type.NUMBER },
                        end: { type: Type.NUMBER },
                        highlightWords: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        }
                      },
                      required: ['id', 'text', 'start', 'end']
                    }
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  advice: { type: Type.STRING }
                },
                required: ['subtitles', 'title', 'description', 'advice']
              }
            }
          });
          if (response && response.text) {
            fallbackSuccess = true;
            console.log(`[AI Copilot Engine] Success with ${targetModel}`);
            break;
          }
        } catch (err: any) {
          apiError = err;
          console.log(`[AI Copilot Engine] Model ${targetModel} error: ${err?.message || err}`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
      if (fallbackSuccess) {
        break;
      }
    }

    if (!fallbackSuccess || !response || !response.text) {
      throw apiError || new Error('Failed to query Gemini API');
    }

    const parsed = JSON.parse(response.text.trim());
    res.json({
      success: true,
      mode: 'live-gemini',
      subtitles: parsed.subtitles || resolvedSubtitles,
      title: parsed.title || resolvedTitle,
      description: parsed.description || resolvedDesc,
      advice: parsed.advice || 'Successfully polished and auto-healed workspace assets.'
    });

  } catch (err: any) {
    console.log(`[AI Copilot Engine] Running robust offline self-healing engine fallback: ${err?.message || err}`);
    
    // Create direct local rule-based healing logic
    let modifiedSubs = JSON.parse(JSON.stringify(resolvedSubtitles));
    let modifiedTitle = resolvedTitle;
    let modifiedDesc = resolvedDesc;
    let adviceSummary = '';

    if (resolvedAction === 'spellcheck') {
      // Correct common capitalization and punctuation issues
      modifiedSubs = modifiedSubs.map((sub: any) => {
        let text = sub.text.trim();
        // Capitalize first letter
        if (text.length > 0) {
          text = text.charAt(0).toUpperCase() + text.slice(1);
        }
        text = fixDunikTypo(text);
        return { ...sub, text };
      });
      modifiedTitle = fixDunikTypo(modifiedTitle);
      modifiedDesc = fixDunikTypo(modifiedDesc);
      adviceSummary = 'Self-Healed spelling errors, sanitized variables, and polished capitalization using active local rules.';

    } else if (resolvedAction === 'gaprepair') {
      // Fix timing overlaps
      for (let i = 0; i < modifiedSubs.length - 1; i++) {
        if (modifiedSubs[i].end > modifiedSubs[i + 1].start) {
          // Adjust end of i to meet start of i+1
          modifiedSubs[i].end = parseFloat(modifiedSubs[i + 1].start.toFixed(2));
        }
      }
      adviceSummary = 'Analyzed timeline track and eliminated subtitle timing overlaps to guarantee seamless frame display.';

    } else if (resolvedAction === 'pacing') {
      // Split subtitles that are too long
      const newSubs: any[] = [];
      modifiedSubs.forEach((sub: any) => {
        const words = sub.text.split(' ');
        if (words.length > 5 && (sub.end - sub.start) > 2.0) {
          // Split into two parts
          const midPoint = Math.floor(words.length / 2);
          const firstText = words.slice(0, midPoint).join(' ');
          const secondText = words.slice(midPoint).join(' ');
          const midTime = parseFloat((sub.start + (sub.end - sub.start) / 2).toFixed(2));
          
          newSubs.push({
            id: `${sub.id}-p1`,
            text: firstText,
            start: sub.start,
            end: midTime,
            highlightWords: sub.highlightWords ? sub.highlightWords.filter((w: string) => firstText.toLowerCase().includes(w.toLowerCase())) : []
          });
          newSubs.push({
            id: `${sub.id}-p2`,
            text: secondText,
            start: midTime,
            end: sub.end,
            highlightWords: sub.highlightWords ? sub.highlightWords.filter((w: string) => secondText.toLowerCase().includes(w.toLowerCase())) : []
          });
        } else {
          newSubs.push(sub);
        }
      });
      modifiedSubs = newSubs;
      adviceSummary = 'Refined pacing timeline by splitting heavy subtitles into snappy, viewer-friendly short segments.';

    } else if (resolvedAction === 'hookboost') {
      // Add impact trigger words to the start
      if (modifiedSubs.length > 0) {
        if (!modifiedSubs[0].text.startsWith('🔥') && !modifiedSubs[0].text.toUpperCase().includes('STOP')) {
          modifiedSubs[0].text = `🔥 STOP! ${modifiedSubs[0].text}`;
        }
      }
      if (!modifiedTitle.includes('📈') && !modifiedTitle.includes('🔥')) {
        modifiedTitle = `🔥 Viral Hack: ${modifiedTitle}`;
      }
      modifiedDesc = `🚨 THIS IS THE SECRET! 🚨\n\n${modifiedDesc}\n\n#viral #trends #foryou`;
      adviceSummary = 'Injected high-converting scroll-stoppers, viral emojis, and curiosity headers to boost viewer retention.';

    } else {
      // Interpret chat commands locally
      const cmd = resolvedCommand.toLowerCase();
      if (cmd.includes('emoji')) {
        modifiedSubs = modifiedSubs.map((sub: any, idx: number) => {
          const emojis = ['🔥', '🚀', '💡', '🤫', '🚨', '👀', '💯', '✨', '⚡'];
          const selectedEmoji = emojis[idx % emojis.length];
          return {
            ...sub,
            text: sub.text.includes(selectedEmoji) ? sub.text : `${selectedEmoji} ${sub.text}`
          };
        });
        adviceSummary = 'Successfully parsed chat request: Added relevant high-retention aesthetic emojis across the timeline.';
      } else if (cmd.includes('sales') || cmd.includes('marketing') || cmd.includes('pitch')) {
        if (modifiedSubs.length > 0) {
          modifiedSubs[0].text = "🤫 The secret they don't want you to know...";
        }
        modifiedTitle = `🚀 Pitch: ${modifiedTitle}`;
        adviceSummary = 'Adjusted project tone to authoritative Sales & Marketing pacing with strong visual hook cues.';
      } else {
        // Simple append/typo corrections
        modifiedSubs = modifiedSubs.map((sub: any) => ({
          ...sub,
          text: fixDunikTypo(sub.text)
        }));
        adviceSummary = `Executed custom co-pilot optimization command: "${resolvedCommand}". All parameters fully synchronized!`;
      }
    }

    res.json({
      success: true,
      mode: 'simulated-engine',
      subtitles: modifiedSubs,
      title: modifiedTitle,
      description: modifiedDesc,
      advice: adviceSummary
    });
  }
});

// REST route: POST detect-cuts
app.post('/api/detect-cuts', async (req, res) => {
  const { subtitles, duration, niche, title, description, isFallbackRequested } = req.body;
  const resolvedNiche = niche || 'general';
  const resolvedDuration = Number(duration) || 30;

  try {
    const hasApiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && process.env.GEMINI_API_KEY.trim() !== '';

    if (isFallbackRequested || !hasApiKey) {
      throw new Error('Fallback simulation mode or missing Gemini API key');
    }

    const ai = getGeminiClient();

    const systemPrompt = `You are the ultimate Video Editor AI specializing in professional short-form videos (TikTok, YouTube Shorts, Instagram Reels).
Analyze this video segment timeline to deduce where physical "scene cuts", transitions, or key visual beats are located.
Look at:
1. Video Title: "${title || 'Untitled'}"
2. Video Niche: "${resolvedNiche}"
3. Video Narrative/Event Context: "${description || 'No description available'}"
4. Script Lines & Transcribed Timing:
${JSON.stringify(subtitles || [], null, 2)}

Identify the natural narrative transitions, pauses, sudden shifts in focus, or audio highlights. Generate logical scene cuts or visual transition moments from 0 to ${resolvedDuration} seconds.
For each detected scene change or cut:
- Provide an ID (e.g. cut-1, cut-2)
- Provide a precise timestamp in seconds (must be sorted ascending, between 0 and ${resolvedDuration})
- Provide a brief punchy label (e.g., "Pattern Interrupt", "Detail Reveal", "Visual Pivot", "Audio Spike", "Action Beat")
- Provide a transition type ('cut' | 'fade' | 'zoom' | 'flash' | 'sound-beat')
- Provide a description of what is happening or why a cut makes sense at this timestamp (e.g. "Script transition to key features", "Dramatic shift on action word", "Audio pause pacing interrupt").

Aim for 4 to 10 logical cuts depending on total duration (${resolvedDuration}s) to help editors jump straight to dramatic beats. Return ONLY JSON conforming strictly to the requested schema.`;

    let response;
    let fallbackSuccess = false;
    let apiError: any = null;
    const modelOptions = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    for (const targetModel of modelOptions) {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[Video AI Cuts Engine] Querying model: ${targetModel} (Attempt ${attempt}/${maxAttempts})`);
          response = await ai.models.generateContent({
            model: targetModel,
            contents: systemPrompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  cuts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        timestamp: { type: Type.NUMBER },
                        label: { type: Type.STRING },
                        type: { type: Type.STRING },
                        description: { type: Type.STRING },
                        confidence: { type: Type.NUMBER }
                      },
                      required: ['id', 'timestamp', 'label', 'type', 'description']
                    }
                  }
                },
                required: ['cuts']
              }
            }
          });

          if (response && response.text) {
            fallbackSuccess = true;
            console.log(`[Video AI Cuts Engine] Cuts successfully generated by model: ${targetModel} on attempt ${attempt}`);
            break;
          }
        } catch (err: any) {
          apiError = err;
          const rawMsg = err?.message || String(err);
          const isThrottle = rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('quota') || rawMsg.includes('429');
          const isOverloaded = rawMsg.includes('503') || rawMsg.includes('temp') || rawMsg.includes('demand') || rawMsg.includes('overloaded');
          
          if (isThrottle) {
            console.log(`[Video AI Cuts Engine] Model ${targetModel} is throttled/rate-limited.`);
          } else if (isOverloaded) {
            console.log(`[Video AI Cuts Engine] Model ${targetModel} is experiencing temporary high demand (503).`);
          } else {
            console.log(`[Video AI Cuts Engine] Model ${targetModel} error (attempt ${attempt}): ${rawMsg.slice(0, 150)}`);
          }

          if (attempt < maxAttempts) {
            const delay = 500 * Math.pow(2, attempt - 1);
            console.log(`[Video AI Cuts Engine] Waiting ${delay}ms before retry...`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
      if (fallbackSuccess) {
        break;
      }
    }

    if (!fallbackSuccess || !response || !response.text) {
      throw apiError || new Error('Failed to generate cuts with Gemini');
    }

    const parsed = JSON.parse(response.text.trim());
    const cuts = parsed.cuts || [];
    res.json({
      success: true,
      mode: 'live-gemini',
      cuts: cuts.sort((a: any, b: any) => a.timestamp - b.timestamp)
    });

  } catch (err: any) {
    console.log(`[Video AI Cuts Engine] Activating rule-based heuristic fallback: ${err?.message || err}`);

    const cuts: any[] = [];
    const resolvedSubs = subtitles || [];
    const totalDuration = resolvedDuration;

    // Cut 1: Always at start or after hook
    cuts.push({
      id: "cut-1",
      timestamp: 0.2,
      label: "Hook Slide",
      type: "zoom",
      description: "Immediate pattern interrupt to stop the scroll.",
      confidence: 0.95
    });

    let cutIndex = 2;
    const lastCutTime = () => {
      return cuts.length > 0 ? cuts[cuts.length - 1].timestamp : 0;
    };

    for (let i = 0; i < resolvedSubs.length - 1; i++) {
      const currentEnd = resolvedSubs[i].end;
      const nextStart = resolvedSubs[i + 1].start;
      const gap = nextStart - currentEnd;

      if (gap > 0.1 || (nextStart - lastCutTime() > 4.5)) {
        const cutTime = parseFloat(((currentEnd + nextStart) / 2).toFixed(2));
        if (cutTime < totalDuration - 2 && cutTime > 1.5 && cutTime - lastCutTime() > 2.0) {
          let label = "Scene Swapping";
          let type = "cut";
          let desc = "Pacing cut timed perfectly with script transition.";

          if (cutIndex === 2) {
            label = "Visual Detail Zoom";
            type = "zoom";
            desc = "Macro detail zoom coinciding with second script statement.";
          } else if (cutIndex === 3) {
            label = "Action Beat Cut";
            type = "flash";
            desc = "Dynamic screen transition flare for visual rhythm.";
          } else if (cutIndex === 4) {
            label = "Contrast Pivot";
            type = "fade";
            desc = "Soft scenic transition matching speech inflection.";
          }

          cuts.push({
            id: `cut-${cutIndex}`,
            timestamp: cutTime,
            label,
            type,
            description: desc,
            confidence: 0.82
          });
          cutIndex++;
        }
      }
    }

    const lastSub = resolvedSubs[resolvedSubs.length - 1];
    const ctaCutTime = lastSub ? Math.max(1.5, parseFloat((lastSub.start - 0.1).toFixed(2))) : parseFloat((totalDuration * 0.8).toFixed(2));
    if (ctaCutTime > lastCutTime() + 1.5 && ctaCutTime < totalDuration) {
      cuts.push({
        id: `cut-${cutIndex}`,
        timestamp: ctaCutTime,
        label: "CTA Outro Cue",
        type: "sound-beat",
        description: "Dynamic transition right before the final core call-to-action.",
        confidence: 0.9
      });
    }

    if (cuts.length < 3) {
      const intervals = [0.2, parseFloat((totalDuration * 0.35).toFixed(2)), parseFloat((totalDuration * 0.7).toFixed(2))];
      cuts.length = 0;
      intervals.forEach((t, i) => {
        if (t < totalDuration) {
          let label = "Hook Entrance";
          let type = "zoom";
          let desc = "Scroll-stopping zoom entrance.";
          if (i === 1) {
            label = "Feature Cut-away";
            type = "cut";
            desc = "Side-angle focus swap matching narrative pacing.";
          } else if (i === 2) {
            label = "Outro CTA Beat";
            type = "sound-beat";
            desc = "Aesthetic transition guiding response engagement.";
          }
          cuts.push({
            id: `cut-h-${i + 1}`,
            timestamp: t,
            label,
            type,
            description: desc,
            confidence: 0.75
          });
        }
      });
    }

    res.json({
      success: true,
      mode: 'simulated-engine',
      cuts: cuts.sort((a, b) => a.timestamp - b.timestamp)
    });
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
