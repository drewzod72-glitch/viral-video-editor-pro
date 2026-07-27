/**
 * Direct browser -> Gemini REST calls, using the user's own locally-stored
 * API key (see apiKeyStore.ts). This replaces the three AI endpoints that
 * used to live on the Express server (/api/analyze-video,
 * /api/copilot-optimize, /api/detect-cuts) — no backend involvement, no
 * shared/hardcoded key.
 *
 * The Express server is still required for one thing this app does: the
 * FFmpeg video render/export (see server.ts). That is a genuinely
 * server-side operation (burning captions/music/color-grades into an
 * actual MP4) and can't be done reliably in-browser — see the removed
 * ffmpeg.wasm fallback in App.tsx for why. Everything AI-related below,
 * however, is now 100% client-to-Gemini with no server hop.
 *
 * IMPORTANT DIFFERENCE from the old /api/analyze-video: the old endpoint
 * used server-side FFmpeg to extract 3 JPEG keyframes + a 45s WAV audio
 * clip, then sent those to Gemini alongside the prompt. There is no
 * FFmpeg available client-side (by design — see above), so
 * runAnalyzeVideo() instead sends the raw video file itself to Gemini as
 * video input. Gemini 1.5+ / 2.x models natively understand video
 * (they do their own internal frame sampling), so this is not a
 * downgrade in practice — it also removes a dependency, since the
 * server no longer needs to do any media preprocessing for this feature.
 * The one real constraint: Gemini's inline_data request size is capped
 * (see MAX_INLINE_VIDEO_BYTES below); larger files need the Files API,
 * which is not implemented here — see the comment at sendVideoAnalysis().
 */

import { getStoredApiKey } from './apiKeyStore';
import type { SubtitleItem, VideoNiche, CaptionStyle } from '../types';

const MODEL_OPTIONS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_UPLOAD_ROOT = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const GEMINI_FILES_ROOT = 'https://generativelanguage.googleapis.com/v1beta/files';

/**
 * 2-Step Resumable Upload for Gemini Files API.
 * Allows videos up to 2GB to be analyzed (User BYOK).
 */
async function uploadVideoToFileApi(apiKey: string, file: File): Promise<string> {
  console.log(`[Gemini Files API] Initiating upload for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

  // 1. Initial request to get the upload URL
  const metadataResponse = await fetch(`${GEMINI_UPLOAD_ROOT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': file.size.toString(),
      'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name } }),
  });

  const uploadUrl = metadataResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('Failed to initiate Gemini upload. Check your API key or connection.');

  // 2. Upload the actual bytes
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: file,
  });

  const uploadData = await uploadResponse.json();
  const fileUri = uploadData.file.uri;
  const fileName = uploadData.file.name; // e.g. "files/..."

  // 3. Poll until the file is PROCESSED (active)
  console.log(`[Gemini Files API] File uploaded. URI: ${fileUri}. Waiting for processing...`);
  
  let state = 'PROCESSING';
  let attempts = 0;
  while (state !== 'ACTIVE') {
    attempts++;
    if (state === 'FAILED') throw new Error('Gemini failed to process this video file.');
    if (attempts > 30) throw new Error('Timeout waiting for Gemini to process the video.');
    
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s

    const pollResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`);
    const pollData = await pollResponse.json();
    state = pollData.state;
    console.log(`[Gemini Files API] Polling state: ${state} (Attempt ${attempts})`);
  }

  console.log(`[Gemini Files API] File is ACTIVE and ready for analysis.`);
  return fileUri;
}

// Gemini's inline_data (base64-in-request-body) path tops out well under
// this in practice once base64 overhead (~33%) and the rest of the
// request are accounted for. Files bigger than this should use the
// Files API (resumable upload, then reference by file URI) — not
// implemented here; sendVideoAnalysis() throws a clear error instead of
// silently truncating or failing with an opaque 400 from Gemini.
const MAX_INLINE_VIDEO_BYTES = 18 * 1024 * 1024; // ~18MB

export class MissingApiKeyError extends Error {
  constructor() {
    super('No Gemini API key is set. Add your API key in Settings to use AI features.');
    this.name = 'MissingApiKeyError';
  }
}

function requireApiKey(explicitKey?: string): string {
  const key = explicitKey || getStoredApiKey();
  if (!key) throw new MissingApiKeyError();
  return key;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (err) => reject(new Error('Failed to read video file for AI analysis.'));
    reader.readAsDataURL(file);
  });
}

/** Same fix-up the server used to apply to Gemini's output (a recurring model typo of "Dunik" -> "Dunk"). */
function fixDunikTypo(str: string): string {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    if (match === match.toUpperCase()) return 'DUNK';
    if (match === match.toLowerCase()) return 'dunk';
    if (match[0] === match[0].toUpperCase()) return 'Dunk';
    return 'Dunk';
  });
}

interface GenerateOptions {
  apiKey: string;
  parts: any[];
  responseSchema: any;
  maxAttemptsPerModel?: number;
}

/** Generic call against Gemini's generateContent REST endpoint, with the same multi-model / multi-attempt fallback the server used to do. */
async function generateStructuredContent({ apiKey, parts, responseSchema, maxAttemptsPerModel = 3 }: GenerateOptions): Promise<any> {
  let lastError: any = null;

  for (const model of MODEL_OPTIONS) {
    for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
      try {
        const res = await fetch(`${GEMINI_API_ROOT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const isThrottleOrOverload = res.status === 429 || res.status === 503;
          lastError = new Error(`Gemini ${model} returned ${res.status}: ${errBody.slice(0, 300)}`);
          if (isThrottleOrOverload) break; // stop retrying this model, try the next one
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            // Bad key / bad request — retrying won't help.
            throw lastError;
          }
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
        if (!text) {
          lastError = new Error(`Gemini ${model} returned an empty response.`);
          continue;
        }
        return JSON.parse(text);
      } catch (err: any) {
        lastError = err;
        if (err instanceof SyntaxError) {
          // JSON.parse failed — the model didn't honor the schema. Worth a retry.
          continue;
        }
        if (attempt < maxAttemptsPerModel) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models are currently unavailable.');
}

