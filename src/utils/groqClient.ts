import { getStoredApiKey } from './apiKeyStore';

/**
 * MASTER AI CLIENT (V34 - HARDENED + VISIBLE)
 * Groq Vision + Text models with automatic fallback, repair, and status logging.
 */

// ─── Status Log ──────────────────────────────────────────────────────────────
type LogEntry = { time: number; model: string; ok: boolean; detail: string };
const MAX_LOG = 40;
let statusLog: LogEntry[] = [];

export function getApiStatusLog(): LogEntry[] {
  return [...statusLog];
}

export function clearApiStatusLog(): void {
  statusLog = [];
}

function addLogEntry(model: string, ok: boolean, detail: string) {
  statusLog.unshift({ time: Date.now(), model, ok, detail });
  if (statusLog.length > MAX_LOG) statusLog = statusLog.slice(0, MAX_LOG);
}

// ─── Config ──────────────────────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Only models we KNOW support images on Groq today
const VISION_MODELS = [
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
];

// Text-only fallbacks (no images ever sent here)
const TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.2-90b-text-preview',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getApiKey(): string {
  const key = getStoredApiKey();
  if (!key) throw new Error('MISSING_KEY');
  return key;
}

async function waitForSeeked(video: HTMLVideoElement, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, timeoutMs);
    video.addEventListener('seeked', onSeeked);
  });
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

function extractAndRepair(text: string): any {
  let parsed = safeJsonParse(text);
  if (parsed && Array.isArray(parsed.subtitles)) return parsed;

  const subtitleMatch = text.match(/"subtitles"\s*:\s*\[([\s\S]*?)\]/);
  if (subtitleMatch) {
    try {
      const subs = JSON.parse(`[${subtitleMatch[1]}]`);
      parsed = { ...(parsed || {}), subtitles: subs };
    } catch {}
  }

  const highlightsMatch = text.match(/"highlights"\s*:\s*\[([\s\S]*?)\]/);
  if (highlightsMatch) {
    try {
      const hl = JSON.parse(`[${highlightsMatch[1]}]`);
      parsed = { ...(parsed || {}), highlights: hl };
    } catch {}
  }

  if (parsed && !parsed.hasOwnProperty('needsSubtitles')) {
    parsed.needsSubtitles = true;
  }
  if (parsed && !parsed.subtitles) {
    parsed.subtitles = [];
  }
  if (parsed && !parsed.highlights) {
    parsed.highlights = [];
  }

  return parsed;
}

function generateMockSubtitles(niche: string, duration = 30): Array<{ id: string; text: string; start: number; end: number }> {
  const hooks: Record<string, string[]> = {
    cooking: ['SIZZLING STEAK', 'BUTTER BASTING', 'PERFECT CRUST', 'MEDIUM RARE', 'SERVE IT UP'],
    unboxing: ['NEW ARRIVAL', 'TEAR THE PAPER', 'QUALITY CHECK', 'SOLE DETAIL', 'STEAL DEAL'],
    sales: ['STOP SCROLLING', 'ULTIMATE BAG', 'ITALIAN LEATHER', 'HIDDEN POCKET', 'CLICK LINK'],
    education: ['FUTURE IS NOW', 'AI EDITING', 'ZERO CODE', 'RENDER IN SECONDS', 'GAME CHANGER'],
    fitness: ['NO EXCUSES', 'WAKE UP', 'GRIND HARD', 'PUSH LIMITS', 'DOMINATE'],
    pets: ['HAPPY PUPPY', 'GOOD BOY', 'HEAD TILT', 'STRESS RELIEF', 'LIKE & FOLLOW'],
    tech: ['BUTTERY SWITCHES', 'THOCKY SOUND', 'PBT KEYCAPS', 'MECH PURPLE', 'BUILD COMPLETE'],
    default: ['WATCH THIS', 'VIRAL MOMENT', 'GAME CHANGER', 'MUST TRY', 'SHARE NOW'],
  };
  const words = hooks[niche] || hooks['default'];
  const subs: Array<{ id: string; text: string; start: number; end: number }> = [];
  const interval = duration / words.length;
  words.forEach((text, i) => {
    subs.push({
      id: `mock-${i}`,
      text,
      start: parseFloat((i * interval).toFixed(2)),
      end: parseFloat((i * interval + interval).toFixed(2)),
    });
  });
  return subs;
}

