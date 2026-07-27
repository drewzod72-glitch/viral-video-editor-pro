import { VideoProject } from '../types';

/**
 * Lightweight browser-side video engine.
 * We use dynamic imports to ensure FFmpeg is ONLY loaded when the user
 * actually clicks "Bake", saving 30MB of memory on the initial load.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void
): Promise<Blob> {
  console.log('[Browser Engine] Initializing FFmpeg core...');
  
  // Dynamic imports to save memory on boot
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);

  const ff = new FFmpeg();
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ff.on('log', ({ message }) => console.log('[FFmpeg.wasm]', message));
  ff.on('progress', ({ progress }) => onProgress(Math.round(progress * 100)));

  // Write video to virtual memory
  const videoData = await fetchFile(project.videoUrl);
  await ff.writeFile('input.mp4', videoData);

  // Apply standard TikTok vertical crop
  const filter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black';
  
  await ff.exec([
    '-i', 'input.mp4',
    '-vf', filter,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '30', // Max compression for mobile speed
    '-c:a', 'copy',
    'output.mp4'
  ]);

  const data = await ff.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
}
