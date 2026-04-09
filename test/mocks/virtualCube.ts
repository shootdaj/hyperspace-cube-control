import { ws } from 'msw';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const wledWs = ws.link('ws://*/ws');

// hs-1.6 firmware -- use observed behavior, not upstream WLED assumptions
export const MOCK_INFO = {
  ver: 'hs-1.6',
  vid: 2406290,
  leds: { count: 480, pwr: 0, fps: 0, maxpwr: 850, maxseg: 32 },
  name: 'HyperCube',
  udpport: 21324,
  live: false,
  fxcount: 118,
  palcount: 71,
  wifi: { bssid: '', rssi: -60, signal: 80, channel: 6 },
};

export const MOCK_STATE = {
  on: true,
  bri: 128,
  transition: 7,
  ps: -1,
  pl: -1,
  nl: { on: false, dur: 60, fade: true, tbri: 0 },
  udpn: { send: false, recv: false },
  seg: [{
    id: 0,
    start: 0,
    stop: 480,
    len: 480,
    col: [[255, 160, 0, 0]],
    fx: 0,
    sx: 128,
    ix: 128,
    pal: 0,
    on: true,
    bri: 255,
  }],
};

const MOCK_EFFECTS = [
  'Solid', 'Blink', 'Breathe', 'Wipe', 'Wipe Random',
  'Random Colors', 'Sweep', 'Dynamic', 'Colorloop', 'Rainbow',
];

const MOCK_PALETTES = [
  'Default', 'Random Cycle', 'Primary Color', 'Based on Primary',
  'Set Colors', 'Based on Set', 'Party', 'Cloud', 'Lava', 'Ocean',
];

/** Generate mock live LED response -- 480 LEDs at a warm orange color */
function mockLiveResponse(): string {
  const leds = Array.from({ length: 480 }, () => 'FF8800');
  return JSON.stringify({ leds, n: 1 });
}

export const virtualCubeHandlers = [
  // WebSocket handler -- simulates WLED ws://[IP]/ws behavior
  wledWs.addEventListener('connection', ({ client }) => {
    // WLED sends initial state on connection (this is the actual hs-1.6 behavior)
    client.send(JSON.stringify({ state: MOCK_STATE, info: MOCK_INFO }));

    client.addEventListener('message', (event) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return; // ignore malformed messages
      }

      // {"v": true} -- request full state (WLED re-sends current state)
      if (msg['v'] === true) {
        client.send(JSON.stringify({ state: MOCK_STATE, info: MOCK_INFO }));
      }

      // {"lv": true} -- enable live LED stream (exclusive -- WLED only streams to one client)
      if (msg['lv'] === true) {
        client.send(mockLiveResponse());
      }
    });
  }),

  // REST API handlers
  http.get('http://*/json/info', () => HttpResponse.json(MOCK_INFO)),
  http.get('http://*/json/state', () => HttpResponse.json(MOCK_STATE)),
  http.post('http://*/json/state', () => HttpResponse.json({ success: true })),
  http.get('http://*/json/eff', () => HttpResponse.json(MOCK_EFFECTS)),
  http.get('http://*/json/pal', () => HttpResponse.json(MOCK_PALETTES)),
];

/** Pre-configured MSW server instance for use in integration/scenario tests */
export const server = setupServer(...virtualCubeHandlers);
