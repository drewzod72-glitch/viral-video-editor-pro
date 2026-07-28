import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { VideoProject } from '../types';

/**
 * SINGLETON ENGINE: We reuse the same FFmpeg instance to prevent 
 * memory leaks that crash mobile Safari.
 */
let ffInstance: FFmpeg | null = null;

async function getFFmpeg() {
  if (ffInstance) return ffInstance;
  
  console.log('[Browser Engine] Initializing FFmpeg Singleton...');
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  const ff = new FFmpeg();
  
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  ffInstance = ff;
  return ff;
}

export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void,
  activeClipId: string | null = null
): Promise<Blob> {
  const ff = await getFFmpeg();

  ff.on('log', ({ message }) => console.log('[FFmpeg Log]', message));
  ff.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  // 1. Cleanup Virtual Filesystem BEFORE starting
  try {
    const files = await ff.listDir('/');
    for (const f of files) {
      if (!f.isDir && f.name !== 'font.ttf') {
        await ff.deleteFile(f.name);
      }
    }
  } catch (e) {}

  // 2. Load User Video
  const inputName = `v_${Date.now()}.mp4`;
  const videoData = await fetchFile(project.videoUrl);
  
  if (!videoData || videoData.length === 0) {
    throw new Error('Video data empty. Try a different file.');
  }
  
  await ff.writeFile(inputName, videoData);

  // 3. Load Font (Persistent in virtual FS)
  const fontName = 'font.ttf';
  try {
    await ff.readFile(fontName);
  } catch (e) {
    const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf';
    const fontData = await fetchFile(fontUrl);
    await ff.writeFile(fontName, fontData);
  }

  // 4. LOW-RAM MASTER SETTINGS: 480p (Perfect for mobile TikTok, 8x lighter than 1080p)
  const W = 480;
  const H = 854;

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
    const speed = selectedClip.speed || 1.0;
    const ptsExpr = speed === 1.0 ? 'PTS-STARTPTS' : `(PTS-STARTPTS)/${speed}`;
    
    useFilterComplex = true;
    filterComplex = `[0:v]trim=start=${selectedClip.start}:end=${selectedClip.end},setpts=${ptsExpr}[v_clip]; `;
    filterComplex += `[0:a]atrim=start=${selectedClip.start}:end=${selectedClip.end},asetpts=PTS-STARTPTS${speed !== 1.0 ? `,atempo=${speed}` : ''}[a_clip]`;
    outputStream = '[v_clip]';
    audioStream = '[a_clip]';

    timeAdjustment = (t) => {
      const adj = (t - selectedClip.start) / speed;
      return (adj >= 0 && adj <= (selectedClip.duration / speed)) ? adj : null;
    };
  } else if (activeClipId === 'smart-cuts' && project.highlights.length > 0) {
    useFilterComplex = true;
    let vStreams = '';
    let aStreams = '';
    let currentConcatTime = 0;
    const mapping: { start: number, end: number, offset: number, speed: number }[] = [];
    
    // LIMIT TO 5 CLIPS for 100% Mobile Stability
    const highlightsToProcess = project.highlights.slice(0, 5);

    highlightsToProcess.forEach((h, i) => {
      const speed = h.speed || 1.0;
      const ptsExpr = speed === 1.0 ? 'PTS-STARTPTS' : `(PTS-STARTPTS)/${speed}`;
      
      filterComplex += `[0:v]trim=start=${h.start}:end=${h.end},setpts=${ptsExpr}[v${i}]; `;
      filterComplex += `[0:a]atrim=start=${h.start}:end=${h.end},asetpts=PTS-STARTPTS${speed !== 1.0 ? `,atempo=${speed}` : ''}[a${i}]; `;
      vStreams += `[v${i}]`;
      aStreams += `[a${i}]`;
      
      mapping.push({ start: h.start, end: h.end, offset: currentConcatTime - h.start, speed });
      currentConcatTime += (h.end - h.start) / speed;
    });

    filterComplex += `${vStreams}${aStreams}concat=n=${highlightsToProcess.length}:v=1:a=1[v_comp][a_comp]`;
    outputStream = '[v_comp]';
    audioStream = '[a_comp]';

    timeAdjustment = (t) => {
      const m = mapping.find(entry => t >= entry.start && t <= entry.end);
      return m ? (t - m.start) / m.speed + (m.offset + m.start) : null;
    };
  }

  // 5. Build Unified Filter Chain (Scale ONCE at the end to save RAM)
  let finalVf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black`;

  // Limit to 8 Subtitles for 100% Mobile stability
  if (project.subtitles && project.subtitles.length > 0) {
    project.subtitles.slice(0, 8).forEach((sub) => {
      const safeText = sub.text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim();
      if (!safeText) return;
      const adjStart = timeAdjustment(sub.start);
      const adjEnd = timeAdjustment(sub.end);
      if (adjStart === null || adjEnd === null) return;
      finalVf += `,drawtext=fontfile=${fontName}:text='${safeText}':fontcolor=white:fontsize=28:borderw=2:bordercolor=black:x=(w-text_w)/2:y=h-150:enable='between(t,${adjStart.toFixed(2)},${adjEnd.toFixed(2)})'`;
    });
  }

  const execArgs = [...inputArgs];
  if (useFilterComplex) {
    filterComplex += `; ${outputStream}${finalVf}[v_final]`;
    execArgs.push('-filter_complex', filterComplex, '-map', '[v_final]', '-map', `[${audioStream.replace(/[\[\]]/g, '')}]`);
  } else {
    execArgs.push('-vf', finalVf);
  }

  execArgs.push(
    '-c:v', 'libx264',
    '-preset', 'superfast', 
    '-crf', '35', 
    '-threads', '1',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '48k', 
    '-movflags', '+faststart',
    'output.mp4'
  );

  console.log('[Browser Engine] Executing Mastered Hardware Chain...');
  
  try {
    const result = await ff.exec(execArgs);
    if (result !== 0) throw new Error(`Process failed (Code ${result})`);
  } catch (err: any) {
    console.error('[FFmpeg Error]', err);
    throw new Error(`Your phone hardware is out of memory. Try a shorter clip or close other tabs.`);
  }

  const outputData = await ff.readFile('output.mp4');
  
  if (!outputData || (outputData instanceof Uint8Array && outputData.length === 0)) {
    throw new Error('Video processing produced an empty file.');
  }

  return new Blob([outputData as any], { type: 'video/mp4' });
}
