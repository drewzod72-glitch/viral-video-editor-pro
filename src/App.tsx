import React, { useState, Suspense, lazy } from 'react';
import { VideoProject } from './types';
import { Sparkles, Download, Video as VideoIcon, CheckCircle, KeyRound, MessageSquare, Flame } from 'lucide-react';
import NicheSelector from './components/NicheSelector';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';
import { AICopilotConsole } from './components/AICopilotConsole';

const VideoPlayerWorkspace = lazy(() => import('./components/VideoPlayerWorkspace'));
const ViralityScorecard = lazy(() => import('./components/ViralityScorecard'));

const fixDunikTypo = (str: string): string => {
  if (typeof str !== 'string' || !str) return str;
  return str.replace(/dunik/gi, (match) => {
    const map: Record<string, string> = { 'DUNIK': 'DUNK', 'dunik': 'dunk', 'Dunik': 'Dunk' };
    return map[match] || 'Dunk';
  });
};

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [activeTab, setActiveTab] = useState<'studio' | 'viral' | 'copilot'>('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  const handleSelectTemplate = async (template: any) => {
    setIsProcessing(true);
    setProcessingStage('AI is analyzing content...');
    try {
      const result = await runAnalyzeVideo({ ...template });
      const newProject = { 
        ...result.project, 
        id: `proj-${Date.now()}`, 
        videoUrl: template.videoUrl, 
        name: fixDunikTypo(template.name),
        niche: template.niche
      };
      setActiveProject(newProject);
      setActiveTab('studio');
    } catch (err: any) {
      alert('AI analysis failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadCustomFile = async (file: File, name: string, niche: any, description: string, rawTranscribe: string) => {
    const videoUrl = URL.createObjectURL(file);
    setIsProcessing(true);
    setProcessingStage('Preparing custom video for AI...');
    try {
      const result = await runAnalyzeVideo({
        name,
        niche,
        userDescription: description,
        defaultTranscribe: rawTranscribe,
        videoFile: file,
        videoUrl
      });
      const newProject = { 
        ...result.project, 
        id: `custom-${Date.now()}`, 
        videoUrl, 
        name: fixDunikTypo(name),
        niche: niche
      };
      setActiveProject(newProject);
      setActiveTab('studio');
    } catch (err: any) {
      alert('Custom upload failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerVideoExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Initializing Video Engine...");
    try {
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      const editedBlob = await renderVideoInBrowser(activeProject, (prg) => {
        setProcessingStage(`Baking video: ${prg}%`);
      });
      const url = URL.createObjectURL(editedBlob);
      setDownloadReadyInfo({ url, filename: `${activeProject.name}_edited.mp4` });
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-purple-600/20 rounded-[30px] flex items-center justify-center mb-8 animate-pulse">
           <Sparkles className="text-purple-500 w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-4 bg-gradient-to-tr from-purple-400 to-pink-500 bg-clip-text text-transparent">Viral AI Editor</h1>
        <p className="text-slate-400 text-sm max-w-[280px] mb-10 leading-relaxed">The Gold Mine Edition: Multimodal AI Video Forge.</p>
        <button 
          onClick={() => setHasStarted(true)}
          className="w-full max-w-[280px] py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-purple-500/20 transition-all active:scale-95"
        >
          Enter Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-black tracking-tighter text-lg uppercase flex items-center gap-2">
          <Sparkles className="text-purple-500 w-5 h-5" /> Viral AI
        </h1>
        <button onClick={() => setShowApiKeyModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
          <KeyRound className="w-3 h-3" /> API Key
        </button>
      </header>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-md font-bold uppercase tracking-widest">{processingStage}</h2>
          <button onClick={() => setIsProcessing(false)} className="mt-8 text-[10px] text-purple-400 font-black uppercase">Cancel</button>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {!activeProject ? (
          <NicheSelector 
            onSelectTemplate={handleSelectTemplate} 
            isProcessing={isProcessing} 
            onUploadCustomFile={handleUploadCustomFile} 
          />
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-900/80 p-4 rounded-3xl border border-slate-800 shadow-xl">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-600/20 rounded-xl"><VideoIcon className="text-purple-500 w-4 h-4" /></div>
                 <div>
                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Project</h2>
                    <p className="text-sm font-black truncate max-w-[150px]">{activeProject.name}</p>
                 </div>
               </div>
               <div className="flex flex-wrap gap-2">
                 <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'studio' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'viral' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                   <Flame className="w-3 h-3 inline mr-1" /> Specs
                 </button>
                 <button onClick={() => setActiveTab('copilot')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'copilot' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                   <MessageSquare className="w-3 h-3 inline mr-1" /> Copilot
                 </button>
                 <button onClick={triggerVideoExport} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                   <Download className="w-3.5 h-3.5" /> Bake Video
                 </button>
               </div>
            </div>
            
            {activeTab === 'studio' ? (
               <Suspense fallback={<div>Loading Workspace...</div>}>
                <VideoPlayerWorkspace 
                  project={activeProject} 
                  onUpdateProject={setActiveProject as any} 
                  activeMusicTrack={null} 
                  musicVolume={0.5} 
                  setMusicVolume={() => {}} 
                  enableSubtitles={true} 
                  setEnableSubtitles={() => {}} 
                  enableZooms={true} 
                  setEnableZooms={() => {}} 
                  enableColorGrade={true} 
                  setEnableColorGrade={() => {}} 
                  activeClipId={activeClipId} 
                  onClipSelect={setActiveClipId} 
                />
               </Suspense>
            ) : activeTab === 'viral' ? (
              <Suspense fallback={<div>Loading Scorecard...</div>}>
                <ViralityScorecard project={activeProject} onUpdateProject={setActiveProject as any} />
              </Suspense>
            ) : (
              <AICopilotConsole 
                project={activeProject} 
                onUpdateProject={setActiveProject as any}
                onUpdateSubtitles={(subs) => setActiveProject({ ...activeProject, subtitles: subs })}
              />
            )}
          </div>
        )}
      </main>
      
      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      
      {downloadReadyInfo && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-slate-800 max-w-sm w-full shadow-2xl animate-scale-in">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Video Ready!</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Your professional vertical short is fully baked and optimized for TikTok.</p>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-sm mb-4 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 text-center">SAVE TO PHOTOS</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Back to Studio</button>
          </div>
        </div>
      )}
    </div>
  );
}
