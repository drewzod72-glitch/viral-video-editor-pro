import { getStoredApiKey } from './apiKeyStore';
import type { SubtitleItem, VideoNiche, CaptionStyle } from '../types';

const MODEL_OPTIONS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-2.0-flash-exp'
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
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', 'true');
    
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    // THE V18.4 READYSTATE PROTOCOL
    const checkReady = async () => {
      let attempts = 0;
      while (video.readyState < 2 && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const snapshots: string[] = [];
        const duration = video.duration || 10;
        
        for (let i = 1; i <= count; i++) {
          video.currentTime = (duration * i) / (count + 1);
          await new Promise(r => {
            const t = setTimeout(r, 1000); // 1s max per seek
            video.onseeked = () => { clearTimeout(t); r(null); };
          });
          
          canvas.width = 640;
          canvas.height = 360;
          context?.drawImage(video, 0, 0, 640, 360);
          const data = canvas.toDataURL('image/jpeg', 0.5);
          if (data.includes(',')) snapshots.push(data.split(',')[1]);
        }
        cleanup();
        resolve(snapshots);
      } catch (e) {
        cleanup();
        resolve([]); // Fail gracefully to manual mode
      }
    };

    video.onloadedmetadata = checkReady;
    video.onerror = () => { cleanup(); resolve([]); };
    
    // Safety Force-Start
    setTimeout(() => { if (video.readyState < 2) checkReady(); }, 3000);
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

export class GeminiApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
  }
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
        if (res.status === 401 || res.status === 403) {
          throw new GeminiApiError('Your Gemini API Key is invalid or expired. Please update it in Settings.', res.status);
        }
        if (res.status === 429) { 
          console.warn(`[Gemini] ${model} overloaded. Falling back...`); 
          lastError = new GeminiApiError('Rate limit exceeded. Please wait a moment.', 429);
          continue; 
        }
        if (res.status === 404) {
          console.warn(`[Gemini] ${model} not found. Falling back...`);
          lastError = new GeminiApiError(`Model ${model} not available on this key.`, 404);
          continue;
        }
        const errText = await res.text().catch(() => 'Error');
        lastError = new GeminiApiError(`Gemini Error ${res.status}: ${errText.slice(0, 100)}`, res.status);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return JSON.parse(text);
    } catch (err: any) { 
      if (err instanceof GeminiApiError && (err.status === 401 || err.status === 403)) throw err;
      lastError = err; 
      if (err.message === 'Aborted') throw err; 
      continue; 
    }
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
  
  // VALIDATE KEY FORMAT BEFORE STARTING
  if (!apiKey.startsWith('AIza')) {
    throw new GeminiApiError('Invalid Gemini API Key format. It should start with AIza.');
  }

  const prompt = `You are a World-Class Creative Director & Viral Strategist. 
Analyze this video and provide a hand-edited blueprint. 
Return JSON { title, description, subtitles, highlights, selectedMusicTrackId, captionStyle, archetype }.`;

  const parts: any[] = [{ text: prompt }];
  
  try {
    if (params.videoFile) {
      if (params.videoFile.size < FILE_API_THRESHOLD_BYTES) {
        // DEFENSIVE SNAPSHOTS: If this fails, AI still runs on text/niche
        try {
          const snapshots = await captureVideoSnapshots(params.videoFile);
          snapshots.forEach(data => parts.push({ inlineData: { mimeType: 'image/jpeg', data } }));
        } catch (e) {
          console.warn("Snapshot capture failed, proceeding with text only", e);
        }
      } else {
        const fileUri = await uploadVideoToFileApi(apiKey, params.videoFile);
        parts.push({ fileData: { mimeType: params.videoFile.type || 'video/mp4', fileUri } });
      }
    }

    const project = await generateStructuredContent({ apiKey, parts, responseSchema: ANALYZE_VIDEO_SCHEMA, signal: params.signal });
    return { success: true, mode: 'live-gemini', project };
  } catch (err: any) {
    // CATCH EXPIRED KEY
    if (err.message.includes('401') || err.message.includes('expired') || err.message.includes('key')) {
      throw new GeminiApiError('Your Gemini API Key is expired or invalid. Please check Google AI Studio.');
    }
    throw err;
  }
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