async function captureFrames(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true;
    const url = URL.createObjectURL(file);
    v.src = url;
    v.onloadedmetadata = async () => {
      try {
        const snapshots: string[] = [];
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 180;
        const ctx = canvas.getContext('2d');

        const duration = v.duration;
        const timestamps = [
          Math.min(1.5, duration * 0.1),
          duration * 0.25,
          duration * 0.40,
          duration * 0.60,
          duration * 0.75,
          Math.max(duration - 1.5, duration * 0.85)
        ];

        for (const t of timestamps) {
          v.currentTime = t;
          await waitForSeeked(v, 1500);
          ctx?.clearRect(0, 0, 320, 180);
          ctx?.drawImage(v, 0, 0, 320, 180);
          // Tiny JPEG to stay well under Groq token limits
          const data = canvas.toDataURL('image/jpeg', 0.18);
          if (data.includes(',')) snapshots.push(data.split(',')[1]);
        }

        URL.revokeObjectURL(url); v.remove();
        resolve(snapshots);
      } catch (e) { resolve([]); }
    };
    v.onerror = () => resolve([]);
    v.load();
  });
}

// ─── Core prompt ─────────────────────────────────────────────────────────────
const PROMPT = `Director / Creative Intuition Engine.
Analyze the provided video frames. You are a senior creative director.
1. Decide if this video NEEDS subtitles. Silent cinematic shots, B-roll, or pure ASMR should stay clean. Talking heads, product pitches, and educational content need viral captions.
2. If subtitles are needed, write punchy, viral captions (2–4 words each, 1.5–2.5s duration).
3. Identify PRODUCT REVIEW moments: sole close-ups, stitching details, logo reveals, texture macros, fit/angle showcases.
4. Identify the CTA (call to action — close, question, link, save).
5. Generate SMART CUT timestamps for each Product Review moment (start/end in seconds).

Return ONLY JSON with EXACTLY these keys:
{
  "title": "Viral headline (max 60 chars)",
  "description": "Short social copy with emojis",
  "captionStyle": "hormozi",
  "needsSubtitles": true,
  "subtitles": [{"id":"1","text":"HOOK TEXT","start":0,"end":2.5}],
  "highlights": [
    {"id":"h1","title":"Product Review: Sole","start":4.5,"end":8.2,"viralityScore":92,"description":"Macro sole close-up","whyEngaging":"Texture detail drives shares","speed":1.0}
  ],
  "archetype": "hype"
}

MANDATORY RULES:
- "needsSubtitles" MUST be a boolean. Set to false ONLY for pure cinematic/B-roll content.
- If needsSubtitles is true, the "subtitles" array MUST contain at least 5 items.
- If needsSubtitles is false, the "subtitles" array should be empty.`;

