import { useState } from 'react';
import { connectionStore } from '@/core/store/connectionStore';
import { detectMixedContent } from '@/core/wled/detectMixedContent';

export function MixedContentWarning() {
  const ip = connectionStore((s) => s.ip);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !detectMixedContent(ip)) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 border-b border-amber-600 px-4 py-3 text-sm text-amber-100 flex items-start justify-between gap-3"
    >
      <div>
        <strong className="font-semibold">HTTPS/HTTP Connection Issue:</strong>{' '}
        This page is served over HTTPS but your HyperCube uses HTTP. Browsers block this
        connection. To control your cube, access this app at{' '}
        <code className="bg-amber-800 px-1 rounded font-mono">http://localhost:5173</code>{' '}
        instead of the Vercel URL.
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-300 hover:text-amber-100 transition-colors cursor-pointer p-1"
        aria-label="Dismiss warning"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
