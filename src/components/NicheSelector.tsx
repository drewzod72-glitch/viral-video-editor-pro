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
    <div style={{ background: '#0f172a', padding: '30px', borderRadius: '32px', border: '1px solid #1e293b', width: '100%', maxWidth: '600px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', background: '#020617', padding: '5px', borderRadius: '16px' }}>
        <button 
          onClick={() => setActiveTab('presets')} 
          style={{ flex: 1, padding: '15px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', background: activeTab === 'presets' ? '#1e293b' : 'transparent', color: activeTab === 'presets' ? 'white' : '#64748b' }}
        >
          Presets
        </button>
        <button 
          onClick={() => setActiveTab('custom')} 
          style={{ flex: 1, padding: '15px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '900', fontSize: '12px', textTransform: 'uppercase', background: activeTab === 'custom' ? '#1e293b' : 'transparent', color: activeTab === 'custom' ? 'white' : '#64748b' }}
        >
          Custom
        </button>
      </div>

      {activeTab === 'presets' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {RAW_VIDEO_TEMPLATES.map((tpl) => (
            <button 
              key={tpl.id} 
              onClick={() => onSelectTemplate(tpl)} 
              style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: '24px', padding: '20px', textAlign: 'left', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>{tpl.niche}</div>
              <div style={{ color: 'white', fontWeight: '900', fontSize: '14px' }}>{tpl.name}</div>
              <div style={{ marginTop: '10px', color: '#10b981', fontSize: '11px', fontWeight: '900' }}>● ONLINE</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div 
            onClick={() => fileInputRef.current?.click()} 
            style={{ border: '2px dashed #1e293b', borderRadius: '24px', padding: '40px', textAlign: 'center', cursor: 'pointer', background: '#020617' }}
          >
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>📹</div>
            <div style={{ color: 'white', fontWeight: '900', fontSize: '12px' }}>{customFileName || 'TAP TO UPLOAD VIDEO'}</div>
          </div>
          
          <div>
            <div style={{ color: '#64748b', fontSize: '10px', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase' }}>AI Instructions</div>
            <textarea 
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g. 'Zoom on the product, make it fast'..."
              style={{ width: '100%', background: '#020617', border: '1px solid #1e293b', borderRadius: '16px', padding: '15px', color: 'white', minHeight: '120px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {['unboxing', 'sales', 'fitness', 'general'].map((n) => (
              <button 
                key={n} 
                onClick={() => setSelectedNiche(n as any)}
                style={{ background: selectedNiche === n ? '#8b5cf6' : '#020617', border: '1px solid #1e293b', color: 'white', padding: '12px', borderRadius: '14px', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {n}
              </button>
            ))}
          </div>

          <button 
            onClick={handleCustomSubmit}
            disabled={isProcessing}
            style={{ background: isProcessing ? '#1e293b' : 'white', color: isProcessing ? '#64748b' : 'black', border: 'none', borderRadius: '16px', padding: '20px', fontWeight: '900', textTransform: 'uppercase', cursor: isProcessing ? 'default' : 'pointer', fontSize: '16px', marginTop: '10px', width: '100%' }}
          >
            {isProcessing ? 'Engineering...' : 'Forge Final Video'}
          </button>
        </div>
      )}
    </div>
  );
}
