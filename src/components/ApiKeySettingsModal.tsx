import React, { useState, useEffect } from 'react';
import { KeyRound, X, ExternalLink, Check, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, getStoredOpenRouterKey, setStoredOpenRouterKey, clearStoredOpenRouterKey, looksLikeValidAiKey, looksLikeValidOpenRouterKey, sanitizeApiKeyInput } from '../utils/apiKeyStore';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (key: string) => void;
}

export default function ApiKeySettingsModal({ isOpen, onClose, onKeySaved }: ApiKeySettingsModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [inputValueOpenRouter, setInputValueOpenRouter] = useState('');
  const [savedKeyPreview, setSavedKeyPreview] = useState<string | null>(null);
  const [savedKeyPreviewOpenRouter, setSavedKeyPreviewOpenRouter] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existingGroq = getStoredApiKey();
      setSavedKeyPreview(existingGroq ? `${existingGroq.slice(0, 4)}${'•'.repeat(Math.max(0, existingGroq.length - 8))}${existingGroq.slice(-4)}` : null);
      const existingOpenRouter = getStoredOpenRouterKey();
      setSavedKeyPreviewOpenRouter(existingOpenRouter ? `${existingOpenRouter.slice(0, 4)}${'•'.repeat(Math.max(0, existingOpenRouter.length - 8))}${existingOpenRouter.slice(-4)}` : null);
      setInputValue('');
      setInputValueOpenRouter('');
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
    if (!looksLikeValidAiKey(cleaned)) {
      setValidationError("That doesn't look like a valid API key. Keys should start with 'gsk_' (Groq) or 'sk-or-' (OpenRouter).");
      return;
    }
    if (looksLikeValidOpenRouterKey(cleaned)) {
      setStoredOpenRouterKey(cleaned);
    } else {
      setStoredApiKey(cleaned);
    }
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

  const handleClearOpenRouter = () => {
    clearStoredOpenRouterKey();
    setSavedKeyPreviewOpenRouter(null);
    setInputValueOpenRouter('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: '16px' }} className="safe-area-all">
      <div className="card" style={{ width: '100%', maxWidth: '440px', overflow: 'hidden', animation: 'scaleIn 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(30,41,59,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(236,72,149,0.1)', borderRadius: '10px', border: '1px solid rgba(236,72,149,0.2)' }}>
              <KeyRound style={{ width: '16px', height: '16px', color: '#EC4899' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '13px', color: 'white', fontFamily: '"Inter", sans-serif' }}>AI API Keys</h2>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.6', fontFamily: '"Inter", sans-serif' }}>
            AI features run directly from your device. Provide at least one key to enable AI editing, analysis, and image generation.
          </p>

          {/* Groq Key Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {savedKeyPreview && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>
                  <ShieldCheck style={{ width: '14px', height: '14px' }} />
                  Groq key saved: {savedKeyPreview}
                </div>
                <button onClick={handleClear} style={{ fontSize: '10px', fontWeight: 600, color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                >
                  <Trash2 style={{ width: '12px', height: '12px' }} /> Remove
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {savedKeyPreview ? 'Replace Groq key' : 'Groq API key (AI editing)'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); setValidationError(null); }}
                  placeholder="gsk_..."
                  style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '12px 40px 12px 14px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: 'monospace', transition: 'all 0.2s' }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(236,72,149,0.5)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(236,72,149,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(30,41,59,0.5)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button type="button" onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                >
                  {showKey ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                </button>
              </div>
            </div>
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#22d3ee'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#06b6d4'}
            >
              Get a free high-speed API key from Groq Console <ExternalLink style={{ width: '12px', height: '12px' }} />
            </a>
          </div>

          {/* OpenRouter Key Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(30,41,59,0.3)' }}>
            {savedKeyPreviewOpenRouter && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>
                  <ShieldCheck style={{ width: '14px', height: '14px' }} />
                  OpenRouter key saved: {savedKeyPreviewOpenRouter}
                </div>
                <button onClick={handleClearOpenRouter} style={{ fontSize: '10px', fontWeight: 600, color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                >
                  <Trash2 style={{ width: '12px', height: '12px' }} /> Remove
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {savedKeyPreviewOpenRouter ? 'Replace OpenRouter key' : 'OpenRouter API key (image generation)'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={inputValueOpenRouter}
                  onChange={(e) => { setInputValueOpenRouter(e.target.value); setValidationError(null); }}
                  placeholder="sk-or-..."
                  style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '12px 40px 12px 14px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: 'monospace', transition: 'all 0.2s' }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(236,72,149,0.5)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(236,72,149,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(30,41,59,0.5)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button type="button" onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                >
                  {showKey ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                </button>
              </div>
            </div>
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#22d3ee'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#06b6d4'}
            >
              Get an API key from OpenRouter <ExternalLink style={{ width: '12px', height: '12px' }} />
            </a>
          </div>

          {validationError && <p style={{ fontSize: '10px', color: '#ec4899' }}>{validationError}</p>}

          <button onClick={handleSave} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #EC4899, #DB2777)', color: 'white', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: '"Inter", sans-serif', transition: 'all 0.2s', boxShadow: '0 8px 24px rgba(236,72,153,0.3)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(236,72,153,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(236,72,153,0.3)';
            }}
          >
            {showSavedToast ? '✅ Saved!' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
