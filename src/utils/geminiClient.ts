import { getStoredApiKey } from './apiKeyStore';
import type { SubtitleItem, VideoNiche, CaptionStyle } from '../types';

const MODEL_OPTIONS = [
  'gemini-3.5-flash', 
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash', 
  'gemini-1.5-flash', 
  'gemini-flash-latest',
  'gemini-1.5-pro'
];

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_UPLOAD_ROOT = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
const FILE_API_THRESHOLD_BYTES = 20 * 1024 * 1024;

export class MissingApiKeyError extends Error {
  constructor() {
    super('No Gemini API key is set. Add your key in Settings.');
    this.name = 'MissingApiKeyError';
  }
}

function requireApiKey(explicitKey?: string): string {
  const key = explicitKey || getStoredApiKey();
  if (!key) throw new MissingApiKeyError();
  return key;
}

async function captureVideoSnapshots(file: File, count: number = 3): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const snapshots: string[] = [];
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const timestamps = Array.from({ length: count }, (_, i) => (duration * (i + 1)) / (count + 1));
      try {
        for (const t of timestamps) {
          video.currentTime = t;
          await new Promise(r => { video.addEventListener('seeked', () => r(null), { once: true }); });
          const MAX_W = 640;
          const scale = Math.min(1, MAX_W / video.videoWidth);
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          context?.drawImage(video, 0, 0, canvas.width, canvas.height);
          snapshots.push(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]);
        }
        URL.revokeObjectURL(url);
        resolve(snapshots);
      } catch (err) { URL.revokeObjectURL(url); reject(err); }
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Snapshot failed. Device out of memory.')); };
  });
}

async function uploadVideoToFileApi(apiKey: string, file: File): Promise<string> {
  const metadataResponse = await fetch(`${GEMINI_UPLOAD_ROOT}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': file.size.toString(),
      'X-Goog-Upload-Header-Content-Type': file.type || 'video/mp4',
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({ file: { display_name: file.name } }),
  });
  if (!metadataResponse.ok) throw new Error('Gemini Upload Failed.');
  const uploadUrl = metadataResponse.headers.get('X-Goog-Upload-URL');
  const uploadResponse = await fetch(uploadUrl!, { method: 'POST', body: file });
  const uploadData = await uploadResponse.json();
  const fileName = uploadData.file.name;
  let state = 'PROCESSING';
  let attempts = 0;
  while (state !== 'ACTIVE') {
    attempts++;
    if (state === 'FAILED') throw new Error('Gemini media processing failed.');
    if (attempts > 30) throw new Error('Gemini indexing timeout.');
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, { headers: { 'x-goog-api-key': apiKey } });
    const pollData = await poll.json();
    state = pollData.state;
  }
  return uploadData.file.uri;
}

async function generateStructuredContent({ apiKey, parts, responseSchema, signal }: any): Promise<any> {
  let lastError: any = null;
  for (const model of MODEL_OPTIONS) {
    try {
      if (signal?.aborted) throw new Error('Aborted');
      console.log(`[Gemini] Forging with: ${model}...`);
      const res = await fetch(`${GEMINI_API_ROOT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', responseSchema },
        }),
      });
      if (!res.ok) {
        if (res.status === 429) { console.warn(`[Gemini] ${model} overloaded. Falling back...`); continue; }
        const errText = await res.text().catch(() => 'Error');
        lastError = new Error(`Gemini Error ${res.status}: ${errText.slice(0, 100)}`);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return JSON.parse(text);
    } catch (err: any) { lastError = err; if (err.message === 'Aborted') throw err; continue; }
  }
  throw lastError || new Error('All AI models failed.');
}

const ANALYZE_VIDEO_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    subtitles: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, text: { type: 'STRING' }, start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, emoji: { type: 'STRING' }, highlightWords: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['id', 'text', 'start', 'end'],
      },
    },
    zoomEffects: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { timestamp: { type: 'NUMBER' }, scale: { type: 'NUMBER' }, duration: { type: 'NUMBER' } } },
    },
    viralityScore: { type: 'INTEGER' },
    viralityFeedback: { type: 'ARRAY', items: { type: 'STRING' } },
    captionStyle: { type: 'STRING' },
    selectedMusicTrackId: { type: 'STRING' },
    colorGrade: { type: 'STRING' },
    transitionStyle: { type: 'STRING' },
    archetype: { type: 'STRING', description: "The editing vibe: 'hype', 'cinematic', 'minimal', or 'story'." },
    pacingSpeed: { type: 'NUMBER', description: "Recommended playback rate (e.g. 1.1 for hype, 1.0 for cinematic)." },
    highlights: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, title: { type: 'STRING' }, start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, duration: { type: 'NUMBER' }, speed: { type: 'NUMBER' } }, required: ['id', 'title', 'start', 'end'] }
    }
  },
  required: ['title', 'description', 'subtitles', 'highlights', 'selectedMusicTrackId', 'captionStyle', 'archetype'],
};