// ---------------------------------------------------------------------
// 1. Video analysis (replaces /api/analyze-video)
// ---------------------------------------------------------------------

export interface AnalyzeVideoParams {
  apiKey?: string;
  name: string;
  niche: VideoNiche | string;
  originalDuration: number;
  userDescription: string;
  defaultTranscribe: string;
  imitationOptions?: { archetype: string; referenceSource: string; copyInstructions: string } | null;
  videoFile?: File | null;
}

const ANALYZE_VIDEO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    alternativeTitles: { type: 'ARRAY', items: { type: 'STRING' } },
    description: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    viralityScore: { type: 'INTEGER' },
    viralityCriteria: {
      type: 'OBJECT',
      properties: {
        hook: { type: 'INTEGER' },
        pacing: { type: 'INTEGER' },
        emotion: { type: 'INTEGER' },
        visualContrast: { type: 'INTEGER' },
      },
    },
    viralityFeedback: { type: 'ARRAY', items: { type: 'STRING' } },
    highlights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          title: { type: 'STRING' },
          start: { type: 'NUMBER' },
          end: { type: 'NUMBER' },
          duration: { type: 'NUMBER' },
          viralityScore: { type: 'INTEGER' },
          description: { type: 'STRING' },
          whyEngaging: { type: 'STRING' },
          speed: { type: 'NUMBER' },
        },
        required: ['id', 'title', 'start', 'end'],
      },
    },
    subtitles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          text: { type: 'STRING' },
          start: { type: 'NUMBER' },
          end: { type: 'NUMBER' },
          emoji: { type: 'STRING' },
          highlightWords: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'text', 'start', 'end'],
      },
    },
    zoomEffects: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          timestamp: { type: 'NUMBER' },
          scale: { type: 'NUMBER' },
          duration: { type: 'NUMBER' },
        },
      },
    },
    endingCTA: { type: 'STRING' },
    thumbnailRecommendation: { type: 'STRING' },
    captionStyle: { type: 'STRING', description: "One of: 'mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'. Decide based on the archetype." },
    selectedMusicTrackId: { type: 'STRING', description: "One of: 'beautiful-dream', 'lofi-sunset', 'cyberpunk-synth', 'holliday-jam', 'forest-trail', 'tech-house', 'sun-weather', 'dreaming-big', 'serene-view', 'hip-hop-vibe'." },
    colorGrade: { type: 'STRING', description: "One of: 'none', 'cinematic', 'warm_vintage', 'vibrant_pop', 'moody_cyber'." },
    transitionStyle: { type: 'STRING', description: "One of: 'none', 'crossfade', 'glitch', 'flash', 'zoom', 'fade_black', 'slide_left'." },
    sfxWhooshEnabled: { type: 'BOOLEAN' },
    sfxPopEnabled: { type: 'BOOLEAN' },
    sfxImpactEnabled: { type: 'BOOLEAN' },
    sfxWhooshUrl: { type: 'STRING' },
    sfxPopUrl: { type: 'STRING' },
    sfxImpactUrl: { type: 'STRING' },
  },
  required: [
    'title', 'alternativeTitles', 'description', 'tags', 'viralityScore', 'viralityCriteria',
    'viralityFeedback', 'highlights', 'subtitles', 'zoomEffects', 'endingCTA', 'thumbnailRecommendation',
    'captionStyle', 'selectedMusicTrackId', 'colorGrade', 'transitionStyle',
    'sfxWhooshEnabled', 'sfxPopEnabled', 'sfxImpactEnabled', 'sfxWhooshUrl', 'sfxPopUrl', 'sfxImpactUrl',
  ],
};

