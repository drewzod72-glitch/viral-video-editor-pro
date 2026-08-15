import React, { useRef, useState } from 'react';
import { Package, Briefcase, Dumbbell, ChefHat, Clapperboard, GraduationCap, Laugh, Flame, PawPrint, Laptop, Video, Settings, Zap, Loader2 } from 'lucide-react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';
import { colors, borderRadius, INTER, statusColors, TRANSITION, tint } from '../utils/styles';

const NICHE_ICONS: Record<string, React.ReactNode> = {
  unboxing: <Package size={14} color={colors.primary} />,
  sales: <Briefcase size={14} color={colors.primary} />,
  fitness: <Dumbbell size={14} color={colors.primary} />,
  cooking: <ChefHat size={14} color={colors.primary} />,
  general: <Clapperboard size={14} color={colors.primary} />,
  education: <GraduationCap size={14} color={colors.primary} />,
  comedy: <Laugh size={14} color={colors.primary} />,
  motivation: <Flame size={14} color={colors.primary} />,
  pets: <PawPrint size={14} color={colors.primary} />,
  tech: <Laptop size={14} color={colors.primary} />,
};

const NICHE_SHORT: Record<string, string> = {
  unboxing: 'Unbox',
  sales: 'Sales',
  fitness: 'Fit',
  cooking: 'Cook',
  general: 'Gen',
  education: 'Edu',
  comedy: 'Com',
  motivation: 'Mote',
  pets: 'Pets',
  tech: 'Tech',
};

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
        <div style={{ fontSize: '11px', color: colors.primary, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
          Zero-Cost Browser Engine
        </div>
        <h2 style={{ fontWeight: 900, fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-2px', fontFamily: INTER, margin: '0 0 12px 0', lineHeight: 1.1, color: colors.foreground }}>
          CREATE VIRAL CONTENT
        </h2>
        <p style={{ color: colors.mutedForeground, fontSize: '13px', maxWidth: '480px', margin: '0 auto', fontWeight: 500, lineHeight: 1.6 }}>
          Professional studio-grade editor. Frame-by-frame canvas forge. Works on any device, any browser. No install. No cloud bill.
        </p>
      </div>

      {/* ── TAB SWITCHER ── */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(20px)', padding: '4px', borderRadius: '16px', border: `1px solid ${colors.border}`, marginBottom: '24px', width: 'fit-content', margin: '0 auto 28px auto' }}>
        <button
          onClick={() => setActiveTab('presets')}
          style={{
            padding: '10px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: INTER, textTransform: 'uppercase', letterSpacing: '0.8px',
            background: activeTab === 'presets' ? tint(colors.primary, 0.25) : 'transparent',
            color: activeTab === 'presets' ? colors.foreground : colors.mutedForeground,
            transition: TRANSITION.smooth,
          }}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          style={{
            padding: '10px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '12px', fontFamily: INTER, textTransform: 'uppercase', letterSpacing: '0.8px',
            background: activeTab === 'custom' ? tint(colors.primary, 0.25) : 'transparent',
            color: activeTab === 'custom' ? colors.foreground : colors.mutedForeground,
            transition: TRANSITION.smooth,
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
              style={{
                background: `linear-gradient(180deg, rgba(24,24,27,0.9) 0%, rgba(9,9,11,0.95) 100%)`,
                border: `1px solid ${tint(colors.primary, 0.2)}`,
                borderRadius: '20px', padding: '20px', textAlign: 'left',
                cursor: isProcessing ? 'not-allowed' : 'pointer', width: '100%',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(12px)', opacity: isProcessing ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) {
                  e.currentTarget.style.borderColor = tint(colors.primary, 0.4);
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 20px 60px ${tint(colors.primary, 0.15)}`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = tint(colors.primary, 0.2);
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Social Simulator Mockup */}
              <div style={{ width: '100%', aspectRatio: '9/16', maxHeight: '180px', background: colors.card, borderRadius: '14px', marginBottom: '14px', overflow: 'hidden', position: 'relative', border: `1px solid ${colors.border}` }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.8) 100%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', filter: `drop-shadow(0 0 20px ${tint(colors.primary, 0.3)})` }}>
                    {NICHE_ICONS[tpl.niche] || <Clapperboard size={24} color={colors.primary} />}
                  </div>
                </div>
                {/* Safe Zone Guides */}
                <div style={{ position: 'absolute', top: '12%', left: '10%', right: '10%', bottom: '18%', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '8px', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontFamily: INTER }}>
                  {tpl.niche}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ fontSize: '10px', color: colors.primary, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{tpl.niche}</div>
                <div style={{ fontSize: '9px', color: statusColors.success, fontWeight: 700, background: statusColors.successDim, padding: '3px 8px', borderRadius: '6px' }}>ACTIVE</div>
              </div>
              <div style={{ color: colors.foreground, fontWeight: 800, fontSize: '13px', fontFamily: INTER, lineHeight: 1.3, marginBottom: '8px' }}>
                {tpl.name}
              </div>
              <div style={{ color: colors.mutedForeground, fontSize: '11px', fontWeight: 500, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
            style={{
              border: `2px dashed ${colors.border}`,
              borderRadius: '24px', padding: '56px 24px', textAlign: 'center', cursor: 'pointer',
              background: `linear-gradient(180deg, rgba(24,24,27,0.6) 0%, rgba(9,9,11,0.8) 100%)`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(12px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = colors.primary;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.background = `linear-gradient(180deg, ${tint(colors.primary, 0.08)} 0%, rgba(9,9,11,0.9) 100%)`;
              e.currentTarget.style.boxShadow = `0 20px 60px ${tint(colors.primary, 0.1)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.border;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = `linear-gradient(180deg, rgba(24,24,27,0.6) 0%, rgba(9,9,11,0.8) 100%)`;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ fontSize: '52px', marginBottom: '14px', filter: `drop-shadow(0 0 20px ${tint(colors.primary, 0.3)})`, transition: 'all 0.3s ease' }}>
              <Video size={52} color={colors.primary} />
            </div>
            <div style={{ color: colors.foreground, fontWeight: 800, fontSize: '14px', fontFamily: INTER, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {customFileName || 'TAP TO UPLOAD VIDEO'}
            </div>
            <div style={{ color: colors.mutedForeground, fontSize: '11px', fontWeight: 500 }}>
              MP4, MOV, WebM — max 500MB
            </div>
          </div>

          {/* AI Instructions */}
          <div>
            <div style={{ color: colors.mutedForeground, fontSize: '10px', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>AI Creative Direction</div>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="&ldquo;e.g. Zoom on the product soles, fast cuts, make it hype&rdquo;..."
              style={{
                width: '100%', background: 'rgba(9,9,11,0.6)', border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '16px',
                color: colors.foreground, minHeight: '110px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: INTER, resize: 'vertical', backdropFilter: 'blur(12px)',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${tint(colors.primary, 0.1)}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Niche Grid */}
          <div>
            <div style={{ color: colors.mutedForeground, fontSize: '10px', fontWeight: 800, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Content Niche</div>
            <div className="niche-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {['unboxing', 'sales', 'fitness', 'cooking', 'general', 'education', 'comedy', 'motivation', 'pets', 'tech'].map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedNiche(n as any)}
                  style={{
                    background: selectedNiche === n ? tint(colors.primary, 0.2) : 'rgba(9,9,11,0.4)',
                    border: selectedNiche === n ? `1px solid ${tint(colors.primary, 0.4)}` : `1px solid ${colors.border}`,
                    color: colors.foreground, padding: '10px 6px', borderRadius: '12px', fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', cursor: 'pointer', fontFamily: INTER, letterSpacing: '0.3px', transition: TRANSITION.smooth, backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedNiche !== n) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedNiche !== n) {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.background = 'rgba(9,9,11,0.4)';
                    }
                  }}
                >
                  <span>{NICHE_ICONS[n] || <Clapperboard size={10} color={colors.primary} />}</span>
                  <span>{NICHE_SHORT[n] || n.slice(0, 6)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          {uploadError && (
            <p style={{ color: statusColors.errorText, fontSize: '11px', fontWeight: 600, lineHeight: 1.5, fontFamily: INTER }}>
              {uploadError}
            </p>
          )}
          <button
            onClick={handleCustomSubmit}
            disabled={isProcessing}
            style={{
              background: isProcessing ? colors.card : `linear-gradient(135deg, ${colors.accent}, ${colors.secondary})`,
              color: colors.onAccent, border: 'none', borderRadius: '18px', padding: '20px', fontWeight: 900,
              textTransform: 'uppercase', cursor: isProcessing ? 'not-allowed' : 'pointer', fontSize: '15px',
              fontFamily: INTER, letterSpacing: '1px',
              boxShadow: isProcessing ? 'none' : `0 12px 40px ${tint(colors.accent, 0.35)}`,
              transition: TRANSITION.smooth, marginTop: '8px',
              opacity: isProcessing ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                <span>Engineering...</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>FORGE FINAL VIDEO</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
