import { VideoProject } from '../types';

/**
 * FULL-POWER Browser-side video engine.
 * Renders crops, dynamic zooms, and ALL subtitles directly in Safari/Chrome.
 */
export async function renderVideoInBrowser(
  project: VideoProject,
  onProgress: (progress: number) => void
): Promise<Blob> {
  console.log('[Browser Engine] Powering up FFmpeg for Full Bake...');
  
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

  // 1. Load User Video
  const videoData = await fetchFile(project.videoUrl);
  await ff.writeFile('input.mp4', videoData);

  // 2. Load Professional Font for Captions
  const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/static/SpaceGrotesk-Bold.ttf';
  const fontData = await fetchFile(fontUrl);
  await ff.writeFile('font.ttf', fontData);

  // 3. Build the Master Filter Chain
  
  // A. Dynamic Zooms (Crop)
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

  let vf = `crop=w='${cropWExpr}':h='${cropHExpr}'`;
  
  // B. Standard Vertical Formatting
  vf += `,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`;

  // C. Burn ALL Subtitles
  if (project.subtitles && project.subtitles.length > 0) {
    project.subtitles.forEach((sub) => {
      const escapedText = sub.text.toUpperCase().replace(/'/g, "’").replace(/:/g, " -");
      vf += `,drawtext=fontfile=font.ttf:text='${escapedText}':fontcolor=white:fontsize=70:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h-400:enable='between(t,${sub.start},${sub.end})'`;
    });
  }

  // 4. Execute the Bake
  await ff.exec([
    '-i', 'input.mp4',
    '-vf', vf,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-c:a', 'copy',
    'output.mp4'
  ]);

  const data = await ff.readFile('output.mp4');
  return new Blob([data as any], { type: 'video/mp4' });
}
