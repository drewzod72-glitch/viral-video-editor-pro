import { getStoredApiKey } from './apiKeyStore';

/**
 * MASTER AI CLIENT (V35 - ROBUST TEXT-ONLY RELAY)
 * Groq text models with automatic fallback, repair, and status logging.
 * Vision models have been removed because current Groq vision IDs are not
 * reliably available across accounts. This client now uses a strong
 * text-only generation path that works for every supported model.
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

// NOTE: llama-3.1-8b-instant and llama-3.3-70b-versatile are being SHUT DOWN
// by Groq on 2026-08-16. These are the officially recommended replacements
// (see console.groq.com/docs/deprecations).
const TEXT_MODELS = [
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
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

// ─── Prompts ────────────────────────────────────────────────────────────────
const TEXT_ANALYSIS_PROMPT = (niche: string, description: string) => `You are a viral short-form video director.

Niche: ${niche}
Description: ${description || 'No description provided.'}

Generate a JSON object with these exact keys:
{
  "title": "Viral headline (max 60 chars)",
  "description": "Short social copy with emojis",
  "captionStyle": "hormozi",
  "needsSubtitles": true,
  "subtitles": [
    {"id":"1","text":"HOOK TEXT","start":0,"end":2.5},
    {"id":"2","text":"NEXT CAPTION","start":2.5,"end":5.0}
  ],
  "highlights": [
    {"id":"h1","title":"Key Moment","start":0,"end":5.0,"viralityScore":92,"description":"Strong hook","whyEngaging":"Stops scrollers","speed":1.0}
  ],
  "archetype": "${niche}"
}

RULES:
- needsSubtitles must be true.
- Return at least 5 subtitles covering the full duration.
- Subtitles must be 2-4 words, uppercase, punchy.
- Do not include markdown or explanations.`;

const COPILOT_PROMPT = (actionType: string, command: string) => `You are a short-form video editor AI.

Action: ${actionType}
Command: ${command}

Return ONLY JSON:
{
  "subtitles": [
    {"id":"1","text":"HOOK TEXT","start":0,"end":2.5}
  ],
  "title": "Updated title",
  "description": "Updated description",
  "advice": "Director's note explaining what changed and why.",
  "needsSubtitles": true
}

Rules:
- Keep subtitle IDs stable when possible.
- Advice must explicitly state what changed.
- If no change is needed, return the original subtitles unchanged.`;

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
    const niche = params.niche || 'default';
    const description = params.userDescription || params.description || '';
    const duration = params.originalDuration || 30;

    const prompt = TEXT_ANALYSIS_PROMPT(niche, description);

    for (const model of TEXT_MODELS) {
      try {
        const raw = await callGroq(model, [
          { role: 'user', content: prompt }
        ]);
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
    errors.push(`analysis: ${e?.message || 'analysis failed'}`);
  }

  console.error('[Groq] All models failed:', errors);
  console.error('[Groq] Last raw response:', lastRaw);

  // Honest failure (per AGENTS.md: never fabricate a fake "AI" result).
  // The caller surfaces "manual mode" so the user keeps editing without
  // believing canned captions came from the AI pipeline.
  return { success: false, error: 'ALL_MODELS_FAILED', details: errors.join(' | ') };
}

export async function runCopilotOptimize(params: any): Promise<any> {
  const errors: string[] = [];
  let lastRaw = '';

  const prompt = COPILOT_PROMPT(params.actionType || 'chat', params.command || '');

  for (const model of TEXT_MODELS) {
    try {
      const raw = await callGroq(model, [
        { role: 'user', content: prompt }
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
