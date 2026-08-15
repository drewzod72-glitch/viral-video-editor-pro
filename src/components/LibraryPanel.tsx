import React from 'react';
import { VideoProject } from '../types';
import { FolderHeart, Trash2, Calendar, ClipboardList, ChefHat, GraduationCap, Dumbbell, Cpu, Smile, FolderOpen } from 'lucide-react';
import { colors } from '../utils/styles';

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
      case 'cooking': return <ChefHat size={20} color={colors.primary} />;
      case 'education': return <GraduationCap size={20} color={colors.primary} />;
      case 'fitness': return <Dumbbell size={20} color={colors.primary} />;
      case 'tech': return <Cpu size={20} color={colors.primary} />;
      case 'comedy': return <Smile size={20} color={colors.primary} />;
      default: return <FolderOpen size={20} color={colors.primary} />;
    }
  };

  return (
    <div id="library-panel" style={{ background: '#09090b', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)', padding: '24px' }}>
      <h2 style={{ fontWeight: 900, fontSize: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: '"Inter", sans-serif', marginBottom: '4px' }}>
        <FolderHeart style={{ color: '#ec4899', width: '20px', height: '20px' }} />
        Project Drafting Vault & Archives
      </h2>
      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
        Stored securely in your browser's private vault cache.
      </p>

      {pastProjects.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(2,6,23,0.4)', borderRadius: '12px', border: '1px dashed #27272a' }}>
          <ClipboardList style={{ width: '32px', height: '32px', color: '#27272a', margin: '0 auto 8px' }} />
          <p style={{ fontSize: '12px', color: '#475569' }}>No drafted projects found. Generate your first video editing pipeline to archive it here!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          {pastProjects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const formattedDate = new Date(proj.createdAt).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            return (
              <div
                key={proj.id}
                onClick={() => onLoadProject(proj.id)}
                style={{
                  padding: '14px', borderRadius: '12px', border: isActive ? '1px solid rgba(236,72,153,0.4)' : '1px solid rgba(30,41,59,0.4)',
                  background: isActive ? 'rgba(236,72,153,0.05)' : 'rgba(2,6,23,0.3)',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '20px' }}>{formatNicheIcon(proj.niche)}</span>
                  <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar style={{ width: '10px', height: '10px' }} />
                    {formattedDate}
                  </span>
                </div>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'white', fontFamily: '"Inter", sans-serif' }}>
                  {fixDunikTypo(proj.name)}
                </h3>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <span style={{ fontSize: '9px', background: '#18181b', color: '#a1a1aa', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>
                    {proj.niche}
                  </span>
                  <span style={{ fontSize: '9px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                    Score: {proj.viralityScore}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #18181b' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>
                    {proj.subtitles.length} Captions
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${fixDunikTypo(proj.name)}"? This can't be undone.`)) {
                        onDeleteProject(proj.id);
                      }
                    }}
                    style={{ padding: '4px 8px', background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', borderRadius: '4px' }}
                    title="Delete project"
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
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
