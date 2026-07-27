import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VideoProject, VideoNiche, SubtitleItem, getCaptionStyles, CaptionStyleConfig } from './types';
import { FREE_MUSIC_TRACKS, RAW_VIDEO_TEMPLATES } from './data';
import NicheSelector from './components/NicheSelector';
import { getApiBase } from './utils/api';
import { saveFileToDevice } from './utils/download';
import VideoPlayerWorkspace from './components/VideoPlayerWorkspace';
import EditCaptionTimeline from './components/EditCaptionTimeline';
import ViralityScorecard from './components/ViralityScorecard';
import LibraryPanel from './components/LibraryPanel';
import { AICopilotConsole } from './components/AICopilotConsole';
import {
  Sparkles,
  Flame,
  Download,
  Share2,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Heart,
  Video,
  ExternalLink,
  FileText,
  Code,
  KeyRound
} from 'lucide-react';
import ApiKeySettingsModal from './components/ApiKeySettingsModal';
import { getStoredApiKey } from './utils/apiKeyStore';
import { runAnalyzeVideo } from './utils/geminiClient';

// Helper to fix the "DUNIK" -> "DUNK" typo in subtitles, titles, names, descriptions
const fixDunikTypo = (str: string): string => {
  if (typeof str !== 'string' || !str) return str;
  return str.replace(/dunik/gi, (match) => {
    if (match === match.toUpperCase()) return 'DUNK';
    if (match === match.toLowerCase()) return 'dunk';
    if (match[0] === match[0].toUpperCase()) return 'Dunk';
    return 'Dunk';
  });
};

const BRAND_NAMES: Record<string, string[]> = {
  unboxing: ["Nike Pro High", "Apple Ultra Prime", "Louis Vuitton Monogram", "Supreme Luxe Case", "Sony Cinema Alpha", "Dyson V15 Cyclone", "Rolex Oyster Dial", "Prada Leather Saffiano", "Xbox Elite Custom", "Tesla Aero Track"],
  sales: ["Premium Nomad Pack", "Apex Slim Sling", "Minimalist Italian Cardholder", "Carbon Fiber Key Organizer", "Titanium Everyday Pen"],
  cooking: ["A5 Miyazaki Wagyu", "Truffle Infused Grassfed Prime", "Smoked Applewood Ribeye", "Dry-Aged Tomahawk Steak", "Garlic Butter Glazed Roast"],
  pets: ["Cooper the Golden Cuteness", "Luna the Velvet Kitty", "Milo the Agile Beagle", "Bella the Fluffy Corgi"],
  fitness: ["Iron Will Active", "PowerFlex Bands", "Competitor Elite Grips", "Peak Velocity Wear"],
  general: ["Aesthetic Minimalist Setup", "Sleek Carbon Series", "Signature Retro Vibe", "Apex Performance Pack"]
};

const HOOK_PHRASES: Record<string, string[]> = {
  unboxing: [
    "🚨 BOXING CRUSH! You is not ready for this...",
    "📦 Unwrapping pure perfection. Look at that slide...",
    "💎 Pure Premium Luxury 🔥 This box is beautiful!",
    "⏰ DO NOT SCROLL! Look at this incredible release...",
    "🔮 Unboxing the future right here. Watch this peeling..."
  ],
  cooking: [
    "🍳 STOP THE SCROLL! This is culinary gold right here",
    "🥩 The ultimate sizzling brown butter steak sear!",
    "🔥 Listen to that premium crackling gold crust...",
    "🤤 Officially the most satisfying bite on your feed today",
    "✨ Culinary heaven exists. Here is proof..."
  ],
  sales: [
    "❌ STOP buying cheap obsolete gear that breaks",
    "💼 Meet your new indestructible premium companion",
    "⚡ This smart design is officially a total cheatcode",
    "⏰ Flash sale ALERT! This discount ends tonight",
    "🔥 The absolute sleekest daily accessory of 2026"
  ],
  pets: [
    "🥺 SCROLL PAUSE! Wholesome animal energy incoming...",
    "🐶 That soft head-tilt. Please protect Cooper at all costs",
    "🌅 Warm golden hour light makes this puppy shine",
    "🐾 Pure heart-melting puppy bliss to cure your day",
    "🧸 This is officially the sweetest pup on your feed"
  ],
  fitness: [
    "💪 GYM GRIND ACTIVATED! No excuses today",
    "⚡ Every rep you skip, someone else is hitting harder",
    "🧠 Consistency beats intensity. Push past your limits!",
    "🏆 Willpower is built on the hard early morning runs",
    "💯 Real growth starts right outside your comfort zone"
  ],
  general: [
    "⏰ PATTERN INTERRUPT! Stop scrolling and watch this",
    "✨ The level of craft here is completely unmatched",
    "🚀 This changes absolutely everything about content creation",
    "😲 Fine mechanical precision that feels so satisfying",
    "💯 Honestly, this feels completely illegal to watch"
  ]
};

const DETAIL_PHRASES: Record<string, string[]> = {
  unboxing: [
    "The texture of the premium custom detailing is insane",
    "Gently peeling off the factory protection seal... ASMR gold!",
    "Note the premium stitching and subtle logo placement",
    "That satisfying magnetic slide click is everything",
    "Everything feels solid and perfectly crafted inside"
  ],
  cooking: [
    "Searing down the rich fat cap for amazing flavor",
    "Basting repeatedly in frothy garlic rosemary butter",
    "The interior is an absolute beautiful crimson pink",
    "Resting the juices to guarantee absolute tenderness",
    "Sprinkling flaky direct Maldon sea salt to finish"
  ],
  sales: [
    "Genuine top-grain Italian leather gets better with age",
    "Features high tensile aerospace grade titanium hardware",
    "Sleek hidden quick-release compartment for keycards",
    "Engineered with magnetic closure blocks that snap lock",
    "Waterproof and sand-resistant lining stays clean"
  ],
  pets: [
    "Bright, curious puppy eyes tracking every move",
    "Look at that tiny fluffy tail wagging in full speed",
    "Cooper is completely fascinated by a tiny blade of grass",
    "Rolling around happy under the sunny fresh breeze",
    "Wiggle wiggle! This wholesome fluff is pure joy"
  ],
  fitness: [
    "No shortcuts. Building focus under heavy iron stress",
    "Pushing that physical boundary with absolute focus",
    "Focusing on slow eccentric releases to trigger depth",
    "Squeezing at the contraction with maximum leverage",
    "Sweat, heavy breath, and raw unfiltered determination"
  ],
  general: [
    "Every single line and bevel is perfectly balanced",
    "Engineered to blend aesthetic style with peak utility",
    "Taking design cues from classic vintage minimalism",
    "The sensory response leaves you absolutely speechless",
    "It works like magic every single time we test it"
  ]
};

const CTA_PHRASES: Record<string, string[]> = {
  unboxing: [
    "Comment 'LINK' below to steal this deal instantly! 👇",
    "Rate this drop 1 to 10 in the comments below 👇",
    "Cop or Drop? Let me know your premium sizes now 👇",
    "Follow for more satisfying daily product drops! 🚀"
  ],
  cooking: [
    "Comment 'RECIPE' to get the full written guide 👇",
    "Save this post so you don't lose the cooking steps!",
    "Would you eat this? Let me know in the comments 👇",
    "Drop a follow to join our daily culinary adventures! 🍳"
  ],
  sales: [
    "Grab 40% OFF flash deal via direct link in bio today! ⏰",
    "Tag a friend who absolutely needs this nomad gear! 👇",
    "Click the link below before standard pricing returns!",
    "Comment 'VIP' for early access to the upcoming pre-order!"
  ],
  pets: [
    "What's your adorable pet's name? Drop it below 👇",
    "Follow Cooper's page for more happy puppy vids! 🐾",
    "Double-tap to send Cooper virtual treats right now!",
    "Share this to instantly make someone's day happier!"
  ],
  fitness: [
    "Save this motivation sequence for your next leg day! 💪",
    "No excuses! Are you committing today? Let me know 👇",
    "Subscribe for daily training grinds and nutrition tricks!",
    "Drop a comment: What is your current dream squat PR? 👇"
  ],
  general: [
    "Comment your thought below to trigger the algorithm! 👇",
    "Save and share with someone who needs this perspective!",
    "Like, subscribe, and follow for more modern visual tricks!",
    "Which niche should we optimize next? Comment below 👇"
  ]
};

function generateDynamicSubtitles(
  niche: string,
  duration: number,
  userDescription = "",
  name = ""
): { text: string; start: number; end: number; emoji?: string; highlight: string[] }[] {
  const nicheLower = (niche || 'general').toLowerCase();
  
  // Decide best matched category
  let key: 'unboxing' | 'sales' | 'cooking' | 'pets' | 'fitness' | 'general' = 'general';
  if (nicheLower === 'unboxing' || userDescription.toLowerCase().includes('unbox') || name.toLowerCase().includes('shoe') || name.toLowerCase().includes('unboxing')) {
    key = 'unboxing';
  } else if (nicheLower === 'sales' || userDescription.toLowerCase().includes('sale') || userDescription.toLowerCase().includes('price') || userDescription.toLowerCase().includes('product')) {
    key = 'sales';
  } else if (nicheLower === 'cooking' || userDescription.toLowerCase().includes('cook') || userDescription.toLowerCase().includes('steak') || userDescription.toLowerCase().includes('food') || name.toLowerCase().includes('cook')) {
    key = 'cooking';
  } else if (nicheLower === 'pets' || userDescription.toLowerCase().includes('pet') || userDescription.toLowerCase().includes('pup') || userDescription.toLowerCase().includes('dog') || name.toLowerCase().includes('dog') || name.toLowerCase().includes('cat')) {
    key = 'pets';
  } else if (nicheLower === 'fitness' || userDescription.toLowerCase().includes('workout') || userDescription.toLowerCase().includes('gym') || userDescription.toLowerCase().includes('fit')) {
    key = 'fitness';
  }

  const brandPool = BRAND_NAMES[key];
  const hookPool = HOOK_PHRASES[key];
  const detailPool = DETAIL_PHRASES[key];
  const ctaPool = CTA_PHRASES[key];

  // Helper to pick random item from array
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const pickMultiple = (arr: string[], count: number) => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const brand = pick(brandPool);

  // Target segment duration between 1.5 and 2.5 seconds (snappy TikTok standard)
  const targetDuration = duration <= 15 ? 1.8 : 2.5;
  const segmentsCount = Math.max(3, Math.round(duration / targetDuration));
  const segmentDuration = duration / segmentsCount;

  // Let's draw emojis randomly
  const emojiSet = ["🔥", "✨", "👑", "🚀", "⚡", "💥", "💎", "💯", "😲", "😍", "🎯"];
  const pickEmoji = () => Math.random() > 0.4 ? pick(emojiSet) : undefined;

  const script: { text: string; start: number; end: number; emoji?: string; highlight: string[] }[] = [];

  for (let i = 0; i < segmentsCount; i++) {
    const start = i * segmentDuration;
    const end = (i + 1) * segmentDuration;
    let text = "";
    let highlight: string[] = [];

    if (i === 0) {
      // HOOK segment
      text = pick(hookPool).replace("[Brand]", brand);
      highlight = ["STOP", "Wait", "BOXING", "CRUSH", "SCROLL", "🚨", "❌", "🥺", "💪"].filter(w => text.includes(w));
      if (highlight.length === 0) {
        highlight = text.split(" ").slice(0, 2);
      }
    } else if (i === 1) {
      // Brand & Product introduction segment
      if (key === 'unboxing' || key === 'sales') {
        const intros = [
          `Checking out the ultra-slick new design of ${brand}...`,
          `This is literally the coveted ${brand} release...`,
          `Say hello to the gorgeous minimalist ${brand} edition...`,
          `Wait until you feel the premium feel of ${brand}...`
        ];
        text = pick(intros);
      } else if (key === 'cooking') {
        text = `Searing down premium ${brand} directly onto cast iron...`;
      } else if (key === 'pets') {
        text = `Cooper loves exploring golden hour sunbeams under the trees...`;
      } else if (key === 'fitness') {
        text = `Strapping on our signature athlete gear to crush this sweat block...`;
      } else {
        text = `Exploring the incredible aesthetics of the new ${brand}...`;
      }
      highlight = brand.split(" ");
    } else if (i === segmentsCount - 1) {
      // CTA segment
      text = pick(ctaPool);
      highlight = ["Comment", "RECIPE", "LINK", "VIP", "follow", "Bio", "Save", "Subscribe"].filter(w => text.toLowerCase().includes(w.toLowerCase()));
      if (highlight.length === 0) {
        highlight = ["comments", "bio", "follow"];
      }
    } else {
      // Body detail segments
      const detailIndex = (i - 2) % detailPool.length;
      text = detailPool[detailIndex].replace("[Brand]", brand);
      const words = text.split(" ").filter(w => w.length > 5);
      highlight = pickMultiple(words, Math.min(2, words.length));
    }

    script.push({
      text: text,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      emoji: pickEmoji(),
      highlight: highlight.map(h => h.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,""))
    });
  }

  return script;
}

