export interface ChunkedVideoOptions {
  file: File;
  onProgress: (progress: number) => void;
  chunkSize?: number;
}

export async function loadVideoInChunks(options: ChunkedVideoOptions): Promise<HTMLVideoElement> {
  const { file, onProgress, chunkSize = 5 * 1024 * 1024 } = options;
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    
    const loadNextChunk = () => {
      if (currentChunk >= totalChunks) {
        resolve(video);
        return;
      }
      
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);
      const url = URL.createObjectURL(blob);
      
      video.src = url;
      video.onloadedmetadata = () => {
        onProgress(Math.round((currentChunk / totalChunks) * 100));
        currentChunk++;
        loadNextChunk();
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to load video chunk ${currentChunk}`));
      };
    };
    
    loadNextChunk();
  });
}
