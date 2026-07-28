import { getStoredApiKey } from './apiKeyStore';
import type { SubtitleItem, VideoNiche, CaptionStyle } from '../types';

const MODEL_OPTIONS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-flash-latest'];
const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_UPLOAD_ROOT = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

const FILE_API_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_INLINE_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB cap for base64

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

/** 
 * Memory-efficient Base64 converter for mobile 
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read video file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts key snapshots from a video file without loading the entire file into memory.
 * This is the secret to avoiding "White Screen" crashes on iPhones.
 */
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
      // Spread snapshots across the video: 15%, 50%, 85%
      const timestamps = Array.from({ length: count }, (_, i) => (duration * (i + 1)) / (count + 1));
      
      try {
        for (const t of timestamps) {
          video.currentTime = t;
          await new Promise(r => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              r(null);
            };
            video.addEventListener('seeked', onSeeked);
          });
          
          const MAX_SNAPSHOT_WIDTH = 640;
          const scaleFactor = Math.min(1, MAX_SNAPSHOT_WIDTH / video.videoWidth);
          canvas.width = video.videoWidth * scaleFactor;
          canvas.height = video.videoHeight * scaleFactor;
          context?.drawImage(video, 0, 0, canvas.width, canvas.height);
          snapshots.push(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]);
        }
        URL.revokeObjectURL(url);
        resolve(snapshots);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Video snapshot extraction failed. Your phone might be out of memory.'));
    };
  });
}

async function uploadVideoToFileApi(apiKey: string, file: File): Promise<string> {
  console.log(`[Gemini Files API] Resumable Upload: ${file.name}`);

  // Use headers for the key to support new AQ.Ab (Aqab) keys
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

  if (!metadataResponse.ok) throw new Error('Failed to initiate Gemini upload. Check your API key.');

  const uploadUrl = metadataResponse.headers.get('X-Goog-Upload-URL');
  const uploadResponse = await fetch(uploadUrl!, {
    method: 'POST',
    body: file,
  });

  const uploadData = await uploadResponse.json();
  const fileName = uploadData.file.name;
  
  let state = 'PROCESSING';
  let attempts = 0;
  while (state !== 'ACTIVE') {
    attempts++;
    if (state === 'FAILED') throw new Error('Gemini media processing failed.');
    if (attempts > 30) throw new Error('Gemini indexing timeout.');
    await new Promise((r) => setTimeout(r, 3000));
    
    const poll = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
      headers: { 'x-goog-api-key': apiKey }
    });
    const pollData = await poll.json();
    state = pollData.state;
  }
  return uploadData.file.uri;
}

function fixDunikTypo(str: string): string {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    const map: Record<string, string> = { 'DUNIK': 'DUNK', 'dunik': 'dunk', 'Dunik': 'Dunk' };
    return map[match] || 'Dunk';
  });
}

