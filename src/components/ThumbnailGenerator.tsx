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
  const [headline, setHeadline] = useState(project.title || 'REVEALING THE SECRETS');
  const [secondLine, setSecondLine] = useState("DON'T SKIP THIS!");
  const [layout, setLayout] = useState<ThumbnailLayout>('cyber-blast');
  const [textPlacement, setTextPlacement] = useState<TextPlacement>('bottom');
  const [intensityGradient, setIntensityGradient] = useState<string>('from-brand-purple to-brand-pink');
  const [selectedBadge, setSelectedBadge] = useState<string>('VIRAL');
  const [badgeColor, setBadgeColor] = useState<string>('bg-brand-pink text-white');
  const [showArrow, setShowArrow] = useState(true);
  const [arrowPosition, setArrowPosition] = useState({ x: 230, y: 350 });
  const [addVignette, setAddVignette] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [corsWarning, setCorsWarning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const headlinePresets: Record<string, string[]> = {
    fitness: ['10x SHRED FORM', 'AVOID THIS INJURY', 'FASTEST AB TRICK', 'GYM TRUTH REVEALED'],
    education: ['DO THIS DAILY', '99% MISS THIS', 'BRAIN SHORTCUT', 'LEARN IN 15 SECONDS'],
    comedy: ['DO NOT LAUGH', 'INSTANT REGRET', 'ACTUALLY CRAZY', 'SITUATION CRITICAL'],
    motivation: ['WAKE UP NOW', 'UNLEASH POWER', 'THE CHOSEN ROAD', 'STOP WASTING YEARS'],
    cooking: ['SECRET INGREDIENT', 'MILITARY KITCHEN', 'BEST BITE EVER', 'NEVER COOK WITHOUT'],
    tech: ['GENIUS HACK', 'NEXT-GEN REVEAL', 'STOP RUNNING SLOW', 'BAN THIS DEVICE'],
    pets: ['ULTIMATE FLUFF', 'ANGRY PAWS', 'SNEAKY ATTACK', 'DOG SAYS NO'],
    unboxing: ['WORTH EVERY CENT', "DON'T BUY YET", 'UNBOXING CHAOS', 'SCAM OR GENIUS'],
    sales: ['10x REVENUE HACK', 'CLOSE EVERY CLIENT', 'PITCH PERFECT', 'COLD CALL SECRETS']
  };

  const activePresets = headlinePresets[project.niche] || ['UNBEATABLE STYLE', 'MUST SEE SEED', 'EXCLUSIVE LOOK', 'NEXT LEVEL'];

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
    ctx.clearRect(0, 0, width, height);

    let frameRendered = false;

    if (videoRef && videoRef.current) {
      try {
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        frameRendered = true;
        setCorsWarning(false);
      } catch (err) {
        setCorsWarning(true);
      }
    }

    if (!frameRendered) {
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
      } else {
        bgGrad.addColorStop(0, '#030712');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 4;
      for (let i = 0; i < width; i += 180) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
      }
      for (let j = 0; j < height; j += 180) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke();
      }

      const spotlightX = width / 2;
      const spotlightY = textPlacement === 'top' ? height * 0.35 : textPlacement === 'bottom' ? height * 0.55 : height / 2;
      const radGrad = ctx.createRadialGradient(spotlightX, spotlightY, 50, spotlightX, spotlightY, 700);
      let glowColor1 = 'rgba(139, 92, 246, 0.4)';
      let glowColor2 = 'rgba(236, 72, 153, 0.4)';
      if (intensityGradient.includes('cyan')) {
        glowColor1 = 'rgba(6, 182, 212, 0.5)';
        glowColor2 = 'rgba(16, 185, 129, 0.2)';
      }
      radGrad.addColorStop(0, glowColor1);
      radGrad.addColorStop(0.4, glowColor2);
      radGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath(); ctx.arc(spotlightX, spotlightY, 900, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = intensityGradient.includes('cyan') ? 'rgba(34, 211, 238, 0.35)' : 'rgba(236, 72, 153, 0.35)';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.arc(width / 2, height / 2 - 100, 240, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      ctx.strokeStyle = intensityGradient.includes('cyan') ? '#22d3ee' : '#ec4899';
      ctx.lineWidth = 6;
      const bracketSize = 40;
      ctx.beginPath(); ctx.moveTo(100, 100 + bracketSize); ctx.lineTo(100, 100); ctx.lineTo(100 + bracketSize, 100); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(width - 100, 100 + bracketSize); ctx.lineTo(width - 100, 100); ctx.lineTo(width - 100 - bracketSize, 100); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(100, height - 100 - bracketSize); ctx.lineTo(100, height - 100); ctx.lineTo(100 + bracketSize, height - 100); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(width - 100, height - 100 - bracketSize); ctx.lineTo(width - 100, height - 100); ctx.lineTo(width - 100 - bracketSize, height - 100); ctx.stroke();

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

    if (addVignette) {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.45, width / 2, height / 2, width * 0.85);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.65, 'rgba(0,0,0,0.55)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    if (showArrow) {
      ctx.save();
      const targetX = arrowPosition.x * (width / 281);
      const targetY = arrowPosition.y * (height / 500);
      const anchorX = targetX + 160;
      const anchorY = targetY + 220;

      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(239, 68, 68, 0.9)';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.bezierCurveTo(anchorX + 50, anchorY - 140, targetX + 100, targetY + 120, targetX + 25, targetY + 25);
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + 65, targetY + 30);
      ctx.lineTo(targetX + 30, targetY + 65);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.save();
    let textY = height * 0.78;
    if (textPlacement === 'top') textY = height * 0.22;
    else if (textPlacement === 'middle') textY = height * 0.50;

    if (layout === 'cyber-blast') {
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 6;

      const boxW = width * 0.92;
      const boxH = 260;
      const boxX = (width - boxW) / 2;
      const boxY = textY - 130;

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = intensityGradient.includes('cyan') ? '#22D3EE' : '#EC4899';
      ctx.lineWidth = 10;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.shadowBlur = 20;
      ctx.shadowColor = intensityGradient.includes('cyan') ? '#0891B2' : '#BE185D';
      ctx.textAlign = 'center';
      ctx.font = '900 86px "Arial Black", Gadget, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(headline.toUpperCase(), width / 2, textY - 15);

      ctx.font = '800 52px "Arial Black", Gadget, sans-serif';
      ctx.fillStyle = intensityGradient.includes('cyan') ? '#22D3EE' : '#FBBF24';
      ctx.fillText(secondLine.toUpperCase(), width / 2, textY + 65);

    } else if (layout === 'extreme-bold') {
      ctx.textAlign = 'center';
      ctx.font = 'bold 125px Impact, Charcoal, sans-serif';
      const words = headline.toUpperCase();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 26;
      ctx.miterLimit = 2;
      ctx.lineJoin = 'miter';
      ctx.strokeText(words, width / 2, textY - 20);
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(words, width / 2, textY - 20);

      if (secondLine) {
        ctx.font = 'bold 80px Impact, Charcoal, sans-serif';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 20;
        ctx.strokeText(secondLine.toUpperCase(), width / 2, textY + 70);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(secondLine.toUpperCase(), width / 2, textY + 70);
      }

    } else if (layout === 'split-faceoff') {
      const pY = textY;
      ctx.textAlign = 'center';
      ctx.font = '900 100px "Arial Black", sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 18;
      ctx.strokeText(headline.toUpperCase(), width / 2, pY - 30);
      const textGrad = ctx.createLinearGradient(0, pY - 80, 0, pY);
      textGrad.addColorStop(0, '#FFFFFF');
      textGrad.addColorStop(1, '#22D3EE');
      ctx.fillStyle = textGrad;
      ctx.fillText(headline.toUpperCase(), width / 2, pY - 30);

      if (secondLine) {
        const bgW = ctx.measureText(secondLine.toUpperCase()).width + 100;
        ctx.fillStyle = '#EF4444';
        ctx.fillRect((width - bgW) / 2, pY + 30, bgW, 90);
        ctx.font = 'bold 55px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(secondLine.toUpperCase(), width / 2, pY + 95);
      }

    } else {
      ctx.textAlign = 'center';
      ctx.font = 'bold 78px "Space Grotesk", "Inter", sans-serif';
      const textWidth = Math.max(ctx.measureText(headline).width, ctx.measureText(secondLine).width) + 80;
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

    if (selectedBadge !== 'NONE') {
      ctx.save();
      ctx.translate(140, 200);
      ctx.rotate(-0.15);
      const bText = selectedBadge.toUpperCase();
      ctx.font = 'bold 70px "Arial Black", sans-serif';
      const bTextW = ctx.measureText(bText).width;
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
      ctx.roundRect(-padX - bTextW / 2, -padY - 35, bTextW + padX * 2, 70 + padY * 2, 16);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = badgeColor.includes('yellow') ? '#000000' : '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(bText, 0, 25);
      ctx.restore();
    }
  };

  const exportThumbnailImage = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) { setIsCapturing(false); return; }
      const filename = `${project.name.toLowerCase().replace(/\s+/g, '-')}-viral-thumbnail.png`;
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

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showArrow || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    setArrowPosition({ x: Math.round(clickX), y: Math.round(clickY) });
  };

  return (
    <div style={{ background: '#09090b', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.5)', backdropFilter: 'blur(12px)', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: '"Inter", sans-serif' }}>
          <ImageIcon style={{ width: '16px', height: '16px', color: '#ec4899' }} />
          Click-Bait Thumbnail Suite
        </h3>
        <span style={{ fontSize: '9px', fontFamily: 'monospace', background: 'rgba(236,72,153,0.1)', color: '#ec4899', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(236,72,153,0.2)', fontWeight: 700, textTransform: 'uppercase' }}>⚡ high-impact</span>
      </div>

      <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>
        Generate customized, high-arousal vertical cover cards from your clip timeline.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye style={{ width: '12px', height: '12px' }} /> Live Target Placement Map
          </div>
          <div
            ref={previewRef}
            onClick={handlePreviewClick}
            style={{ position: 'relative', aspectRatio: '9/16', height: '340px', background: '#020617', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(30,41,59,0.5)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', cursor: 'crosshair' }}
          >
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            {showArrow && (
              <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(239,68,68,0.9)', color: 'white', fontSize: '8px', padding: '3px 6px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase' }}>
                🎯 Click to move Arrow
              </div>
            )}
          </div>
          {corsWarning && (
            <div style={{ marginTop: '8px', fontSize: '9px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px', maxWidth: '280px' }}>
              <AlertCircle style={{ width: '12px', height: '12px', color: '#22d3ee', flexShrink: 0, marginTop: '2px' }} />
              <span>Sandbox restricts direct frame capture. Generated an elegant high-contrast studio cover as a fail-safe.</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Type style={{ width: '12px', height: '12px', color: '#ec4899' }} /> Headline Punchlines
            </label>
            <input
              type="text"
              placeholder="MAIN BIG TEXT..."
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: '"Inter", sans-serif', fontWeight: 700 }}
            />
            <input
              type="text"
              placeholder="Sub-Headline Hook..."
              value={secondLine}
              onChange={(e) => setSecondLine(e.target.value)}
              style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: '"Inter", sans-serif', fontWeight: 600 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {activePresets.map((pr) => (
                <button key={pr} type="button" onClick={() => setHeadline(pr)} style={{ fontSize: '9px', background: '#020617', color: '#64748b', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(30,41,59,0.4)', cursor: 'pointer', fontFamily: '"Inter", sans-serif', fontWeight: 600 }}>
                  "{pr}"
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>Template Style</label>
              <select value={layout} onChange={(e) => setLayout(e.target.value as ThumbnailLayout)} style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', color: '#e2e8f0', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none', fontFamily: '"Inter", sans-serif' }}>
                <option value="cyber-blast">👾 Cyber Neon</option>
                <option value="extreme-bold">📢 Extreme Impact</option>
                <option value="split-faceoff">🔥 Blue/Red Faceoff</option>
                <option value="clean-minimal">💎 Minimalist</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase' }}>Text Placement</label>
              <select value={textPlacement} onChange={(e) => setTextPlacement(e.target.value as TextPlacement)} style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', color: '#e2e8f0', fontSize: '11px', padding: '8px', borderRadius: '8px', outline: 'none', fontFamily: '"Inter", sans-serif' }}>
                <option value="top">Top Zone</option>
                <option value="middle">Mid Center</option>
                <option value="bottom">Lower 1/3</option>
              </select>
            </div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(2,6,23,0.6)', borderRadius: '12px', border: '1px solid rgba(30,41,59,0.4)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 700 }}>Stickers & Accessories</span>
              <span style={{ fontSize: '9px', color: '#475569' }}>Corner elements</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 700 }}>Badge Sticker</span>
                <select value={selectedBadge} onChange={(e) => setSelectedBadge(e.target.value)} style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', color: '#e2e8f0', fontSize: '11px', padding: '6px', borderRadius: '6px', outline: 'none', fontFamily: '"Inter", sans-serif' }}>
                  <option value="NONE">No Badge</option>
                  <option value="VIRAL">🔥 VIRAL</option>
                  <option value="FREE">💎 FREE</option>
                  <option value="WARNING">⚠️ WARNING</option>
                  <option value="OMG">😱 OMG!</option>
                  <option value="PROOF">✅ PROOF</option>
                  <option value="10X">🚀 10X</option>
                </select>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 700 }}>Badge Theme</span>
                <select value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', color: '#e2e8f0', fontSize: '11px', padding: '6px', borderRadius: '6px', outline: 'none', fontFamily: '"Inter", sans-serif' }}>
                  <option value="bg-brand-pink text-white">Glamour Pink</option>
                  <option value="bg-brand-green text-black">Neon Green</option>
                  <option value="bg-amber-400 text-black">Warning Yellow</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" id="showArrow" checked={showArrow} onChange={() => setShowArrow(!showArrow)} style={{ accentColor: '#ec4899' }} />
                Arrow Indicator
              </label>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" id="addVignette" checked={addVignette} onChange={() => setAddVignette(!addVignette)} style={{ accentColor: '#ec4899' }} />
                Contrast Vignette
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '1px' }}>Backlight Neon Glow Accent:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'from-brand-purple to-brand-pink', label: 'Violet Pink' },
                { id: 'from-brand-cyan to-brand-green', label: 'Mint Ocean' },
                { id: 'from-amber-500 to-rose-600', label: 'Vulcan Flare' }
              ].map((grad) => (
                <button key={grad.id} onClick={() => setIntensityGradient(grad.id)} type="button" style={{ flex: 1, padding: '6px', borderRadius: '8px', border: intensityGradient === grad.id ? '1px solid white' : '1px solid rgba(30,41,59,0.5)', background: '#020617', color: '#e2e8f0', fontSize: '10px', cursor: 'pointer', fontFamily: '"Inter", sans-serif', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }} />
                  {grad.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={exportThumbnailImage} disabled={isCapturing} style={{ width: '100%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontWeight: 700, fontSize: '12px', fontFamily: '"Inter", sans-serif', cursor: isCapturing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 30px rgba(236,72,153,0.2)' }}>
            {isCapturing ? (
              <>
                <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                Squeezing Frame Textures...
              </>
            ) : (
              <>
                <Download style={{ width: '14px', height: '14px' }} />
                Download High-Impact Thumbnail (PNG)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
