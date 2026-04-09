import { connectionStore } from '@/core/store/connectionStore';
import { detectMixedContent } from '@/core/wled/detectMixedContent';

export function MixedContentWarning() {
  const ip = connectionStore((s) => s.ip);

  if (!detectMixedContent(ip)) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 border-b border-amber-600 px-4 py-3 text-sm text-amber-100"
    >
      <strong className="font-semibold">HTTPS/HTTP Connection Issue:</strong>{' '}
      This page is served over HTTPS but your HyperCube uses HTTP. Browsers block this
      connection. To control your cube, access this app at{' '}
      <code className="bg-amber-800 px-1 rounded font-mono">http://localhost:5173</code>{' '}
      instead of the Vercel URL.
    </div>
  );
}
