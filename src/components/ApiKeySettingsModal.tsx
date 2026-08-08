import React, { useState, useEffect } from 'react';
import { KeyRound, X, ExternalLink, Check, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, looksLikeValidAiKey, sanitizeApiKeyInput } from '../utils/apiKeyStore';

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
    if (!looksLikeValidAiKey(cleaned)) {
      setValidationError("That doesn't look like a valid API key. Groq keys start with 'gsk_'.");
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', padding: '16px' }} className="safe-area-all">
      <div style={{ width: '100%', maxWidth: '440px', background: '#09090b', borderRadius: '24px', border: '1px solid rgba(30,41,59,0.5)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(30,41,59,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(139,92,246,0.1)', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <KeyRound style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '13px', color: 'white', fontFamily: '"Inter", sans-serif' }}>Your AI API Key (Groq)</h2>
          </div>
          <button onClick={onClose} style={{ padding: '6px', borderRadius: '8px', color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6', fontFamily: '"Inter", sans-serif' }}>
            AI features run directly from your device to Groq's high-speed API using your own key.
          </p>

          {savedKeyPreview && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>
                <ShieldCheck style={{ width: '14px', height: '14px' }} />
                Key saved: {savedKeyPreview}
              </div>
              <button onClick={handleClear} style={{ fontSize: '10px', fontWeight: 600, color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter", sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Trash2 style={{ width: '12px', height: '12px' }} /> Remove
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {savedKeyPreview ? 'Replace key' : 'Paste your Groq API key'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setValidationError(null); }}
                placeholder="gsk_..."
                style={{ width: '100%', background: '#020617', border: '1px solid rgba(30,41,59,0.5)', borderRadius: '12px', padding: '12px 40px 12px 14px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: 'monospace' }}
              />
              <button type="button" onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {showKey ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
              </button>
            </div>
            {validationError && <p style={{ fontSize: '10px', color: '#ec4899' }}>{validationError}</p>}
          </div>

          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Get a free high-speed API key from Groq Console <ExternalLink style={{ width: '12px', height: '12px' }} />
          </a>

          <button onClick={handleSave} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: '"Inter", sans-serif', transition: 'all 0.2s' }}>
            {showSavedToast ? '✅ Saved!' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
}
