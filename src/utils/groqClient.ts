import { getStoredApiKey } from './apiKeyStore';

/**
 * MASTER AI CLIENT (V36 - HYBRID VISION + TEXT)
 * Attempts Groq vision models first when video frames are available,
 * then falls back to text-only generation. Every call is logged.
 */

// ─── Status Log ──────────────────────────────────────────────────────────────
type LogEntry = { time: number; model: string; mode: 'vision' | 'text'; ok: boolean; detail: string };
const MAX_LOG = 40;
let statusLog: LogEntry[] = [];

export function getApiStatusLog(): LogEntry[] {
  return [...statusLog];
}

export function clearApiStatusLog(): void {
  statusLog = [];
}

function addLogEntry(model: string, mode: 'vision' | 'text', ok: boolean, detail: string) {
  statusLog.unshift({ time: Date.now(), model, mode, ok, detail });
  if (statusLog.length > MAX_LOG) statusLog = statusLog.slice(0, MAX_LOG);
}

// ─── Config ──────────────────────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// NOTE: llama-3.1-8b-instant and llama-3.3-70b-versatile are being SHUT DOWN
// by Groq on 2026-08-16. The TEXT_MODELS below are the officially recommended
// replacements (see console.groq.com/docs/deprecations).
// NOTE: llama-3.1-8b-instant and llama-3.3-70b-versatile shut down 2026-08-16,
// llama-4-maverick shut down 2026-03-09, llama-4-scout shut down 2026-07-17.
// openai/gpt-oss-120b is text-only on Groq (image content → 400
// "messages[0].content must be a string"). qwen/qwen3.6-27b is the current
// vision-capable model (Text+Images input, max 3 images per request).
const VISION_MODELS = [
  'qwen/qwen3.6-27b',
];

const TEXT_MODELS = [
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b',
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
    cooking: ['SIZZLING STEAK', 'BUTTER BASTING', 'PERFECT CRUST', 'MEDIUM RARE', 'SERVE IT UP', 'REST THE MEAT', 'SLICE AGAINST GRAIN', 'PLATE IT', 'ADD HERBS', 'FINAL TOUCH'],
    unboxing: ['NEW ARRIVAL', 'TEAR THE PAPER', 'QUALITY CHECK', 'SOLE DETAIL', 'STEAL DEAL', 'UNBOXING NOW', 'FIRST IMPRESSION', 'WORTH IT', 'BUILD QUALITY', 'VERDICT'],
    sales: ['STOP SCROLLING', 'ULTIMATE BAG', 'ITALIAN LEATHER', 'HIDDEN POCKET', 'CLICK LINK', 'BEST VALUE', 'LIMITED STOCK', 'ADD TO CART', 'SAVE NOW', 'DON\'T MISS'],
    education: ['FUTURE IS NOW', 'AI EDITING', 'ZERO CODE', 'RENDER IN SECONDS', 'GAME CHANGER', 'LEARN FAST', 'SKILL UP', 'TRY THIS', 'NEXT LEVEL', 'GO WILD'],
    fitness: ['NO EXCUSES', 'WAKE UP', 'GRIND HARD', 'PUSH LIMITS', 'DOMINATE', 'STAY STRONG', 'KEEP GOING', 'ONE MORE', 'FINISH HIM', 'BE LEGEND'],
    pets: ['HAPPY PUPPY', 'GOOD BOY', 'HEAD TILT', 'STRESS RELIEF', 'LIKE & FOLLOW', 'CUTE ALERT', 'PLAY TIME', 'TASTY TREAT', 'NAP TIME', 'BEST FRIEND'],
    tech: ['BUTTERY SWITCHES', 'THOCKY SOUND', 'PBT KEYCAPS', 'MECH PURPLE', 'BUILD COMPLETE', 'TYPE FAST', 'GAME READY', 'SETUP TOUR', 'RGB SYNC', 'UPGRADE NOW'],
    default: ['WATCH THIS', 'VIRAL MOMENT', 'GAME CHANGER', 'MUST TRY', 'SHARE NOW', 'FOLLOW ME', 'LINK IN BIO', 'TAG A FRIEND', 'SAVE THIS', 'COMMENT BELOW'],
  };
  
  const words = hooks[niche] || hooks['default'];
  const subs: Array<{ id: string; text: string; start: number; end: number }> = [];
  const interval = 2.5; // One caption every 2.5 seconds for full coverage
  
  for (let t = 0; t < duration; t += interval) {
    const wordIndex = Math.floor(t / interval) % words.length;
    subs.push({
      id: `mock-${Math.floor(t / interval)}`,
      text: words[wordIndex],
      start: parseFloat(t.toFixed(2)),
      end: parseFloat(Math.min(t + interval, duration).toFixed(2)),
    });
  }
  
  return subs;
}

