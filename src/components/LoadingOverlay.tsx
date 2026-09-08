import React from 'react';
import { Loader2 } from 'lucide-react';
import { colors, INTER } from '../utils/styles';

interface LoadingOverlayProps {
  stage?: string;
  progress?: number;
  onCancel?: () => void;
}

export default function LoadingOverlay({ stage, progress, onCancel }: LoadingOverlayProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '20px', backdropFilter: 'blur(12px)'
    }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '50%',
        border: '4px solid #27272a', borderTopColor: '#EC4899',
        animation: 'spin 1s linear infinite', marginBottom: '24px'
      }} />

      {stage && (
        <div style={{
          color: '#fff', fontSize: '14px', fontWeight: 600,
          fontFamily: INTER, marginBottom: '8px', textAlign: 'center'
        }}>
          {stage}
        </div>
      )}

      {progress !== undefined && (
        <div style={{
          width: '200px', height: '6px', background: '#27272a',
          borderRadius: '3px', overflow: 'hidden', marginBottom: '16px'
        }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, progress))}%`, height: '100%',
            background: 'linear-gradient(90deg, #EC4899, #db2777)',
            borderRadius: '3px', transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {progress !== undefined && (
        <div style={{
          color: '#a1a1aa', fontSize: '12px', fontWeight: 500,
          fontFamily: 'monospace', marginBottom: onCancel ? '16px' : '0'
        }}>
          {Math.round(progress)}%
        </div>
      )}

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            padding: '10px 24px', borderRadius: '10px', border: '1px solid #333',
            background: '#252525', color: '#fff', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', fontFamily: INTER,
            textTransform: 'uppercase', letterSpacing: '0.5px'
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
