import React, { useState, Suspense, lazy } from 'react';
import { Sparkles, KeyRound, CheckCircle, Video as VideoIcon, Download } from 'lucide-react';
import NicheSelector from './components/NicheSelector';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { runAnalyzeVideo } from './utils/geminiClient';

// Lazy load heavy components to save memory
const VideoPlayerWorkspace = lazy(() => import('./components/VideoPlayerWorkspace'));
const ViralityScorecard = lazy(() => import('./components/ViralityScorecard'));

export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeProject, setActiveProject] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('studio');
  const [downloadReadyInfo, setDownloadReadyInfo] = useState(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const handleSelectTemplate = async (template) => {
    setIsProcessing(true);
    try {
      const result = await runAnalyzeVideo(template);
      setActiveProject({ ...result.project, videoUrl: template.videoUrl, name: template.name });
    } catch (err) {
      alert('AI analysis failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerExport = async () => {
    if (!activeProject) return;
    setIsProcessing(true);
    try {
      const { renderVideoInBrowser } = await import('./utils/ffmpegClient');
      const editedBlob = await renderVideoInBrowser(activeProject, () => {});
      setDownloadReadyInfo({ url: URL.createObjectURL(editedBlob), filename: 'edited.mp4' });
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
        <button 
          onClick={() => setHasStarted(true)}
          className="px-10 py-5 bg-purple-600 text-white rounded-3xl font-black text-lg uppercase tracking-widest"
        >
          Start AI Editor
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <h1 className="font-black text-lg uppercase flex items-center gap-2">
          <Sparkles className="text-purple-500 w-5 h-5" /> Viral AI
        </h1>
        <button onClick={() => setShowApiKeyModal(true)} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
          <KeyRound className="w-3 h-3" /> API Key
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        {!activeProject ? (
          <NicheSelector onSelectTemplate={handleSelectTemplate} isProcessing={isProcessing} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 justify-between items-center bg-slate-900/80 p-4 rounded-3xl border border-slate-800">
               <p className="text-sm font-black">{activeProject.name}</p>
               <div className="flex gap-2">
                 <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${activeTab === 'studio' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Studio</button>
                 <button onClick={() => setActiveTab('viral')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${activeTab === 'viral' ? 'bg-white text-black' : 'bg-slate-800 text-slate-400'}`}>Viral</button>
                 <button onClick={triggerExport} className="bg-purple-600 px-6 py-2 rounded-xl font-black text-[10px] uppercase flex items-center gap-2">
                   <Download className="w-3.5 h-3.5" /> Bake
                 </button>
               </div>
            </div>
            
            <Suspense fallback={<div className="p-20 text-center text-slate-500 font-mono text-xs uppercase tracking-widest">Loading Studio Modules...</div>}>
              {activeTab === 'studio' ? (
                <VideoPlayerWorkspace project={activeProject} onUpdateProject={setActiveProject} />
              ) : (
                <ViralityScorecard project={activeProject} />
              )}
            </Suspense>
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-6 text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-md font-bold uppercase tracking-widest">Processing...</h2>
          <button onClick={() => setIsProcessing(false)} className="mt-8 text-[10px] text-purple-400 font-black uppercase underline">Cancel</button>
        </div>
      )}

      <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />
      
      {downloadReadyInfo && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-slate-800 max-w-sm w-full shadow-2xl">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Ready!</h3>
            <a href={downloadReadyInfo.url} download={downloadReadyInfo.filename} className="block w-full py-4 bg-green-600 text-white rounded-2xl font-black text-sm mb-4">SAVE VIDEO</a>
            <button onClick={() => setDownloadReadyInfo(null)} className="text-[10px] font-black uppercase text-slate-500">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