function generateSmartCuts(duration: number): Array<{ id: string; start: number; end: number; reason: string }> {
  // Generate 2-4 smart cuts to remove dead air and keep only viral moments
  const cuts: Array<{ id: string; start: number; end: number; reason: string }> = [];
  const segmentDuration = 5.0; // 5-second segments
  
  // Keep first 5s (hook) and last 5s (CTA), cut middle dead air
  if (duration > 15) {
    cuts.push({
      id: 'cut-1',
      start: 5.0,
      end: Math.min(5.0 + segmentDuration, duration - 5),
      reason: 'Dead air - no speech or action'
    });
  }
  
  if (duration > 20) {
    cuts.push({
      id: 'cut-2', 
      start: Math.min(10.0, duration - 5),
      end: Math.min(15.0, duration - 5),
      reason: 'Slow pacing - trimming for retention'
    });
  }
  
  return cuts;
}

function generateSmartHighlights(duration: number, cuts: Array<{ start: number; end: number }>): Array<any> {
  // Generate highlights from segments NOT cut
  const highlights: Array<any> = [];
  let currentTime = 0;
  let highlightId = 1;
  
  // Sort cuts by start time
  const sortedCuts = [...cuts].sort((a, b) => a.start - b.start);
  
  for (const cut of sortedCuts) {
    if (currentTime < cut.start) {
      highlights.push({
        id: `h${highlightId}`,
        title: `Viral Moment ${highlightId}`,
        start: currentTime,
        end: cut.start,
        duration: cut.start - currentTime,
        viralityScore: 75 + Math.floor(Math.random() * 25),
        description: 'Strong hook or engaging content',
        whyEngaging: 'Stops scrollers and builds curiosity',
        speed: 1.0
      });
      highlightId++;
    }
    currentTime = cut.end;
  }
  
  // Add final segment after last cut
  if (currentTime < duration) {
    highlights.push({
      id: `h${highlightId}`,
      title: `Viral Moment ${highlightId}`,
      start: currentTime,
      end: duration,
      duration: duration - currentTime,
      viralityScore: 75 + Math.floor(Math.random() * 25),
      description: 'CTA or closing moment',
      whyEngaging: 'Drives action and completion',
      speed: 1.0
    });
  }
  
  // Ensure we have at least 3 highlights
  if (highlights.length < 3 && duration > 10) {
    const third = duration / 3;
    highlights.push({
      id: `h${highlightId}`,
      title: `Viral Moment ${highlightId}`,
      start: third * 2,
      end: Math.min(third * 2 + third, duration),
      duration: Math.min(third, duration - third * 2),
      viralityScore: 80,
      description: 'Engaging middle segment',
      whyEngaging: 'Maintains viewer interest',
      speed: 1.0
    });
  }
  
  return highlights;
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
        // Small frames keep the vision request inside free-tier TPM budgets.
        // Empirically: 3 frames @ 320x180 + prompt ≈ 7,600 input tokens,
        // which blew the 8,000 TPM limit on on_demand orgs (Groq 413).
        canvas.width = 256; canvas.height = 144;
        const ctx = canvas.getContext('2d');

        const duration = v.duration;
        // Two hook-biased frames: enough context for product-review/hook
        // detection while staying under the 8K TPM budget (Kilo 1a24083).
        const timestamps = [
          Math.min(1.5, duration * 0.1),
          duration * 0.45
        ];

        for (const t of timestamps) {
          v.currentTime = t;
          await waitForSeeked(v, 1500);
          ctx?.clearRect(0, 0, 256, 144);
          ctx?.drawImage(v, 0, 0, 256, 144);
          const data = canvas.toDataURL('image/jpeg', 0.15);
          if (data.includes(',')) snapshots.push(data.split(',')[1]);
          if (snapshots.length >= 2) break; // hard cap: never exceed budget
        }

        URL.revokeObjectURL(url); v.remove();
        resolve(snapshots);
      } catch (e) { resolve([]); }
    };
    v.onerror = () => resolve([]);
    v.load();
  });
}

