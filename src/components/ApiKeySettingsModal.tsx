import React, { useState, useEffect } from 'react';
import { KeyRound, X, ExternalLink, Check, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, looksLikeValidGeminiKey, sanitizeApiKeyInput } from '../utils/apiKeyStore';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export default function ApiKeySettingsModal({ isOpen, onClose, onKeySaved }: ApiKeySettingsModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [savedKeyPreview, setSavedKeyPreview] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = getStoredApiKey();
      setSavedKeyPreview(existing ? `${existing.slice(0, 4)}${'•'.repeat(Math.max(0, existing.length - 8))}${existing.slice(-4)}` : null);
      setInputValue('');
      setValidationError(null);
      setShowSavedToast(false);
      setShowKey(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const cleaned = sanitizeApiKeyInput(inputValue);
    if (!cleaned) {
      setValidationError('Please paste a key first.');
      return;
    }
    if (!looksLikeValidGeminiKey(cleaned)) {
      setValidationError("That doesn't look like a valid API key. Tap the eye icon to see exactly what got pasted — a common cause is an extra character picked up from copying on a phone.");
      return;
    }
    setStoredApiKey(cleaned);
    setValidationError(null);
    setShowSavedToast(true);
    onKeySaved?.(cleaned);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 900);
  };

  const handleClear = () => {
    clearStoredApiKey();
    setSavedKeyPreview(null);
    setInputValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 safe-area-all">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-purple/10 border border-brand-purple/20 rounded-xl">
              <KeyRound className="w-4 h-4 text-brand-purple" />
            </div>
            <h2 className="text-sm font-bold text-white">Your Gemini API Key</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            AI features (title/caption generation, the Co-Pilot, and smart cut detection) run directly from your
            device to Google's Gemini API using your own key — nothing passes through our servers, and your key
            never leaves this device except to talk to Google.
          </p>

          {savedKeyPreview && (
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                Key saved: {savedKeyPreview}
              </div>
              <button
                onClick={handleClear}
                className="text-[10px] font-semibold text-slate-500 hover:text-brand-pink flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              {savedKeyPreview ? 'Replace key' : 'Paste your API key'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setValidationError(null); }}
                placeholder="Paste key here..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-purple rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-600 font-mono focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key — useful to check for stray characters from copying on a phone'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationError && <p className="text-[10px] text-brand-pink">{validationError}</p>}
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-brand-cyan hover:text-cyan-300 font-medium"
          >
            Get a free API key from Google AI Studio <ExternalLink className="w-3 h-3" />
          </a>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {showSavedToast ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Key'}
          </button>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            Stored locally in this browser/app only. Not encrypted — don't use this on a shared device.
            You can remove it any time with the button above.
          </p>
        </div>
      </div>
    </div>
  );
}