async function generateStructuredContent({ apiKey, parts, responseSchema, signal }: any): Promise<any> {
  let lastError: any = null;

  for (const model of MODEL_OPTIONS) {
    try {
      if (signal?.aborted) throw new Error('Aborted');

      console.log(`[Gemini] Attempting analysis with model: ${model}...`);

      // 2026 AUTH STRATEGY: Use the 'x-goog-api-key' header for AQ.Ab keys.
      // We REMOVE the query parameter to avoid "multiple auth methods" errors.
      const res = await fetch(`${GEMINI_API_ROOT}/${model}:generateContent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey 
        },
        signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { 
            responseMimeType: 'application/json', 
            responseSchema 
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'No error body');
        console.error(`[Gemini] Model ${model} returned ${res.status}:`, errText);
        
        if (res.status === 403) {
          throw new Error('API Key Permission Denied. Go to AI Studio and ensure "Generative Language API" is enabled for your project.');
        }
        
        if (res.status === 429) {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || '';
          
          if (errMsg.toLowerCase().includes('quota')) {
            lastError = new Error(`Daily/Minute Quota Exceeded for ${model}. If you are on the Free Tier, Google restricts the number of requests you can make. Try a different API key or wait 60 seconds.`);
          } else {
            lastError = new Error(`Rate Limit Exceeded for ${model}. Wait 60 seconds and try again.`);
          }
          
          console.warn(`[Gemini] 429 for ${model}. Trying next...`);
          continue; 
        }
        
        lastError = new Error(`Gemini [${model}] Error ${res.status}: ${errText.slice(0, 150)}`);
        continue; // Try next model
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new Error(`Model ${model} returned success but no text content.`);
        continue;
      }
      return JSON.parse(text);
    } catch (err: any) {
      lastError = err;
      if (err.message === 'Aborted') throw err;
      console.warn(`[Gemini] Model ${model} exception:`, err.message);
      continue;
    }
  }
  
  // If we reach here, all models failed. Show the LAST error received.
  throw lastError || new Error('Critical: All AI models failed to respond.');
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
        properties: { timestamp: { type: 'NUMBER' }, scale: { type: 'NUMBER' }, duration: { type: 'NUMBER' } },
      },
    },
    viralityScore: { type: 'INTEGER' },
    viralityCriteria: {
      type: 'OBJECT',
      properties: { hook: { type: 'INTEGER' }, pacing: { type: 'INTEGER' }, emotion: { type: 'INTEGER' }, visualContrast: { type: 'INTEGER' } }
    },
    viralityFeedback: { type: 'ARRAY', items: { type: 'STRING' } },
    highlights: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { id: { type: 'STRING' }, title: { type: 'STRING' }, start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, duration: { type: 'NUMBER' }, speed: { type: 'NUMBER' } },
        required: ['id', 'title', 'start', 'end'],
      }
    }
  },
  required: ['title', 'description', 'subtitles', 'highlights'],
};

export async function runAnalyzeVideo(params: any): Promise<any> {
  const apiKey = requireApiKey(params.apiKey);
  const userInstructions = params.userDescription ? `USER SPECIFIC GOALS: ${params.userDescription}` : '';
  
  let prompt = `You are a World-Class Viral Architect.
Your task is to re-engineer this video to DOMINATE the algorithm for the "${params.niche}" niche. ${userInstructions}

### PSYCHOLOGICAL RETAINMENT PROTOCOLS:
1. **0.5s Hook**: Rewrite the first sentence to be a "Pattern Interrupt" (Identity call or curiosity gap).
2. **1.8s Beat**: Create cuts and zooms every 1.8 seconds. Stagnancy = Death.
3. **Word-for-Word Pacing**: Use micro-pacing (1.12x speed) during setup talk.
4. **Infinity Loop**: Craft the final CTA to flow perfectly back to the first second.
5. **Captions**: Max 3 words. Use "Hormozi" bold styling. Visualize EVERY noun with an emoji.
6. **Sonic Matching**: Select the best "selectedMusicTrackId" from this library:
   - 'lofi-viral-1': Use for study, slow morning, soft vlog.
   - 'phonk-hype-1': Use for streetwear, unboxing, fast cuts.
   - 'cinematic-epic-1': Use for extreme sports, dramatic reveals.
   - 'chill-reels-1': Use for travel, sunset, aesthetic products.
   - 'gym-hustle-1': Use for intense workouts, fitness motivation.
   - 'minimal-unbox-1': Use for tech, minimal aesthetic, clean products.
   - 'cooking-zen-1': Use for food prep, satisfying kitchen sounds.
   - 'vibe-vlog-1': Use for daily hustle, city walk, upbeat lifestyle.

Return a JSON blueprint optimized for 70%+ completion rates.`;
  
  if (!params.videoFile && params.defaultTranscribe) {
    prompt += `\n\nVIDEO TRANSCRIPT FOR CONTEXT: ${params.defaultTranscribe}`;
  }

  const parts: any[] = [{ text: prompt }];

  if (params.videoFile) {
    const fileSize = params.videoFile.size;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && fileSize < FILE_API_THRESHOLD_BYTES) {
      // Mobile Snapshot Method
      const snapshots = await captureVideoSnapshots(params.videoFile);
      snapshots.forEach(data => parts.push({ inlineData: { mimeType: 'image/jpeg', data } }));
    } else if (fileSize >= FILE_API_THRESHOLD_BYTES) {
      // Large File API Method
      const fileUri = await uploadVideoToFileApi(apiKey, params.videoFile);
      parts.push({ fileData: { mimeType: params.videoFile.type || 'video/mp4', fileUri } });
    } else {
      // Fast Base64 Method
      const data = await fileToBase64(params.videoFile);
      parts.push({ inlineData: { mimeType: params.videoFile.type || 'video/mp4', data } });
    }
  }

  const project = await generateStructuredContent({
    apiKey,
    parts,
    responseSchema: ANALYZE_VIDEO_SCHEMA,
    signal: params.signal
  });

  return { success: true, mode: 'live-gemini', project };
}

export async function runCopilotOptimize(params: any): Promise<any> {
  const apiKey = requireApiKey(params.apiKey);
  const prompt = `Optimize subtitles: ${JSON.stringify(params.subtitles)}. Task: ${params.actionType}. Return JSON { subtitles, title, description, advice }.`;
  const parts = [{ text: prompt }];
  const res = await generateStructuredContent({ apiKey, parts, responseSchema: { type: 'OBJECT', properties: { subtitles: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, text: { type: 'STRING' }, start: { type: 'NUMBER' }, end: { type: 'NUMBER' } } } }, title: { type: 'STRING' }, description: { type: 'STRING' }, advice: { type: 'STRING' } } } });
  return { success: true, ...res };
}

export async function runDetectCuts(params: any): Promise<any> {
  const apiKey = requireApiKey(params.apiKey);
  const prompt = `Detect scene cuts for: ${params.title}. Duration: ${params.duration}. Return JSON { cuts: [{ id, timestamp, label, type, description }] }.`;
  const res = await generateStructuredContent({ apiKey, parts: [{ text: prompt }], responseSchema: { type: 'OBJECT', properties: { cuts: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, timestamp: { type: 'NUMBER' }, label: { type: 'STRING' }, type: { type: 'STRING' }, description: { type: 'STRING' } } } } } } });
  return { success: true, cuts: res.cuts || [] };
}