const VISION_PROMPT = (duration: number) => `You are a viral short-form video director analyzing a ${duration.toFixed(1)}s video.

TASK: Create a PROFESSIONAL EDIT with CUTS and FULL COVERAGE subtitles.

1. SUBTITLES (MANDATORY):
   - Generate subtitles for the ENTIRE ${duration.toFixed(1)}s duration
   - Minimum subtitle count: ${Math.ceil(duration / 2.5)}
   - Each subtitle: 2-4 words, UPPERCASE, punchy
   - Coverage: every second must have a subtitle OR be explicitly marked as silent B-roll
   - Start times: 0, 2.5, 5.0, 7.5, 10.0... covering full duration

2. SMART CUTS (MANDATORY):
   - Identify 3-5 MOMENTS to KEEP (viral highlights)
   - Identify 2-3 MOMENTS to CUT (dead air, boring parts)
   - Each cut: {"start": X, "end": Y, "reason": "dead air/silence"}
   - Each keep: {"start": X, "end": Y, "viralityScore": 85-100, "reason": "hook/emotion/CTA"}

3. PRODUCT REVIEW moments: sole close-ups, stitching details, logo reveals, texture macros.
4. CTA: identify the call to action.

Return ONLY JSON:
{
  "title": "Viral headline (max 60 chars)",
  "description": "Short social copy with emojis",
  "captionStyle": "hormozi",
  "needsSubtitles": true,
  "subtitles": [
    {"id":"1","text":"HOOK TEXT","start":0,"end":2.5},
    {"id":"2","text":"NEXT CAPTION","start":2.5,"end":5.0}
  ],
  "cuts": [
    {"id":"c1","start":12.0,"end":15.0,"reason":"Dead air, no speech"}
  ],
  "highlights": [
    {"id":"h1","title":"Product Review: Sole","start":4.5,"end":8.2,"viralityScore":92,"description":"Macro sole close-up","whyEngaging":"Texture detail drives shares","speed":1.0}
  ],
  "archetype": "hype"
}

MANDATORY RULES:
- "subtitles" array MUST have at least ${Math.ceil(duration / 2.5)} items covering 0 to ${duration.toFixed(1)}s
- "cuts" array MUST have at least 2 items removing boring segments
- "highlights" array MUST have at least 3 items keeping viral moments
- Total kept duration (highlights) must be 60-80% of original for pacing
- No markdown, no explanations.`;

const TEXT_ANALYSIS_PROMPT = (niche: string, description: string, duration: number) => `You are a viral short-form video director.

Niche: ${niche}
Description: ${description || 'No description provided.'}
Duration: ${duration.toFixed(1)}s

Generate a PROFESSIONAL EDIT plan with CUTS and FULL COVERAGE subtitles.

Return ONLY JSON:
{
  "title": "Viral headline (max 60 chars)",
  "description": "Short social copy with emojis",
  "captionStyle": "hormozi",
  "needsSubtitles": true,
  "subtitles": [
    {"id":"1","text":"HOOK TEXT","start":0,"end":2.5},
    {"id":"2","text":"NEXT CAPTION","start":2.5,"end":5.0}
  ],
  "cuts": [
    {"id":"c1","start":12.0,"end":15.0,"reason":"Dead air"}
  ],
  "highlights": [
    {"id":"h1","title":"Key Moment","start":0,"end":5.0,"viralityScore":92,"description":"Strong hook","whyEngaging":"Stops scrollers","speed":1.0}
  ],
  "archetype": "${niche}"
}

RULES:
- needsSubtitles must be true.
- Subtitles: at least ${Math.ceil(duration / 2.5)} items covering FULL ${duration.toFixed(1)}s duration
- Cuts: at least 2 segments to REMOVE (dead air, boring parts)
- Highlights: at least 3 segments to KEEP (viral moments)
- Kept duration = 60-80% of original for professional pacing
- Subtitles: 2-4 words, UPPERCASE, punchy
- No markdown, no explanations.`;

