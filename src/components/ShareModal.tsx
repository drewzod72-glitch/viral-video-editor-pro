import React, { useState } from 'react';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { shareToSocial, copyToClipboard, getPlatformShareUrl } from '../utils/socialShare';
import { trackEvent } from '../utils/analytics';
import { colors, INTER, TRANSITION } from '../utils/styles';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  shareText: string;
  shareUrl?: string;
}

export default function ShareModal({ isOpen, onClose, projectName, shareText, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!isOpen) return null;

  const platforms = [
    { id: 'twitter', name: 'Twitter / X', color: '#000000', icon: '𝕏' },
    { id: 'facebook', name: 'Facebook', color: '#1877F2', icon: 'f' },
    { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', icon: 'in' },
    { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', icon: '📱' },
    { id: 'telegram', name: 'Telegram', color: '#0088cc', icon: '✈' },
    { id: 'reddit', name: 'Reddit', color: '#FF4500', icon: '🔴' },
  ];

  const handleShare = async (platform: string) => {
    setSharing(true);
    trackEvent('share_click', { platform, project: projectName });

    if (platform === 'copy') {
      const success = await copyToClipboard(shareText + (shareUrl ? `\n${shareUrl}` : ''));
      setCopied(success);
      setTimeout(() => setCopied(false), 2000);
    } else {
      const url = getPlatformShareUrl(platform, shareText, shareUrl);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }

    setSharing(false);
  };

  const handleNativeShare = async () => {
    trackEvent('native_share', { project: projectName });
    const success = await shareToSocial({
      title: projectName,
      text: shareText,
      url: shareUrl,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backdropFilter: 'blur(8px)'
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a1a', borderRadius: '20px', padding: '24px',
        maxWidth: '400px', width: '100%', border: '1px solid #333'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, margin: 0 }}>Share Video</h3>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: '20px'
          }}>✕</button>
        </div>

        {navigator.share && (
          <button
            onClick={handleNativeShare}
            disabled={sharing}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #EC4899, #db2777)',
              color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              fontFamily: INTER, marginBottom: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Share2 size={18} />
            Share via Device
          </button>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px'
        }}>
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => handleShare(platform.id)}
              disabled={sharing}
              style={{
                padding: '12px', borderRadius: '10px', border: '1px solid #333',
                background: '#252525', color: '#fff', cursor: 'pointer',
                fontFamily: INTER, fontSize: '12px', fontWeight: 600,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                transition: TRANSITION.smooth
              }}
            >
              <span style={{ fontSize: '20px' }}>{platform.icon}</span>
              <span style={{ fontSize: '10px', color: '#a1a1aa' }}>{platform.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => handleShare('copy')}
          disabled={sharing}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333',
            background: '#252525', color: copied ? '#10b981' : '#fff',
            cursor: 'pointer', fontFamily: INTER, fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: TRANSITION.smooth
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied to clipboard!' : 'Copy link & text'}
        </button>
      </div>
    </div>
  );
}
