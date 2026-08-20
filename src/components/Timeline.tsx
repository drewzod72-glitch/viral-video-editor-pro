import React from 'react';
import { VideoProject } from '../types';

export default function Timeline({ project, activeClipId, onClipSelect }: { project: VideoProject; activeClipId: string | null; onClipSelect: (id: string | null) => void }) {
  if (!project) return null;
  
  const duration = project.duration || 30;
  const highlights = project.highlights || [];
  const segments = project.segments || [];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {/* Time ruler */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', fontFamily: 'monospace', padding: '0 4px' }}>
        <span>0:00</span>
        <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
      </div>
      
      {/* Video track */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Video</div>
        <div style={{ display: 'flex', gap: '2px', height: '32px' }}>
          {highlights.map((h: any) => {
            const left = (h.start / duration) * 100;
            const width = ((h.end - h.start) / duration) * 100;
            return (
              <div
                key={h.id}
                onClick={() => onClipSelect(h.id === activeClipId ? null : h.id)}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  height: '32px',
                  background: h.id === activeClipId ? '#EC4899' : '#3b82f6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  opacity: 0.8,
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#fff',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >{h.title}</div>
            );
          })}
          <div style={{ position: 'relative', flex: 1, background: '#252525', borderRadius: '4px', border: '1px solid #333' }}>
            {highlights.map((h: any) => {
              const left = (h.start / duration) * 100;
              const width = ((h.end - h.start) / duration) * 100;
              return (
                <div
                  key={h.id}
                  onClick={() => onClipSelect(h.id === activeClipId ? null : h.id)}
                  style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${width}%`,
                    height: '100%',
                    background: h.id === activeClipId ? 'rgba(236,72,149,0.4)' : 'rgba(59,130,246,0.3)',
                    borderLeft: h.id === activeClipId ? '2px solid #EC4899' : '2px solid #3b82f6',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Subtitle track */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Subtitles</div>
        <div style={{ height: '24px', background: '#252525', borderRadius: '4px', border: '1px solid #333', position: 'relative' }}>
          {project.subtitles?.map((sub: any, idx: number) => {
            const left = (sub.start / duration) * 100;
            const width = ((sub.end - sub.start) / duration) * 100;
            return (
              <div
                key={sub.id || idx}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${Math.max(width, 1)}%`,
                  height: '100%',
                  background: 'rgba(16, 185, 129, 0.3)',
                  borderLeft: '1px solid #10b981',
                  borderRadius: '2px',
                  fontSize: '9px',
                  color: '#10b981',
                  padding: '2px 4px',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
                title={sub.text}
              ></div>
            );
          })}
        </div>
      </div>
      
      {/* Audio track */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Audio</div>
        <div style={{ height: '24px', background: '#252525', borderRadius: '4px', border: '1px solid #333', position: 'relative' }}>
          {project.selectedMusicTrackId && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
              background: 'linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))',
              borderRadius: '4px'
            }} />
          )}
        </div>
      </div>
    </div>
  );
}