function buildAnalyzeVideoPrompt(p: AnalyzeVideoParams): string {
  let prompt = `You are the Google AI Studio Auto Editor — a world-class Viral Video Director and Social Media Algorithm Engineer.
Your goal is to transform this raw footage into a high-retention "Short-form" masterpiece for TikTok and Reels.

=== ALGORITHM STRATEGY ===
1. HOOK (0-3s): You must identify the most visually shocking or curiosity-inducing moment and force the edit to start there.
2. PATTERN INTERRUPTS: Every 2-3 seconds, you must trigger a visual change (zoom, crop shift, or caption color pop) to reset the viewer's attention span.
3. RETENTION PACING: Remove every single millisecond of silence. If the speaker breathes or pauses, cut it.

=== DETAILED INSTRUCTIONS ===
- Analyze the VISUALS: What is the subject? What is the vibe (Luxury, Action, Wholesome)?
- Analyze the AUDIO: Is there music? Is there speech?
- Adapt to the NICHE: "${p.niche}". Use slang and hashtags specific to this community.

Return a JSON project that specifies exactly where to cut, where to zoom (scale 1.1x to 1.5x), and what high-impact subtitles to overlay.`;

  if (p.imitationOptions) {
    prompt += `\n\n=== VIRAL INSPIRATION REPLICA ENGINE ACTIVATED ===
You MUST replicate the visual and pacing style of the following reference source:
- Imitation Archetype Profile: "${p.imitationOptions.archetype}"
- Cloned Source Target: "${p.imitationOptions.referenceSource}"
- Direct copycat directives: "${p.imitationOptions.copyInstructions}"
Make sure to customize subtitle layout density, emoji selection, and highlight durations to match this creator's energy and timing patterns.`;
  }

  prompt += `\n\nReturn ONLY a JSON response matching the requested schema.`;
  return prompt;
}

export async function runAnalyzeVideo(params: AnalyzeVideoParams): Promise<{ success: true; mode: 'live-gemini'; project: any }> {
  const apiKey = requireApiKey(params.apiKey);
  const parts: any[] = [{ text: buildAnalyzeVideoPrompt(params) }];

  if (params.videoFile) {
    // USE THE FILES API (2GB LIMIT) INSTEAD OF INLINE_DATA (18MB LIMIT)
    try {
      const fileUri = await uploadVideoToFileApi(apiKey, params.videoFile);
      parts.push({
        fileData: {
          mimeType: params.videoFile.type || 'video/mp4',
          fileUri: fileUri,
        },
      });
    } catch (uploadErr: any) {
      console.error('[Gemini Client] Files API upload failed, falling back to legacy inline_data:', uploadErr);
      
      // Fallback for tiny files if the Files API fails for some reason
      if (params.videoFile.size <= MAX_INLINE_VIDEO_BYTES) {
        parts.push({
          inlineData: {
            mimeType: params.videoFile.type || 'video/mp4',
            data: await fileToBase64(params.videoFile),
          },
        });
      } else {
        throw uploadErr;
      }
    }
  }

  const compiledProject = await generateStructuredContent({
    apiKey,
    parts,
    responseSchema: ANALYZE_VIDEO_SCHEMA,
  });

  if (compiledProject) {
    if (typeof compiledProject.title === 'string') compiledProject.title = fixDunikTypo(compiledProject.title);
    if (typeof compiledProject.description === 'string') compiledProject.description = fixDunikTypo(compiledProject.description);
    if (Array.isArray(compiledProject.subtitles)) {
      compiledProject.subtitles = compiledProject.subtitles.map((sub: any) => {
        if (sub && typeof sub.text === 'string') {
          return {
            ...sub,
            text: fixDunikTypo(sub.text),
            highlightWords: Array.isArray(sub.highlightWords) ? sub.highlightWords.map((w: string) => fixDunikTypo(w)) : sub.highlightWords,
          };
        }
        return sub;
      });
    }
  }

  return { success: true, mode: 'live-gemini', project: compiledProject };
}

// ---------------------------------------------------------------------
// 2. Copilot optimize (replaces /api/copilot-optimize)
// ---------------------------------------------------------------------

