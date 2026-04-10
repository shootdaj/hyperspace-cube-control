import { useState } from 'react';
import { connectionStore } from '@/core/store/connectionStore';
import { WLEDWebSocketService } from '@/core/wled/WLEDWebSocketService';
import { WLEDRestClient } from '@/core/wled/WLEDRestClient';
import { Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function ConnectionSettings() {
  const ip = connectionStore((s) => s.ip);
  const status = connectionStore((s) => s.status);
  const [inputIp, setInputIp] = useState(ip);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleConnect() {
    const trimmed = inputIp.trim();
    if (!trimmed) return;

    setTesting(true);
    setTestResult(null);

    try {
      const client = new WLEDRestClient(trimmed);
      const info = await client.getInfo();
      if (info && info.ver) {
        setTestResult(`Connected: ${info.name || info.product || 'WLED'} (${info.leds?.count} LEDs, fw ${info.ver})`);
        connectionStore.getState().setIp(trimmed);
        WLEDWebSocketService.getInstance().connect(trimmed);
      } else {
        setTestResult('No WLED device found at this IP');
      }
    } catch {
      setTestResult('Connection failed — check IP and ensure device is on');
    } finally {
      setTesting(false);
    }
  }

  function handleDisconnect() {
    WLEDWebSocketService.getInstance().disconnect();
    connectionStore.getState().setIp('');
    setTestResult(null);
  }

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';

  return (
    <div className="space-y-4">
      <div className="section-header">
        <Wifi className="w-3.5 h-3.5 text-primary" />
        <span>Connection</span>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-secondary/30 border border-border/50">
        <div className={`
          flex items-center justify-center w-8 h-8 rounded-full
          ${isConnected
            ? 'bg-green-500/15 text-green-400'
            : isConnecting
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-muted text-muted-foreground'
          }
        `}>
          {isConnected && <Wifi className="w-4 h-4" />}
          {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
          {!isConnected && !isConnecting && <WifiOff className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${
            isConnected ? 'text-green-400' : isConnecting ? 'text-amber-400' : 'text-muted-foreground'
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
          {ip && (
            <div className="text-xs font-mono text-muted-foreground truncate">{ip}</div>
          )}
        </div>
      </div>

      {/* IP Input + Connect button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputIp}
          onChange={(e) => setInputIp(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          placeholder="192.168.1.x"
          className="flex-1 h-11 px-3 rounded-md border border-input bg-secondary/50 text-foreground text-sm font-mono placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={handleConnect}
          disabled={testing || !inputIp.trim()}
          className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Connect'
          )}
        </button>
      </div>

      {isConnected && (
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 h-11 px-4 rounded-md border border-destructive/50 text-destructive text-sm hover:bg-destructive/10 cursor-pointer transition-colors w-full justify-center"
        >
          <WifiOff className="w-4 h-4" />
          Disconnect
        </button>
      )}

      {testResult && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${
          testResult.startsWith('Connected')
            ? 'text-green-400 bg-green-500/10'
            : 'text-red-400 bg-red-500/10'
        }`}>
          {testResult.startsWith('Connected')
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          }
          <span>{testResult}</span>
        </div>
      )}
    </div>
  );
}
