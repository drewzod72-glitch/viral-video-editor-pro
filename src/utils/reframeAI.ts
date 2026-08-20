import { VideoProject } from '../types';

export interface ReframeCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  reason: string;
}

export interface ReframeAnalysis {
  sourceWidth: number;
  sourceHeight: number;
  crops: ReframeCrop[];
  recommended: {
    '9:16': ReframeCrop;
    '16:9': ReframeCrop;
    '1:1': ReframeCrop;
  };
}

async function sampleFrame(video: HTMLVideoElement, time: number): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { resolve(null); return; }

    const onSeeked = () => {
      ctx.drawImage(video, 0, 0, 160, 90);
      try {
        const data = ctx.getImageData(0, 0, 160, 90);
        resolve(data);
      } catch {
        resolve(null);
      }
    };
    video.currentTime = time;
    video.addEventListener('seeked', onSeeked, { once: true });
    setTimeout(() => resolve(null), 1000);
  });
}

function computeSaliency(data: ImageData, region: { x: number; y: number; width: number; height: number }): number {
  const { x, y, width, height } = region;
  const pixels = data.data;
  const w = data.width;
  let score = 0;
  let count = 0;

  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(w, Math.floor(x + width));
  const endY = Math.min(data.height, Math.floor(y + height));

  for (let row = startY; row < endY; row++) {
    for (let col = startX; col < endX; col++) {
      const idx = (row * w + col) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      score += brightness * 0.6 + saturation * 0.4;
      count++;
    }
  }

  if (count === 0) return 0;
  return score / count;
}

export async function analyzeReframeCrops(
  videoUrl: string,
  duration: number
): Promise<ReframeAnalysis | null> {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Video load timeout')), 15000);
    video.onloadedmetadata = () => { clearTimeout(t); resolve(); };
    video.onerror = () => { clearTimeout(t); reject(new Error('Failed to load video')); };
    video.load();
  });

  const sourceWidth = video.videoWidth || 1080;
  const sourceHeight = video.videoHeight || 1920;
  const aspect = sourceWidth / sourceHeight;

  const samples = 8;
  const step = duration / (samples + 1);
  let accumulatedSaliency: number[][] = [];

  for (let i = 0; i < samples; i++) {
    const t = (i + 1) * step;
    const frame = await sampleFrame(video, t);
    if (!frame) continue;

    const gridCols = 8;
    const gridRows = 8;
    const cellW = 160 / gridCols;
    const cellH = 90 / gridRows;

    if (!accumulatedSaliency.length) {
      accumulatedSaliency = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));
    }

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const region = { x: col * cellW, y: row * cellH, width: cellW, height: cellH };
        accumulatedSaliency[row][col] += computeSaliency(frame, region);
      }
    }
  }

  video.remove();

  if (!accumulatedSaliency.length) return null;

  const gridRows = accumulatedSaliency.length;
  const gridCols = accumulatedSaliency[0].length;
  const totalSamples = samples;

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      accumulatedSaliency[row][col] /= totalSamples;
    }
  }

  const centerBias = (row: number, col: number) => {
    const cx = gridCols / 2;
    const cy = gridRows / 2;
    const dx = (col - cx) / cx;
    const dy = (row - cy) / cy;
    return 1 - Math.sqrt(dx * dx + dy * dy) * 0.5;
  };

  const findBestWindow = (targetAspect: number): ReframeCrop => {
    let bestScore = -1;
    let bestX = 0;
    let bestY = 0;
    let bestW = 0;
    let bestH = 0;

    const windowCols = Math.max(3, Math.floor(gridCols * 0.6));
    const windowRows = Math.max(3, Math.floor(gridCols / targetAspect * 0.6));

    for (let row = 0; row <= gridRows - windowRows; row++) {
      for (let col = 0; col <= gridCols - windowCols; col++) {
        let saliencySum = 0;
        let count = 0;
        for (let wr = 0; wr < windowRows; wr++) {
          for (let wc = 0; wc < windowCols; wc++) {
            saliencySum += accumulatedSaliency[row + wr][col + wc];
            count++;
          }
        }
        const avgSaliency = saliencySum / count;
        const bias = centerBias(row + windowRows / 2, col + windowCols / 2);
        const score = avgSaliency * 0.7 + bias * 30;

        if (score > bestScore) {
          bestScore = score;
          bestX = (col / gridCols) * sourceWidth;
          bestY = (row / gridRows) * sourceHeight;
          bestW = (windowCols / gridCols) * sourceWidth;
          bestH = (windowRows / gridRows) * sourceHeight;
        }
      }
    }

    return {
      x: Math.max(0, bestX),
      y: Math.max(0, bestY),
      width: Math.min(sourceWidth - bestX, bestW),
      height: Math.min(sourceHeight - bestY, bestH),
      score: bestScore,
      reason: `AI detected highest attention zone at ${(bestX / sourceWidth * 100).toFixed(0)}%, ${(bestY / sourceHeight * 100).toFixed(0)}%`
    };
  };

  const recommend = (ar: string): ReframeCrop => {
    const aspectMap: Record<string, number> = {
      '9:16': 9 / 16,
      '16:9': 16 / 9,
      '1:1': 1 / 1,
    };
    const targetAspect = aspectMap[ar] || 9 / 16;
    return findBestWindow(targetAspect);
  };

  const crops = [
    recommend('9:16'),
    recommend('16:9'),
    recommend('1:1'),
  ];

  return {
    sourceWidth,
    sourceHeight,
    crops,
    recommended: {
      '9:16': crops[0],
      '16:9': crops[1],
      '1:1': crops[2],
    },
  };
}

export function getCropFFmpegFilter(crop: ReframeCrop, sourceWidth: number, sourceHeight: number): string {
  const x = Math.round(crop.x);
  const y = Math.round(crop.y);
  const w = Math.round(crop.width);
  const h = Math.round(crop.height);
  return `crop=w='${w}':h='${h}':x='${x}':y='${y}'`;
}
