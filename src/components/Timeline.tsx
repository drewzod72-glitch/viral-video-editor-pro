import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { VideoProject } from '../types';

export interface TimelineProps {
  project: VideoProject;
  activeClipId: string | null;
  onClipSelect: (id: string | null) => void;
  onUpdateProject: (project: VideoProject) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

interface TimelineClip {
  id: string;
  trackType: string;
  start: number;
  end: number;
  label: string;
  color: string;
  data: any;
}

interface DragState {
  clipId: string;
  type: 'move' | 'resize';
  trackType: string;
  startX: number;
  originalStart: number;
  originalEnd: number;
}

const TRACKS = [
  { key: 'video', label: 'Video', color: '#3b82f6', height: 32 },
  { key: 'subtitle', label: 'Subtitles', color: '#10b981', height: 24 },
  { key: 'audio', label: 'Audio', color: '#f59e0b', height: 24 },
  { key: 'effect', label: 'Effects', color: '#8b5cf6', height: 24 },
] as const;

const BASE_PX_PER_SEC = 50;
const SNAP_SEC = 0.1;
const MIN_CLIP_DURATION = 0.1;

function snapToGrid(value: number, snap: boolean): number {
  if (!snap) return value;
  return Math.round(value / SNAP_SEC) * SNAP_SEC;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default function Timeline({
  project,
  activeClipId,
  onClipSelect,
  onUpdateProject,
  currentTime,
  onSeek,
  zoom,
  onZoomChange,
}: TimelineProps) {
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [undoStack, setUndoStack] = useState<VideoProject[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const undoStackRef = useRef<VideoProject[]>([]);
  const projectRef = useRef(project);

  useEffect(() => { projectRef.current = project; }, [project]);

  const duration = useMemo(() => Math.max(1, project.duration || 30), [project.duration]);
  const pxPerSec = useMemo(() => BASE_PX_PER_SEC * zoom, [zoom]);
  const timelineWidth = useMemo(() => duration * pxPerSec, [duration, pxPerSec]);

  const clips = useMemo<TimelineClip[]>(() => {
    const result: TimelineClip[] = [];

    (project.segments || project.highlights || []).forEach((h: any) => {
      result.push({
        id: h.id,
        trackType: 'video',
        start: h.start,
        end: h.end,
        label: h.title || 'Clip',
        color: '#3b82f6',
        data: h,
      });
    });

    (project.subtitles || []).forEach((sub: any) => {
      result.push({
        id: sub.id,
        trackType: 'subtitle',
        start: sub.start,
        end: sub.end,
        label: sub.text || 'Sub',
        color: '#10b981',
        data: sub,
      });
    });

    if (project.selectedMusicTrackId) {
      result.push({
        id: 'audio-music',
        trackType: 'audio',
        start: 0,
        end: duration,
        label: 'Music',
        color: '#f59e0b',
        data: { trackId: project.selectedMusicTrackId },
      });
    }

    (project.zoomEffects || []).forEach((z: any, i: number) => {
      result.push({
        id: `zoom-${i}`,
        trackType: 'effect',
        start: z.timestamp,
        end: z.timestamp + z.duration,
        label: `Zoom ${i + 1}`,
        color: '#8b5cf6',
        data: { ...z, effectType: 'zoom' },
      });
    });

    if (project.sfxWhooshEnabled && project.sfxWhooshUrl) {
      result.push({
        id: 'sfx-whoosh',
        trackType: 'effect',
        start: 0,
        end: Math.min(2, duration),
        label: 'Whoosh',
        color: '#8b5cf6',
        data: { effectType: 'sfx', sfxType: 'whoosh' },
      });
    }

    if (project.sfxPopEnabled && project.sfxPopUrl) {
      result.push({
        id: 'sfx-pop',
        trackType: 'effect',
        start: 0,
        end: Math.min(0.5, duration),
        label: 'Pop',
        color: '#8b5cf6',
        data: { effectType: 'sfx', sfxType: 'pop' },
      });
    }

    if (project.sfxImpactEnabled && project.sfxImpactUrl) {
      result.push({
        id: 'sfx-impact',
        trackType: 'effect',
        start: 0,
        end: Math.min(1, duration),
        label: 'Impact',
        color: '#8b5cf6',
        data: { effectType: 'sfx', sfxType: 'impact' },
      });
    }

    return result;
  }, [project, duration]);

  const saveUndo = useCallback(() => {
    const stack = [...undoStackRef.current, projectRef.current].slice(-20);
    undoStackRef.current = stack;
    setUndoStack(stack);
  }, []);

  const performUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    const stack = undoStackRef.current.slice(0, -1);
    undoStackRef.current = stack;
    setUndoStack(stack);
    onUpdateProject(prev);
  }, [onUpdateProject]);

  const updateClipInProject = useCallback(
    (clip: TimelineClip, newStart: number, newEnd: number) => {
      const updated = { ...projectRef.current };
      const track = clip.trackType;

      if (track === 'video') {
        const segs = (updated.segments || []).map((s: any) =>
          s.id === clip.id ? { ...s, start: newStart, end: newEnd } : s
        );
        const highs = (updated.highlights || []).map((h: any) =>
          h.id === clip.id ? { ...h, start: newStart, end: newEnd, duration: newEnd - newStart } : h
        );
        if (segs.length > 0) updated.segments = segs;
        if (highs.length > 0) updated.highlights = highs;
      } else if (track === 'subtitle') {
        updated.subtitles = (updated.subtitles || []).map((s: any) =>
          s.id === clip.id ? { ...s, start: newStart, end: newEnd } : s
        );
      } else if (track === 'effect') {
        if (clip.data?.effectType === 'zoom') {
          const idx = (updated.zoomEffects || []).findIndex(
            (z: any, i: number) => `zoom-${i}` === clip.id
          );
          if (idx >= 0 && updated.zoomEffects) {
            const newEffects = [...updated.zoomEffects];
            newEffects[idx] = { ...newEffects[idx], timestamp: newStart, duration: newEnd - newStart };
            updated.zoomEffects = newEffects;
          }
        }
      }

      onUpdateProject(updated);
    },
    [onUpdateProject]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, clip: TimelineClip, type: 'move' | 'resize') => {
      e.stopPropagation();
      e.preventDefault();

      saveUndo();
      setDragState({
        clipId: clip.id,
        type,
        trackType: clip.trackType,
        startX: e.clientX,
        originalStart: clip.start,
        originalEnd: clip.end,
      });
      dragStateRef.current = {
        clipId: clip.id,
        type,
        trackType: clip.trackType,
        startX: e.clientX,
        originalStart: clip.start,
        originalEnd: clip.end,
      };
      setIsDragging(true);
      onClipSelect(clip.id);
    },
    [saveUndo, onClipSelect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;

      const dx = e.clientX - ds.startX;
      const dt = dx / pxPerSec;
      const clip = clips.find((c) => c.id === ds.clipId);
      if (!clip) return;

      if (ds.type === 'move') {
        let newStart = snapToGrid(ds.originalStart + dt, snapEnabled);
        let newEnd = snapToGrid(ds.originalEnd + dt, snapEnabled);
        const clipDuration = ds.originalEnd - ds.originalStart;

        if (newStart < 0) {
          newStart = 0;
          newEnd = clipDuration;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - clipDuration;
        }

        updateClipInProject(clip, newStart, newEnd);
      } else if (ds.type === 'resize') {
        let newEnd = snapToGrid(ds.originalEnd + dt, snapEnabled);
        newEnd = clamp(newEnd, clip.start + MIN_CLIP_DURATION, duration);
        updateClipInProject(clip, clip.start, newEnd);
      }
    },
    [pxPerSec, clips, snapEnabled, duration, updateClipInProject]
  );

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
    setDragState(null);
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (!dragStateRef.current) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dt = dx / pxPerSec;
      const clip = clips.find((c) => c.id === dragStateRef.current!.clipId);
      if (!clip) return;

