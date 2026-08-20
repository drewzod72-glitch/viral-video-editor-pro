export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  timestamp: number;
}

export interface ImageGenOptions {
  prompt: string;
  model: 'flux' | 'dall-e-3' | 'stable-diffusion';
  aspectRatio: '1:1' | '16:9' | '9:16';
  apiKey?: string;
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODEL_MAP: Record<string, string> = {
  flux: 'black-forest-labs/flux-1-pro',
  'dall-e-3': 'openai/dall-e-3',
  'stable-diffusion': 'stability-ai/stable-diffusion-xl',
};

import { getStoredOpenRouterKey, getStoredApiKey, looksLikeValidAiKey } from './apiKeyStore';

export function getImageGenModels(): { value: string; label: string }[] {
  return [
    { value: 'flux', label: 'Flux Pro' },
    { value: 'dall-e-3', label: 'DALL-E 3' },
    { value: 'stable-diffusion', label: 'Stable Diffusion XL' },
  ];
}

export async function generateImageWithAI(options: ImageGenOptions): Promise<GeneratedImage> {
  const { prompt, model, aspectRatio } = options;
  const modelId = MODEL_MAP[model];
  if (!modelId) {
    throw new Error(`Unknown image generation model: ${model}`);
  }

  const apiKey = options.apiKey || getStoredOpenRouterKey() || getStoredApiKey();
  if (!apiKey || !looksLikeValidAiKey(apiKey)) {
    throw new Error('MISSING_API_KEY: No valid OpenRouter or Groq API key found. Add one in API Key settings.');
  }

  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1792x1024',
    '9:16': '1024x1792',
  };
  const size = sizeMap[aspectRatio] || '1024x1024';

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
          ],
        },
      ],
      modalities: ['image', 'text'],
      image_config: {
        size,
        quality: 'standard',
        n: 1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const imageMessage = data.choices?.[0]?.message;
  const imageContent = imageMessage?.images?.[0];

  if (!imageContent?.url) {
    throw new Error('Image generation returned no image. The model may not support image output in your region.');
  }

  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: imageContent.url,
    prompt,
    model,
    timestamp: Date.now(),
  };
}
