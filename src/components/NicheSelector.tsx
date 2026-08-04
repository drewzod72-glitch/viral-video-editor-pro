import React, { useRef, useState } from 'react';
import { RAW_VIDEO_TEMPLATES } from '../data';
import { VideoNiche } from '../types';

export default function NicheSelector({ onSelectTemplate, onUploadCustomFile, isProcessing }: any) {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [selectedNiche, setSelectedNiche] = useState<VideoNiche>('unboxing');
  const [customDescription, setCustomDescription] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
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
      alert("Please upload a video file first.");
      return;
    }
    onUploadCustomFile(selectedFileObj, customFileName, selectedNiche, customDescription || 'Master review and viral hype edit.');
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(16px)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(30,41,59,0.4)', marginBottom: '24px', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('presets')}
          style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', background: activeTab === 'presets' ? 'rgba(139,92,246,0.2)' : 'transparent', color: activeTab === 'presets' ? '#e9d5ff' : '#71717a' }}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '12px', fontFamily: '"Inter", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px', background: activeTab === 'custom' ? 'rgba(139,92,246,0.2)' : 'transparent', color: activeTab === 'custom' ? '#e9d5ff' : '#71717a' }}
        >
          Custom
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {RAW_VIDEO_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelectTemplate(tpl)}
              style={{ background: '#09090b', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '16px', padding: '18px 20px', textAlign: 'left', cursor: 'pointer', width: '100%', transition: 'border-color 0.2s', backdropFilter: 'blur(12px)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(30,41,59,0.5)')}
            >
              <div style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{tpl.niche}</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '14px', fontFamily: '"Inter", sans-serif' }}>{tpl.name}</div>
              <div style={{ marginTop: '8px', color: '#10b981', fontSize: '11px', fontWeight: 700 }}>● ONLINE</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ border: '2px dashed #27272a', borderRadius: '20px', padding: '48px', textAlign: 'center', cursor: 'pointer', background: '#09090b', transition: 'border-color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#8b5cf6')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#27272a')}
          >
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📹</div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '13px', fontFamily: '"Inter", sans-serif' }}>{customFileName || 'TAP TO UPLOAD VIDEO'}</div>
          </div>

          <div>
            <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>AI Instructions</div>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g. 'Zoom on the product, make it fast'..."
              style={{ width: '100%', background: '#09090b', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '14px', padding: '14px', color: 'white', minHeight: '100px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: '"Inter", sans-serif', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {['unboxing', 'sales', 'fitness', 'general'].map((n) => (
              <button
                key={n}
                onClick={() => setSelectedNiche(n as any)}
                style={{ background: selectedNiche === n ? 'rgba(139,92,246,0.2)' : '#09090b', border: '1px solid rgba(30,41,59,0.5)', color: 'white', padding: '12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', fontFamily: '"Inter", sans-serif', letterSpacing: '0.5px' }}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            onClick={handleCustomSubmit}
            disabled={isProcessing}
            style={{ background: isProcessing ? '#18181b' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: isProcessing ? '#64748b' : 'white', border: 'none', borderRadius: '14px', padding: '18px', fontWeight: 900, textTransform: 'uppercase', cursor: isProcessing ? 'default' : 'pointer', fontSize: '15px', fontFamily: '"Inter", sans-serif', letterSpacing: '0.5px', boxShadow: isProcessing ? 'none' : '0 8px 30px rgba(139,92,246,0.3)' }}
          >
            {isProcessing ? 'Engineering...' : '🔥 Forge Final Video'}
          </button>
        </div>
      )}
    </div>
  );
}
