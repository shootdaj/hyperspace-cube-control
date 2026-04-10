import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WLEDRestClient } from '@/core/wled/WLEDRestClient';
import { scanForDevices, type DiscoveredDevice } from '@/core/wled/DeviceScanner';
import { Search, Loader2, Radio, RotateCcw } from 'lucide-react';
import type { WLEDInfo } from '@/core/wled/types';

interface SetupWizardProps {
  onComplete: (ip: string) => void;
}

type Step = 1 | 2 | 3;
type ScanState = 'idle' | 'scanning' | 'done';

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [ip, setIp] = useState('');
  const [ipError, setIpError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [cubeInfo, setCubeInfo] = useState<WLEDInfo | null>(null);

  // Discovery state
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);

  const handleScan = useCallback(async () => {
    setScanState('scanning');
    setDiscoveredDevices([]);
    setIpError('');

    try {
      const devices = await scanForDevices((device) => {
        // Progressive update: add each device as it's found
        setDiscoveredDevices((prev) => [...prev, device]);
      });
      // Final set in case progressive updates missed any
      setDiscoveredDevices(devices);
    } catch {
      // Scan failed entirely — still show empty results
    } finally {
      setScanState('done');
    }
  }, []);

  function handleSelectDevice(device: DiscoveredDevice) {
    setIp(device.ip);
    setIpError('');
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setIpError('');

    if (!ip.trim()) {
      setIpError('Please enter an IP address');
      return;
    }

    setIsValidating(true);
    try {
      const client = new WLEDRestClient(ip.trim());
      const info = await client.getInfo();
      setCubeInfo(info);
      setStep(2);
    } catch {
      setIpError(`Could not reach HyperCube at ${ip}. Check the IP address.`);
    } finally {
      setIsValidating(false);
    }
  }

  function handleSkip() {
    onComplete(ip);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs text-muted-foreground">Step {step} of 3</span>
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip setup wizard"
          >
            Skip
          </button>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Connect to HyperCube</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Scan your network to find WLED devices, or enter an IP address manually.
            </p>

            {/* Network scan section */}
            <div className="mb-6">
              {scanState === 'idle' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScan}
                  className="w-full h-12 gap-2 border-dashed border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50"
                  aria-label="Scan network for WLED devices"
                >
                  <Search className="w-4 h-4" />
                  Scan Network
                </Button>
              )}

              {scanState === 'scanning' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-card border border-border/50">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Scanning network for WLED devices...
                    </span>
                  </div>
                  {discoveredDevices.length > 0 && (
                    <DeviceList
                      devices={discoveredDevices}
                      selectedIp={ip}
                      onSelect={handleSelectDevice}
                    />
                  )}
                </div>
              )}

              {scanState === 'done' && (
                <div className="space-y-3">
                  {discoveredDevices.length > 0 ? (
                    <>
                      <DeviceList
                        devices={discoveredDevices}
                        selectedIp={ip}
                        onSelect={handleSelectDevice}
                      />
                      <button
                        onClick={handleScan}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                        type="button"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rescan
                      </button>
                    </>
                  ) : (
                    <div className="text-center py-4 rounded-lg bg-card border border-border/50">
                      <p className="text-sm text-muted-foreground mb-3">
                        No devices found on your network.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleScan}
                        className="gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Scan
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            {scanState !== 'idle' && (
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground/60">
                    or enter manually
                  </span>
                </div>
              </div>
            )}

            {/* Manual IP input */}
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <Label htmlFor="cube-ip" className="text-foreground/80">HyperCube IP Address</Label>
                <Input
                  id="cube-ip"
                  type="text"
                  placeholder="192.168.1.100"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  className="mt-1 bg-card border-border text-foreground"
                  aria-describedby={ipError ? 'ip-error' : undefined}
                />
                {ipError && (
                  <p id="ip-error" className="text-red-400 text-xs mt-1" role="alert">
                    {ipError}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={isValidating}
                className="w-full"
              >
                {isValidating ? 'Connecting...' : 'Connect'}
              </Button>
            </form>
          </div>
        )}

        {step === 2 && cubeInfo && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Connected!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your HyperCube is ready to control.
            </p>
            <div className="bg-card rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Device</span>
                <span className="text-foreground font-medium">{cubeInfo.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">LEDs</span>
                <span className="text-foreground font-medium">{cubeInfo.leds.count} LEDs</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Firmware</span>
                <span className="text-foreground font-medium">{cubeInfo.ver}</span>
              </div>
            </div>
            <Button onClick={() => setStep(3)} className="w-full">
              Next: Quick Tour
            </Button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">What can you do?</h2>
            <ul className="space-y-3 mb-6">
              {[
                { icon: '\u{1F3A8}', title: 'WLED Effects', desc: 'Browse 100+ effects and palettes' },
                { icon: '\u{270F}\u{FE0F}', title: 'Paint LEDs', desc: 'Click and drag to paint individual LEDs' },
                { icon: '\u{1F3B5}', title: 'Audio Reactive', desc: 'React to music from any audio source' },
                { icon: '\u{1F4F7}', title: 'Video Mapping', desc: 'Map video or webcam to your cube' },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Button onClick={() => onComplete(ip)} className="w-full">
              Get Started
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Device card list for discovered WLED devices */
function DeviceList({
  devices,
  selectedIp,
  onSelect,
}: {
  devices: DiscoveredDevice[];
  selectedIp: string;
  onSelect: (device: DiscoveredDevice) => void;
}) {
  return (
    <div className="space-y-2" role="list" aria-label="Discovered WLED devices">
      {devices.map((device) => {
        const isSelected = device.ip === selectedIp;
        return (
          <button
            key={device.ip}
            type="button"
            onClick={() => onSelect(device)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left
              transition-colors cursor-pointer
              ${isSelected
                ? 'border-primary/60 bg-primary/10'
                : 'border-border/50 bg-card hover:border-primary/30 hover:bg-card/80'
              }
            `}
            role="listitem"
            aria-label={`Select ${device.name} at ${device.ip}`}
          >
            <div className={`
              flex items-center justify-center w-9 h-9 rounded-full shrink-0
              ${isSelected ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}
            `}>
              <Radio className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">
                {device.name}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{device.ip}</span>
                <span className="text-muted-foreground/40">|</span>
                <span>{device.ledCount} LEDs</span>
              </div>
            </div>
            {isSelected && (
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