export async function runAnalyzeVideo(params: any): Promise<any> {
  const apiKey = requireApiKey(params.apiKey);
  const userInstructions = params.userDescription ? `USER SPECIFIC GOALS: ${params.userDescription}` : '';
  const prompt = `You are a World-Class Creative Director & Viral Strategist. 
Your task is to analyze this video and provide a custom-tailored editing blueprint. 
DO NOT apply a robotic pattern. Instead, use your "Creative Intuition" to match the editing to the video's soul, energy, and context.

### 🎥 DIRECTIONAL PROTOCOL:
1. **ENERGY ANALYSIS**: Is this video high-energy (gym/unboxing) or low-energy (vlog/nature)? 
   - If Hype: Use fast cuts (1.5-2s), 'hormozi' style, and aggressive zooms.
   - If Cinematic: Use long holds (4s+), 'minimalist' style, and soft slow zooms.
   - If Story: Use cuts that follow the narrative beats.

2. **CONTEXTUAL HOOKS**: Rewrite the first sentence into a viral "Open Loop" that fits the niche naturally. No generic templates.
3. **SUBTITLE WRAPPING**: Group words for readability. Max 4 words per line.
4. **MUSIC MATCHING**: Choose the best "selectedMusicTrackId" from the library:
   - 'hype-[1-7]': Energy, sports, fast unboxings.
   - 'lofi-[1-7]': Vlogs, relaxing, study, slow cooking.
   - 'epic-[1-7]': Dramatic reveals, high stakes.
   - 'lux-[1-7]': Beauty, fashion, tech, minimal products.

5. **THE INFINITY LOOP**: If the video is under 30s, ensure the ending CTA bridges back to the start sentence to force a rewatch.

Return a JSON blueprint that feels hand-edited, expert, and purposeful.`;

  const parts: any[] = [{ text: prompt }];
  if (params.videoFile) {
    if (params.videoFile.size < FILE_API_THRESHOLD_BYTES) {
      const snapshots = await captureVideoSnapshots(params.videoFile);
      snapshots.forEach(data => parts.push({ inlineData: { mimeType: 'image/jpeg', data } }));
    } else {
      const fileUri = await uploadVideoToFileApi(apiKey, params.videoFile);
      parts.push({ fileData: { mimeType: params.videoFile.type || 'video/mp4', fileUri } });
    }
  }

  const project = await generateStructuredContent({ apiKey, parts, responseSchema: ANALYZE_VIDEO_SCHEMA, signal: params.signal });
  return { success: true, mode: 'live-gemini', project };
}

export async function runCopilotOptimize(params: any): Promise<any> {
  const apiKey = requireApiKey(params.apiKey);
  
  const isStyleClone = params.command?.includes('CLONE VIRAL STYLE');
  
  const prompt = isStyleClone 
    ? `VIRE ENGINE ACTIVATED. 
       REFERENCE LINK: ${params.command}
       Current Project: ${params.title}
       
       TASK: You are a professional editor mimicking a viral creator. 
       1. Identify the 'Energy Signature' of the niche. 
       2. Re-write subtitles to match viral 'pacing loops'.
       3. Choose the perfect 'captionStyle' (hormozi/mrbeast/minimalist).
       4. Set the 'archetype' to hype or cinematic.
       
       Return JSON { subtitles, title, description, advice, captionStyle, archetype }.`
    : `Optimize subtitles: ${JSON.stringify(params.subtitles)}. Task: ${params.actionType}. Return JSON { subtitles, title, description, advice }.`;

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      subtitles: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, text: { type: 'STRING' }, start: { type: 'NUMBER' }, end: { type: 'NUMBER' } } } },
      title: { type: 'STRING' },
      description: { type: 'STRING' },
      advice: { type: 'STRING' },
      captionStyle: { type: 'STRING' },
      archetype: { type: 'STRING' }
    }
  };

  const res = await generateStructuredContent({ 
    apiKey, 
    parts: [{ text: prompt }], 
    responseSchema 
  });
  return { success: true, ...res };
}

export async function runDetectCuts(params: any): Promise<any> {
  const apiKey = requireApiKey(params.apiKey);
  const prompt = `Detect scene cuts for: ${params.title}. Return JSON { cuts: [{ id, timestamp, label, type, description }] }.`;
  const res = await generateStructuredContent({ apiKey, parts: [{ text: prompt }], responseSchema: { type: 'OBJECT', properties: { cuts: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, timestamp: { type: 'NUMBER' }, label: { type: 'STRING' }, type: { type: 'STRING' }, description: { type: 'STRING' } } } } } } });
  return { success: true, cuts: res.cuts || [] };
}
