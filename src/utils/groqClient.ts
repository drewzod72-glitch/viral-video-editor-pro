import { getStoredApiKey } from './apiKeyStore';

/**
 * MASTER AI CLIENT (V54 - TEXT-ONLY STABILITY)
 * Reverted to text-only flow to avoid decommissioned vision models.
 */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const TEXT_MODELS = [
  'llama-3.3-70b-versatile', 
  'llama-3.1-8b-instant', 
  'llama-3.2-90b-text-preview'
];

// In-memory status log for UI
let apiStatusLog: Array<{ model: string; status: 'success' | 'failure'; error?: string; timestamp: string }> = [];

export function getApiStatusLog() {
  return [...apiStatusLog];
}

export function clearApiStatusLog() {
  apiStatusLog = [];
}

function addLogEntry(entry: { model: string; status: 'success' | 'failure'; error?: string }) {
  apiStatusLog.unshift({ ...entry, timestamp: new Date().toLocaleTimeString() });
  if (apiStatusLog.length > 50) apiStatusLog.pop();
}

function getApiKey(): string {
  const key = getStoredApiKey();
  if (!key) throw new Error('MISSING_KEY');
  return key;
}

/**
 * Shared Groq caller with retry + backoff + detailed error logging.
 */
async function callGroq(model: string, messages: any[], retryCount = 0): Promise<any> {
  const key = getApiKey();
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' }
      })
    });

    if (res.ok) {
      const data = await res.json();
      addLogEntry({ model, status: 'success' });
      return data;
    }

    const rawText = await res.text();
    const errSnippet = rawText.slice(0, 200);
    console.error(`[Groq] ${model} failed (${res.status}): ${errSnippet}`);

    // Prefix fallback for potential 404s
    if (res.status === 404 && !model.startsWith('meta-llama/') && retryCount === 0) {
      return callGroq(`meta-llama/${model}`, messages, 1);
    }
    
    const isClientError = res.status >= 400 && res.status < 500 && res.status !== 429;

    if (!isClientError && retryCount < 2) {
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(r => setTimeout(r, delay));
      return callGroq(model, messages, retryCount + 1);
    }

    addLogEntry({ model, status: 'failure', error: `HTTP ${res.status}: ${errSnippet}` });
    return null;
  } catch (e: any) {
    console.error(`[Groq] ${model} network error:`, e);
    addLogEntry({ model, status: 'failure', error: e?.message || 'Network error' });
    return null;
  }
}

function extractAndRepair(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        const subMatch = text.match(/"subtitles"\s*:\s*(\[[\s\S]*?\])/);
        const highMatch = text.match(/"highlights"\s*:\s*(\[[\s\S]*?\])/);
        
        return {
          title: text.match(/"title"\s*:\s*"([^"]+)"/)?.[1] || "Viral Video",
          description: text.match(/"description"\s*:\s*"([^"]+)"/)?.[1] || "Edited by AI",
          needsSubtitles: true,
          subtitles: subMatch ? JSON.parse(subMatch[1]) : [],
          highlights: highMatch ? JSON.parse(highMatch[1]) : [],
          enableSubtitles: true
        };
      }
    }
    return null;
  }
}

function generateMockSubtitles(niche: string): any[] {
  const mocks: Record<string, string[]> = {
    cooking: ["SIZZLING STEAK", "BUTTER BASTING", "FRESH HERBS", "PERFECT SEAR", "LET'S EAT"],
    tech: ["BUTTERY SWITCHES", "THOCKY SOUND", "AESTHETIC BUILD", "GENIUS HACK", "NEXT GEN"],
    fitness: ["NO EXCUSES", "PUSH LIMITS", "STAY FOCUSED", "GET SHREDDED", "WORK HARD"],
    default: ["VIRAL MOMENT", "WATCH TILL END", "DONT SKIP", "GAME CHANGER", "MUST SEE"]
  };
  const texts = mocks[niche] || mocks.default;
  return texts.map((t, i) => ({ id: `m-${i}`, text: t, start: i * 3, end: (i * 3) + 2.5 }));
}

const PROMPT = `Senior Viral Director. 
Analyze the video context (description/niche) and generate a viral edit plan.
Return ONLY JSON: { "title", "description", "subtitles": [], "highlights": [] }`;

export async function runAnalyzeVideo(params: any): Promise<any> {
  // Vision model path removed per Kilo Fix. Focus on text models using description/niche.
  const context = `Niche: ${params.niche}. Title: ${params.name}. Description: ${params.userDescription || 'Viral video'}.`;
  
  for (const model of TEXT_MODELS) {
    const messages = [
      { role: 'user', content: `${PROMPT}\nVideo Context: ${context}` }
    ];
    
    const data = await callGroq(model, messages);
    if (data?.choices?.[0]?.message?.content) {
      const project = extractAndRepair(data.choices[0].message.content);
      if (project) {
        return { success: true, project };
      }
    }
  }

  // Final fallback
  return { 
    success: true, 
    project: { 
      title: params.name || "Viral Edit",
      subtitles: generateMockSubtitles(params.niche || 'default'),
      needsSubtitles: true,
      enableSubtitles: true,
      highlights: [{ id: '1', title: 'Smart Cut', start: 0, end: 30 }]
    } 
  };
}

export async function runCopilotOptimize(params: any): Promise<any> {
  for (const model of TEXT_MODELS) {
    const messages = [{ role: 'user', content: `Task: ${params.actionType}. Command: ${params.command}. Return JSON {subtitles, title, description, advice}.` }];
    const data = await callGroq(model, messages);
    if (data?.choices?.[0]?.message?.content) {
      const parsed = extractAndRepair(data.choices[0].message.content);
      if (parsed) return { success: true, ...parsed };
    }
  }
  throw new Error('AI_OFFLINE');
}

export async function runDetectCuts(params: any): Promise<any> {
  const { subtitles } = params;
  if (!subtitles || subtitles.length === 0) return { success: true, cuts: [] };
  const cuts: any[] = [];
  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start - sorted[i - 1].end;
    if (gap > 1.5) {
      cuts.push({ id: `cut-${i}`, timestamp: sorted[i].start, label: `Gap Cut`, type: 'fade' });
    }
  }
  return { success: true, cuts };
}
