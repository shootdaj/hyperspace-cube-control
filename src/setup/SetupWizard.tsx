import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WLEDRestClient } from '@/core/wled/WLEDRestClient';
import type { WLEDInfo } from '@/core/wled/types';

interface SetupWizardProps {
  onComplete: (ip: string) => void;
}

type Step = 1 | 2 | 3;

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [ip, setIp] = useState('');
  const [ipError, setIpError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [cubeInfo, setCubeInfo] = useState<WLEDInfo | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-xs text-zinc-500">Step {step} of 3</span>
          <button
            onClick={handleSkip}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Skip setup wizard"
          >
            Skip
          </button>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Connect to HyperCube</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Enter the IP address of your HyperCube. Find it in your router&apos;s device list
              or on the WLED web interface.
            </p>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <Label htmlFor="cube-ip" className="text-zinc-300">HyperCube IP Address</Label>
                <Input
                  id="cube-ip"
                  type="text"
                  placeholder="192.168.1.100"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  className="mt-1 bg-zinc-900 border-zinc-700 text-zinc-100"
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
            <p className="text-zinc-400 text-sm mb-6">
              Your HyperCube is ready to control.
            </p>
            <div className="bg-zinc-900 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Device</span>
                <span className="text-zinc-100 font-medium">{cubeInfo.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">LEDs</span>
                <span className="text-zinc-100 font-medium">{cubeInfo.leds.count} LEDs</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Firmware</span>
                <span className="text-zinc-100 font-medium">{cubeInfo.ver}</span>
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
                    <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                    <p className="text-xs text-zinc-400">{item.desc}</p>
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
