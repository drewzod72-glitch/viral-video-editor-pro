import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Download, 
  Type, 
  Palette, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  RefreshCw, 
  Eye, 
  Zap,
  Check,
  Flame,
  Bomb,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { VideoProject } from '../types';
import { saveFileToDevice } from '../utils/download';

interface ThumbnailGeneratorProps {
  project: VideoProject;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onUpdateProject: (updated: VideoProject) => void;
}

type ThumbnailLayout = 'cyber-blast' | 'extreme-bold' | 'split-faceoff' | 'clean-minimal';
type TextPlacement = 'top' | 'middle' | 'bottom';

export function ThumbnailGenerator({ 
  project, 
  currentTime, 
  videoRef, 
  onUpdateProject 
}: ThumbnailGeneratorProps) {
  // Customizable options
  const [headline, setHeadline] = useState(project.title || 'REVEALING THE SECRETS');
  const [secondLine, setSecondLine] = useState('DON\'T SKIP THIS!');
  const [layout, setLayout] = useState<ThumbnailLayout>('cyber-blast');
  const [textPlacement, setTextPlacement] = useState<TextPlacement>('bottom');
  const [intensityGradient, setIntensityGradient] = useState<string>('from-brand-purple to-brand-pink');
  
  // Custom badges
  const [selectedBadge, setSelectedBadge] = useState<string>('VIRAL');
  const [badgeColor, setBadgeColor] = useState<string>('bg-brand-pink text-white');
  
  // Display Arrow
  const [showArrow, setShowArrow] = useState(true);
  const [arrowPosition, setArrowPosition] = useState({ x: 230, y: 350 });
  
  // Dark vignette
  const [addVignette, setAddVignette] = useState(true);
  
  // Graphic generation state
  const [isCapturing, setIsCapturing] = useState(false);
  const [corsWarning, setCorsWarning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Suggested high-impact headline presets based on the active niche
  const headlinePresets: Record<string, string[]> = {
    fitness: ['10x SHRED FORM', 'AVOID THIS INJURY', 'FASTEST AB TRICK', 'GYM TRUTH REVEALED'],
    education: ['DO THIS DAILY', '99% MISS THIS', 'BRAIN SHORTCUT', 'LEARN IN 15 SECONDS'],
    comedy: ['DO NOT LAUGH', 'INSTANT REGRET', 'ACTUALLY CRAZY', 'SITUATION CRITICAL'],
    motivation: ['WAKE UP NOW', 'UNLEASH POWER', 'THE CHOSEN ROAD', 'STOP WASTING YEARS'],
    cooking: ['SECRET INGREDIENT', 'MILITARY KITCHEN', 'BEST BITE EVER', 'NEVER COOK WITHOUT'],
    tech: ['GENIUS HACK', 'NEXT-GEN REVEAL', 'STOP RUNNING SLOW', 'BAN THIS DEVICE'],
    pets: ['ULTIMATE FLUFF', 'ANGRY PAWS', 'SNEAKY ATTACK', 'DOG SAYS NO'],
    unboxing: ['WORTH EVERY CENT', 'DON\'T BUY YET', 'UNBOXING CHAOS', 'SCAM OR GENIUS'],
    sales: ['10x REVENUE HACK', 'CLOSE EVERY CLIENT', 'PITCH PERFECT', 'COLD CALL SECRETS']
  };

  const activePresets = headlinePresets[project.niche] || ['UNBEATABLE STYLE', 'MUST SEE SEED', 'EXCLUSIVE LOOK', 'NEXT LEVEL'];

  // Draw preview to canvas Whenever changes occur
  useEffect(() => {
    drawCanvas();
  }, [headline, secondLine, layout, textPlacement, intensityGradient, selectedBadge, badgeColor, showArrow, arrowPosition, addVignette, currentTime]);

  const drawCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    let frameRendered = false;

    // 1. Try to extract current frame from the HTMLVideoElement
    if (videoRef && videoRef.current) {
      try {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        frameRendered = true;
        setCorsWarning(false);
      } catch (err) {
        // Safe failover representation for sandbox environment CORS issues
        setCorsWarning(true);
      }
    }

    // 2. If CORS or video state blocks frame extraction, draw a beautiful illustrative high-contrast graphic template
    if (!frameRendered) {
      // Background base gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      if (project.colorGrade === 'moody_cyber') {
        bgGrad.addColorStop(0, '#020617');
        bgGrad.addColorStop(0.5, '#1e1b4b');
        bgGrad.addColorStop(1, '#090514');
      } else if (project.colorGrade === 'warm_vintage') {
        bgGrad.addColorStop(0, '#1c1917');
        bgGrad.addColorStop(0.5, '#451a03');
        bgGrad.addColorStop(1, '#0c0a09');
      } else if (project.colorGrade === 'vibrant_pop') {
        bgGrad.addColorStop(0, '#030712');
        bgGrad.addColorStop(0.5, '#4c0519');
        bgGrad.addColorStop(1, '#111827');
      } else { // cinematic/none
        bgGrad.addColorStop(0, '#030712');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw active thematic design grid / neon spotlights for contrast
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 4;
      for (let i = 0; i < width; i += 180) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let j = 0; j < height; j += 180) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(width, j);
        ctx.stroke();
      }

      // Draw stylized colored radial accent behind the text (face-spotlight simulation)
      const spotlightX = width / 2;
      const spotlightY = textPlacement === 'top' ? height * 0.35 : textPlacement === 'bottom' ? height * 0.55 : height / 2;
      const radGrad = ctx.createRadialGradient(spotlightX, spotlightY, 50, spotlightX, spotlightY, 700);
      
      let glowColor1 = 'rgba(139, 92, 246, 0.4)'; // purple
      let glowColor2 = 'rgba(236, 72, 153, 0.4)'; // pink
      if (intensityGradient.includes('cyan')) {
        glowColor1 = 'rgba(6, 182, 212, 0.5)';
        glowColor2 = 'rgba(16, 185, 129, 0.2)';
      }
      radGrad.addColorStop(0, glowColor1);
      radGrad.addColorStop(0.4, glowColor2);
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(spotlightX, spotlightY, 900, 0, Math.PI * 2);
      ctx.fill();

      // Draw highly prominent silhouette center graphic to look like a high-production video frame
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = intensityGradient.includes('cyan') ? 'rgba(34, 211, 238, 0.35)' : 'rgba(236, 72, 153, 0.35)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 - 100, 240, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Camera focal lines decoration
      ctx.strokeStyle = intensityGradient.includes('cyan') ? '#22d3ee' : '#ec4899';
      ctx.lineWidth = 6;
      const bracketSize = 40;
      // top-left
      ctx.beginPath(); ctx.moveTo(100, 100 + bracketSize); ctx.lineTo(100, 100); ctx.lineTo(100 + bracketSize, 100); ctx.stroke();
      // top-right
      ctx.beginPath(); ctx.moveTo(width - 100, 100 + bracketSize); ctx.lineTo(width - 100, 100); ctx.lineTo(width - 100 - bracketSize, 100); ctx.stroke();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(100, height - 100 - bracketSize); ctx.lineTo(100, height - 100); ctx.lineTo(100 + bracketSize, height - 100); ctx.stroke();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(width - 100, height - 100 - bracketSize); ctx.lineTo(width - 100, height - 100); ctx.lineTo(width - 100 - bracketSize, height - 100); ctx.stroke();

      // Draw stylized video-camera logo in center silhouette
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PREVIEW TIMESTAMP: ${currentTime.toFixed(1)}s`, width / 2, height / 2 - 120);

      const topicText = project.niche.toUpperCase() + ' INSIGHTS';
      ctx.font = 'bold 44px "Arial Black", Gadget, sans-serif';
      ctx.fillStyle = intensityGradient.includes('cyan') ? '#22d3ee' : '#ec4899';
      ctx.fillText(topicText, width / 2, height / 2 - 60);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '32px sans-serif';
      ctx.fillText('Automatic Cinematic Frame Overlay', width / 2, height / 2);
    }

    // 3. Apply High-Impact Vignette
    if (addVignette) {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.45, width / 2, height / 2, width * 0.85);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.65, 'rgba(0,0,0,0.55)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // 4. Draw Attention Curved Pointer Arrow
    if (showArrow) {
      ctx.save();
      // Adjust pointer size
      const targetX = arrowPosition.x * (width / 281);
      const targetY = arrowPosition.y * (height / 500);

      const anchorX = targetX + 160;
      const anchorY = targetY + 220;

      // Draw arrow tail bezier curve
      ctx.strokeStyle = '#EF4444'; // Red attention-grabber arrow
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
      ctx.shadowBlur = 30;

      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.bezierCurveTo(anchorX + 50, anchorY - 140, targetX + 100, targetY + 120, targetX + 25, targetY + 25);
      ctx.stroke();

      // Draw Arrow Head pointing to target
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + 65, targetY + 30);
      ctx.lineTo(targetX + 30, targetY + 65);
      ctx.closePath();
      ctx.fill();

      // Neon sticker text at arrow anchor
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 5. Draw Headline and Secondary Headline Text blocks
    ctx.save();

    let textY = height * 0.78; // bottom default
    if (textPlacement === 'top') textY = height * 0.22;
    else if (textPlacement === 'middle') textY = height * 0.50;

    // Set layout specific fonts and backings
    if (layout === 'cyber-blast') {
      // 3D Split Block Banner
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 6;

      // Draw Neon Backdrop bar
      const boxW = width * 0.92;
      const boxH = 260;
      const boxX = (width - boxW) / 2;
      const boxY = textY - 130;

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = intensityGradient.includes('cyan') ? '#22D3EE' : '#EC4899';
      ctx.lineWidth = 10;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Render headline text
      ctx.shadowBlur = 20;
      ctx.shadowColor = intensityGradient.includes('cyan') ? '#0891B2' : '#BE185D';
      
      ctx.textAlign = 'center';
      ctx.font = '900 86px "Arial Black", Gadget, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(headline.toUpperCase(), width / 2, textY - 15);

      // Second Line
      ctx.font = '800 52px "Arial Black", Gadget, sans-serif';
      ctx.fillStyle = intensityGradient.includes('cyan') ? '#22D3EE' : '#FBBF24';
      ctx.fillText(secondLine.toUpperCase(), width / 2, textY + 65);

    } else if (layout === 'extreme-bold') {
      // Chunky Impact Style
      ctx.textAlign = 'center';
      ctx.font = 'bold 125px Impact, Charcoal, sans-serif';

      const words = headline.toUpperCase();

      // Thick Text stroke border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 26;
      ctx.miterLimit = 2;
      ctx.lineJoin = 'miter';
      ctx.strokeText(words, width / 2, textY - 20);

      // Fill text
      ctx.fillStyle = '#FBBF24'; // Warning Yellow
      ctx.fillText(words, width / 2, textY - 20);

      // Second line smaller
      if (secondLine) {
        ctx.font = 'bold 80px Impact, Charcoal, sans-serif';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 20;
        ctx.strokeText(secondLine.toUpperCase(), width / 2, textY + 70);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(secondLine.toUpperCase(), width / 2, textY + 70);
      }

    } else if (layout === 'split-faceoff') {
      // Split red/blue neon gaming banner style
      const pY = textY;
      ctx.textAlign = 'center';
      ctx.font = '900 100px "Arial Black", sans-serif';

      // Blue gradient text top
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 18;
      ctx.strokeText(headline.toUpperCase(), width / 2, pY - 30);
      const textGrad = ctx.createLinearGradient(0, pY - 80, 0, pY);
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(1, '#22D3EE'); // Cyan gradient
      ctx.fillStyle = textGrad;
      ctx.fillText(headline.toUpperCase(), width / 2, pY - 30);

      // Red spotlight banner or alert text for second line
      if (secondLine) {
        // Red background banner strap
        const bgW = ctx.measureText(secondLine.toUpperCase()).width + 100;
        ctx.fillStyle = '#EF4444';
        ctx.fillRect((width - bgW) / 2, pY + 30, bgW, 90);

        ctx.font = 'bold 55px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(secondLine.toUpperCase(), width / 2, pY + 95);
      }

    } else { // clean-minimal
      // Minimal elegant premium styling
      ctx.textAlign = 'center';
      ctx.font = 'bold 78px "Space Grotesk", "Inter", sans-serif';

      // Rounded background box
      const textWidth = Math.max(
        ctx.measureText(headline).width,
        ctx.measureText(secondLine).width
      ) + 80;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3;
      const bH = 220;
      ctx.beginPath();
      ctx.roundRect((width - textWidth) / 2, textY - 110, textWidth, bH, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(headline, width / 2, textY - 20);

      ctx.font = '500 50px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(secondLine, width / 2, textY + 55);
    }
    ctx.restore();

    // 6. Render selected corner badge sticker
    if (selectedBadge !== 'NONE') {
      ctx.save();
      ctx.translate(140, 200);
      ctx.rotate(-0.15); // subtle angle

      const bText = selectedBadge.toUpperCase();
      ctx.font = 'bold 70px "Arial Black", sans-serif';
      const bTextW = ctx.measureText(bText).width;

      // Badge base border box
      const isPink = badgeColor.includes('pink') || badgeColor.includes('rose');
      const isYellow = badgeColor.includes('yellow') || badgeColor.includes('amber');
      ctx.fillStyle = isPink ? '#EC4899' : isYellow ? '#EAB308' : '#10B981';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 14;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 15;

      const padX = 60;
      const padY = 30;
      ctx.beginPath();
      ctx.roundRect(-padX - bTextW/2, -padY - 35, bTextW + padX*2, 70 + padY*2, 16);
      ctx.fill();
      ctx.stroke();

      // Shiny lightning or fire symbol
      ctx.shadowBlur = 0;
      ctx.fillStyle = badgeColor.includes('yellow') ? '#000000' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(bText, 0, 25);

      ctx.restore();
    }
  };

  // Safe Image Downloader trigger
  const exportThumbnailImage = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setIsCapturing(false);
        return;
      }
      const filename = `${project.name.toLowerCase().replace(/\s+/g, '-')}-viral-thumbnail.png`;

      // canvas.toBlob + saveFileToDevice instead of toDataURL + anchor.click():
      // toDataURL+anchor silently does nothing on a lot of iOS Safari /
      // in-app-webview combinations (no error, the image just never saves).
      // saveFileToDevice tries the native share sheet first (real "Save
      // Image" option on iOS/Android) and falls back to a blob-anchor
      // download everywhere else.
      canvas.toBlob(async (blob) => {
        try {
          if (!blob) throw new Error('Canvas produced an empty image.');
          await saveFileToDevice(blob, filename);
        } catch (err) {
          console.error('[Thumbnail Download] Failed:', err);
        } finally {
          setIsCapturing(false);
        }
      }, 'image/png');
    }, 600);
  };

  // Capture arrow click relocation coordinates
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showArrow || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // update within relative preview bounds (281 * 500)
    setArrowPosition({
      x: Math.round(clickX),
      y: Math.round(clickY)
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-brand-pink" />
          Click-Bait Thumbnail Suite
        </h3>
        <span className="text-[9.5px] font-mono bg-brand-pink/10 text-brand-pink px-1.5 py-0.5 rounded border border-brand-pink/20 uppercase font-bold animate-pulse">
          ⚡ high-impact
        </span>
      </div>

      <p className="text-[10px] text-slate-400">
        Generate customized, high-arousal vertical cover cards straight from your clips timeline. Adjust arrow pointers, banners, and overlays.
      </p>

      {/* Render layout canvas in invisible zone but showing a scaled visual div preview box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Visual Interactive Map */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="text-[11px] text-slate-500 font-mono uppercase mb-1 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Live Target Placement Map
          </div>
          
          <div 
            ref={previewRef}
            onClick={handlePreviewClick}
            className="relative aspect-[9/16] h-[340px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-xl cursor-crosshair group-hover:ring-1 ring-slate-700"
            title={showArrow ? "Click anywhere on this preview map to relocate the attention pointer arrow!" : "Interactive preview"}
          >
            {/* Direct Scaled Image projection from HTML5 Canvas */}
            <canvas 
              ref={canvasRef} 
              className="w-full h-full object-cover pointer-events-none"
            />

            {showArrow && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Visual tooltip tag in canvas indicator */}
                <span className="absolute top-2 right-2 bg-red-500/90 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase shadow animate-pulse">
                  🎯 Click map to move Arrow
                </span>
              </div>
            )}
          </div>
          
          {corsWarning && (
            <div className="mt-2 text-[9px] bg-indigo-950/40 text-indigo-300 border border-indigo-800/30 p-2 rounded-lg flex items-start gap-1.5 max-w-[220px]">
              <AlertCircle className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Sandbox restricts direct clip-frame capture. We generated an elegant <strong>high-contrast vector studio cover</strong> as a fail-safe backstop!
              </span>
            </div>
          )}
        </div>

        {/* Custom Controller zones */}
        <div className="md:col-span-7 space-y-3.5">
          {/* Headline inputs */}
          <div className="space-y-2">
            <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Type className="w-3 h-3 text-brand-pink" /> Headline Punchlines
            </label>
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="MAIN BIG TEXT..."
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:border-brand-pink focus:outline-none placeholder-slate-600 font-bold"
              />
              <input
                type="text"
                placeholder="Sub-Headline Hook..."
                value={secondLine}
                onChange={(e) => setSecondLine(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white focus:border-brand-pink focus:outline-none placeholder-slate-600 font-semibold"
              />
            </div>
            
            {/* Quick headline presets */}
            <div className="space-y-1">
              <span className="text-[9.5px] text-slate-500 font-semibold">Suggested Viral Hook Hooks:</span>
              <div className="flex flex-wrap gap-1">
                {activePresets.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => setHeadline(pr)}
                    className="text-[9px] bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-850"
                  >
                    "{pr}"
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Theme / Visual Layout presets */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500 font-mono uppercase">Template Style</label>
              <select
                value={layout}
                onChange={(e) => setLayout(e.target.value as ThumbnailLayout)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg p-1.5 focus:outline-none"
              >
                <option value="cyber-blast">👾 Cyber Neon Backdrop</option>
                <option value="extreme-bold">📢 Extreme Impact Yellow</option>
                <option value="split-faceoff">🔥 Blue/Red Game Faceoff</option>
                <option value="clean-minimal">💎 Minimalist Suede</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500 font-mono uppercase">Text Placement</label>
              <select
                value={textPlacement}
                onChange={(e) => setTextPlacement(e.target.value as TextPlacement)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg p-1.5 focus:outline-none"
              >
                <option value="top">顶部 Top Zone</option>
                <option value="middle">中部 Mid Center</option>
                <option value="bottom">底部 Lower 1/3</option>
              </select>
            </div>
          </div>

          {/* Sticker & Accessories */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-300">Stickers & Accessories</span>
              <span className="text-[9.5px] text-slate-500">Corner elements</span>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <span className="text-[9px] text-slate-500 font-semibold block">Badge Sticker</span>
                <select
                  value={selectedBadge}
                  onChange={(e) => setSelectedBadge(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-400 rounded p-1 focus:outline-none"
                >
                  <option value="NONE">No Badge</option>
                  <option value="VIRAL">🔥 VIRAL</option>
                  <option value="FREE">💎 FREE</option>
                  <option value="WARNING">⚠️ WARNING</option>
                  <option value="OMG">😱 OMG!</option>
                  <option value="PROOF">✅ PROOF</option>
                  <option value="10X">🚀 10X</option>
                </select>
              </div>

              <div className="flex-1 space-y-1">
                <span className="text-[9px] text-slate-500 font-semibold block">Badge Theme</span>
                <select
                  value={badgeColor}
                  onChange={(e) => setBadgeColor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-400 rounded p-1 focus:outline-none"
                >
                  <option value="bg-brand-pink text-white">Glamour Pink</option>
                  <option value="bg-brand-green text-black">Neon Green</option>
                  <option value="bg-amber-400 text-black">Warning Yellow</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <input
                  type="checkbox"
                  id="showArrow"
                  checked={showArrow}
                  onChange={() => setShowArrow(!showArrow)}
                  className="rounded text-brand-pink bg-slate-950 border-slate-800"
                />
                <label htmlFor="showArrow">Click-To-Point Arrow Indicator</label>
              </span>
              
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <input
                  type="checkbox"
                  id="addVignette"
                  checked={addVignette}
                  onChange={() => setAddVignette(!addVignette)}
                  className="rounded text-brand-pink bg-slate-950 border-slate-800"
                />
                <label htmlFor="addVignette">Contrast Vignette</label>
              </span>
            </div>
          </div>

          {/* Color Gradient Spot */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 font-mono uppercase block">Backlight Neon Glow Accent:</span>
            <div className="flex gap-1.5">
              {[
                { id: 'from-brand-purple to-brand-pink', label: 'Violet Pink', color: 'bg-gradient-to-r from-brand-purple to-brand-pink' },
                { id: 'from-brand-cyan to-brand-green', label: 'Mint Ocean', color: 'bg-gradient-to-r from-brand-cyan to-brand-green' },
                { id: 'from-amber-500 to-rose-600', label: 'Vulcan Flare', color: 'bg-gradient-to-r from-amber-500 to-rose-600' }
              ].map((grad) => (
                <button
                  key={grad.id}
                  onClick={() => setIntensityGradient(grad.id)}
                  type="button"
                  className={`flex-1 p-1 rounded border text-[10px] flex items-center gap-1 text-slate-300 transition-all ${
                    intensityGradient === grad.id 
                      ? 'border-white bg-slate-850 font-bold' 
                      : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${grad.color}`} />
                  {grad.label}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Export Trigger Button */}
          <button
            onClick={exportThumbnailImage}
            disabled={isCapturing}
            className="w-full bg-gradient-to-r from-brand-pink via-purple-600 to-brand-purple text-white hover:brightness-110 active:scale-95 py-2.5 px-4 rounded-xl text-xs font-bold font-display shadow-lg transition-all duration-150 flex items-center justify-center gap-1.5 text-center cursor-pointer"
          >
            {isCapturing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Squeezing Frame Textures...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download High-Impact Thumbnail (PNG)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
