import React, { useRef, useState } from 'react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';

export default function NicheSelector({ onSelectTemplate, onUploadCustomFile, isProcessing }: any) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedNiche, setSelectedNiche] = useState<VideoNiche>('unboxing');
  const [customDescription, setCustomDescription] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileObj(file);
      setCustomFileName(file.name);
    }
  };

  const handleCustomSubmit = (e: any) => {
    e.preventDefault();
    if (isProcessing) return;
    if (!selectedFileObj) {
      setUploadError('Please upload a video file first.');
      return;
    }
    setUploadError(null);
    onUploadCustomFile(selectedFileObj, customFileName, selectedNiche, customDescription || 'Master review and viral hype edit.');
  };

  const NICHE_ICONS: Record<string, string> = {
    unboxing: '📦', sales: '💼', fitness: '💪', cooking: '👨‍🍳',
    general: '🎬', education: '🎓', comedy: '😂', motivation: '🔥',
    pets: '🐾', tech: '💻',
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 8px' }}>
      <style>{`
        @media (max-width: 480px) {
          .niche-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 481px) and (max-width: 640px) {
          .niche-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
      {/* ── HERO ── */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
          Zero-Cost Browser Engine
        </div>
        <h2 style={{ fontWeight: 900, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-2px', fontFamily: '"Inter", sans-serif', margin: '0 0 12px 0', lineHeight: 1.1 }}>
          CREATE VIRAL CONTENT
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '480px', margin: '0 auto', fontWeight: 500, lineHeight: 1.6 }}>
          Professional studio-grade editor. Frame-by-frame canvas forge. Works on any device, any browser. No install. No cloud bill.
        </p>
      </div>

      {/* ── TAB SWITCHER ── */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(20px)', padding: '4px', borderRadius: '16px', border: '1px solid rgba(30,41,59,0.6)', marginBottom: '24px', width: 'fit-content', margin: '0 auto 28px auto' }}>
        <button
          onClick={() => setActiveTab('presets')}
          style={{ padding: '10px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.8px', background: activeTab === 'presets' ? 'rgba(139,92,246,0.25)' : 'transparent', color: activeTab === 'presets' ? '#e9d5ff' : '#64748b', transition: 'all 0.2s' }}
          onMouseEnter={(e) => {
            if (activeTab !== 'presets') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = '#a1a1aa';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'presets') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }
          }}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          style={{ padding: '10px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.8px', background: activeTab === 'custom' ? 'rgba(139,92,246,0.25)' : 'transparent', color: activeTab === 'custom' ? '#e9d5ff' : '#64748b', transition: 'all 0.2s' }}
          onMouseEnter={(e) => {
            if (activeTab !== 'custom') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = '#a1a1aa';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'custom') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }
          }}
        >
          Custom Upload
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {RAW_VIDEO_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              disabled={isProcessing}
              style={{ background: 'linear-gradient(180deg, rgba(24,24,27,0.9) 0%, rgba(9,9,11,0.95) 100%)', border: '1px solid rgba(30,41,59,0.6)', borderRadius: '20px', padding: '20px', textAlign: 'left', cursor: isProcessing ? 'not-allowed' : 'pointer', width: '100%', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(12px)', opacity: isProcessing ? 0.5 : 1, transform: 'translateY(0)' }}
              onMouseEnter={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(139,92,246,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(30,41,59,0.6)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Social Simulator Mockup */}
              <div style={{ width: '100%', aspectRatio: '9/16', maxHeight: '180px', background: '#000', borderRadius: '14px', marginBottom: '14px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(30,41,59,0.8)' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.8) 100%)' }}>
                  <div style={{ fontSize: '40px', opacity: 0.9 }}>{NICHE_ICONS[tpl.niche] || '🎬'}</div>
                </div>
                {/* Safe Zone Guides */}
                <div style={{ position: 'absolute', top: '12%', left: '10%', right: '10%', bottom: '18%', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '8px', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {tpl.niche}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{tpl.niche}</div>
                <div style={{ fontSize: '9px', color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '6px' }}>● READY</div>
              </div>
              <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '13px', fontFamily: '"Inter", sans-serif', lineHeight: 1.3, marginBottom: '8px' }}>
                {tpl.name}
              </div>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 500, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {tpl.userDescription}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ border: '2px dashed #27272a', borderRadius: '24px', padding: '56px 24px', textAlign: 'center', cursor: 'pointer', background: 'linear-gradient(180deg, rgba(24,24,27,0.6) 0%, rgba(9,9,11,0.8) 100%)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(12px)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.background = 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(9,9,11,0.9) 100%)'; e.currentTarget.style.boxShadow = '0 20px 60px rgba(139,92,246,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'linear-gradient(180deg, rgba(24,24,27,0.6) 0%, rgba(9,9,11,0.8) 100%)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ fontSize: '52px', marginBottom: '14px', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.3))', transition: 'all 0.3s ease' }}>📹</div>
            <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '14px', fontFamily: '"Inter", sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {customFileName || 'TAP TO UPLOAD VIDEO'}
            </div>
            <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 500 }}>
              MP4, MOV, WebM — max 500MB
            </div>
          </div>

          {/* AI Instructions */}
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>AI Creative Direction</div>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g. 'Zoom on the product soles, fast cuts, make it hype'..."
              style={{ width: '100%', background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(30,41,59,0.6)', borderRadius: '16px', padding: '16px', color: '#f1f5f9', minHeight: '110px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: '"Inter", sans-serif', resize: 'vertical', backdropFilter: 'blur(12px)' }}
            />
          </div>

          {/* Niche Grid */}
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Content Niche</div>
            <div className="niche-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {['unboxing', 'sales', 'fitness', 'cooking', 'general', 'education', 'comedy', 'motivation', 'pets', 'tech'].map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedNiche(n as any)}
                  style={{ background: selectedNiche === n ? 'rgba(139,92,246,0.2)' : 'rgba(9,9,11,0.4)', border: selectedNiche === n ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(30,41,59,0.5)', color: 'white', padding: '10px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', fontFamily: '"Inter", sans-serif', letterSpacing: '0.3px', transition: 'all 0.2s', backdropFilter: 'blur(8px)' }}
                  onMouseEnter={(e) => {
                    if (selectedNiche !== n) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedNiche !== n) {
                      e.currentTarget.style.borderColor = 'rgba(30,41,59,0.5)';
                      e.currentTarget.style.background = 'rgba(9,9,11,0.4)';
                    }
                  }}
                >
                  {NICHE_ICONS[n] ? `${NICHE_ICONS[n]} ${n.slice(0, 4)}` : n.slice(0, 6)}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          {uploadError && (
            <p style={{ color: '#fca5a5', fontSize: '11px', fontWeight: 600, lineHeight: 1.5 }}>
              {uploadError}
            </p>
          )}
          <button
            onClick={handleCustomSubmit}
            disabled={isProcessing}
            style={{ background: isProcessing ? '#18181b' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: isProcessing ? '#64748b' : 'white', border: 'none', borderRadius: '18px', padding: '20px', fontWeight: 900, textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', fontSize: '15px', fontFamily: '"Inter", sans-serif', letterSpacing: '1px', boxShadow: isProcessing ? 'none' : '0 12px 40px rgba(139,92,246,0.35)', transition: 'all 0.2s', marginTop: '8px' }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(139,92,246,0.45)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = isProcessing ? 'none' : '0 12px 40px rgba(139,92,246,0.35)';
            }}
          >
            {isProcessing ? '⚙ Engineering...' : '🔥 FORGE FINAL VIDEO'}
          </button>
        </div>
      )}
    </div>
  );
}