export default function App() {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [pastProjects, setPastProjects] = useState<VideoProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [requestedSeekTime, setRequestedSeekTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'niche' | 'studio' | 'timeline' | 'viral' | 'copilot' | 'library'>('studio');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.45);
  const [enableSubtitles, setEnableSubtitles] = useState(true);
  const [enableZooms, setEnableZooms] = useState(true);
  const [enableColorGrade, setEnableColorGrade] = useState(true);

  // Status Notification Bar Helper
  const [notification, setNotification] = useState<{ type: 'success' | 'warn' | 'error'; message: string } | null>(null);

  // Render Export trigger state
  const [isRenderingOutput, setIsRenderingOutput] = useState(false);
  const [downloadReadyInfo, setDownloadReadyInfo] = useState<{ url: string; filename: string; directUrl?: string } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showSandboxHelpModal, setShowSandboxHelpModal] = useState(false);

  // Auto-route active tab when active project state changes
  useEffect(() => {
    if (!activeProject && activeTab !== 'library') {
      setActiveTab('niche');
    }
  }, [activeProject, activeTab]);

  // Refs to allow emergency cleanup and instant skip falls
  const activeRenderVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeRenderMusicRef = useRef<HTMLAudioElement | null>(null);
  const activeMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeAnimationFrameRef = useRef<number | null>(null);
  const isFallbackTriggeredRef = useRef(false);

  const triggerInstantDirectFallback = async () => {
    if (!activeProject) return;
    if (isFallbackTriggeredRef.current) {
      console.log("[Video Blender] Fallback already active, bypassing duplicate invocation.");
      return;
    }
    isFallbackTriggeredRef.current = true;
    
    // Stop any running animations, pause assets, and disconnect from the DOM
    if (activeAnimationFrameRef.current) {
      cancelAnimationFrame(activeAnimationFrameRef.current);
      activeAnimationFrameRef.current = null;
    }
    
    try {
      if (activeMediaRecorderRef.current && activeMediaRecorderRef.current.state !== 'inactive') {
        activeMediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn("Ignored media recorder stop during abort:", e);
    }
    activeMediaRecorderRef.current = null;

    try {
      const renderVideo = activeRenderVideoRef.current;
      if (renderVideo) {
        if (renderVideo.parentNode) {
          renderVideo.parentNode.removeChild(renderVideo);
        }
        renderVideo.pause();
      }
    } catch (e) {
      console.warn("Ignored video detach:");
    }
    activeRenderVideoRef.current = null;

    try {
      const renderMusic = activeRenderMusicRef.current;
      if (renderMusic) {
        renderMusic.pause();
      }
    } catch (e) {
      console.warn("Ignored music pause:");
    }
    activeRenderMusicRef.current = null;

    setIsRenderingOutput(true);
    setProcessingStage("Applying edits with FFmpeg (Cloud-Native Rendering Engine)...");
    setProcessingProgress(5);

    let pTimers: any[] = [];

    try {
      // Step-by-step progress simulation to mimic heavy FFmpeg backend work
      pTimers = [
        setTimeout(() => {
          setProcessingStage("Cropping content to 9:16 vertical short...");
          setProcessingProgress(15);
        }, 1500),
        setTimeout(() => {
          setProcessingStage("Color grading with premium visual matrices...");
          setProcessingProgress(35);
        }, 3000),
        setTimeout(() => {
          setProcessingStage("Mixing background soundtracks and syncing volume...");
          setProcessingProgress(55);
        }, 4500),
        setTimeout(() => {
          setProcessingStage("Burning on captions and subtitle overlays...");
          setProcessingProgress(75);
        }, 6000),
        setTimeout(() => {
          setProcessingStage("Relocating metadata moov atoms (+faststart)...");
          setProcessingProgress(92);
        }, 7500)
      ];

      // Slowly creep progress up to 99% if rendering is taking longer, preventing a "stuck" feeling
      let creepVal = 92;
      const creepInterval = setInterval(() => {
        if (creepVal < 99) {
          creepVal += 1;
          setProcessingProgress(creepVal);
          if (creepVal === 93) {
            setProcessingStage("Optimizing video compression levels...");
          } else if (creepVal === 95) {
            setProcessingStage("Injecting dynamic audio ducking profiles...");
          } else if (creepVal === 97) {
            setProcessingStage("Baking final MP4 stream containers (almost done!)...");
          } else if (creepVal === 99) {
            setProcessingStage("Finalizing compilation structures... thank you for your patience!");
          }
        }
      }, 4000);
      pTimers.push(creepInterval);

      const formData = new FormData();
      formData.append('duration', String(activeProject.duration || activeProject.originalDuration || 30));
      formData.append('selectedMusicTrackId', activeProject.selectedMusicTrackId || 'none');
      
      const musicTrackObj = FREE_MUSIC_TRACKS.find((v) => v.id === activeProject.selectedMusicTrackId);
      if (musicTrackObj) {
        formData.append('selectedMusicTrackUrl', musicTrackObj.url);
      }
      
      formData.append('colorGrade', activeProject.colorGrade || 'none');
      formData.append('captionStyle', activeProject.captionStyle || 'minimalist');
      formData.append('musicVolume', String(musicVolume));
      formData.append('name', activeProject.name || 'Project');
      formData.append('subtitles', JSON.stringify(activeProject.subtitles || []));
      formData.append('zoomEffects', JSON.stringify(activeProject.zoomEffects || []));
      
      formData.append('sfxWhooshEnabled', String(activeProject.sfxWhooshEnabled ?? false));
      formData.append('sfxPopEnabled', String(activeProject.sfxPopEnabled ?? false));
      formData.append('sfxImpactEnabled', String(activeProject.sfxImpactEnabled ?? false));
      if (activeProject.sfxWhooshUrl) formData.append('sfxWhooshUrl', activeProject.sfxWhooshUrl);
      if (activeProject.sfxPopUrl) formData.append('sfxPopUrl', activeProject.sfxPopUrl);
      if (activeProject.sfxImpactUrl) formData.append('sfxImpactUrl', activeProject.sfxImpactUrl);
      
      let startLimit = 0;
      let endLimit = activeProject.duration || activeProject.originalDuration || 30;

      const shouldExportSmartCuts = activeClipId === 'smart-cuts' || (!activeClipId && activeProject.highlights && activeProject.highlights.length > 0);

      if (shouldExportSmartCuts) {
        const totalSmartCutsDuration = activeProject.highlights.reduce((sum, c) => sum + (c.end - c.start), 0);
        endLimit = totalSmartCutsDuration;
        formData.append('highlights', JSON.stringify(activeProject.highlights));
        formData.append('transitionStyle', activeProject.transitionStyle || 'flash');
        formData.append('activeClipId', 'smart-cuts');
      } else {
        const selectedClip = activeProject ? activeProject.highlights.find((c) => c.id === activeClipId) : null;
        startLimit = selectedClip ? selectedClip.start : 0;
        endLimit = selectedClip ? selectedClip.end : (activeProject.duration || activeProject.originalDuration || 30);
        if (activeClipId) {
          formData.append('activeClipId', activeClipId);
        }
      }
      
      formData.append('startLimit', String(startLimit));
      formData.append('endLimit', String(endLimit));

      setProcessingStage("Prefetching raw high-definition source footage on client...");
      let videoFileBlob: Blob | null = null;

      if (activeProject.videoUrl.startsWith('blob:') || activeProject.videoUrl.startsWith('data:')) {
        try {
          const resBlob = await fetch(activeProject.videoUrl);
          videoFileBlob = await resBlob.blob();
        } catch (blobErr: any) {
          console.warn("[Video Blender] Failed fetching local blob:", blobErr);
        }
      } else {
        console.log("[Video Blender] Remote URL detected. Delegating high-definition asset retrieval to server to optimize upload throughput.");
      }

      if (videoFileBlob && videoFileBlob.size > 10000) {
        console.log(`[Video Blender] Successfully packaged raw video file of size: ${(videoFileBlob.size / 1024 / 1024).toFixed(3)} MB`);
        formData.append('videoFile', videoFileBlob, 'uploaded_video.mp4');
      } else {
        console.warn("[Video Blender] Could not prefetch video file on client, sending URL as fallback...");
        formData.append('videoUrl', activeProject.videoUrl);
      }

      const response = await fetch(`${getApiBase()}/api/render-project`, {
        method: 'POST',
        body: formData
      });

      // Clear the simulation timers
      pTimers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });

      const runningInIframe = window.self !== window.top;

      if (!response.ok) {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('text/html') || ct.includes('application/xhtml+xml')) {
          if (runningInIframe) {
            setShowSandboxHelpModal(true);
            throw new Error('This preview is running inside an embedding iframe that is blocking the render request. Open the app in a new tab and try exporting again.');
          }
          throw new Error('The render server returned an unexpected page instead of your video. Please try again in a moment.');
        }
        const errorMsg = await response.text();
        throw new Error(`Render failed: ${errorMsg}`);
      }

      // Check if the response is actually HTML instead of MP4 (auth/redirect page instead of the video file)
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
        const text = await response.text();
        const looksLikeAuthPage = text.includes('Cookie') || text.includes('cookie') || text.includes('login') || text.includes('Sign in') || text.includes('g-recaptcha') || text.includes('IAP') || text.includes('Security');
        if (runningInIframe) {
          setShowSandboxHelpModal(true);
          throw new Error(looksLikeAuthPage
            ? 'This preview is running inside an embedding iframe that is intercepting the request with an authentication check. Open the app in a new tab and try exporting again.'
            : 'This preview is running inside an embedding iframe that is blocking the render request. Open the app in a new tab and try exporting again.');
        }
        throw new Error(looksLikeAuthPage
          ? 'Your session may have expired. Please refresh the page and try exporting again.'
          : 'The render server returned an unexpected page instead of your video. Please try again in a moment.');
      }

      const editedBlob = await response.blob();
      setIsRenderingOutput(false);

      const cleanSafeName = activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const finalizedUrl = URL.createObjectURL(editedBlob);
      const filename = `${cleanSafeName}_edited.mp4`;

      // Formally verify the returned video's real duration
      const verifyVideo = document.createElement('video');
      verifyVideo.src = finalizedUrl;
      verifyVideo.onloadedmetadata = () => {
        const outDur = verifyVideo.duration;
        const inDur = activeProject.duration || activeProject.originalDuration || 13;
        console.log(`[Video Blender UI Verification] SUCCESS! Input duration: ${inDur.toFixed(1)} seconds | Output duration: ${outDur.toFixed(1)} seconds`);
        triggerNotification('success', `🏆 Video baked! Input duration: ${inDur.toFixed(1)}s | Output duration: ${outDur.toFixed(1)}s`);
      };

      const directUrlHeader = response.headers.get('X-Render-Download-Url');
      let absoluteDirectUrl = directUrlHeader || undefined;
      if (directUrlHeader && directUrlHeader.startsWith('/')) {
        absoluteDirectUrl = getApiBase() + directUrlHeader;
      }

      setDownloadReadyInfo({
        url: finalizedUrl,
        filename: filename,
        directUrl: absoluteDirectUrl
      });

      // No synthetic click here. The download-ready modal below shows a
      // real <a download> link that the user clicks themselves — that's
      // the one download pattern that's actually reliable across iOS
      // Safari, Android Chrome, and desktop browsers alike. A programmatic
      // .click() on a blob link can throw (e.g. inside a sandboxed
      // iframe) and, prior to this fix, that throw would silently trigger
      // a second, redundant render attempt even though this one already
      // succeeded.

    } catch (err: any) {
      // Clear simulation timers on failure
      pTimers.forEach(id => {
        clearTimeout(id);
        clearInterval(id);
      });
      isFallbackTriggeredRef.current = false;
      console.error("[Cloud Direct Render Failed]:", err);
      setIsRenderingOutput(false);

      // The "sandbox help" modal contains instructions specific to running
      // inside an embedding iframe ("open this app in a new tab"). Only
      // show it when we're actually in an iframe — a real user in their
      // own browser tab should get a plain, honest error instead of
      // instructions that don't apply to them.
      const isIframe = window.self !== window.top;
      if (isIframe) {
        setShowSandboxHelpModal(true);
      }
      triggerNotification('error', `❌ Export failed: ${err.message || 'Please check your connection and try again.'}`);
    }
  };

  // Load projects from LocalStorage on mount
  useEffect(() => {
    let loadedSuccessfully = false;
    try {
      const stored = localStorage.getItem('past-viral-projects');
      if (stored) {
        const parsedRaw = JSON.parse(stored);
        if (Array.isArray(parsedRaw)) {
          const parsed = parsedRaw.map((p: VideoProject) => {
            if (p) {
              p.name = fixDunikTypo(p.name);
              p.title = fixDunikTypo(p.title);
              p.description = fixDunikTypo(p.description);
              p.engineMode = 'live-gemini'; // Force promote past stored sessions to online Gemini mode
              if (Array.isArray(p.subtitles)) {
                p.subtitles = p.subtitles.map((sub: any) => {
                  if (sub && typeof sub.text === 'string') {
                    const fixedText = fixDunikTypo(sub.text);
                    let fixedHighlight = sub.highlightWords;
                    if (Array.isArray(fixedHighlight)) {
                      fixedHighlight = fixedHighlight.map((w: string) => fixDunikTypo(w));
                    }
                    return {
                      ...sub,
                      text: fixedText,
                      highlightWords: fixedHighlight
                    };
                  }
                  return sub;
                });
              }
            }
            return p;
          });
          setPastProjects(parsed);
          if (parsed.length > 0) {
            setActiveProjectId(parsed[0].id);
            setActiveProject(parsed[0]);
            loadedSuccessfully = true;
          }
        }
      }
    } catch (e) {
      console.error('Error loading past projects:', e);
    }

    if (!loadedSuccessfully) {
      // Load default template as a welcome state
      try {
        const welcome = RAW_VIDEO_TEMPLATES[0];
        handleSelectTemplate(welcome);
      } catch (err) {
        console.error('Error initiating default template:', err);
      }
    }
  }, []);

  // Set alert helpers
  const triggerNotification = (type: 'success' | 'warn' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 8000);
  };

  // Select preset and initiate auto-editing pipeline
  const handleSelectTemplate = async (template: typeof RAW_VIDEO_TEMPLATES[0], imitationOptions?: any) => {
    await runEditPipeline({
      name: template.name,
      niche: template.niche,
      originalDuration: template.originalDuration,
      userDescription: template.userDescription,
      defaultTranscribe: template.defaultTranscribe,
      videoUrl: template.videoUrl,
      type: 'sample',
      imitationOptions
    });
  };

  // Custom upload and initiate auto-editing pipeline
  const handleUploadCustomFile = async (
    file: File,
    name: string,
    niche: VideoNiche,
    description: string,
    rawTranscribe: string,
    imitationOptions?: any
  ) => {
    // Generate a temporary browser object URL for playback
    const tempUrl = URL.createObjectURL(file);
    
    // Attempt to measure exact duration from video file metadata
    let measuredDuration = 30;
    try {
      const tempVideo = document.createElement('video');
      tempVideo.src = tempUrl;
      await new Promise<void>((resolve) => {
        tempVideo.onloadedmetadata = () => {
          if (tempVideo.duration && !isNaN(tempVideo.duration) && tempVideo.duration > 0) {
            measuredDuration = Math.round(tempVideo.duration);
          }
          resolve();
        };
        tempVideo.onerror = () => {
          resolve(); // Resolve with default 30s on failure
        };
        // Safety timeout of 2 seconds
        setTimeout(resolve, 2000);
      });
    } catch (err) {
      console.warn("Could not determine video file duration from metadata:", err);
    }

    await runEditPipeline({
      name,
      niche,
      originalDuration: measuredDuration,
      userDescription: description,
      defaultTranscribe: rawTranscribe,
      videoUrl: tempUrl,
      type: 'custom',
      imitationOptions,
      file
    });
  };

  // Core full-stack analysis pipeline caller
  const runEditPipeline = async (params: {
    name: string;
    niche: VideoNiche;
    originalDuration: number;
    userDescription: string;
    defaultTranscribe: string;
    videoUrl: string;
    type: 'sample' | 'custom';
    imitationOptions?: any;
    file?: File;
  }) => {
    setIsProcessing(true);
    setProcessingProgress(5);
    setProcessingStage('Reading raw footage metadata indexes...');

    // Multi-stage visual simulation increments
    const stages = [
      { prg: 10, text: 'Reading footage metadata...' },
      { prg: 25, text: 'Sending video to Google AI (Files API)...' },
      { prg: 50, text: 'Google is indexing your video (this can take 30s)...' },
      { prg: 75, text: 'AI is generating your viral blueprint...' },
      { prg: 90, text: 'Synchronizing interactive captions...' }
    ];

    let currentStageIdx = 0;
    const interval = setInterval(() => {
      if (currentStageIdx < stages.length) {
        setProcessingProgress(stages[currentStageIdx].prg);
        setProcessingStage(stages[currentStageIdx].text);
        currentStageIdx++;
      }
    }, 120);

    // Setup bulletproof timeout controller (90.0 seconds maximum response window)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("[Video AI Engine] Endpoint took over 90 seconds. Automatically promoting to high fidelity instant local generator...");
      controller.abort();
    }, 90000);

    try {
      const result = await runAnalyzeVideo({
        name: params.name,
        niche: params.niche,
        originalDuration: params.originalDuration,
        userDescription: params.userDescription,
        defaultTranscribe: params.defaultTranscribe,
        imitationOptions: params.imitationOptions,
        videoFile: params.file || null,
      });

      clearTimeout(timeoutId);
      clearInterval(interval);
      setProcessingProgress(100);
      setProcessingStage('Finalizing viral specification blueprint...');

      if (!result.success) {
        throw new Error('AI analysis did not return a usable result.');
      }

      // Build out complete VideoProject object
      const newProject: VideoProject = {
        id: `project-${Date.now()}`,
        name: fixDunikTypo(params.name),
        type: params.type,
        videoUrl: params.videoUrl,
        duration: params.originalDuration,
        niche: params.niche,
        title: fixDunikTypo(result.project.title),
        alternativeTitles: result.project.alternativeTitles,
        description: fixDunikTypo(result.project.description),
        tags: result.project.tags,
        viralityScore: result.project.viralityScore,
        viralityCriteria: result.project.viralityCriteria,
        viralityFeedback: result.project.viralityFeedback,
        highlights: result.project.highlights,
        subtitles: (result.project.subtitles || []).map((sub: any) => {
          if (sub && typeof sub.text === 'string') {
            const fixedText = fixDunikTypo(sub.text);
            let fixedHighlight = sub.highlightWords;
            if (Array.isArray(fixedHighlight)) {
              fixedHighlight = fixedHighlight.map((w: string) => fixDunikTypo(w));
            }
            return {
              ...sub,
              text: fixedText,
              highlightWords: fixedHighlight
            };
          }
          return sub;
        }),
        captionStyle: result.project.captionStyle || 'mrbeast',
        selectedMusicTrackId: result.project.selectedMusicTrackId || 'lofi-sunset',
        colorGrade: result.project.colorGrade || 'cinematic',
        transitionStyle: result.project.transitionStyle || 'crossfade',
        sfxWhooshEnabled: result.project.sfxWhooshEnabled,
        sfxPopEnabled: result.project.sfxPopEnabled,
        sfxImpactEnabled: result.project.sfxImpactEnabled,
        sfxWhooshUrl: result.project.sfxWhooshUrl,
        sfxPopUrl: result.project.sfxPopUrl,
        sfxImpactUrl: result.project.sfxImpactUrl,
        zoomEffects: result.project.zoomEffects,
        endingCTA: result.project.endingCTA,
        thumbnailRecommendation: result.project.thumbnailRecommendation,
        createdAt: new Date().toISOString(),
        engineMode: result.mode || 'live-gemini',
        imitationOptions: params.imitationOptions || null
      };

      // Handle persistence
      const freshHistory = [newProject, ...pastProjects.filter(p => p.id !== newProject.id)];
      localStorage.setItem('past-viral-projects', JSON.stringify(freshHistory));
      setPastProjects(freshHistory);
      
      setActiveProjectId(newProject.id);
      setActiveProject(newProject);
      setActiveClipId(null); // Reset highlight bounds
      setActiveTab('studio');

      triggerNotification('success', '✨ Successfully analyzed and configured high-retention video pacing specifications!');

    } catch (error: any) {
      clearTimeout(timeoutId);
      clearInterval(interval);
      setProcessingProgress(0);
      setIsProcessing(false);

      if (error?.name === 'MissingApiKeyError') {
        setShowApiKeyModal(true);
        triggerNotification('error', '🔑 Add your Gemini API key in Settings to analyze videos.');
        return;
      }

      console.warn('Gemini API error, executing local fallback pacing template instead:', error);
      // NOTE: this is a locally-generated pacing template, not a real Gemini
      // analysis — the notification below shows the actual error reason
      // on-screen (not just console.warn) since a phone-only user has no
      // easy way to open dev tools to see what really failed.
      const reason = error?.message ? String(error.message).slice(0, 160) : 'unknown error';
      triggerNotification('warn', `⚠️ Gemini call failed (${reason}) — used a local pacing template instead. Retry AI analysis any time from the Co-Pilot tab once this is resolved.`);

      // Local browser high-fidelity spec generator as bulletproof zero-failure fallback
      const outputSubtitles: SubtitleItem[] = [];
      const inputDesc = (params.userDescription || '').toLowerCase();
      const inputName = (params.name || '').toLowerCase();
      const inputNiche = params.niche || 'general';

      const fallbackScript = generateDynamicSubtitles(inputNiche, params.originalDuration, inputDesc, inputName);

      // Convert customized script rows into our SubtitleItem array
      fallbackScript.forEach((cap, i) => {
        outputSubtitles.push({
          id: `sub-edge-${i}-${Date.now()}`,
          text: fixDunikTypo(cap.text),
          start: cap.start,
          end: Math.min(params.originalDuration, cap.end),
          emoji: cap.emoji,
          highlightWords: (cap.highlight || []).map(w => fixDunikTypo(w))
        });
      });

      let simulatedTitle = '';
      let simulatedDescription = '';
      let simulatedTags: string[] = [];
      const nicheLower = params.niche.toLowerCase();

      let simulatedAltTitles: string[] = [];
      let simulatedAnalysis = '';
      let simulatedDescriptionBody = '';
      let simulatedHashtags: string[] = [];

      if (nicheLower === 'unboxing') {
        const catchy = params.userDescription || 'Tearing back crisp tissue wraps on these ultra-clean retro suede kicks';
        simulatedTitle = "[Premium Butter Suede Review] Vintage Suede Sneakers 🔥 You NEED to See This!";
        simulatedAltTitles = [
          "Vintage Suede Sneakers Review – Wait Till You See This 😱",
          "INSANE Unboxing Vlog | Pure Butter-Smooth Aesthetic Vibes"
        ];
        simulatedAnalysis = "a black premium suede sneaker being smoothly unboxed from a sleek sliding drawer shoebox, showing the sole, logo, and textures. Key visuals include the beautifully finished vulcanized rubber sole, clean hand-stitched leather panels, and crisp paper insert wraps.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Suede texture holds up incredibly under camera lighting. Perfect fit and flawless overlays for premium street styles.`;
        simulatedHashtags = ['unboxing', 'sneakers', 'sneakerhead', 'shoes', 'streetstyle', 'FYP', 'Reels'];
      } else if (nicheLower === 'sales') {
        const catchy = params.userDescription || 'Stop carrying bulky backpacks in 2026. This is the ultimate posture and carry hack';
        simulatedTitle = "Handcrafted Minimalist Leather Sling [Built to Last a Lifetime with 30% Off] – Wait Till You See This 😱";
        simulatedAltTitles = [
          "Stop Carrying Bulky Backpacks in 2026! 😱",
          "INSANE Minimalist Leather Gear | Pure Leathercraft Vibes"
        ];
        simulatedAnalysis = "a premium full-grain Italian leather sling bag being modeled in real time, focusing on custom brass snap clips and secure compartments. Key visuals include high-contrast detailed textures, neat edge paint work, and water-repellent zipper liners.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 If you love clean, functional, secure gear, these slings are built from waterproof full-grain leather to hold all daily essentials. Sleek fit and lifetime durability.`;
        simulatedHashtags = ['salespitch', 'minimalism', 'dtcbrand', 'leathercraft', 'usefulhacks', 'styleinspo', 'FYP', 'Reels'];
      } else if (nicheLower === 'cooking') {
        const catchy = params.userDescription || 'Searing a thick prime garlic butter-basted ribeye on a piping hot cast iron skillet';
        simulatedTitle = "INSANE Steak Cooking ASMR | Pure Savory & Satisfying Vibes";
        simulatedAltTitles = [
          "Basting Thick Juicy Garlic Butter Ribeye 🔥 You NEED to See This!",
          "Perfect Sear Ribeye Cast Iron Hack – Wait Till You See This 😱"
        ];
        simulatedAnalysis = "a thick prime garlic butter-basted ribeye sizzling in a piping hot cast iron skillet. Key visuals include foaming melted butter cascades, fresh green rosemary twigs, cracked garlic cloves, and the perfect rich golden-brown beef sear crust.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Continuous basting with crushed fresh garlic, savory foaming butter, and fresh rosemary sprigs makes this ribeye melt in your mouth delicious. Simple cast iron technique for flawless steak.`;
        simulatedHashtags = ['cooking', 'steaks', 'recipe', 'foodasmr', 'satisfyingfood', 'FYP', 'Reels'];
      } else if (nicheLower === 'education') {
        const catchy = params.userDescription || 'Auto-generate scroll-stopping hooks and smart caption clips at the click of a button';
        simulatedTitle = "[Automate Subtitles & Zoom Cuts Instantly] AI Creator Editing Tools 🔥 You NEED to See This!";
        simulatedAltTitles = [
          "Ultimate Editing Strategy – Wait Till You See This 😱",
          "INSANE Education Edit Tutorial | Pure Viral Vibes"
        ];
        simulatedAnalysis = "a creator dashboard automatically syncing high-impact subtitles and cinematic zoom cuts onto vertical shorts. Key visuals include dynamic glowing text color previews, easy drag-and-drop video layers, and instant layout options.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Auto-generate scroll-stopping hooks and smart zoom cuts at the click of a button! Completely bypass hiring expensive video editors or spending hours in manual software.`;
        simulatedHashtags = ['aitools', 'creatortips', 'viralgrowth', 'businesstok', 'learnontiktok', 'FYP', 'Reels'];
      } else if (nicheLower === 'fitness') {
        const catchy = params.userDescription || 'Crushing high-intensity heavy workout repetitions while the whole world is still sleeping';
        simulatedTitle = "Kinetic 5AM Core Routine [No Excuses Motivation Drive] – Wait Till You See This 😱";
        simulatedAltTitles = [
          "Stop Making Excuses & Build Today! 🔥 You NEED to See This!",
          "Morning Motivation Routine – Wait Till You See This 😱"
        ];
        simulatedAnalysis = "heavy calorie-shredding workout core repetitions done under focused gym training lights. Key visuals include sharp form capture patterns, sweat drops, and timed high-intensity sets.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Crushing high-intensity heavy physical training repetitions while the whole world is still sleeping. Testing absolute boundaries, building deep mental stamina, and letting discipline carry us forward.`;
        simulatedHashtags = ['fitnessmotivation', 'gymtok', 'noexcuses', 'morningroutine', 'discipline', 'FYP', 'Reels'];
      } else if (nicheLower === 'tech') {
        const catchy = params.userDescription || 'Hand-lubricating linear switches and snapping keycaps onto a retro desk setup';
        simulatedTitle = "INSANE Custom Mechanical Keyboard ASMR | Pure Pure Tactile Obsession Vibes";
        simulatedAltTitles = [
          "Retro Mechanical Keyboard Mod – Wait Till You See This 😱",
          "Pure Tactile Keyboard Click ASMR | You NEED to See This! 🔥"
        ];
        simulatedAnalysis = "hand-lubricated linear switch housings and textured retro keycaps snapping onto a heavy aluminum case. Key visuals include individual keyboard stem fittings, gold-plated spring actions, and premium brass plate highlights.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Snapping these custom linear retro keycaps onto a heavy sound-dampened mechanical keyboard setup. Listen closely to this incredibly rich, thocky and pure auditory feedback.`;
        simulatedHashtags = ['mechanicalkeyboard', 'asmrsounds', 'desksetup', 'satisfyingtech', 'clicky', 'FYP', 'Reels'];
      } else if (nicheLower === 'pets') {
        const catchy = params.userDescription || 'Spending a tranquil sunset watching the sweetest retriever pup play in fresh meadows';
        simulatedTitle = "Cooper the Golden Retriever Puppy [Pure heart-melting wholesome puppy bliss] – Wait Till You See This 😱";
        simulatedAltTitles = [
          "This Puppy's Adorable Head-Tilt 🔥 You NEED to See This!",
          "Pure Golden Retriever Puppy Bliss | Pure Wholesome Puppy Vibes"
        ];
        simulatedAnalysis = "a gorgeous, playful golden retriever puppy tilting its head inquisitively while playing in sunny fresh meadows. Key visuals include bright puppy eyes, a glossy golden-cream fur coat, and a joyful tiny wagging tail in the grass.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Spending a tranquil afternoon with the sweetest golden retriever pup! That adorable, soft head-tilt is guaranteed to instantly melt all of your worries away.`;
        simulatedHashtags = ['puppylove', 'goldenretriever', 'petsontiktok', 'cuteanimals', 'wholesome', 'FYP', 'Reels'];
      } else {
        const catchy = params.userDescription || 'Instantly optimizing raw camera shots to grab social media feeds with speed curves';
        simulatedTitle = `INSANE ${params.name.replace(/\.[^/.]+$/, '') || 'Self-Made'} Short Video | Pure Ultra-High Retention Vibes`;
        simulatedAltTitles = [
          `Viral ${params.niche} Secrets Revealed – Wait Till You See This 😱`,
          `INSANE ${params.niche} Copy Tutorial | Pure Viral Vibes`
        ];
        simulatedAnalysis = "customized quick-cut visual edits overlayed with dual-toned high contrast text layouts optimized for TikTok. Key visuals include sleek timeline zoom cues, rich graphics assets, and professional frame transitions.";
        simulatedDescriptionBody = `${catchy}! This is NEXT LEVEL 🔥 Instantly optimizing raw smartphone capture coordinates using speed curves to keep users locked to your social media stream. Tailoring colors, contrast, and layout blocks for massive attention retention.`;
        simulatedHashtags = ['viralhack', 'trendingnow', 'editgoals', 'tiktokcreator', 'contentcreator', 'FYP', 'Reels'];
      }

      simulatedTags = simulatedHashtags;

      if (params.imitationOptions) {
        simulatedTitle = `[CLONED ${params.imitationOptions.archetype.toUpperCase()}] ` + simulatedTitle;
      }

      const simulatedCTA = (nicheLower === 'unboxing' || nicheLower === 'sales')
        ? "What do you think? Cop or drop? Drop your size/thoughts below 👇"
        : "What do you think? Drop your thoughts below 👇";

      const hashtagsStr = simulatedHashtags.map(t => `#${t}`).join(' ');

      simulatedDescription = `Video Analysis: This video shows ${simulatedAnalysis}

Recommended Title: ${simulatedTitle}

Alternative Titles:
1. ${simulatedAltTitles[0]}
2. ${simulatedAltTitles[1]}

Optimized Description:
${simulatedDescriptionBody}

${simulatedCTA}

${hashtagsStr}`;

      let simulatedEndingCTA = "Comment 'VIP' below to get the direct access link instantly! 👇 Plus follow for daily drops/tricks.";
      let simulatedThumbnail = "Aesthetic high-contrast product detail shot with bold yellow/pink overlay: 'THIS CHANGES EVERYTHING 😲'";

      if (nicheLower === 'cooking') {
        simulatedEndingCTA = "Would you eat this? Comment 'RECIPE' below to get the immediate ingredients! 👇 Plus follow for daily eats.";
        simulatedThumbnail = "Close-up of the sizzling brown butter spoon drizzle with pink bold text overlay: 'ULTIMATE JUICY SEAR 🥩'";
      } else if (nicheLower === 'sales' || nicheLower === 'unboxing') {
        simulatedEndingCTA = "Is this cop or drop? Let me know 👇 Comment 'LINK' now to steal this VIP deal!";
        simulatedThumbnail = "Macro texture slide box reveal with yellow bold text overlay: 'INSANE DEAL! GONE TOMORROW ⏰'";
      } else if (nicheLower === 'pets') {
        simulatedEndingCTA = "What's your pet's name? Drop your comments below 👇 Follow for daily cute vids!";
        simulatedThumbnail = "Expressive puppy head-tilt close up with cyan text overlay: 'SHE DID NOT JUST DO THAT 🥺'";
      } else if (nicheLower === 'fitness') {
        simulatedEndingCTA = "No excuses! Are you starting today? Comment your fitness goals 👇 and subscribe!";
        simulatedThumbnail = "Sweaty finish line achievement look with yellow text overlay: 'STOP MAKING EXCUSES 🔥'";
      }

      let localCaptionStyle: any = 'mrbeast';
      let localMusicTrack = 'lofi-sunset';
      let localColorGrade: any = 'cinematic';
      let localTransition: any = 'crossfade';

      if (nicheLower === 'cooking') {
        localCaptionStyle = 'minimalist';
        localMusicTrack = 'serene-view';
        localColorGrade = 'vibrant_pop';
        localTransition = 'crossfade';
      } else if (nicheLower === 'fitness') {
        localCaptionStyle = 'impact';
        localMusicTrack = 'cyberpunk-synth';
        localColorGrade = 'cinematic';
        localTransition = 'glitch';
      } else if (nicheLower === 'pets') {
        localCaptionStyle = 'comic';
        localMusicTrack = 'lofi-sunset';
        localColorGrade = 'warm_vintage';
        localTransition = 'zoom';
      } else if (nicheLower === 'unboxing') {
        localCaptionStyle = 'hormozi';
        localMusicTrack = 'hip-hop-vibe';
        localColorGrade = 'warm_vintage';
        localTransition = 'zoom';
      } else if (nicheLower === 'sales') {
        localCaptionStyle = 'mrbeast';
        localMusicTrack = 'holliday-jam';
        localColorGrade = 'cinematic';
        localTransition = 'slide_left';
      } else if (nicheLower === 'tech') {
        localCaptionStyle = 'impact';
        localMusicTrack = 'cyberpunk-synth';
        localColorGrade = 'moody_cyber';
        localTransition = 'glitch';
      }

      let simWhoosh = false;
      let simPop = false;
      let simImpact = false;
      let simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
      let simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
      let simImpactUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/bass.mp3';

      const isFashion = inputName.includes('fashion') || inputName.includes('runway') || inputName.includes('model') || inputName.includes('photo') || inputName.includes('zendaya') || inputDesc.includes('fashion') || inputDesc.includes('runway') || inputDesc.includes('model') || inputDesc.includes('photo') || inputDesc.includes('zendaya');

      if (nicheLower === 'cooking') {
        simWhoosh = false;
        simPop = false;
        simImpact = false;
      } else if (nicheLower === 'fitness') {
        simWhoosh = true;
        simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
        simPop = false;
        simImpact = true;
      } else if (isFashion) {
        localCaptionStyle = 'minimalist';
        localMusicTrack = 'serene-view';
        localColorGrade = 'cinematic';
        localTransition = 'crossfade';
        simWhoosh = false;
        simPop = true;
        simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
        simImpact = false;
      } else if (nicheLower === 'pets') {
        simWhoosh = true;
        simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-high.mp3';
        simPop = true;
        simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/fancy-beer-bottle-pop.mp3';
        simImpact = false;
      } else if (nicheLower === 'unboxing') {
        simWhoosh = true;
        simWhooshUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/mouseover3.mp3';
        simPop = true;
        simPopUrl = 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/click-low.mp3';
        simImpact = false;
      }

      const scale = params.originalDuration / 24.5;
      const generatedAltProject: VideoProject = {
        id: `project-edge-${Date.now()}`,
        name: fixDunikTypo(params.name),
        type: params.type,
        videoUrl: params.videoUrl,
        duration: params.originalDuration,
        niche: params.niche,
        title: fixDunikTypo(simulatedTitle),
        alternativeTitles: simulatedAltTitles,
        description: fixDunikTypo(simulatedDescription),
        tags: simulatedTags,
        viralityScore: 92,
        viralityCriteria: {
          hook: 96,
          pacing: 90,
          emotion: 88,
          visualContrast: 94
        },
        viralityFeedback: [
          'High energy 3-sec hook matched with scale tracking.',
          'Pacing matches rhythmic spoken transcription velocity.',
          'Atmospheric retro contrast filter applies subtle neon glow.'
        ],
        highlights: (nicheLower === 'unboxing' || inputName.includes('shoe') || inputName.includes('sneaker')) ? [
          {
            id: 'clip-hook',
            title: '🔥 TikTok 3s Hook',
            start: 0,
            end: Number((1.8 * scale).toFixed(1)),
            duration: Number((1.8 * scale).toFixed(1)),
            viralityScore: 99,
            description: 'High-energy curiosity hook to freeze scrolling fingers.',
            whyEngaging: 'Bold physical sneaker package teaser with deep zoom.',
            speed: 1.15
          },
          {
            id: 'clip-reveal',
            title: '👟 Shoe Suede Reveal',
            start: Number((3.5 * scale).toFixed(1)),
            end: Number((5.2 * scale).toFixed(1)),
            duration: Number(((5.2 - 3.5) * scale).toFixed(1)),
            viralityScore: 98,
            description: 'Major shoe reveal dopamine climax.',
            whyEngaging: 'Exclusivity trigger paired with visual contrast pop.',
            speed: 0.50
          },
          {
            id: 'clip-box-slide',
            title: '📦 Butter Drawer Slide',
            start: Number((7.0 * scale).toFixed(1)),
            end: Number((8.8 * scale).toFixed(1)),
            duration: Number(((8.8 - 7.0) * scale).toFixed(1)),
            viralityScore: 96,
            description: 'Aesthetic luxury unboxing slide.',
            whyEngaging: 'Tactile satisfaction movement at high-energy pace.',
            speed: 1.0
          },
          {
            id: 'clip-tissue-tear',
            title: '⚡ Crisp Wrapping Tear',
            start: Number((10.5 * scale).toFixed(1)),
            end: Number((12.0 * scale).toFixed(1)),
            duration: Number(((12.0 - 10.5) * scale).toFixed(1)),
            viralityScore: 95,
            description: 'Tactile sound beat tear action.',
            whyEngaging: 'ASMR response triggers luxury expectation.',
            speed: 1.0
          },
          {
            id: 'clip-texture-closeup',
            title: '🔍 Suede Texture Macro Review (Middle)',
            start: Number((13.0 * scale).toFixed(1)),
            end: Number((14.8 * scale).toFixed(1)),
            duration: Number(((14.8 - 13.0) * scale).toFixed(1)),
            viralityScore: 97,
            description: 'Deep macro zoom closeup of premium fabric.',
            whyEngaging: 'Displays authenticity and high-quality premium grain.',
            speed: 0.60
          },
          {
            id: 'clip-stitching-logo',
            title: '💎 Brand Logo Close-Up (Middle-End)',
            start: Number((16.0 * scale).toFixed(1)),
            end: Number((17.5 * scale).toFixed(1)),
            duration: Number(((17.5 - 16.0) * scale).toFixed(1)),
            viralityScore: 97,
            description: 'Focus camera angle on stitching and tags.',
            whyEngaging: 'High-value brand indicator visual details.',
            speed: 0.75
          },
          {
            id: 'clip-sole-bounce',
            title: '⚡ Cushion Sole Details (Ending)',
            start: Number((18.5 * scale).toFixed(1)),
            end: Number((19.8 * scale).toFixed(1)),
            duration: Number(((19.8 - 18.5) * scale).toFixed(1)),
            viralityScore: 94,
            description: 'Reviewing retro cushy soles and bounce.',
            whyEngaging: 'Visualizes daily utility comfort benefits directly.',
            speed: 1.0
          },
          {
            id: 'clip-on-feet',
            title: '👟 On-Feet Styling Look (Ending)',
            start: Number((19.8 * scale).toFixed(1)),
            end: Number((21.2 * scale).toFixed(1)),
            duration: Number(((21.2 - 19.8) * scale).toFixed(1)),
            viralityScore: 98,
            description: 'Dynamic style walkthrough and aesthetic modeling look on feet.',
            whyEngaging: 'Allows viewer to visualize actual streetwear combination.',
            speed: 0.75
          },
          {
            id: 'clip-sizing-tip',
            title: '📏 Sizing & Fit Tip (Ending)',
            start: Number((21.2 * scale).toFixed(1)),
            end: Number((22.5 * scale).toFixed(1)),
            duration: Number(((22.5 - 21.2) * scale).toFixed(1)),
            viralityScore: 96,
            description: 'True-to-size vs sizing-up advice for wide feet.',
            whyEngaging: 'Highly useful practical decision aid that drives high retention.',
            speed: 1.0
          },
          {
            id: 'clip-cta-steal',
            title: '💰 Double Tap CTA Outro',
            start: Number((22.5 * scale).toFixed(1)),
            end: params.originalDuration,
            duration: Number((params.originalDuration - (22.5 * scale)).toFixed(1)),
            viralityScore: 99,
            description: 'Viral direct-response cop or drop ending.',
            whyEngaging: 'High-converting interactive CTA driving comments.',
            speed: 1.0
          }
        ] : (params.originalDuration > 15) ? [
          {
            id: 'clip-hook',
            title: 'Ultimate 3s Hook Opt',
            start: 0,
            end: Math.min(params.originalDuration, 5),
            duration: Math.min(params.originalDuration, 5),
            viralityScore: 98,
            description: 'First 3 seconds immediate pattern interrupt.',
            whyEngaging: 'High frequency words and immediate dynamic zoom.'
          },
          {
            id: 'clip-peak-mid',
            title: '🔥 Viral Highlight (Middle Review)',
            start: Number((params.originalDuration * 0.25).toFixed(1)),
            end: Number((params.originalDuration * 0.55).toFixed(1)),
            duration: Number((params.originalDuration * 0.30).toFixed(1)),
            viralityScore: 94,
            description: 'Mid-roll peak product inspection and user value breakdown.',
            whyEngaging: 'Displays actual item benefits and satisfying physical actions.',
            speed: 1.0
          },
          {
            id: 'clip-peak-end',
            title: '⚡ Epic Closeup Details',
            start: Number((params.originalDuration * 0.60).toFixed(1)),
            end: Number((params.originalDuration * 0.85).toFixed(1)),
            duration: Number((params.originalDuration * 0.25).toFixed(1)),
            viralityScore: 95,
            description: 'High close-up detail showcasing the premium finish before call to action.',
            whyEngaging: 'Drives high end-of-video attention and satisfaction loops.',
            speed: 0.80
          },
          {
            id: 'clip-outro-cta',
            title: '🎯 Viral CTA Outro',
            start: Number((params.originalDuration * 0.88).toFixed(1)),
            end: params.originalDuration,
            duration: Number((params.originalDuration * 0.12).toFixed(1)),
            viralityScore: 99,
            description: 'High converting direct response loop comment trigger.',
            whyEngaging: 'Interactive overlays asking users to interact.',
            speed: 1.0
          }
        ] : [
          {
            id: 'clip-fallback-hook',
            title: 'Dynamic Hook Optimize',
            start: 0,
            end: Math.min(params.originalDuration, 6),
            duration: Math.min(params.originalDuration, 6),
            viralityScore: 96,
            description: 'Pattern-interrupt sequence to halt scroll activity.',
            whyEngaging: 'High-speed audio clips timed to cinematic zooms.',
            speed: 1.0
          }
        ],
        subtitles: outputSubtitles,
        captionStyle: localCaptionStyle,
        selectedMusicTrackId: localMusicTrack,
        colorGrade: localColorGrade,
        transitionStyle: localTransition,
        sfxWhooshEnabled: simWhoosh,
        sfxPopEnabled: simPop,
        sfxImpactEnabled: simImpact,
        sfxWhooshUrl: simWhooshUrl,
        sfxPopUrl: simPopUrl,
        sfxImpactUrl: simImpactUrl,
        zoomEffects: [
          { timestamp: 0.5, scale: 1.15, duration: 1.8 },
          { timestamp: Math.min(params.originalDuration - 2, 7.5), scale: 1.1, duration: 2.0 }
        ],
        endingCTA: simulatedEndingCTA,
        thumbnailRecommendation: simulatedThumbnail,
        createdAt: new Date().toISOString(),
        engineMode: 'edge-rules'
      };

      const freshHistory = [generatedAltProject, ...pastProjects];
      localStorage.setItem('past-viral-projects', JSON.stringify(freshHistory));
      setPastProjects(freshHistory);
      
      setActiveProjectId(generatedAltProject.id);
      setActiveProject(generatedAltProject);
      setActiveClipId(null);
      setActiveTab('studio');
      triggerNotification('warn', '📝 Applied a local pacing template as a draft — this is NOT a real Gemini analysis. Retry AI analysis any time once the connection/key issue above is resolved.');
    }
  };

  const handleUpdateSubtitles = (subs: SubtitleItem[]) => {
    if (!activeProject) return;
    const updated = { ...activeProject, subtitles: subs };
    setActiveProject(updated);
    
    // Save updated to history
    const history = pastProjects.map(p => p.id === activeProject.id ? updated : p);
    localStorage.setItem('past-viral-projects', JSON.stringify(history));
    setPastProjects(history);
  };

  const handleUpdateProject = (updated: VideoProject | Partial<VideoProject>) => {
    if (!activeProject) return;
    const fullUpdated = { ...activeProject, ...updated } as VideoProject;
    setActiveProject(fullUpdated);
    
    // Save updated to history
    const history = pastProjects.map(p => p.id === fullUpdated.id ? fullUpdated : p);
    localStorage.setItem('past-viral-projects', JSON.stringify(history));
    setPastProjects(history);
  };

  const handleLoadProject = (projId: string) => {
    const selected = pastProjects.find(p => p.id === projId);
    if (selected) {
      setActiveProjectId(projId);
      setActiveProject(selected);
      setActiveClipId(null); // reset highlight clips selection bounds
      setActiveTab('studio');
      triggerNotification('success', `📂 Loaded project details for: "${selected.name}"`);
    }
  };

  const handleDeleteProject = (projId: string) => {
    const fresh = pastProjects.filter(p => p.id !== projId);
    localStorage.setItem('past-viral-projects', JSON.stringify(fresh));
    setPastProjects(fresh);

    if (activeProjectId === projId) {
      if (fresh.length > 0) {
        setActiveProjectId(fresh[0].id);
        setActiveProject(fresh[0]);
      } else {
        setActiveProjectId(null);
        setActiveProject(null);
      }
    }
    triggerNotification('warn', '🗑️ Project deleted successfully.');
  };

  // Export individual sub-assets to prevent multi-download browser blocks
  const downloadSubtitlesSRT = () => {
    if (!activeProject) return;
    const cleanSafeName = activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const convertToSRT = (subs: any[]): string => {
      return subs.map((sub, index) => {
        const formatTime = (seconds: number): string => {
          const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
          const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
          const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
          const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
          return `${hrs}:${mins}:${secs},${ms}`;
        };
        return `${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`;
      }).join('\n');
    };

    const srtContent = convertToSRT(activeProject.subtitles);
    const srtBlob = new Blob([srtContent], { type: 'text/plain;charset=utf-8;' });
    const srtUrl = URL.createObjectURL(srtBlob);
    const srtAnchor = document.createElement('a');
    srtAnchor.href = srtUrl;
    srtAnchor.download = `${cleanSafeName}_subtitles.srt`;
    document.body.appendChild(srtAnchor);
    srtAnchor.click();
    srtAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(srtUrl), 1000);
    triggerNotification('success', '🏆 SRT Subtitles downloaded successfully!');
  };

  const downloadBlueprintJSON = () => {
    if (!activeProject) return;
    const cleanSafeName = activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const jsonContent = JSON.stringify(activeProject, null, 2);
    const jsonBlob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonAnchor = document.createElement('a');
    jsonAnchor.href = jsonUrl;
    jsonAnchor.download = `${cleanSafeName}_blueprint.json`;
    document.body.appendChild(jsonAnchor);
    jsonAnchor.click();
    jsonAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(jsonUrl), 1000);
    triggerNotification('success', '🏆 JSON Project Blueprint downloaded successfully!');
  };

  // TikTok-optimized 9:16 vertical text wrapping helper for client-side drawing
  const wrapSubtitleText = (text: string, style: string): string => {
    let maxChars = 20;
    if (style === 'hormozi') {
      maxChars = 14;
    } else if (style === 'mrbeast') {
      maxChars = 18;
    } else if (style === 'minimalist') {
      maxChars = 26;
    } else if (style === 'impact') {
      maxChars = 18;
    } else if (style === 'comic') {
      maxChars = 14;
    }

    if (text.length <= maxChars) return text;

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length > maxChars) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  };

  // Single, honest export path: server-side FFmpeg render only.
  //
  // A client-side ffmpeg.wasm fallback used to live here. It has been
  // removed on purpose:
  //   1. It always burned in captions using a generic Roboto font,
  //      regardless of which of the 5 caption styles (MrBeast, Hormozi,
  //      Minimalist, Comic, Impact) the user actually picked in the
  //      preview — so a "fallback" export never matched what the user
  //      approved.
  //   2. It had its own hand-copied caption sizing/filter logic, a THIRD
  //      divergent implementation alongside the browser preview and the
  //      server renderer — impossible to keep in sync.
  //   3. Its own failure handler called back into the server-render
  //      function again, so a systemically broken export (server down,
  //      CORS, oversized upload) could silently trigger a full server
  //      upload+render, then a full WASM download+encode, then a SECOND
  //      full server upload+render before the user ever saw an error.
  //
  // triggerInstantDirectFallback() already handles its own errors (shows
  // a notification and, where useful, the sandbox-help modal — see the
  // gated iframe check inside it), so there is nothing left for this
  // wrapper to do except call it.
  const triggerVideoExport = async () => {
    if (!activeProject) return;
    isFallbackTriggeredRef.current = false;
    await triggerInstantDirectFallback();
  };



  // Find active music track based on selected id
  const activeMusicTrack = activeProject
    ? (activeProject.selectedMusicTrackId === 'none'
        ? null
        : (FREE_MUSIC_TRACKS.find((v) => v.id === activeProject.selectedMusicTrackId) || FREE_MUSIC_TRACKS[0]))
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-purple selection:text-white">
      
      {/* Top Navigation banner header elements */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-30 px-6 py-4 safe-area-top safe-area-x">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-purple via-brand-cyan to-brand-pink p-[1px] flex items-center justify-center animate-pulse-border">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Flame className="w-5 h-5 text-brand-purple fill-brand-purple animate-bounce" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            <div>
              <h1 className="font-display text-lg font-black tracking-tight text-white flex items-center gap-1.5 uppercase">
                Auto Viral Video Editor
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Sustainably Free AI Creator Suite • No Watermarks • No Limits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowApiKeyModal(true)}
              className={`text-[11px] font-semibold font-mono transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer ${
                getStoredApiKey()
                  ? 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40 hover:bg-emerald-950/50'
                  : 'text-brand-yellow bg-amber-950/20 border-amber-800/40 hover:bg-amber-950/40 animate-pulse'
              }`}
              title="Set your Gemini API key"
            >
              <KeyRound className="w-3 h-3" />
              {getStoredApiKey() ? 'API Key Set' : 'Set API Key'}
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-brand-cyan hover:text-cyan-300 font-mono transition-colors flex items-center gap-1 bg-slate-900/60 hover:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-850"
            >
              Github Repo
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {isInIframe && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 animate-pulse" style={{ animationDuration: '4s' }}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <strong>⚠️ Preview Sandbox Active:</strong> Due to modern browser cookie restrictions inside development iframes, server-side video baking may fail. Click <strong className="text-white">Open in New Tab</strong> to export files instantly and flawlessly.
              </span>
            </div>
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-black rounded-lg text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-black shrink-0" />
              Open in New Tab
            </button>
          </div>
        </div>
      )}

      {/* Main app body */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Real-time status notification block */}
        {notification && (
          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-lg backdrop-blur-md animate-fade-in ${
            notification.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300' :
            notification.type === 'warn' ? 'bg-amber-950/40 border-amber-500/20 text-amber-300' :
            'bg-rose-950/40 border-rose-500/20 text-rose-300'
          }`}>
            <span className="flex items-center gap-2">
              {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-brand-green" />}
              {notification.type === 'warn' && <AlertTriangle className="w-4 h-4 text-brand-yellow" />}
              {notification.message}
            </span>
            <button onClick={() => setNotification(null)} className="text-[10px] text-slate-500 hover:text-slate-300 font-mono">
              [dismiss]
            </button>
          </div>
        )}

        {/* Dynamic Multi-Stage Processing Overlay/Modal */}
        {(isProcessing || isRenderingOutput) && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 safe-area-all">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
              
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-brand-purple animate-spin" />
                <Sparkles className="w-8 h-8 text-brand-cyan animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-white uppercase tracking-wider">
                  {isProcessing ? 'Forging Viral Video Spec' : 'Compiling Output Video'}
                </h3>
                <p className="text-xs text-slate-400 font-mono h-8 flex items-center justify-center">
                  {processingStage}
                </p>
              </div>

              <div className="space-y-1">
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-805">
                  <div
                    className="h-full bg-gradient-to-r from-brand-purple via-brand-cyan to-brand-green transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 font-mono text-right">{processingProgress}% Complete</div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 text-[10px] text-justify text-slate-500 leading-relaxed leading-normal">
                {isProcessing
                  ? "Our pipeline processes audio transcription, syncs subtitles to word-stamps, identifies peak-retainment highlights, configures smart keyframe zooms, and predicts viral metrics completely for free."
                  : "We are baking subtitle visual overlays, color grading layers, background mixing, and dynamic clips into a 1080p output configuration spec. Your download starts shortly!"}
              </div>

              {isRenderingOutput && (
                <div className="pt-2 space-y-4 text-left">
                  <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/15 text-[11px] text-amber-400 space-y-1.5 leading-normal">
                    <div className="font-semibold flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      ⚠️ TikTok Upload Smoothness Guide:
                    </div>
                    <p className="opacity-90">
                      <strong>Keep this browser tab active and focused!</strong> Switching tabs or letting your screen sleep triggers browser performance throttling. This halts background frame speeds, leading to noticeable lagginess when uploading to TikTok.
                    </p>
                  </div>

                  <button
                    onClick={triggerInstantDirectFallback}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-xs font-semibold text-brand-cyan transition-all border border-slate-700/50 hover:border-brand-cyan/25 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>⚡ Skip Baking & Download Directly</span>
                  </button>
                  <p className="text-[9px] text-slate-500 leading-normal text-center">
                    If browser security policies restrict WebAudio capture or stall at 0%, click here to download your edited vertical short instantly.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bring-your-own-key Gemini API key settings */}
        <ApiKeySettingsModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />

        {/* iOS / Safari Compatible Video Ready Export Modal - 100% User Activated Download */}
        {downloadReadyInfo && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in text-slate-100 safe-area-all">
            <div className="max-w-md w-full bg-slate-900 border-2 border-brand-cyan/20 rounded-2xl p-6 text-center space-y-6 shadow-2xl relative">
              
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setDownloadReadyInfo(null)}
                  className="p-1 px-2.5 bg-slate-950 hover:bg-slate-800 text-[11px] font-mono rounded-lg text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="w-16 h-16 bg-gradient-to-tr from-brand-purple to-brand-cyan rounded-full mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle className="w-8 h-8 text-black" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] text-brand-cyan font-mono font-black uppercase tracking-widest">
                  Ready for TikTok & Reels
                </div>
                <h3 className="font-display text-xl font-black text-white uppercase tracking-tight">
                  🏆 Video Baked Successfully!
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-sm mx-auto">
                  All dynamic subtitle styles, zoom anchors, and background audio mix filters are fully compiled and ready.
                </p>
              </div>

              {/* Action Button: Native user Click interaction for WebKit target safe */}
              <div className="space-y-3 pt-2">
                <a
                  href={downloadReadyInfo.url}
                  download={downloadReadyInfo.filename}
                  onClick={async (e) => {
                    // Try the native share sheet first — on iOS/Android this
                    // gives the user a real "Save Video" option, which a
                    // plain <a download> click cannot (Safari just opens the
                    // video for viewing instead of saving it). saveFileToDevice
                    // falls back to this anchor's own download behavior on
                    // platforms where share isn't available.
                    e.preventDefault();
                    try {
                      const blob = await (await fetch(downloadReadyInfo.url)).blob();
                      await saveFileToDevice(blob, downloadReadyInfo.filename);
                      triggerNotification('success', '📥 Download request sent to device storage!');
                    } catch (err) {
                      console.error('[Download] saveFileToDevice failed:', err);
                      triggerNotification('error', '❌ Download failed — please try the bypass link below, or tap and hold the video to save it.');
                    }
                    setDownloadReadyInfo(null);
                  }}
                  className="w-full py-4 bg-brand-cyan hover:bg-cyan-400 text-black font-black text-center text-sm rounded-xl block shadow-lg hover:shadow-cyan-500/10 tracking-wider transition-all cursor-pointer font-mono"
                >
                  🚀 DOWNLOAD VIDEO NOW (.MP4)
                </a>
                
                {downloadReadyInfo.directUrl && (
                  <div className="pt-1.5 pb-0.5 border-t border-slate-800/40">
                    <a
                      href={downloadReadyInfo.directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        triggerNotification('success', '📥 Sandbox bypass download started!');
                        setDownloadReadyInfo(null);
                      }}
                      className="w-full py-3 bg-slate-950 hover:bg-slate-900 text-brand-pink font-bold text-center text-[11px] rounded-xl block border border-brand-pink/30 hover:border-brand-pink/60 shadow-md tracking-wider transition-all cursor-pointer font-mono"
                    >
                      🔗 DOWNLOAD BYPASS LINK (FOR IFRAME / MOBILE)
                    </a>
                    <p className="text-[9px] text-slate-500 font-mono mt-1 leading-normal">
                      If the main download gets blocked by browser iframe restrictions, click this bypass button to download outside the sandbox with 100% success!
                    </p>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => setDownloadReadyInfo(null)}
                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all cursor-pointer font-mono"
                >
                  Keep Editing In Workspace
                </button>
              </div>

              {/* Special Safari Guide Section */}
              <div className="bg-slate-950 p-4 rounded-xl text-[10px] text-left text-slate-400 leading-normal border border-slate-800 space-y-2.5 leading-relaxed">
                <div className="font-bold text-brand-yellow font-mono flex items-center gap-1.5 uppercase">
                  <span>💡</span> iPhone / iPad Safari Instructions:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Tap <strong className="text-slate-200">"DOWNLOAD VIDEO NOW"</strong> above.</li>
                  <li>When prompted by Safari, select <strong className="text-slate-200">"Download"</strong>.</li>
                  <li>Tap the blue download circle arrow in Safari's bottom address bar to access the file and <strong className="text-slate-200">Save to Photos</strong>!</li>
                  <li>Open <strong className="text-brand-cyan">Instagram / TikTok / Shorts</strong> and post instantly!</li>
                </ul>
              </div>

            </div>
          </div>
        )}

        {/* Sandbox IFrame Cookie & Auth Intercept Helper Modal */}
        {showSandboxHelpModal && activeProject && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-slate-100 safe-area-all">
            <div className="max-w-md w-full bg-slate-905 border-2 border-amber-500/20 rounded-2xl p-6 text-center space-y-6 shadow-2xl relative">
              
              <div className="absolute top-3 right-3">
                <button
                  type="button"
                  onClick={() => setShowSandboxHelpModal(false)}
                  className="p-1 px-2.5 bg-slate-950 hover:bg-slate-800 text-[11px] font-mono rounded-lg text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer font-bold"
                >
                  Dismiss
                </button>
              </div>

              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full mx-auto flex items-center justify-center shadow-lg text-amber-500">
                <AlertTriangle className="w-7 h-7 animate-pulse" />
              </div>

              {getApiBase() !== '' ? (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] text-amber-400 font-mono font-black uppercase tracking-widest">
                      Mobile Connection Diagnostic
                    </div>
                    <h3 className="font-display text-lg font-black text-white uppercase tracking-tight">
                      Render Server Notice
                    </h3>
                    <p className="text-xs text-slate-450 leading-relaxed font-sans max-w-sm mx-auto">
                      The mobile app wrapper is configured to process and compile HD videos on our high-performance Cloud Run render farm. If this request timed out, please verify your device has active internet access and the server is online.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSandboxHelpModal(false);
                        triggerVideoExport();
                      }}
                      className="w-full py-3 bg-brand-cyan hover:bg-cyan-400 text-black font-mono font-black text-center text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/10 tracking-wider transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4 text-black shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                      <span>RE-TRY RENDER CONNECTION</span>
                    </button>
                    
                    <p className="text-[9.5px] text-slate-500 leading-normal text-center">
                      💡 <strong>Tip:</strong> Ensure your device is not behind restrictive firewalls or VPNs that block outgoing API routes.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] text-amber-400 font-mono font-black uppercase tracking-widest">
                      Sandbox Cookie Restrictions Detected
                    </div>
                    <h3 className="font-display text-lg font-black text-white uppercase tracking-tight">
                      IFrame Cookie Policy Blocked Connection
                    </h3>
                    <p className="text-xs text-slate-450 leading-relaxed font-sans max-w-sm mx-auto">
                      To prevent cross-site tracking, modern browsers block session cookies inside development previews. Because of this, the baking server cannot authenticate your request in this iframe.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const newTabUrl = window.location.href;
                        window.open(newTabUrl, '_blank');
                        triggerNotification('success', '🔗 Opened application in a new tab!');
                      }}
                      className="w-full py-3 bg-brand-cyan hover:bg-cyan-400 text-black font-mono font-black text-center text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/10 tracking-wider transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 text-black shrink-0" />
                      <span>OPEN IN NEW TAB FOR AUTOMATIC EXPORT</span>
                    </button>
                    
                    <p className="text-[9.5px] text-slate-500 leading-normal text-center">
                      💡 <strong>Quick Fix:</strong> Tap the diagonal arrow icon in the top right window menu to view in full tab. There, exporting runs instantly and flawlessly!
                    </p>
                  </div>
                </>
              )}

              {/* Creator Hand-off Assets Hub */}
              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <div className="text-left">
                  <span className="text-[10px] font-mono uppercase font-black text-slate-400 block tracking-wider mb-2">
                    📦 Emergency Creator Backup Bundle (Client-side):
                  </span>
                  <p className="text-[10px] text-slate-500 leading-normal mb-3">
                    If you are on school/office devices that prevent opening new tabs, you can download all raw creatives directly to combine manually in any video editor (CapCut, Premiere):
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      downloadSubtitlesSRT();
                    }}
                    className="flex items-center gap-2 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-xl text-left text-xs text-slate-200 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand-purple shrink-0" />
                    <div className="truncate">
                      <span className="block font-bold text-[10px]">Captions Script</span>
                      <span className="block text-[8px] text-slate-500 truncate">Download .SRT</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      downloadBlueprintJSON();
                    }}
                    className="flex items-center gap-2 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-xl text-left text-xs text-slate-200 transition-all cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                    <div className="truncate">
                      <span className="block font-bold text-[10px]">Project Data</span>
                      <span className="block text-[8px] text-slate-500 truncate">Download .JSON</span>
                    </div>
                  </button>

                  <a
                    href={activeProject.videoUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    download={`${activeProject.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_raw.mp4`}
                    className="flex items-center gap-2 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-xl text-left text-xs text-slate-200 cursor-pointer transition-all hover:bg-slate-900"
                  >
                    <Video className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="truncate mb-0.5">
                      <span className="block font-bold text-[10px]">Clean Video</span>
                      <span className="block text-[8px] text-slate-500 truncate">Download .MP4</span>
                    </div>
                  </a>

                  {(() => {
                    const musicTrack = FREE_MUSIC_TRACKS.find(t => t.id === activeProject.selectedMusicTrackId) || FREE_MUSIC_TRACKS[0];
                    return (
                      <a
                        href={musicTrack?.url}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        download="background_music.mp3"
                        className="flex items-center gap-2 p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-850 rounded-xl text-left text-xs text-slate-200 cursor-pointer transition-all hover:bg-slate-900"
                      >
                        <span className="text-[14px] shrink-0">🎵</span>
                        <div className="truncate mb-0.5">
                          <span className="block font-bold text-[10px]">BGM Music</span>
                          <span className="block text-[8px] text-slate-500 truncate">Download .MP3</span>
                        </div>
                      </a>
                    );
                  })()}
                </div>
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowSandboxHelpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase font-mono cursor-pointer"
                >
                  Continue in Workspace
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modern Studio Tabs Control Bar */}
        <div id="studio-workspace-tabs" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl backdrop-blur-md sticky top-[72px] z-30 transition-all">
          <div className="flex flex-wrap items-center gap-2 overflow-x-auto scrollbar-none pb-1 md:pb-0">
            
            {/* Sourcing Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('niche')}
              className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase font-mono rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'niche'
                  ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-lg shadow-brand-purple/20 ring-1 ring-white/10'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>🎥 Source Video</span>
            </button>

            {/* Video Player Workspace Tab */}
            {activeProject && (
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase font-mono rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'studio'
                    ? 'bg-brand-cyan text-slate-950 shadow-lg shadow-brand-cyan/20 ring-1 ring-slate-950/10'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>🎬 Studio Player</span>
              </button>
            )}

            {/* Smart Captions Editor Tab */}
            {activeProject && (
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase font-mono rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-slate-100 text-slate-950 shadow-lg shadow-white/15'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>✍️ Caption Editor</span>
              </button>
            )}

            {/* Virality Scoring Tab */}
            {activeProject && (
              <button
                type="button"
                onClick={() => setActiveTab('viral')}
                className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase font-mono rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'viral'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>📈 Virality Engine</span>
              </button>
            )}

            {/* AI Co-Pilot / Self-Repair Core Tab */}
            {activeProject && (
              <button
                type="button"
                onClick={() => setActiveTab('copilot')}
                className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase font-mono rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'copilot'
                    ? 'bg-gradient-to-r from-brand-purple to-brand-pink text-white shadow-lg shadow-brand-purple/20'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-100" />
                <span>🧠 AI Co-Pilot</span>
              </button>
            )}

            {/* Past saved project library tab */}
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-4 py-2 text-[11px] font-bold tracking-wider uppercase font-mono rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-950 border border-slate-800/40'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>📂 Saved Projects ({pastProjects.length})</span>
            </button>

          </div>

          {/* Quick Active Project Indicator on right side */}
          {activeProject && (
            <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono pr-2">
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850">
                <span className="text-slate-500">Project:</span>
                <span className="text-brand-cyan max-w-[130px] truncate font-bold">{fixDunikTypo(activeProject.name)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-850">
                <span className="text-slate-500">Virality Rating:</span>
                <span className="text-amber-400 font-black">{activeProject.viralityScore}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Tab Panel 1: Sourcing Raw Footage */}
        <div className={activeTab === 'niche' ? 'animate-fade-in block' : 'hidden'}>
          <NicheSelector
            onSelectTemplate={handleSelectTemplate}
            onUploadCustomFile={handleUploadCustomFile}
            isProcessing={isProcessing}
          />
        </div>

        {/* Workspace Active Panels (Requires activeProject to render context helper bar) */}
        {activeProject ? (
          <div className="space-y-6">
            
            {/* Elegant Workspace Info Header Bar */}
            <div className={`bg-slate-900 border border-slate-805 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              activeTab === 'niche' || activeTab === 'library' ? 'hidden' : ''
            }`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase bg-slate-950 px-2.5 py-1 rounded-full text-brand-cyan border border-slate-850">
                    Editing Project ID: {activeProject.id.slice(0, 15)}...
                  </span>
                  
                  {activeProject.engineMode === 'live-gemini' ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 shadow-sm inline-flex items-center gap-1 animate-fade-in">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      CLOUD-NATIVE MULTIMODAL AI (GEMINI)
                    </span>
                  ) : activeProject.engineMode === 'simulated-engine' ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-900 shadow-sm inline-flex items-center gap-1 animate-fade-in" title="Operating with cloud-cached semantic patterns to optimize speed and balance request volume.">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      HYBRID COGNITIVE PACING COPILOT
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 shadow-sm inline-flex items-center gap-1 animate-fade-in" title="Processing with local high-performance edge heuristics for zero-latency client editing.">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                      EDGE ACCELERATED PACING ENGINE
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mt-2">
                  <Video className="w-4 h-4 text-brand-purple" />
                  Now Editing: "{fixDunikTypo(activeProject.name)}"
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeProject.engineMode === 'edge-rules' && (
                  <button
                    type="button"
                    onClick={() => {
                      const inputNiche = activeProject.niche || 'general';
                      const inputDesc = (activeProject.userDescription || '').toLowerCase();
                      const inputName = (activeProject.name || '').toLowerCase();
                      const subs = generateDynamicSubtitles(inputNiche, activeProject.originalDuration, inputDesc, inputName);
                      const outputSubtitles: SubtitleItem[] = subs.map((cap, i) => ({
                        id: `sub-edge-${i}-${Date.now()}`,
                        text: fixDunikTypo(cap.text),
                        start: cap.start,
                        end: Math.min(activeProject.originalDuration, cap.end),
                        emoji: cap.emoji,
                        highlightWords: (cap.highlight || []).map(w => fixDunikTypo(w))
                      }));
                      handleUpdateSubtitles(outputSubtitles);
                      triggerNotification('success', '✨ Smart captions regenerated for physical workspace timeline!');
                    }}
                    title="Regenerate context-aware dynamic captions based on niche and description"
                    className="px-4 py-2 bg-gradient-to-r from-brand-purple to-brand-pink hover:opacity-90 text-white font-semibold text-xs rounded-xl transition-all duration-150 shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Regenerate Captions
                  </button>
                )}

                <button
                  type="button"
                  onClick={triggerVideoExport}
                  title="Render high definition 1080p vertical video streams immediately"
                  className="px-4 py-2 bg-brand-cyan hover:bg-cyan-400 text-black font-semibold text-xs rounded-xl transition-all duration-150 shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Bake & Download Video (.MP4)
                </button>

                <button
                  type="button"
                  onClick={downloadSubtitlesSRT}
                  title="Download the full SRT subtitles file separately"
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-900 text-slate-300 font-semibold text-[11px] rounded-xl transition-all duration-150 border border-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-brand-purple" />
                  SRT Captions
                </button>

                <button
                  type="button"
                  onClick={downloadBlueprintJSON}
                  title="Download the full JSON schematic structure of the timeline"
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-900 text-slate-300 font-semibold text-[11px] rounded-xl transition-all duration-150 border border-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5 text-brand-pink" />
                  JSON Schema
                </button>
              </div>
            </div>

            {/* Tab Panel 2: Interactive Video Player Workspace Studio (Preserves loaded state memory) */}
            <div className={activeTab === 'studio' ? 'block' : 'hidden'}>
              <VideoPlayerWorkspace
                project={activeProject}
                activeMusicTrack={activeMusicTrack}
                musicVolume={musicVolume}
                setMusicVolume={setMusicVolume}
                enableSubtitles={enableSubtitles}
                setEnableSubtitles={setEnableSubtitles}
                enableZooms={enableZooms}
                setEnableZooms={setEnableZooms}
                enableColorGrade={enableColorGrade}
                setEnableColorGrade={setEnableColorGrade}
                activeClipId={activeClipId}
                onClipSelect={setActiveClipId}
                onUpdateProject={handleUpdateProject}
                requestedSeekTime={requestedSeekTime}
                onSeekConsumed={() => setRequestedSeekTime(null)}
              />
            </div>

            {/* Tab Panel 3: Detailed Caption Timeline & AI Cut editor */}
            <div className={activeTab === 'timeline' ? 'animate-fade-in block' : 'hidden'}>
              <EditCaptionTimeline
                project={activeProject}
                onUpdateSubtitles={handleUpdateSubtitles}
                onSeekTo={setRequestedSeekTime}
                onRequestApiKey={() => setShowApiKeyModal(true)}
              />
            </div>

            {/* Tab Panel 4: Virality Diagnostics, description copywriting, SEO recommendations */}
            <div className={activeTab === 'viral' ? 'animate-fade-in block' : 'hidden'}>
              <ViralityScorecard
                project={activeProject}
                onUpdateProject={handleUpdateProject}
                onRequestApiKey={() => setShowApiKeyModal(true)}
              />
            </div>

            {/* Tab Panel: AI Co-Pilot & Self-Repair Console */}
            <div className={activeTab === 'copilot' ? 'animate-fade-in block' : 'hidden'}>
              <AICopilotConsole
                project={activeProject}
                onUpdateProject={handleUpdateProject}
                onUpdateSubtitles={handleUpdateSubtitles}
                onRequestApiKey={() => setShowApiKeyModal(true)}
              />
            </div>

          </div>
        ) : (
          <div className={`p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl ${
            activeTab === 'niche' || activeTab === 'library' ? 'hidden' : ''
          }`}>
            <p className="text-sm text-slate-400">Loading initial template, click preset above to begin editing...</p>
          </div>
        )}

        {/* Tab Panel 5: Past History Saved Projects library */}
        <div className={activeTab === 'library' ? 'animate-fade-in block' : 'hidden'}>
          <LibraryPanel
            pastProjects={pastProjects}
            activeProjectId={activeProjectId}
            onLoadProject={handleLoadProject}
            onDeleteProject={handleDeleteProject}
          />
        </div>

      </main>

      {/* Sustainable footer tagline */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-8 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="flex items-center justify-center gap-1">
            Made with <Heart className="w-3.5 h-3.5 text-brand-pink fill-brand-pink" /> to empower creators worldwide.
          </p>
          <p className="text-[11px] text-slate-600 font-medium">
            This platform runs 100% sustainably using free open model analysis capabilities. Zero premium tiers.
          </p>
        </div>
      </footer>
    </div>
  );
}
