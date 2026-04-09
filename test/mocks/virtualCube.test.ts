import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server, MOCK_INFO, MOCK_STATE } from './virtualCube';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const BASE_URL = 'http://192.168.1.100';
const WS_URL = 'ws://192.168.1.100/ws';

describe('VirtualCube REST API', () => {
  it('TestVirtualCube_GetInfo_ReturnsHs16Firmware', async () => {
    const res = await fetch(`${BASE_URL}/json/info`);
    const json = await res.json() as typeof MOCK_INFO;
    expect(json.ver).toBe('hs-1.6');
    expect(json.leds.count).toBe(480);
    expect(json.name).toBe('HyperCube');
  });

  it('TestVirtualCube_GetState_ReturnsInitialState', async () => {
    const res = await fetch(`${BASE_URL}/json/state`);
    const json = await res.json() as typeof MOCK_STATE;
    expect(json.on).toBe(true);
    expect(json.bri).toBe(128);
    expect(json.seg).toHaveLength(1);
    expect(json.seg[0].len).toBe(480);
  });

  it('TestVirtualCube_PostState_ReturnsSuccess', async () => {
    const res = await fetch(`${BASE_URL}/json/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bri: 200 }),
    });
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('TestVirtualCube_GetEffects_ReturnsStringArray', async () => {
    const res = await fetch(`${BASE_URL}/json/eff`);
    const json = await res.json() as string[];
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(typeof json[0]).toBe('string');
    expect(json).toContain('Solid');
  });

  it('TestVirtualCube_GetPalettes_ReturnsStringArray', async () => {
    const res = await fetch(`${BASE_URL}/json/pal`);
    const json = await res.json() as string[];
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json).toContain('Default');
  });
});

describe('VirtualCube WebSocket', () => {
  it('TestVirtualCube_WsConnect_ReceivesInitialState', async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Timeout: no initial state received'));
      }, 3000);

      socket.onmessage = (event: MessageEvent<string>) => {
        clearTimeout(timer);
        const msg = JSON.parse(event.data) as { state?: typeof MOCK_STATE };
        expect(msg.state).toBeDefined();
        expect(msg.state!.on).toBe(true);
        socket.close();
        resolve();
      };

      socket.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  });

  it('TestVirtualCube_WsRequestState_ResponseContainsState', async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      let messageCount = 0;
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Timeout'));
      }, 3000);

      socket.onmessage = (event: MessageEvent<string>) => {
        messageCount++;
        const msg = JSON.parse(event.data) as { state?: unknown };
        if (messageCount === 1) {
          // First message is initial state -- send {"v": true} to request again
          socket.send(JSON.stringify({ v: true }));
        } else if (messageCount === 2) {
          clearTimeout(timer);
          expect(msg.state).toBeDefined();
          socket.close();
          resolve();
        }
      };

      socket.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  });

  it('TestVirtualCube_WsLiveStream_ReceivesLedHexArray', async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(WS_URL);
      let waitingForLive = false;
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Timeout waiting for live LED data'));
      }, 3000);

      socket.onmessage = (event: MessageEvent<string>) => {
        const msg = JSON.parse(event.data) as { leds?: string[]; n?: number; state?: unknown };
        if (!waitingForLive && msg.state) {
          // Initial state received -- request live stream
          waitingForLive = true;
          socket.send(JSON.stringify({ lv: true }));
        } else if (msg.leds) {
          clearTimeout(timer);
          expect(Array.isArray(msg.leds)).toBe(true);
          expect(msg.leds).toHaveLength(480);
          // Each entry should be a 6-character hex string
          expect(msg.leds[0]).toMatch(/^[0-9A-Fa-f]{6}$/);
          socket.close();
          resolve();
        }
      };

      socket.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  });
});