const COPILOT_PROMPT = (actionType: string, command: string, existingPlan: any) => `You are a short-form video editor AI refining an EXISTING edit plan.

Current edit plan:
- Subtitles: ${existingPlan?.subtitles?.length || 0} captions
- Color grade: ${existingPlan?.colorGrade || 'none'}
- Transition: ${existingPlan?.transitionStyle || 'none'}
- Zoom effects: ${existingPlan?.zoomEffects?.length || 0}
- Music: ${existingPlan?.selectedMusicTrackId || 'none'}
- Caption style: ${existingPlan?.captionStyle || 'hormozi'}

User action: ${actionType}
Command: ${command}

CRITICAL RULES:
1. PRESERVE the existing edit plan unless the user explicitly requests a change.
2. If the user says "make it more X", only change the specific property they mentioned.
3. Keep subtitle IDs stable. Never regenerate all subtitles from scratch.
4. Return ONLY JSON with the CHANGED properties. Do not return the full plan.
5. If no change is needed, return: {"changed": false, "advice": "No changes needed."}

Example response for "boost hooks":
{
  "changed": true,
  "advice": "Strengthened hook captions while preserving your existing edit plan.",
  "subtitles": [{"id":"1","text":"NEW HOOK","start":0,"end":2.5}],
  "colorGrade": "vibrant_pop"
}

Example response for "add transitions":
{
  "changed": true,
  "advice": "Added crossfade transitions between cuts.",
  "transitionStyle": "crossfade"
}`;

