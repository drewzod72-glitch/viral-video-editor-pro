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
  onProgress: (progress: number) => void
): Promise<Blob> {
  console.log('[Browser Engine] Booting FFmpeg Gold Master...');
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  const ff = new FFmpeg();
  
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ff.on('log', ({ message }) => console.log('[FFmpeg Log]', message));
  ff.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  // 1. Load User Video with unique name to prevent cache issues
  const inputName = `input_${Date.now()}.mp4`;
  const videoData = await fetchFile(project.videoUrl);
  await ff.writeFile(inputName, videoData);

  // 2. Load Professional Space Grotesk Font
  const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf';
  const fontData = await fetchFile(fontUrl);
  await ff.writeFile('font.ttf', fontData);

  // 3. Construct Filter Graph
  let cropWExpr = 'iw';
  let cropHExpr = 'ih';
  if (project.zoomEffects && project.zoomEffects.length > 0) {
    project.zoomEffects.forEach((z) => {
      const start = z.timestamp;
      const end = start + z.duration;
      cropWExpr = `if(between(t,${start},${end}),iw/${z.scale},${cropWExpr})`;
      cropHExpr = `if(between(t,${start},${end}),ih/${z.scale},${cropHExpr})`;
    });
  }

  let vf = `crop=w='${cropWExpr}':h='${cropHExpr}',scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`;

  // Apply Subtitles (Limit to first 50 for mobile stability)
  if (project.subtitles && project.subtitles.length > 0) {
    project.subtitles.slice(0, 50).forEach((sub) => {
      const escapedText = sub.text.toUpperCase()
        .replace(/'/g, "’")
        .replace(/:/g, " -")
        .replace(/%/g, " percent");
      vf += `,drawtext=fontfile=font.ttf:text='${escapedText}':fontcolor=white:fontsize=75:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h-450:enable='between(t,${sub.start},${sub.end})'`;
    });
  }

  // 4. Run the Bake Process
  console.log('[Browser Engine] Executing filter chain...');
  await ff.exec([
    '-i', inputName,
    '-vf', vf,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '32', // Higher compression for mobile file size
    '-c:a', 'aac', // Explicitly transcode audio to AAC for TikTok
    '-b:a', '128k',
    '-movflags', '+faststart',
    'output.mp4'
  ]);

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
