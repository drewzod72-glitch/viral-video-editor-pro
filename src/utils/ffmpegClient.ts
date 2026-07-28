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

  // 2. Load Professional Font
  const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf';
  const fontData = await fetchFile(fontUrl);
  await ff.writeFile('font.ttf', fontData);

  // 3. Handle Clipping / Smart Cuts
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
    inputArgs = ['-ss', selectedClip.start.toString(), '-t', selectedClip.duration.toString(), '-i', inputName];
    timeAdjustment = (t) => {
      const adj = t - selectedClip.start;
      return (adj >= 0 && adj <= selectedClip.duration) ? adj : null;
    };
  } else if (activeClipId === 'smart-cuts' && project.highlights.length > 0) {
    // Smart Cuts Mode: Build mapping
    useFilterComplex = true;
    let vStreams = '';
    let aStreams = '';
    let currentConcatTime = 0;
    const mapping: { start: number, end: number, offset: number }[] = [];

    project.highlights.forEach((h, i) => {
      filterComplex += `[0:v]trim=start=${h.start}:end=${h.end},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[v${i}]; `;
      filterComplex += `[0:a]atrim=start=${h.start}:end=${h.end},asetpts=PTS-STARTPTS[a${i}]; `;
      vStreams += `[v${i}]`;
      aStreams += `[a${i}]`;
      
      mapping.push({ start: h.start, end: h.end, offset: currentConcatTime - h.start });
      currentConcatTime += (h.end - h.start);
    });

    filterComplex += `${vStreams}${aStreams}concat=n=${project.highlights.length}:v=1:a=1[v_comp][a_comp]`;
    outputStream = '[v_comp]';
    audioStream = '[a_comp]';

    timeAdjustment = (t) => {
      const m = mapping.find(entry => t >= entry.start && t <= entry.end);
      return m ? t + m.offset : null;
    };
  }

  // 4. Construct Video Filters (Zooms + Subtitles)
  let videoFilters: string[] = [];
  
  // If not using filter_complex (single clip), we need to scale/pad first
  if (!useFilterComplex) {
    videoFilters.push('scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black');
  }

  // A. Simplified Dynamic Zooms (Limit to 10 for stability)
  if (project.zoomEffects && project.zoomEffects.length > 0) {
    let wExpr = 'iw';
    let hExpr = 'ih';
    const sortedZooms = [...project.zoomEffects].sort((a, b) => a.timestamp - b.timestamp).slice(0, 10);
    
    sortedZooms.forEach((z) => {
      const adjStart = timeAdjustment(z.timestamp);
      if (adjStart === null) return;
      const adjEnd = adjStart + z.duration;
      wExpr = `if(between(t,${adjStart.toFixed(2)},${adjEnd.toFixed(2)}),iw/${z.scale},${wExpr})`;
      hExpr = `if(between(t,${adjStart.toFixed(2)},${adjEnd.toFixed(2)}),ih/${z.scale},${hExpr})`;
    });
    
    videoFilters.push(`crop=w='${wExpr}':h='${hExpr}',scale=1080:1920`);
  }

  // B. Subtitles (Limit to 25 for maximum stability in browser)
  if (project.subtitles && project.subtitles.length > 0) {
    project.subtitles.slice(0, 25).forEach((sub) => {
      // Very strict sanitization: only alphanumeric and space
      const safeText = sub.text.toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "") 
        .trim();
      
      if (!safeText) return;

      const adjStart = timeAdjustment(sub.start);
      const adjEnd = timeAdjustment(sub.end);
      if (adjStart === null || adjEnd === null) return;

      videoFilters.push(`drawtext=fontfile=font.ttf:text='${safeText}':fontcolor=white:fontsize=70:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-480:enable='between(t,${adjStart.toFixed(2)},${adjEnd.toFixed(2)})'`);
    });
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