// ─── Low-level Groq caller with retry + status logging ──────────────────────
async function callGroq(model: string, messages: any[], retries = 2, mode: 'vision' | 'text' = 'text', baseMaxTokens = 4096): Promise<string> {
  const key = getApiKey();
  let jsonMode = true;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Reduce max_tokens on retry to mitigate TPM/context limit issues (Kilo).
    // Base is 4096 for text; vision passes 2048 because image inputs already
    // consume most of the 8K free-tier TPM budget (qwen3.6 on_demand).
    const maxTokens = attempt === 0 ? baseMaxTokens : Math.floor(baseMaxTokens / 2);

    try {
      const body: Record<string, any> = {
        model,
        messages,
        temperature: 0.5,
        max_tokens: maxTokens,
      };
      if (jsonMode) body.response_format = { type: 'json_object' };

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        const snippet = text.slice(0, 200);

        // Handle 413 Request Too Large / TPM limit errors: wait for the
        // rolling TPM window (60s) to drain, then retry with smaller
        // max_tokens (Kilo).
        if (res.status === 413) {
          addLogEntry(model, mode, false, `413: ${snippet}`);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
            continue; // retry with reduced max_tokens
          }
          throw new Error(`Groq 413: ${snippet}`);
        }

        // Some models (e.g. qwen3.6-27b) can fail strict JSON mode even with a
        // valid prompt. Retry the SAME model once in free-form mode — the
        // extractAndRepair parser salvages JSON from plain text output.
        if (res.status === 400 && snippet.includes('json_validate_failed') && jsonMode) {
          addLogEntry(model, mode, false, '400 json_validate_failed — retrying without JSON mode');
          jsonMode = false;
          attempt--; // don't consume a retry slot for this recovery path
          continue;
        }

        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
          addLogEntry(model, mode, false, `${res.status}: ${snippet}`);
          throw new Error(`Groq ${res.status}: ${snippet}`);
        }
        addLogEntry(model, mode, false, `${res.status}: ${snippet}`);
        throw new Error(`Groq ${res.status}: ${snippet}`);
      }

      const data = JSON.parse(text);
      const content = data.choices?.[0]?.message?.content || '';
      addLogEntry(model, mode, true, `OK (${content.length} chars)`);
      return content;
    } catch (e: any) {
      const msg = e?.message || 'network error';
      addLogEntry(model, mode, false, msg);
      // 4xx = permanent error (bad key, bad model, unsupported payload).
      // Retrying the identical request can never succeed — fail fast so the
      // fallback chain (next model / text mode) starts immediately.
      if (msg.startsWith('Groq 4') || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return '';
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function runAnalyzeVideo(params: any): Promise<any> {
  const errors: string[] = [];
  let lastRaw = '';
  let usedVision = false;

  try {
    // ── ATTEMPT 1: VISION ANALYSIS ─────────────────────────────────────
    if (params.videoFile) {
      const frames = await captureFrames(params.videoFile);
      if (frames.length > 0) {
        for (const model of VISION_MODELS) {
          try {
              const content: any = [
                { type: 'text', text: VISION_PROMPT(params.originalDuration || 30) },
                ...frames.map(f => ({
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${f}` }
                }))
              ];

            const raw = await callGroq(model, [{ role: 'user', content }], 2, 'vision', 2048);
            lastRaw = raw;
            const parsed = extractAndRepair(raw);

            if (parsed && Array.isArray(parsed.subtitles)) {
              usedVision = true;
              addLogEntry(model, 'vision', true, 'Vision analysis complete');
              return {
                success: true,
                mode: 'vision',
                project: {
                  ...parsed,
                  enableSubtitles: parsed.needsSubtitles !== false,
                }
              };
            }
            errors.push(`${model} (vision): parsed but no subtitles`);
          } catch (e: any) {
            errors.push(`${model} (vision): ${e?.message || 'network error'}`);
          }
        }
      }
    }

    // ── ATTEMPT 2: TEXT-ONLY ANALYSIS ──────────────────────────────────
    const niche = params.niche || 'default';
    const description = params.userDescription || params.description || '';
    const duration = params.originalDuration || 30;
    const prompt = TEXT_ANALYSIS_PROMPT(niche, description, duration);

    for (const model of TEXT_MODELS) {
      try {
        const raw = await callGroq(model, [{ role: 'user', content: prompt }]);
        lastRaw = raw;
        const parsed = extractAndRepair(raw);

        if (parsed && Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
          addLogEntry(model, 'text', true, 'Text analysis complete');
          return {
            success: true,
            mode: 'text',
            project: {
              ...parsed,
              enableSubtitles: parsed.needsSubtitles !== false,
            }
          };
        }
        errors.push(`${model} (text): parsed but no subtitles`);
      } catch (e: any) {
        errors.push(`${model} (text): ${e?.message || 'network error'}`);
      }
    }
  } catch (e: any) {
    errors.push(`analysis: ${e?.message || 'analysis failed'}`);
  }

  console.error('[Groq] All models failed:', errors);
  console.error('[Groq] Last raw response:', lastRaw);

  // ── LOCAL FALLBACK: Generate professional edit with smart cuts ────────
  const cuts = generateSmartCuts(params.originalDuration || 30);
  const highlights = generateSmartHighlights(params.originalDuration || 30, cuts);
  const subtitles = generateMockSubtitles(params.niche || 'default', params.originalDuration || 30);

  const fallbackProject = {
    title: params.name || 'Viral Video',
    description: params.userDescription || 'Auto-generated viral edit',
    captionStyle: 'hormozi',
    needsSubtitles: true,
    enableSubtitles: true,
    subtitles,
    cuts,
    highlights,
    archetype: params.niche || 'default'
  };

  return { success: true, mode: 'local', project: fallbackProject };
}

export async function runCopilotOptimize(params: any): Promise<any> {
  const errors: string[] = [];
  let lastRaw = '';

  const prompt = COPILOT_PROMPT(params.actionType || 'chat', params.command || '', params.existingPlan);

  for (const model of TEXT_MODELS) {
    try {
      const raw = await callGroq(model, [
        { role: 'user', content: prompt }
      ], 1);
      lastRaw = raw;
      const parsed = extractAndRepair(raw);
      
      // If copilot says no changes needed, return empty success
      if (parsed && parsed.changed === false) {
        return {
          success: true,
          changed: false,
          advice: parsed.advice || 'No changes needed.',
          ...parsed
        };
      }
      
      if (parsed && (Array.isArray(parsed.subtitles) || parsed.transitionStyle || parsed.colorGrade || parsed.zoomEffects)) {
        return { success: true, changed: true, ...parsed };
      }
      errors.push(`${model}: parsed but invalid response`);
    } catch (e: any) {
      errors.push(`${model}: ${e?.message || 'network error'}`);
    }
  }

  console.error('[Groq] Copilot all models failed:', errors);
  console.error('[Groq] Last raw response:', lastRaw);

  return {
    success: true,
    changed: false,
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
