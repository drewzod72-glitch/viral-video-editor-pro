import React, { useState, useEffect } from 'react';

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      setError(e.error || new Error(e.message));
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      setError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
    });
    return () => {
      window.removeEventListener('error', handler);
    };
  }, []);

  if (error) {
    return (
      <div style={{
        background: '#020617', color: 'white', height: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#f43f5e', marginBottom: '12px' }}>Something went wrong</h2>
        <pre style={{
          background: '#18181b', padding: '16px', borderRadius: '12px',
          maxWidth: '90vw', overflow: 'auto', fontSize: '12px',
          color: '#fca5a5', whiteSpace: 'pre-wrap'
        }}>
          {error.message}
        </pre>
        <button
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
          style={{
            background: '#EC4899', color: 'white', padding: '12px 24px',
            border: 'none', borderRadius: '12px', marginTop: '20px',
            fontWeight: 700, cursor: 'pointer'
          }}
        >
          Reload App
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
