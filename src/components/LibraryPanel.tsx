import React from 'react';
import { VideoProject } from '../types';
import { FolderHeart, Trash2, Calendar, ClipboardList } from 'lucide-react';

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

interface LibraryPanelProps {
  pastProjects: VideoProject[];
  activeProjectId: string | null;
  onLoadProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export default function LibraryPanel({
  pastProjects,
  activeProjectId,
  onLoadProject,
  onDeleteProject,
}: LibraryPanelProps) {
  const formatNicheIcon = (niche: string) => {
    switch (niche) {
      case 'cooking': return '🍳';
      case 'education': return '🧠';
      case 'fitness': return '💪';
      case 'tech': return '🖥️';
      case 'comedy': return '🎭';
      default: return '💎';
    }
  };

  return (
    <div id="library-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
      <h2 className="font-display text-xl font-bold text-white flex items-center gap-2 mb-2">
        <FolderHeart className="text-brand-pink w-5 h-5" />
        Project Drafting Vault & Archives
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Stored securely in your browser's private vault cache. Access your creative projects anytime with zero delay.
      </p>

      {pastProjects.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-850 border-dashed">
          <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">No drafted projects found. Generate your first video editing pipeline to archive it here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pastProjects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const formattedDate = new Date(proj.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={proj.id}
                onClick={() => onLoadProject(proj.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                  isActive
                    ? 'border-brand-pink bg-brand-pink/5 hover:bg-brand-pink/10 shadow-lg'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg">{formatNicheIcon(proj.niche)}</span>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formattedDate}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white truncate max-w-full">
                    {fixDunikTypo(proj.name)}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded capitalize">
                      {proj.niche}
                    </span>
                    <span className="text-[10px] text-brand-green bg-brand-green/10 px-1.5 py-0.5 rounded font-mono font-bold">
                      Score: {proj.viralityScore}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-900">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {proj.subtitles.length} Captions Aligned
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${fixDunikTypo(proj.name)}"? This can't be undone.`)) {
                        onDeleteProject(proj.id);
                      }
                    }}
                    className="p-2 rounded-md text-slate-600 hover:text-brand-pink hover:bg-slate-900/60 transition-all duration-150"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