export interface CopilotOptimizeParams {
  apiKey?: string;
  subtitles: SubtitleItem[];
  title: string;
  description: string;
  niche: VideoNiche | string;
  command?: string;
  actionType: 'spellcheck' | 'gaprepair' | 'pacing' | 'hookboost' | 'chat';
}

const COPILOT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    subtitles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          text: { type: 'STRING' },
          start: { type: 'NUMBER' },
          end: { type: 'NUMBER' },
          highlightWords: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['id', 'text', 'start', 'end'],
      },
    },
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    advice: { type: 'STRING' },
  },
  required: ['subtitles', 'title', 'description', 'advice'],
};

export async function runCopilotOptimize(params: CopilotOptimizeParams): Promise<{ success: true; mode: 'live-gemini'; title: string; description: string; subtitles: SubtitleItem[]; advice: string }> {
  const apiKey = requireApiKey(params.apiKey);
  const resolvedNiche = params.niche || 'general';
  const resolvedCommand = params.command || '';

  const prompt = `You are the chief AI Video optimization and self-healing engineer inside the "Auto Viral Video Editor".
Your goal is to optimize, refine, correct, or dramatically improve the text metrics of the current short-form video project.

You are given:
1. Current Subtitles: ${JSON.stringify(params.subtitles, null, 2)}
2. Current Video Title: "${params.title}"
3. Current Video Description/Captions: "${params.description}"
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

Return ONLY a JSON response matching the requested schema.

Task requested: "${params.actionType}"`;

  const parsed = await generateStructuredContent({
    apiKey,
    parts: [{ text: prompt }],
    responseSchema: COPILOT_SCHEMA,
    maxAttemptsPerModel: 2,
  });

  return {
    success: true,
    mode: 'live-gemini',
    subtitles: parsed.subtitles || params.subtitles,
    title: fixDunikTypo(parsed.title || params.title),
    description: fixDunikTypo(parsed.description || params.description),
    advice: parsed.advice || 'Optimization complete.',
  };
}

// ---------------------------------------------------------------------
// 3. Detect cuts (replaces /api/detect-cuts)
// ---------------------------------------------------------------------

export interface DetectCutsParams {
  apiKey?: string;
  subtitles: SubtitleItem[];
  duration: number;
  niche: VideoNiche | string;
  title?: string;
  description?: string;
}

const DETECT_CUTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cuts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          timestamp: { type: 'NUMBER' },
          label: { type: 'STRING' },
          type: { type: 'STRING' },
          description: { type: 'STRING' },
          confidence: { type: 'NUMBER' },
        },
        required: ['id', 'timestamp', 'label', 'type', 'description'],
      },
    },
  },
  required: ['cuts'],
};

export async function runDetectCuts(params: DetectCutsParams): Promise<{ success: true; cuts: any[] }> {
  const apiKey = requireApiKey(params.apiKey);
  const resolvedDuration = Number(params.duration) || 30;

  const prompt = `You are the ultimate Video Editor AI specializing in professional short-form videos (TikTok, YouTube Shorts, Instagram Reels).
Analyze this video segment timeline to deduce where physical "scene cuts", transitions, or key visual beats are located.
Look at:
1. Video Title: "${params.title || 'Untitled'}"
2. Video Niche: "${params.niche || 'general'}"
3. Video Narrative/Event Context: "${params.description || 'No description available'}"
4. Script Lines & Transcribed Timing:
${JSON.stringify(params.subtitles || [], null, 2)}

Identify the natural narrative transitions, pauses, sudden shifts in focus, or audio highlights. Generate logical scene cuts or visual transition moments from 0 to ${resolvedDuration} seconds.
For each detected scene change or cut:
- Provide an ID (e.g. cut-1, cut-2)
- Provide a precise timestamp in seconds (must be sorted ascending, between 0 and ${resolvedDuration})
- Provide a brief punchy label (e.g., "Pattern Interrupt", "Detail Reveal", "Visual Pivot", "Audio Spike", "Action Beat")
- Provide a transition type ('cut' | 'fade' | 'zoom' | 'flash' | 'sound-beat')
- Provide a description of what is happening or why a cut makes sense at this timestamp (e.g. "Script transition to key features", "Dramatic shift on action word", "Audio pause pacing interrupt").

Aim for 4 to 10 logical cuts depending on total duration (${resolvedDuration}s) to help editors jump straight to dramatic beats. Return ONLY JSON conforming strictly to the requested schema.`;

  const parsed = await generateStructuredContent({
    apiKey,
    parts: [{ text: prompt }],
    responseSchema: DETECT_CUTS_SCHEMA,
  });

  return { success: true, cuts: parsed.cuts || [] };
}
