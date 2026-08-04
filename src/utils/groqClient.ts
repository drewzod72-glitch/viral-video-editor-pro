import { getStoredApiKey } from './apiKeyStore';

/**
 * MASTER AI CLIENT (V30.4 - BEST EVER RESET)
 * Groq Vision (Llama 3.2 90B) for product-aware editing.
 */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODELS = ['llama-3.2-90b-vision-preview', 'qwen/qwen3.6-27b'];
const TEXT_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile'];

function getApiKey(): string {
  const key = getStoredApiKey();
  if (!key) throw new Error('MISSING_KEY');
  return key;
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
        canvas.width = 480; canvas.height = 270;
        const ctx = canvas.getContext('2d');
        v.currentTime = v.duration / 2;
        await new Promise(r => { v.onseeked = r; setTimeout(r, 1200); });
        ctx?.drawImage(v, 0, 0, 480, 270);
        const data = canvas.toDataURL('image/jpeg', 0.4);
        if (data.includes(',')) snapshots.push(data.split(',')[1]);
        URL.revokeObjectURL(url); v.remove();
        resolve(snapshots);
      } catch (e) { resolve([]); }
    };
    v.onerror = () => resolve([]);
    v.load();
  });
}

const PROMPT = `Director: Analyze video. Identify "Hook", "Product Reveal (sole/texture)", and "CTA". 
Use 'hormozi' styling (Yellow/Pink highlights). Return ONLY JSON { "title": "str", "description": "str", "subtitles": [{"id":"1","text":"str","start":0,"end":2}], "highlights": [{"id":"h1","title":"str","start":0,"end":2}], "captionStyle": "hormozi", "archetype": "hype" }`;

export async function runAnalyzeVideo(params: any): Promise<any> {
  const key = getApiKey();
  const frames = params.videoFile ? await captureFrames(params.videoFile) : [];
  for (const model of VISION_MODELS) {
    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, ...frames.map(f => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${f}` } }))] }],
          response_format: { type: 'json_object' }
        })
      });
      if (res.ok) {
        const d = await res.json();
        return { success: true, project: JSON.parse(d.choices[0].message.content) };
      }
    } catch (e) { continue; }
  }
  throw new Error('AI_BUSY');
}

export async function runCopilotOptimize(params: any): Promise<any> {
  const key = getApiKey();
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: TEXT_MODELS[0],
      messages: [{ role: 'user', content: `Task: ${params.actionType}. Command: ${params.command}. Return JSON {subtitles, title, description, advice}.` }],
      response_format: { type: 'json_object' }
    })
  });
  const d = await res.json();
  return { success: true, ...JSON.parse(d.choices[0].message.content) };
}

/**
 * Client-side smart cut detection using the subtitle transcript.
 * Analyzes pacing gaps, long pauses, and natural break points to
 * identify optimal cut locations — no server round-trip needed.
 */
export async function runDetectCuts(params: any): Promise<any> {
  const { subtitles, duration = 30 } = params;
  if (!subtitles || subtitles.length === 0) {
    return { success: true, cuts: [] };
  }

  const cuts: Array<{ id: string; timestamp: number; label: string; description: string; type: string }> = [];
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);

  // Detect gaps between subtitles > 1.5s as potential cut points
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

  // Detect very short subtitles (< 1s) as quick-cut/hard-cut opportunities
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

  // Sort by timestamp
  cuts.sort((a, b) => a.timestamp - b.timestamp);

  return { success: true, cuts };
}
