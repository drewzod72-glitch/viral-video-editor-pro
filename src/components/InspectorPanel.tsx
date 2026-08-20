import React, { useState } from 'react';
import { VideoProject, CaptionStyle } from '../types';
import { LUT_PRESETS, TRANSITION_PRESETS } from '../utils/ffmpegWasmRenderer';
import { Wand2, Type, Music, Palette, Zap, Shield, Image as ImageIcon } from 'lucide-react';

const CAPTION_STYLES: CaptionStyle[] = ['mrbeast', 'hormozi', 'minimalist', 'impact', 'comic'];

export default function InspectorPanel({ project, onUpdateProject }: { project: VideoProject; onUpdateProject: (up: any) => void }) {
  const [activeTab, setActiveTab] = useState<'edit' | 'text' | 'audio' | 'effects' | 'ai'>('edit');

  const tabs = [
    { key: 'edit' as const, label: 'Edit', icon: <Zap size={12} /> },
    { key: 'text' as const, label: 'Text', icon: <Type size={12} /> },
    { key: 'audio' as const, label: 'Audio', icon: <Music size={12} /> },
    { key: 'effects' as const, label: 'Effects', icon: <Palette size={12} /> },
    { key: 'ai' as const, label: 'AI', icon: <Wand2 size={12} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '2px', padding: '8px 8px 0',
        borderBottom: '1px solid #333'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: '6px 6px 0 0', border: 'none',
              background: activeTab === tab.key ? '#252525' : 'transparent',
              color: activeTab === tab.key ? '#fff' : '#a1a1aa',
              fontWeight: 600, fontSize: '11px', cursor: 'pointer',
              fontFamily: '"Inter", sans-serif', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeTab === 'edit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Segments</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button
                  onClick={() => {
                    const segs = (project.segments || []).map((s: any) => ({ ...s }));
                    const newStart = parseFloat(prompt('Segment start (seconds):') || '0');
                    const newEnd = parseFloat(prompt('Segment end (seconds):') || '5');
                    if (!Number.isNaN(newStart) && !Number.isNaN(newEnd) && newEnd > newStart) {
                      onUpdateProject({ segments: [...segs, { start: newStart, end: newEnd, speed: 1.0 }] });
                    }
                  }}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #333',
                    background: '#252525', color: '#fff', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: '"Inter", sans-serif'
                  }}
                >+ Add Segment</button>
                <button
                  onClick={() => onUpdateProject({ segments: [] })}
                  style={{
                    padding: '8px 12px', borderRadius: '8px', border: '1px solid #333',
                    background: '#252525', color: '#f87171', fontSize: '11px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: '"Inter", sans-serif'
                  }}
                >Clear</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                {(project.segments || []).map((seg: any, idx: number) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', borderRadius: '6px',
                    background: '#252525', border: '1px solid #333'
                  }}>
                    <span style={{ fontSize: '9px', color: '#EC4899', fontWeight: 700, minWidth: '20px' }}>#{idx + 1}</span>
                    <span style={{ fontSize: '10px', color: '#e4e4e7', fontFamily: 'monospace', flex: 1 }}>
                      {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                    </span>
                    <button
                      onClick={() => {
                        const next = (project.segments || []).filter((_: any, i: number) => i !== idx);
                        onUpdateProject({ segments: next });
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Caption Style</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {CAPTION_STYLES.map(style => (
                  <button
                    key={style}
                    onClick={() => onUpdateProject({ captionStyle: style })}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', border: '1px solid #333',
                      background: project.captionStyle === style ? '#EC4899' : '#252525',
                      color: project.captionStyle === style ? '#fff' : '#a1a1aa',
                      fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: '"Inter", sans-serif', textTransform: 'capitalize'
                    }}
                  >{style}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Music</div>
              <div style={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px' }}>
                Track: {project.selectedMusicTrackId || 'None'}
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={project.musicVolume ?? 0.4}
                onChange={(e) => onUpdateProject({ musicVolume: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#EC4899' }}
              />
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                Volume: {Math.round((project.musicVolume ?? 0.4) * 100)}%
              </div>
            </div>
          </div>
        )}

        {activeTab === 'effects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Color Grade</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {Object.entries(LUT_PRESETS).map(([key, lut]) => (
                  <button
                    key={key}
                    onClick={() => onUpdateProject({ colorGrade: key as any })}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', border: '1px solid #333',
                      background: project.colorGrade === key ? '#EC4899' : '#252525',
                      color: project.colorGrade === key ? '#fff' : '#a1a1aa',
                      fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: '"Inter", sans-serif'
                    }}
                  >{lut.name}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Transition</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {Object.entries(TRANSITION_PRESETS).map(([key, trans]) => (
                  <button
                    key={key}
                    onClick={() => onUpdateProject({ transitionStyle: key as any })}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', border: '1px solid #333',
                      background: project.transitionStyle === key ? '#EC4899' : '#252525',
                      color: project.transitionStyle === key ? '#fff' : '#a1a1aa',
                      fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                      fontFamily: '"Inter", sans-serif'
                    }}
                  >{trans.name}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Effects</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { key: 'enableSubtitles', label: 'Subtitles' },
                  { key: 'enableZooms', label: 'Zooms' },
                  { key: 'enableColorGrade', label: 'Color Grade' },
                  { key: 'shakeOnPunch', label: 'Shake' },
                ].map(eff => (
                  <label key={eff.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#e4e4e7', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!(project as any)[eff.key]}
                      onChange={(e) => onUpdateProject({ [eff.key]: e.target.checked })}
                      style={{ accentColor: '#EC4899' }}
                    />
                    {eff.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>AI Command</div>
              <div style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: 1.5, marginBottom: '8px' }}>
                Type commands in the Command Bar below the preview. Examples:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                <div>"change caption style to mrbeast"</div>
                <div>"add zoom at 5s 1.5x"</div>
                <div>"remove silence"</div>
                <div>"add broll at 2s"</div>
                <div>"voiceover: hello"</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
