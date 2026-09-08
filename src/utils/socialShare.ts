export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
  file?: Blob;
}

export async function shareToSocial(options: ShareOptions): Promise<boolean> {
  const { title, text, url, file } = options;

  if (navigator.share && navigator.canShare && file) {
    const shareData: any = { title, text, files: [file] };
    if (url) shareData.url = url;
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch {
        return false;
      }
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

export function getPlatformShareUrl(platform: string, text: string, url?: string): string {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = url ? encodeURIComponent(url) : '';
  
  switch (platform) {
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodedText}${encodedUrl ? '%20' + encodedUrl : ''}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    case 'reddit':
      return `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
    case 'pinterest':
      return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`;
    default:
      return '';
  }
}
