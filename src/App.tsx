import React, { useState, useEffect } from 'react';
import { VideoProject } from './types';
import { FREE_MUSIC_TRACKS } from './data';
import NicheSelector from './components/NicheSelector';
import { saveFileToDevice } from './utils/download';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import { Sparkles, Download, Video as VideoIcon, CheckCircle, KeyRound } from 'lucide-react';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';

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
  const [processingProgress, setProcessingProgress] = useState(0);
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
      if (!result || !result.project) throw new Error("AI data empty.");
      const p = result.project;
      const newProject: VideoProject = { 
        ...p, 
        id: `proj-${Date.now()}`, 
        videoUrl: template.videoUrl, 
        name: fixDunikTypo(template.name),
        niche: template.niche,
        selectedMusicTrackId: p.selectedMusicTrackId || 'lofi-1',
        captionStyle: p.captionStyle || 'hormozi',
        colorGrade: p.colorGrade || 'vibrant_pop',
        createdAt: new Date().toISOString(),
        enableSubtitles: true, enableZooms: true, enableColorGrade: true, musicVolume: 0.4,
        jumpCuts: true, speedRamp: true, sfxSparks: true, emojiBounces: true,
        autoZoomPunch: true, shakeOnPunch: true, camRecorderHUD: false
      };
      setActiveProject(newProject);
      setActiveTab('studio');
    } catch (err: any) { alert('AI analysis failed: ' + err.message); } finally { setIsProcessing(false); }
  };

  const handleUploadCustomFile = async (file: File, name: string, niche: any, description: string, rawTranscribe: string) => {
    const videoUrl = URL.createObjectURL(file);
    setIsProcessing(true);
    setProcessingStage('Preparing video for AI...');
    try {
      const result = await runAnalyzeVideo({ name, niche, userDescription: description, defaultTranscribe: rawTranscribe, videoFile: file, videoUrl });
      if (!result || !result.project) throw new Error("AI data empty.");
      const p = result.project;
      const newProject: VideoProject = { 
        ...p, 
        id: `custom-${Date.now()}`, 
        videoUrl, 
        name: fixDunikTypo(name),
        niche: niche,
        createdAt: new Date().toISOString(),
        enableSubtitles: true, enableZooms: true, enableColorGrade: true, musicVolume: 0.4,
        jumpCuts: true, speedRamp: true, sfxSparks: true, emojiBounces: true,
        autoZoomPunch: true, shakeOnPunch: true, camRecorderHUD: false
      };
      setActiveProject(newProject);
      setActiveTab('studio');
    } catch (err: any) { alert('Upload failed: ' + err.message); } finally { setIsProcessing(false); }
  };

  const triggerVideoExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    setProcessingStage("Initializing Native Forge...");
    try {
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      const editedBlob = await renderVideoInBrowser(activeProject, (prg) => {
        setProcessingProgress(prg);
        setProcessingStage(`Baking: ${prg}%`);
      }, activeClipId);
      if (!editedBlob) throw new Error('Bake failed.');
      setDownloadReadyInfo({ url: URL.createObjectURL(editedBlob), filename: `${activeProject.name.replace(/\s+/g, '_')}_edit.mp4` });
    } catch (err: any) { alert('Export failed: ' + (err.message || 'Error')); } finally { setIsProcessing(false); }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-[35px] flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(139,92,246,0.3)] animate-bounce">
             <Sparkles className="text-white w-12 h-12" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 leading-none">Viral <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">AI Editor</span></h1>
          <button onClick={() => setHasStarted(true)} className="group relative w-full max-w-[280px] py-5 bg-white text-black rounded-[24px] font-black text-sm uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95 overflow-hidden">
            <span className="relative z-10">Launch Studio</span>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-black tracking-tighter text-lg uppercase flex items-center gap-2"><Sparkles className="text-purple-500 w-5 h-5" /> Viral AI</h1>
        <button onClick={() => setShowApiKeyModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><KeyRound className="w-3 h-3" /> API Key</button>
      </header>
      {isProcessing && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-md font-bold uppercase tracking-widest">{processingStage}</h2>
          <button onClick={() => setIsProcessing(false)} className="mt-8 text-[10px] text-purple-400 font-black uppercase border border-purple-900/50 px-4 py-2 rounded-lg">Cancel</button>
        </div>
      )}
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {!activeProject ? (
          <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} onUploadCustomFile={handleUploadCustomFile} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-900/80 p-4 rounded-3xl border border-slate-800 shadow-xl">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-purple-600/20 rounded-xl"><VideoIcon className="text-purple-500 w-4 h-4" /></div>
                 <p className="text-sm font-black truncate max-w-[150px]">{activeProject.name}</p>
               </div>
               <div className="flex flex-wrap gap-2">
                 <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'studio' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'viral' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Specs</button>
                 <button onClick={() => setActiveTab('copilot')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'copilot' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}>Copilot</button>
                 <button onClick={triggerVideoExport} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Bake Video</button>
               </div>
            </div>
            {activeTab === 'studio' && <VideoPlayerWorkspace project={activeProject} onUpdateProject={(u) => setActiveProject({...activeProject, ...u})} activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || null} activeClipId={activeClipId} onClipSelect={setActiveClipId} />}
            {activeTab === 'viral' && <ViralityScorecard project={activeProject} onUpdateProject={(u) => setActiveProject({...activeProject, ...u})} />}
            {activeTab === 'copilot' && <AICopilotConsole project={activeProject} onUpdateProject={(u) => setActiveProject({...activeProject, ...u})} onUpdateSubtitles={(subs) => setActiveProject({...activeProject, subtitles: subs})} />}
          </div>
        )}
      </main>
      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      {downloadReadyInfo && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-slate-800 max-w-sm w-full shadow-2xl animate-scale-in">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Video Ready!</h3>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} onClick={() => setDownloadReadyInfo(null)} className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-sm mb-4 transition-all">SAVE TO PHOTOS</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Back to Studio</button>
          </div>
        </div>
      )}
    </div>
  );
}
