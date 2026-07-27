import React, { useState } from 'react';
import { VideoProject, SubtitleItem } from '../types';
import { runDetectCuts } from '../utils/geminiClient';
import { Type, Check, Plus, Edit2, Clock, Trash2, RotateCcw, Scissors, Sparkles, Info } from 'lucide-react';

// Helper to fix the "DUNIK" -> "DUNK" typo in subtitles, titles, names, descriptions
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

  // Auto-reset cuts when project context changes
  React.useEffect(() => {
    if (analyzedForProjectId !== project.id) {
      setDetectedCuts([]);
    }
  }, [project.id, analyzedForProjectId]);

  const [cutDetectionError, setCutDetectionError] = useState<string | null>(null);
  // CSS :hover never fires on touch devices, so the timeline-node tooltip
  // below also needs a tap-driven way to show — this tracks which one (if
  // any) was last tapped. Desktop hover keeps working via group-hover
  // classes; this just adds the missing tap affordance for mobile/tablet.
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
        setCutDetectionError('No Gemini API key set — add one in Settings to use this.');
        onRequestApiKey?.();
      } else {
        setCutDetectionError(err?.message || 'Cut detection failed — please try again.');
      }
    } finally {
      setIsAnalyzingCuts(false);
    }
  };

  // Start editing a subtitle row
  const startEdit = (sub: SubtitleItem) => {
    setEditingSubId(sub.id);
    setEditText(fixDunikTypo(sub.text));
    setEditStart(sub.start);
    setEditEnd(sub.end);
    setEditEmoji(sub.emoji || '');
  };

  // Save edits back to project
  const saveEdit = (subId: string) => {
    const correctedEditText = fixDunikTypo(editText);
    const updated = project.subtitles.map((sub) => {
      if (sub.id === subId) {
        // Derive highlight words
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Type className="text-brand-purple w-5 h-5" />
            2. Fully Editable Transcription Backlog
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            We automatically parsed the raw speech. Edit any timing or text overlays directly below.
          </p>
        </div>

        <button
          type="button"
          onClick={addSub}
          className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-3.5 h-3.5 text-brand-green" />
          Add Script Line
        </button>
      </div>

      {/* AI Smart Cut Detection Panel */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center shrink-0 mt-0.5">
              <Scissors className="text-brand-purple w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                AI-Powered Smart Cut Detection
                <span className="text-[10px] font-medium bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 px-1.5 py-0.5 rounded">NEW</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Detect visual transitions, slide swaps, and dramatic pacing changes automatically using the narrative script arc.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isAnalyzingCuts}
            onClick={triggerCutDetection}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all duration-250 shrink-0 ${
              isAnalyzingCuts 
                ? 'bg-slate-800 text-slate-500 border border-slate-700' 
                : 'bg-brand-purple hover:bg-brand-purple/90 text-white shadow-lg shadow-brand-purple/15 hover:shadow-brand-purple/25'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isAnalyzingCuts ? 'Analyzing Timeline...' : detectedCuts.length > 0 ? 'Analyze Cuts Again' : 'Scan Visual Beats'}
          </button>
        </div>

        {/* Loading state with a beautiful animated slider */}
        {isAnalyzingCuts && (
          <div className="mt-5 space-y-3">
            <div className="relative h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
              <div className="absolute h-full w-[45%] bg-gradient-to-r from-brand-purple to-brand-pink rounded-full animate-pulse" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>STAGES: [1/3] Mapping sound frequencies & subtitle pauses...</span>
              <span className="animate-pulse text-brand-purple">PROCESSING VIA GEMINI AI</span>
            </div>
          </div>
        )}

        {/* Calculated scene changes results */}
        {!isAnalyzingCuts && detectedCuts.length > 0 && (
          <div className="mt-5 space-y-4">
            {/* Horizontal interactive timeline slider line */}
            <div className="relative py-2">
              {/* Backline track */}
              <div className="h-1 bg-slate-800 rounded-full w-full relative">
                {/* Horizontal Nodes mapping */}
                {detectedCuts.map((cut, cidx) => {
                  const percentage = Math.min(100, Math.max(0, (cut.timestamp / (project.duration || 30)) * 100));
                  return (
                    <button
                      key={cut.id}
                      type="button"
                      onClick={() => {
                        onSeekTo && onSeekTo(cut.timestamp);
                        setTappedCutId(cut.id);
                        setTimeout(() => setTappedCutId((current) => (current === cut.id ? null : current)), 2500);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-10 cursor-pointer focus:outline-none"
                      style={{ left: `${percentage}%` }}
                      title={`Tap to jump to ${cut.label} (${cut.timestamp}s)`}
                    >
                      {/* Outer circle element */}
                      <div className="w-4 h-4 rounded-full bg-slate-950 border-2 border-brand-purple group-hover:border-brand-pink flex items-center justify-center transition-all duration-150 transform group-hover:scale-125 shadow shadow-purple-950">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-purple group-hover:bg-brand-pink" />
                      </div>

                      {/* Tiny floating trigger hover information bubble — shown on desktop hover
                          OR when tapped on a touch device (tappedCutId), since CSS :hover never
                          fires on touch at all. */}
                      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 border border-slate-750 p-2.5 rounded-lg shadow-xl text-left pointer-events-none origin-bottom transform transition-all duration-150 z-50 ${tappedCutId === cut.id ? 'block scale-100' : 'hidden group-hover:block scale-90 group-hover:scale-100'}`}>
                        <div className="flex items-center gap-1.5 justify-between">
                          <span className="text-[10px] font-bold text-white leading-none shrink-0 truncate max-w-[100px]">{cut.label}</span>
                          <span className="text-[8px] font-mono text-brand-purple bg-brand-purple/10 px-1 py-0.2 rounded shrink-0">{cut.timestamp}s</span>
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1 font-sans leading-tight">
                          {cut.description}
                        </p>
                        <div className="text-[8px] text-slate-500 font-mono mt-1 w-full text-right uppercase">
                          Type: {cut.type}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* Scale labels */}
              <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-2 px-1">
                <span>0.0s</span>
                <span>{(project.duration / 2).toFixed(1)}s</span>
                <span>{project.duration.toFixed(1)}s</span>
              </div>
            </div>

            {/* Visual Beats click list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
              {detectedCuts.map((cut) => {
                // Colors matching transition types
                let typeColor = 'bg-slate-900/80 border-slate-800 text-slate-400';
                if (cut.type === 'zoom') typeColor = 'bg-pink-950/20 border-pink-900/30 text-pink-400';
                else if (cut.type === 'fade') typeColor = 'bg-cyan-950/20 border-cyan-900/30 text-cyan-400';
                else if (cut.type === 'flash') typeColor = 'bg-amber-950/20 border-amber-900/30 text-amber-400';
                else if (cut.type === 'sound-beat') typeColor = 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400';

                return (
                  <button
                    key={cut.id}
                    type="button"
                    onClick={() => onSeekTo && onSeekTo(cut.timestamp)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-900/50 hover:border-slate-700 text-left transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-100 truncate group-hover:text-brand-purple transition-colors">
                          {cut.label}
                        </span>
                        <span className={`text-[8px] font-mono uppercase px-1 rounded border ${typeColor}`}>
                          {cut.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5 font-sans">
                        {cut.description}
                      </span>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <span className="text-xs font-mono font-bold text-brand-purple bg-brand-purple/10 px-2 py-1 rounded">
                        {cut.timestamp.toFixed(1)}s
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Scanning CTA banner if empty, or the error if the last attempt failed */}
        {!isAnalyzingCuts && detectedCuts.length === 0 && (
          <div className={`mt-4 p-3 rounded-lg border border-dashed text-center ${cutDetectionError ? 'bg-brand-pink/5 border-brand-pink/30' : 'bg-slate-950/30 border-slate-800'}`}>
            <p className={`text-[11px] font-medium ${cutDetectionError ? 'text-brand-pink' : 'text-slate-500'}`}>
              {cutDetectionError ? `⚠️ ${cutDetectionError}` : '💡 Click "Scan Visual Beats" to map transitions and jumps automatically.'}
            </p>
          </div>
        )}
      </div>

      {sortedSubtitles.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800 border-dashed">
          <p className="text-sm text-slate-500">No script timelines detected.</p>
          <button
            onClick={addSub}
            className="mt-3 px-3.5 py-1.5 text-xs bg-brand-purple text-white rounded-lg font-semibold hover:bg-brand-purple/85"
          >
            Create Initial Line
          </button>
        </div>
      ) : (
        /* Subtitles timelines list */
        <div className="max-h-[360px] overflow-y-auto pr-2 space-y-2">
          {sortedSubtitles.map((sub, idx) => {
            const isEditing = editingSubId === sub.id;

            return (
              <div
                key={sub.id}
                className={`p-3 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isEditing
                    ? 'border-brand-purple/70 bg-brand-purple/5 shadow-inner'
                    : 'border-slate-850 bg-slate-950/30 hover:bg-slate-950/70'
                }`}
              >
                {/* Visual order bubble and text information details */}
                <div className="flex-1 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-mono text-[10px] text-slate-400 mt-1 shrink-0">
                    {idx + 1}
                  </div>

                  {isEditing ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-500 font-mono mb-1 uppercase">Spoken Text</label>
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full text-xs rounded-lg bg-slate-905 border border-slate-700 text-white px-2.5 py-1.5 focus:outline-none focus:border-brand-purple"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-mono mb-1 uppercase">Emoji</label>
                        <input
                          type="text"
                          value={editEmoji}
                          onChange={(e) => setEditEmoji(e.target.value)}
                          placeholder="e.g. 🔥"
                          className="w-full text-xs rounded-lg text-center bg-slate-905 border border-slate-700 text-white px-2 py-1.5 focus:outline-none focus:border-brand-purple"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1">
                      <div className="text-xs text-slate-200 flex items-center gap-2">
                        <span className="font-semibold text-slate-50">{fixDunikTypo(sub.text)}</span>
                        {sub.emoji && (
                          <span className="text-base bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800">
                            {sub.emoji}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-600" />
                          {sub.start.toFixed(1)}s - {sub.end.toFixed(1)}s
                        </span>
                        {sub.highlightWords && sub.highlightWords.length > 0 && (
                          <div className="flex gap-1">
                            {sub.highlightWords.map((hw, hIdx) => (
                              <span
                                key={hIdx}
                                className="text-[9px] font-mono px-1.5 capitalize rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20"
                              >
                                {fixDunikTypo(hw)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Subtitle editing control actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {isEditing ? (
                    <React.Fragment>
                      {/* Editing time offset inputs */}
                      <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-[9px] text-slate-500 font-mono uppercase">Start</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          value={editStart}
                          onChange={(e) => setEditStart(Number(e.target.value))}
                          className="w-10 text-[10px] font-mono text-center bg-transparent text-brand-purple focus:outline-none"
                        />
                        <span className="text-slate-700 font-mono text-xs">|</span>
                        <span className="text-[9px] text-slate-500 font-mono uppercase">End</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          value={editEnd}
                          onChange={(e) => setEditEnd(Number(e.target.value))}
                          className="w-10 text-[10px] font-mono text-center bg-transparent text-brand-purple focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => saveEdit(sub.id)}
                        className="p-1.5 rounded-lg bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors"
                        title="Save changes"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <button
                        type="button"
                        onClick={() => startEdit(sub)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit timestamp or text"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSub(sub.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-brand-pink hover:bg-slate-800 transition-colors"
                        title="Delete caption segment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </React.Fragment>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