      if (dragStateRef.current.type === 'move') {
        let newStart = snapToGrid(dragStateRef.current.originalStart + dt, snapEnabled);
        let newEnd = snapToGrid(dragStateRef.current.originalEnd + dt, snapEnabled);
        const clipDuration = dragStateRef.current.originalEnd - dragStateRef.current.originalStart;

        if (newStart < 0) {
          newStart = 0;
          newEnd = clipDuration;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - clipDuration;
        }

        updateClipInProject(clip, newStart, newEnd);
      } else if (dragStateRef.current.type === 'resize') {
        let newEnd = snapToGrid(dragStateRef.current.originalEnd + dt, snapEnabled);
        newEnd = clamp(newEnd, clip.start + MIN_CLIP_DURATION, duration);
        updateClipInProject(clip, clip.start, newEnd);
      }
    };

    const handleGlobalUp = () => {
      dragStateRef.current = null;
      setDragState(null);
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handleGlobalMove);
    document.addEventListener('pointerup', handleGlobalUp);
    return () => {
      document.removeEventListener('pointermove', handleGlobalMove);
      document.removeEventListener('pointerup', handleGlobalUp);
    };
  }, [pxPerSec, clips, snapEnabled, duration, updateClipInProject]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeClipId && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          saveUndo();
          const updated = { ...projectRef.current };
          const track = dragStateRef.current?.trackType || 'video';

          if (track === 'video') {
            updated.segments = (updated.segments || []).filter((s: any) => s.id !== activeClipId);
            updated.highlights = (updated.highlights || []).filter((h: any) => h.id !== activeClipId);
          } else if (track === 'subtitle') {
            updated.subtitles = (updated.subtitles || []).filter((s: any) => s.id !== activeClipId);
          }
          onClipSelect(null);
          onUpdateProject(updated);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeClipId, saveUndo, performUndo, onClipSelect, onUpdateProject]);

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scrollLeft;
      const time = clamp(x / pxPerSec, 0, duration);
      onSeek(time);
    },
    [isDragging, pxPerSec, duration, onSeek]
  );

  const handleTrackAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      if ((e.target as HTMLElement).closest('[data-clip]')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current?.scrollLeft || 0;
      const x = e.clientX - rect.left + scrollLeft;
      const time = clamp(x / pxPerSec, 0, duration);
      onSeek(time);
    },
    [isDragging, pxPerSec, duration, onSeek]
  );

  const rulerTicks = useMemo(() => {
    const ticks: { time: number; major: boolean }[] = [];
    let interval: number;
    if (zoom < 2) interval = 5;
    else if (zoom < 5) interval = 2;
    else if (zoom < 8) interval = 1;
    else interval = 0.5;

    for (let t = 0; t <= duration; t += interval) {
      ticks.push({ time: t, major: true });
      if (zoom >= 3 && interval >= 1) {
        for (let sub = 1; sub < 4; sub++) {
          const subT = t + (interval / 4) * sub;
          if (subT <= duration) ticks.push({ time: subT, major: false });
        }
      }
    }
    return ticks;
  }, [duration, zoom]);

  const empty = clips.length === 0;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '200px',
        background: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header: Zoom controls + Ruler */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#111' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            borderBottom: '1px solid #333',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Timeline
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => onZoomChange(clamp(zoom - 1, 1, 10))}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '1px solid #333',
                  background: '#252525',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                -
              </button>
              <span style={{ fontSize: '10px', color: '#fff', fontWeight: 700, minWidth: '32px', textAlign: 'center' }}>
                {zoom.toFixed(1)}x
              </span>
              <button
                onClick={() => onZoomChange(clamp(zoom + 1, 1, 10))}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '1px solid #333',
                  background: '#252525',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid ${snapEnabled ? '#3b82f6' : '#333'}`,
                background: snapEnabled ? 'rgba(59,130,246,0.15)' : '#252525',
                color: snapEnabled ? '#3b82f6' : '#a1a1aa',
                fontSize: '9px',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Snap
            </button>
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Ruler */}
        <div
          ref={scrollContainerRef}
          onScroll={() => {
            if (containerRef.current) {
              const tracks = containerRef.current.querySelector('[data-tracks]') as HTMLDivElement;
              if (tracks) tracks.scrollLeft = scrollContainerRef.current!.scrollLeft;
            }
          }}
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            height: '20px',
            position: 'relative',
            cursor: 'pointer',
            scrollbarWidth: 'thin',
            scrollbarColor: '#333 transparent',
          }}
          onClick={handleRulerClick}
        >
          <div style={{ width: `${timelineWidth}px`, height: '100%', position: 'relative' }}>
            {rulerTicks.map((tick, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${tick.time * pxPerSec}px`,
                  top: 0,
                  bottom: tick.major ? 0 : '50%',
                  width: '1px',
                  background: tick.major ? '#444' : '#2a2a2a',
                }}
              />
            ))}
            {rulerTicks.filter((t) => t.major).map((tick, i) => (
              <div
                key={`label-${i}`}
                style={{
                  position: 'absolute',
                  left: `${tick.time * pxPerSec}px`,
                  top: '2px',
                  fontSize: '9px',
                  color: '#64748b',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  transform: 'translateX(2px)',
                }}
              >
                {formatTime(tick.time)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div
        data-tracks
        onScroll={(e) => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
          }
        }}
        style={{
          overflowX: 'auto',
          overflowY: 'auto',
          flex: 1,
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'default',
          scrollbarWidth: 'thin',
          scrollbarColor: '#333 transparent',
        }}
        onClick={handleTrackAreaClick}
      >
        <div style={{ width: `${timelineWidth}px`, height: '100%', position: 'relative' }}>
          {/* Playhead */}
          <div
            style={{
              position: 'absolute',
              left: `${currentTime * pxPerSec}px`,
              top: 0,
              bottom: 0,
              width: '2px',
              background: '#EC4899',
              zIndex: 20,
              pointerEvents: 'none',
              boxShadow: '0 0 8px rgba(236,72,149,0.5)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-2px',
                left: '-5px',
                width: '12px',
                height: '12px',
                background: '#EC4899',
                borderRadius: '2px',
                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              }}
            />
          </div>

          {/* Track backgrounds and clips */}
          {TRACKS.map((track) => {
            const trackClips = clips.filter((c) => c.trackType === track.key);
            return (
              <div
                key={track.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: `${track.height + 8}px`,
                  borderBottom: '1px solid #2a2a2a',
                  position: 'relative',
                }}
              >
                {/* Track label */}
                <div
                  style={{
                    position: 'sticky',
                    left: 0,
                    width: '60px',
                    minWidth: '60px',
                    fontSize: '9px',
                    color: '#64748b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    paddingLeft: '8px',
                    zIndex: 10,
                    background: '#1a1a1a',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    borderRight: '1px solid #2a2a2a',
                  }}
                >
                  {track.label}
                </div>

                {/* Clip area */}
                <div
                  style={{
                    flex: 1,
                    height: '100%',
                    position: 'relative',
                    background: '#252525',
                  }}
                >
                  {empty ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: '#4a4a4a',
                        fontStyle: 'italic',
                      }}
                    >
                      No clips
                    </div>
                  ) : (
                    trackClips.map((clip) => {
                      const isSelected = clip.id === activeClipId;
                      const left = clip.start * pxPerSec;
                      const width = Math.max(clip.end - clip.start, 0.5) * pxPerSec;

                      return (
                        <div
                          key={clip.id}
                          data-clip
                          onPointerDown={(e) => handlePointerDown(e, clip, 'move')}
                          style={{
                            position: 'absolute',
                            left: `${left}px`,
                            width: `${width}px`,
                            height: `${track.height - 4}px`,
                            top: '2px',
                            background: isSelected
                              ? `${clip.color}dd`
                              : `${clip.color}99`,
                            border: isSelected ? '2px solid #EC4899' : `1px solid ${clip.color}`,
                            borderRadius: '3px',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#fff',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            touchAction: 'none',
                            transition: isDragging ? 'none' : 'border-color 0.15s, background 0.15s',
                          }}
                        >
                          {width > 30 && <span style={{ pointerEvents: 'none' }}>{clip.label}</span>}
                          {/* Resize handle */}
                          <div
                            onPointerDown={(e) => handlePointerDown(e, clip, 'resize')}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '8px',
                              cursor: 'ew-resize',
                              touchAction: 'none',
                              background: isSelected ? 'rgba(255,255,255,0.2)' : 'transparent',
                              borderRadius: '0 3px 3px 0',
                            }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
