import React, { useState } from 'react';
import { VideoProject, SubtitleItem } from '../types';
import { runDetectCuts } from '../utils/groqClient';
import { Type, Check, Plus, Edit2, Clock, Trash2, RotateCcw, Scissors, Sparkles, Info, Lightbulb, FileText } from 'lucide-react';

const fixDunikTypo = (str: string): string => {
  if (!str) return str;
  return str.replace(/dunik/gi, (match) => {
    if (match === match.toUpperCase()) return 'DUNK';
    if (match === match.toLowerCase()) return 'dunk';
    if (match[0] === match[0].toUpperCase()) return 'Dunk';
    return 'Dunk';
  });
};

interface EditCaptionTimelineProps {
  project: VideoProject;
  onUpdateSubtitles: (subs: SubtitleItem[]) => void;
  onSeekTo?: (time: number) => void;
  onRequestApiKey?: () => void;
}

export default function EditCaptionTimeline({
  project,
  onUpdateSubtitles,
  onSeekTo,
  onRequestApiKey,
}: EditCaptionTimelineProps) {
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editStart, setEditStart] = useState<number>(0);
  const [editEnd, setEditEnd] = useState<number>(0);
  const [editEmoji, setEditEmoji] = useState('');

  const [detectedCuts, setDetectedCuts] = useState<any[]>([]);
  const [isAnalyzingCuts, setIsAnalyzingCuts] = useState(false);
  const [analyzedForProjectId, setAnalyzedForProjectId] = useState<string | null>(null);

  React.useEffect(() => {
    if (analyzedForProjectId !== project.id) {
      setDetectedCuts([]);
    }
  }, [project.id, analyzedForProjectId]);

  const [cutDetectionError, setCutDetectionError] = useState<string | null>(null);
  const [tappedCutId, setTappedCutId] = useState<string | null>(null);

  const triggerCutDetection = async () => {
    setIsAnalyzingCuts(true);
    setCutDetectionError(null);
    try {
      const data = await runDetectCuts({
        subtitles: project.subtitles,
        duration: project.duration,
        niche: project.niche,
        title: project.title,
        description: project.description
      });
      if (data.success && data.cuts) {
        setDetectedCuts(data.cuts);
        setAnalyzedForProjectId(project.id);
      }
    } catch (err: any) {
      console.error("[Smart Cut Detection] API error:", err);
      if (err?.name === 'MissingApiKeyError') {
        setCutDetectionError('No API key set — add one in Settings to use this.');
        onRequestApiKey?.();
      } else {
        setCutDetectionError(err?.message || 'Cut detection failed — please try again.');
      }
    } finally {
      setIsAnalyzingCuts(false);
    }
  };

  const startEdit = (sub: SubtitleItem) => {
    setEditingSubId(sub.id);
    setEditText(fixDunikTypo(sub.text));
    setEditStart(sub.start);
    setEditEnd(sub.end);
    setEditEmoji(sub.emoji || '');
  };

  const saveEdit = (subId: string) => {
    const correctedEditText = fixDunikTypo(editText);
    const updated = project.subtitles.map((sub) => {
      if (sub.id === subId) {
        const words = correctedEditText.split(/\s+/);
        const randHighlight = words.length > 0 ? [words[Math.floor(Math.random() * words.length)].replace(/[^\w]/g, '')] : [];
        return {
          ...sub,
          text: correctedEditText,
          start: Number(editStart),
          end: Number(editEnd),
          emoji: editEmoji ? editEmoji.trim() : undefined,
          highlightWords: sub.highlightWords?.length
            ? sub.highlightWords.map(w => fixDunikTypo(w))
            : randHighlight,
        };
      }
      return sub;
    });

    onUpdateSubtitles(updated);
    setEditingSubId(null);
  };

  const deleteSub = (subId: string) => {
    const filtered = project.subtitles.filter((sub) => sub.id !== subId);
    onUpdateSubtitles(filtered);
  };

  const addSub = () => {
    const newId = `sub-${Date.now()}`;
    const maxEnd = project.subtitles.reduce((max, s) => (s.end > max ? s.end : max), 0);
    const newSub: SubtitleItem = {
      id: newId,
      text: 'New captioned word',
      start: maxEnd,
      end: Math.min(maxEnd + 2, project.duration || 30),
      emoji: '🔥',
      highlightWords: ['word'],
    };

    onUpdateSubtitles([...project.subtitles, newSub]);
    startEdit(newSub);
  };

  const sortedSubtitles = [...project.subtitles].sort((a, b) => a.start - b.start);

  return (
    <div style={{ background: '#09090b', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: '"Inter", sans-serif' }}>
            <span style={{ color: '#EC4899' }}><FileText size={18} /></span> 2. Editable Transcription Backlog
          </h2>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Edit any timing or text overlays directly below.
          </p>
        </div>

        <button
          type="button"
          onClick={addSub}
          style={{ padding: '10px 16px', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '10px', color: '#e2e8f0', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: '"Inter", sans-serif', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span style={{ color: '#10b981' }}>+</span> Add Script Line
        </button>
      </div>

      {/* AI Smart Cut Detection Panel */}
      <div style={{ background: 'rgba(2,6,23,0.7)', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(30,41,59,0.4)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'rgba(236,72,149,0.05)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(236,72,149,0.1)', border: '1px solid rgba(236,72,149,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scissors style={{ color: '#EC4899', width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '13px', color: 'white', fontFamily: '"Inter", sans-serif' }}>
                AI-Powered Smart Cut Detection
                <span style={{ fontSize: '9px', fontWeight: 600, background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)', padding: '2px 6px', borderRadius: '6px', marginLeft: '8px' }}>NEW</span>
              </h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Detect visual transitions and pacing changes automatically.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isAnalyzingCuts}
            onClick={triggerCutDetection}
            style={{
              padding: '10px 16px', borderRadius: '10px', border: 'none',
              background: isAnalyzingCuts ? '#18181b' : 'linear-gradient(135deg, #EC4899, #DB2777)',
              color: 'white', fontWeight: 700, fontSize: '11px', cursor: isAnalyzingCuts ? 'default' : 'pointer',
              fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start'
            }}
          >
            <Sparkles style={{ width: '14px', height: '14px' }} />
            {isAnalyzingCuts ? 'Analyzing...' : detectedCuts.length > 0 ? 'Re-Scan' : 'Scan Visual Beats'}
          </button>
        </div>

        {isAnalyzingCuts && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ height: '4px', background: '#18181b', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '45%', background: 'linear-gradient(90deg, #EC4899, #ec4899)', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div style={{ marginTop: '8px', fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>
              STAGES: [1/3] Mapping sound frequencies...
            </div>
          </div>
        )}

        {!isAnalyzingCuts && detectedCuts.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Detected Cuts</div>
            {detectedCuts.map((cut) => (
              <button
                key={cut.id}
                onClick={() => onSeekTo?.(cut.timestamp)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: '#020617', border: '1px solid rgba(30,41,59,0.4)',
                  borderRadius: '8px', marginBottom: '6px', width: '100%', cursor: 'pointer',
                  fontFamily: '"Inter", sans-serif', color: 'white', fontSize: '11px'
                }}
              >
                <span style={{ fontWeight: 600 }}>{cut.label}</span>
                <span style={{ fontFamily: 'monospace', color: '#EC4899', fontSize: '10px' }}>{cut.timestamp.toFixed(1)}s</span>
              </button>
            ))}
          </div>
        )}

        {!isAnalyzingCuts && detectedCuts.length === 0 && (
          <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', border: '1px dashed #27272a', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Lightbulb size={14} color="#f59e0b" /> Click "Scan Visual Beats" to map transitions automatically.
            </p>
          </div>
        )}
      </div>

      {sortedSubtitles.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(2,6,23,0.4)', borderRadius: '12px', border: '1px dashed #27272a' }}>
          <p style={{ fontSize: '12px', color: '#475569' }}>No script timelines detected.</p>
          <button onClick={addSub} style={{ marginTop: '12px', padding: '8px 16px', background: '#EC4899', color: 'white', borderRadius: '8px', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer', fontFamily: '"Inter", sans-serif' }}>
            Create Initial Line
          </button>
        </div>
      ) : (
        <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
          {sortedSubtitles.map((sub, idx) => {
            const isEditing = editingSubId === sub.id;

            return (
              <div
                key={sub.id}
                style={{
                  padding: '12px', borderRadius: '12px', border: '1px solid rgba(30,41,59,0.4)',
                  background: isEditing ? 'rgba(236,72,149,0.05)' : 'rgba(2,6,23,0.3)',
                  marginBottom: '8px', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b', fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>
                    {idx + 1}
                  </div>

                  <div style={{ flex: 1 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{ background: '#020617', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 10px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: '"Inter", sans-serif' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>Start</span>
                          <input type="number" step={0.1} min={0} value={editStart} onChange={(e) => setEditStart(Number(e.target.value))} style={{ width: '60px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', background: 'transparent', color: '#EC4899', border: 'none', outline: 'none' }} />
                          <span style={{ color: '#27272a', fontSize: '11px' }}>|</span>
                          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>End</span>
                          <input type="number" step={0.1} min={0} value={editEnd} onChange={(e) => setEditEnd(Number(e.target.value))} style={{ width: '60px', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', background: 'transparent', color: '#EC4899', border: 'none', outline: 'none' }} />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '12px', color: '#e2e8f0', fontFamily: '"Inter", sans-serif', fontWeight: 500 }}>
                          <span style={{ fontWeight: 700 }}>{fixDunikTypo(sub.text)}</span>
                          {sub.emoji && (
                            <span style={{ fontSize: '16px', marginLeft: '6px' }}>{sub.emoji}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '10px', color: '#475569' }}>
                          <span style={{ fontFamily: 'monospace' }}>{sub.start.toFixed(1)}s - {sub.end.toFixed(1)}s</span>
                          {sub.highlightWords && sub.highlightWords.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {sub.highlightWords.map((hw, hIdx) => (
                                <span key={hIdx} style={{ fontSize: '9px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                                  {fixDunikTypo(hw)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {isEditing ? (
                      <button onClick={() => saveEdit(sub.id)} style={{ padding: '6px 10px', background: '#EC4899', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>
                        <Check style={{ width: '14px', height: '14px' }} />
                      </button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(sub)} style={{ padding: '6px 10px', background: 'transparent', color: '#64748b', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                          <Edit2 style={{ width: '14px', height: '14px' }} />
                        </button>
                        <button onClick={() => deleteSub(sub.id)} style={{ padding: '6px 10px', background: 'transparent', color: '#64748b', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
