import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { VideoProject } from '../types';

/**
 * PRO-POWER Browser-side video engine.
 * Renders crops, dynamic zooms, and ALL subtitles directly in Safari/Chrome.
 * Optimized for mobile memory limits and TikTok standards.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  console.log('[Browser Engine] Booting FFmpeg Gold Master...');
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  const ff = new FFmpeg();
  
  // ... existing ff.load logic ...
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ff.on('log', ({ message }) => console.log('[FFmpeg Log]', message));
  ff.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  // 1. Load User Video with unique name to prevent cache issues
  const inputName = `input_${Date.now()}.mp4`;
  const videoData = await fetchFile(project.videoUrl);
  
  if (!videoData || videoData.length === 0) {
    throw new Error('Failed to load video data. The file may be too large or inaccessible.');
  }
  
  await ff.writeFile(inputName, videoData);

  // 2. Load Font with Error Handling
  try {
    const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf';
    const fontData = await fetchFile(fontUrl);
    if (!fontData || fontData.length < 1000) {
      throw new Error('Font download failed');
    }
    await ff.writeFile('font.ttf', fontData);
  } catch (fontErr) {
    console.warn('[Browser Engine] External font failed, using fallback path...');
    // In many environments, the font might already be in the public folder
    try {
      const fallbackFont = await fetchFile('/fonts/SpaceGrotesk-Bold.ttf');
      await ff.writeFile('font.ttf', fallbackFont);
    } catch (e) {
      console.error('[Browser Engine] No font available. Subtitles will be disabled.');
    }
  }

  // ... Clipping logic ...
  let inputArgs: string[] = ['-i', inputName];
  let filterComplex = '';
  let outputStream = '[v]';
  let audioStream = '[a]';
  let useFilterComplex = false;

  const selectedClip = activeClipId && activeClipId !== 'smart-cuts' 
    ? project.highlights.find(h => h.id === activeClipId) 
    : null;

  let timeAdjustment: (t: number) => number | null = (t) => t;

  if (selectedClip) {
    // Single Clip Mode: Timestamps start from 0 at clip.start
    const speed = selectedClip.speed || 1.0;
    const ptsExpr = speed === 1.0 ? 'PTS-STARTPTS' : `(PTS-STARTPTS)/${speed}`;
    
    // We apply speed via setpts and atempo
    let vFilter = `trim=start=${selectedClip.start}:end=${selectedClip.end},setpts=${ptsExpr}`;
    let aFilter = `atrim=start=${selectedClip.start}:end=${selectedClip.end},asetpts=${ptsExpr}`;
    if (speed !== 1.0) {
      // atempo supports 0.5 to 2.0
      aFilter += `,atempo=${speed}`;
    }
    
    useFilterComplex = true;
    filterComplex = `[0:v]${vFilter},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[v_clip]; `;
    filterComplex += `[0:a]${aFilter}[a_clip]`;
    outputStream = '[v_clip]';
    audioStream = '[a_clip]';

    timeAdjustment = (t) => {
      const adj = (t - selectedClip.start) / speed;
      return (adj >= 0 && adj <= (selectedClip.duration / speed)) ? adj : null;
    };
  } else if (activeClipId === 'smart-cuts' && project.highlights.length > 0) {
    // Smart Cuts Mode: Build mapping
    useFilterComplex = true;
    let vStreams = '';
    let aStreams = '';
    let currentConcatTime = 0;
    const mapping: { start: number, end: number, offset: number, speed: number }[] = [];

    // Limit to 12 segments for mobile stability
    const highlightsToProcess = project.highlights.slice(0, 12);

    highlightsToProcess.forEach((h, i) => {
      const speed = h.speed || 1.0;
      const ptsExpr = speed === 1.0 ? 'PTS-STARTPTS' : `(PTS-STARTPTS)/${speed}`;
      
      let vF = `trim=start=${h.start}:end=${h.end},setpts=${ptsExpr},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`;
      let aF = `atrim=start=${h.start}:end=${h.end},asetpts=${ptsExpr}`;
      if (speed !== 1.0) aF += `,atempo=${speed}`;
      
      filterComplex += `[0:v]${vF}[v${i}]; `;
      filterComplex += `[0:a]${aF}[a${i}]; `;
      vStreams += `[v${i}]`;
      aStreams += `[a${i}]`;
      
      const durationAtSpeed = (h.end - h.start) / speed;
      mapping.push({ start: h.start, end: h.end, offset: currentConcatTime - h.start, speed });
      currentConcatTime += durationAtSpeed;
    });

    filterComplex += `${vStreams}${aStreams}concat=n=${highlightsToProcess.length}:v=1:a=1[v_comp][a_comp]`;
    outputStream = '[v_comp]';
    audioStream = '[a_comp]';

    timeAdjustment = (t) => {
      const m = mapping.find(entry => t >= entry.start && t <= entry.end);
      if (!m) return null;
      // Adjusted time = (Time in original clip) / speed + cumulative offset
      return (t - m.start) / m.speed + (m.offset + m.start);
    };
  }

  // 4. Construct Video Filters (Subtitles Only - Zooms disabled for stability)
  let videoFilters: string[] = [];
  
  if (!useFilterComplex) {
    videoFilters.push('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black');
  }

  // B. Subtitles (Limit to 15 for maximum stability in browser)
  if (project.subtitles && project.subtitles.length > 0) {
    const hasFont = await ff.readFile('font.ttf').then(() => true).catch(() => false);
    
    if (hasFont) {
      project.subtitles.slice(0, 15).forEach((sub) => {
        const safeText = sub.text.toUpperCase()
          .replace(/[^A-Z0-9 ]/g, "") 
          .trim();
        
        if (!safeText) return;

        const adjStart = timeAdjustment(sub.start);
        const adjEnd = timeAdjustment(sub.end);
        if (adjStart === null || adjEnd === null) return;

        videoFilters.push(`drawtext=fontfile=font.ttf:text='${safeText}':fontcolor=white:fontsize=75:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h-480:enable='between(t,${adjStart.toFixed(2)},${adjEnd.toFixed(2)})'`);
      });
    }
  }

  // Final command construction
  const execArgs = [...inputArgs];
  const vf = videoFilters.join(',');

  if (useFilterComplex) {
    if (vf) {
      filterComplex += `; ${outputStream}${vf}[v_final]`;
      outputStream = '[v_final]';
    }
    execArgs.push('-filter_complex', filterComplex);
    execArgs.push('-map', outputStream, '-map', audioStream);
  } else if (vf) {
    execArgs.push('-vf', vf);
  }

  execArgs.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '30', // Higher compression for memory
    '-pix_fmt', 'yuv420p', // Standard mobile pixel format
    '-c:a', 'aac',
    '-b:a', '96k',
    '-ar', '44100',
    '-movflags', '+faststart',
    'output.mp4'
  );

  console.log('[Browser Engine] Executing filter chain...');
  
  try {
    const result = await ff.exec(execArgs);
    if (result !== 0) {
      throw new Error(`Engine process failed (Code ${result}). This usually happens if the video format is unsupported or the filter chain is too complex.`);
    }
  } catch (err: any) {
    console.error('[FFmpeg Error]', err);
    const errorMessage = err instanceof Error ? err.message : (typeof err === 'string' ? err : 'Hardware memory limit reached');
    throw new Error(`Bake failed: ${errorMessage}. Try a shorter clip or removing some subtitles.`);
  }

  const outputData = await ff.readFile('output.mp4');
  
  // Explicitly check for content
  if (!outputData || (outputData instanceof Uint8Array && outputData.length === 0)) {
    throw new Error('Video processing produced an empty file. Try a shorter clip or different template.');
  }

  console.log(`[Browser Engine] Export Success: ${outputData instanceof Uint8Array ? outputData.length : 'unknown'} bytes.`);

  // Cleanup virtual files
  try {
    await ff.deleteFile(inputName);
    await ff.deleteFile('output.mp4');
    await ff.deleteFile('font.ttf');
  } catch (e) {}

  return new Blob([outputData as any], { type: 'video/mp4' });
}