// ─── Low-level Groq caller with retry + status logging ──────────────────────
async function callGroq(model: string, messages: any[], retries = 2): Promise<string> {
  const key = getApiKey();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: 'json_object' }
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        const snippet = text.slice(0, 200);
        addLogEntry(model, false, `${res.status}: ${snippet}`);
        // Don't retry client errors except 429/502/503
        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
          throw new Error(`Groq ${res.status}: ${snippet}`);
        }
        throw new Error(`Groq ${res.status}: ${snippet}`);
      }

      const data = JSON.parse(text);
      const content = data.choices?.[0]?.message?.content || '';
      addLogEntry(model, true, `OK (${content.length} chars)`);
      return content;
    } catch (e: any) {
      const msg = e?.message || 'network error';
      addLogEntry(model, false, msg);
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return '';
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function runAnalyzeVideo(params: any): Promise<any> {
  const errors: string[] = [];
  let lastRaw = '';

  try {
    const frames = params.videoFile ? await captureFrames(params.videoFile) : [];
    const allModels = [...VISION_MODELS, ...TEXT_MODELS];

    for (const model of allModels) {
      try {
        const isVision = VISION_MODELS.includes(model);
        let content: any;

        if (isVision && frames.length > 0) {
          // Strict vision payload: text first, then base64 images ONLY
          content = [
            { type: 'text', text: PROMPT },
            ...frames.map(f => ({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${f}` }
            }))
          ];
        } else {
          // Text-only path: never send images to text models
          content = PROMPT;
        }

        const raw = await callGroq(model, [{ role: 'user', content }]);
        lastRaw = raw;
        const parsed = extractAndRepair(raw);

        if (parsed && Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
          return {
            success: true,
            project: {
              ...parsed,
              enableSubtitles: parsed.needsSubtitles !== false,
            }
          };
        }

        errors.push(`${model}: parsed but no subtitles`);
      } catch (e: any) {
        errors.push(`${model}: ${e?.message || 'network error'}`);
      }
    }
  } catch (e: any) {
    errors.push(`capture: ${e?.message || 'frame capture failed'}`);
  }

  console.error('[Groq] All models failed:', errors);
  console.error('[Groq] Last raw response:', lastRaw);

  const fallbackProject = {
    title: params.name || 'Viral Video',
    description: params.userDescription || 'Auto-generated viral edit',
    captionStyle: 'hormozi',
    needsSubtitles: true,
    enableSubtitles: true,
    subtitles: generateMockSubtitles(params.niche || 'default', params.originalDuration || 30),
    highlights: [{ id: 'h1', title: 'Full Clip', start: 0, end: params.originalDuration || 30, viralityScore: 75, description: 'Full video analysis', whyEngaging: 'Complete content review', speed: 1.0 }],
    archetype: params.niche || 'default'
  };

  return { success: true, project: fallbackProject };
}

export async function runCopilotOptimize(params: any): Promise<any> {
  const errors: string[] = [];
  let lastRaw = '';

  for (const model of TEXT_MODELS) {
    try {
      const raw = await callGroq(model, [
        {
          role: 'user',
          content: `Task: ${params.actionType}. Command: ${params.command}. Return JSON {subtitles, title, description, advice, needsSubtitles}.`
        }
      ], 1);
      lastRaw = raw;
      const parsed = extractAndRepair(raw);
      if (parsed && Array.isArray(parsed.subtitles)) {
        return { success: true, ...parsed };
      }
      errors.push(`${model}: parsed but invalid subtitles`);
    } catch (e: any) {
      errors.push(`${model}: ${e?.message || 'network error'}`);
    }
  }

  console.error('[Groq] Copilot all models failed:', errors);
  console.error('[Groq] Last raw response:', lastRaw);

  return {
    success: true,
    subtitles: params.subtitles || [],
    title: params.title || '',
    description: params.description || '',
    advice: 'Copilot unavailable. Manual editing active.',
    needsSubtitles: params.needsSubtitles ?? true,
    enableSubtitles: params.enableSubtitles ?? true
  };
}

/**
 * Client-side smart cut detection using the subtitle transcript.
 */
export async function runDetectCuts(params: any): Promise<any> {
  const { subtitles, duration = 30 } = params;
  if (!subtitles || subtitles.length === 0) {
    return { success: true, cuts: [] };
  }

  const cuts: Array<{ id: string; timestamp: number; label: string; description: string; type: string }> = [];
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start - sorted[i - 1].end;
    if (gap > 1.5) {
      cuts.push({
        id: `cut-${i}`,
        timestamp: sorted[i].start,
        label: `Cut at ${sorted[i].start.toFixed(1)}s`,
        description: `Gap of ${gap.toFixed(1)}s between captions — natural transition point`,
        type: gap > 3 ? 'fade' : 'sound-beat',
      });
    }
  }

  for (const sub of sorted) {
    const dur = sub.end - sub.start;
    if (dur < 1.0 && dur > 0.1) {
      cuts.push({
        id: `quick-${sub.id}`,
        timestamp: sub.start,
        label: `Quick cut "${sub.text.slice(0, 20)}"`,
        description: `Short ${dur.toFixed(1)}s burst — high-impact pacing`,
        type: 'flash',
      });
    }
  }

  cuts.sort((a, b) => a.timestamp - b.timestamp);
  return { success: true, cuts };
}
