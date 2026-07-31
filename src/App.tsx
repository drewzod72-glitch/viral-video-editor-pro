import React, { useState, useEffect } from 'react';
import { VideoProject } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import { saveFileToDevice } from './utils/download';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import ViralityScorecard from './components/ViralityScorecard';
import { AICopilotConsole } from './components/AICopilotConsole';
import { Sparkles, Download, Video as VideoIcon, CheckCircle, KeyRound, MessageSquare, Flame } from 'lucide-react';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';

// NOTE: renderVideoInBrowser is imported DYNAMICALLY inside triggerVideoExport
// to prevent the 30MB FFmpeg engine from crashing the browser on boot.

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
    
    // Watchdog: Increased to 90s for complex viral engineering
    const watchdog = setTimeout(() => {
      setIsProcessing(false);
      alert("The social algorithm is taking longer than expected to solve. Please ensure your API key is valid and try again in 60 seconds.");
    }, 90000);

    try {
      const result = await runAnalyzeVideo({ ...template });
      clearTimeout(watchdog);
      
      if (!result || !result.project) {
        throw new Error("The AI provided an invalid blueprint. Please try again.");
      }

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
        
        // DEFAULT PERSISTENT SETTINGS
        enableSubtitles: true,
        enableZooms: true,
        enableColorGrade: true,
        musicVolume: 0.4,
        jumpCuts: true,
        speedRamp: true,
        sfxSparks: true,
        emojiBounces: true,
        autoZoomPunch: true,
        shakeOnPunch: true,
        camRecorderHUD: false
      };
      setActiveProject(newProject);
      setActiveTab('studio');
    } catch (err: any) {
      clearTimeout(watchdog);
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
      const p = result.project;
      const newProject: VideoProject = { 
        ...p, 
        id: `custom-${Date.now()}`, 
        videoUrl, 
        name: fixDunikTypo(name),
        niche: niche,
        createdAt: new Date().toISOString(),

        // DEFAULT PERSISTENT SETTINGS
        enableSubtitles: true,
        enableZooms: true,
        enableColorGrade: true,
        musicVolume: 0.4,
        jumpCuts: true,
        speedRamp: true,
        sfxSparks: true,
        emojiBounces: true,
        autoZoomPunch: true,
        shakeOnPunch: true,
        camRecorderHUD: false
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
    setProcessingStage("Initializing Native Forge...");
    try {
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      
      const editedBlob = await renderVideoInBrowser(activeProject, (prg) => {
        setProcessingProgress(prg);
        setProcessingStage(`Baking: ${prg}%`);
      }, activeClipId);
      
      if (!editedBlob) throw new Error('Bake failed.');

      const url = URL.createObjectURL(editedBlob);
      setDownloadReadyInfo({ url, filename: `${activeProject.name.replace(/\s+/g, '_')}_edit.mp4` });
    } catch (err: any) {
      console.error('[Export Error]', err);
      const msg = err?.message || (typeof err === 'string' ? err : 'Unknown hardware error. Try refreshing the page.');
      alert('Export failed: ' + msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateProject = (updated: Partial<VideoProject>) => {
    if (!activeProject) return;
    setActiveProject({ ...activeProject, ...updated } as VideoProject);
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/20 blur-[120px] rounded-full animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-[35px] flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(139,92,246,0.3)] animate-[bounce_3s_infinite]">
             <Sparkles className="text-white w-12 h-12" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter mb-4 leading-none">
            Viral <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">AI Editor</span>
          </h1>
          
          <p className="text-slate-400 text-sm md:text-base max-w-[320px] mb-12 font-medium leading-relaxed tracking-tight">
            The professional suite for high-retention social media content.
          </p>
          
          <button 
            onClick={() => setHasStarted(true)}
            className="group relative w-full max-w-[280px] py-5 bg-white text-black rounded-[24px] font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_rgba(255,255,255,0.1)] transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10">Launch Studio</span>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-500 opacity-0 group-hover:opacity-10 transition-opacity" />
          </button>
          
          <div className="mt-8 flex gap-4 opacity-40">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><VideoIcon className="w-4 h-4" /></div>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><Flame className="w-4 h-4" /></div>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center"><MessageSquare className="w-4 h-4" /></div>
          </div>
        </div>
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
          <p className="text-[10px] text-slate-500 mt-2 max-w-[250px]">Please keep this tab active. AI processing uses device resources!</p>
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
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'viral' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>Specs</button>
                 <button onClick={() => setActiveTab('copilot')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'copilot' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>Copilot</button>
                 <button onClick={triggerVideoExport} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                   <Download className="w-3.5 h-3.5" /> Bake Video
                 </button>
               </div>
            </div>
            
            {activeTab === 'studio' && (
              <VideoPlayerWorkspace 
                project={activeProject} 
                onUpdateProject={setActiveProject as any} 
                activeMusicTrack={FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || (activeProject.selectedMusicTrackId !== 'none' ? FREE_MUSIC_TRACKS[0] : null)} 
                activeClipId={activeClipId} 
                onClipSelect={setActiveClipId} 
              />
            )}
            
            {activeTab === 'viral' && (
              <ViralityScorecard project={activeProject} onUpdateProject={setActiveProject as any} />
            )}
            
            {activeTab === 'copilot' && (
              <AICopilotConsole 
                project={activeProject} 
                onUpdateProject={updateProject}
                onUpdateSubtitles={(subs) => updateProject({ subtitles: subs })}
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
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Your professional vertical short is fully baked and ready to share.</p>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} onClick={async () => {
                const blob = await fetch(downloadReadyInfo.url).then(r => r.blob());
                await saveFileToDevice(blob, downloadReadyInfo.filename);
                setDownloadReadyInfo(null);
            }} className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-sm mb-4 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 text-center text-decoration-none">SAVE TO PHOTOS</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Back to Studio</button>
          </div>
        </div>
      )}
    </div>
  );
}
