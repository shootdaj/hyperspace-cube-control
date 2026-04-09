/**
 * Vite plugin: Embedded sACN/E1.31 Bridge
 *
 * Starts a WebSocket server alongside the Vite dev server that bridges
 * browser WebSocket frames to sACN unicast UDP for the HyperCube.
 *
 * The browser sends 672-byte binary frames (224 LEDs x 3 RGB bytes).
 * These are split into 2 DMX universes and forwarded via sACN unicast.
 *
 * Universe layout:
 *   Universe 1: channels 1-510 (LEDs 0-169, 170 LEDs x 3 = 510 channels)
 *   Universe 2: channels 1-162 (LEDs 170-223, 54 LEDs x 3 = 162 channels)
 *
 * Config:
 *   VITE_CUBE_IP env var or .env file (default: 192.168.1.160)
 */

import http from 'node:http';
import { URL } from 'node:url';
import type { Plugin } from 'vite';
import { Sender } from 'sacn';
import { WebSocketServer, WebSocket } from 'ws';

const PREFIX = '[sACN Bridge]';

const LED_COUNT = 224;
const BYTES_PER_LED = 3;
const FRAME_SIZE = LED_COUNT * BYTES_PER_LED; // 672
const MAX_FPS = 44;
const MIN_FRAME_INTERVAL_MS = 1000 / MAX_FPS; // ~22.7ms
const WS_PORT = 3001;

const UNIVERSE_1_LEDS = 170;
const UNIVERSE_2_LEDS = LED_COUNT - UNIVERSE_1_LEDS; // 54
const UNIVERSE_1_CHANNELS = UNIVERSE_1_LEDS * BYTES_PER_LED; // 510
const UNIVERSE_2_CHANNELS = UNIVERSE_2_LEDS * BYTES_PER_LED; // 162

export default function sacnBridgePlugin(): Plugin {
  let wss: WebSocketServer | null = null;
  let sender1: Sender | null = null;
  let sender2: Sender | null = null;

  // Frame throttle state
  let lastFrameTime = 0;
  let frameCount = 0;
  let fpsStartTime = Date.now();

  function logFps(): void {
    const now = Date.now();
    const elapsed = now - fpsStartTime;
    if (elapsed >= 5000) {
      const fps = (frameCount / elapsed) * 1000;
      console.log(`${PREFIX} ${fps.toFixed(1)} fps (${frameCount} frames in ${(elapsed / 1000).toFixed(1)}s)`);
      frameCount = 0;
      fpsStartTime = now;
    }
  }

  async function sendFrame(data: Buffer | Uint8Array): Promise<void> {
    if (!sender1 || !sender2) return;

    const now = performance.now();
    if (now - lastFrameTime < MIN_FRAME_INTERVAL_MS) {
      return; // Drop frame -- too fast
    }
    lastFrameTime = now;

    // Build universe 1 payload: channels 1..510
    const payload1: Record<number, number> = {};
    for (let i = 0; i < UNIVERSE_1_CHANNELS; i++) {
      payload1[i + 1] = data[i]; // sACN channels are 1-indexed
    }

    // Build universe 2 payload: channels 1..162
    const payload2: Record<number, number> = {};
    for (let i = 0; i < UNIVERSE_2_CHANNELS; i++) {
      payload2[i + 1] = data[UNIVERSE_1_CHANNELS + i];
    }

    try {
      await Promise.all([
        sender1.send({ payload: payload1 }),
        sender2.send({ payload: payload2 }),
      ]);
      frameCount++;
      logFps();
    } catch (err) {
      console.error(`${PREFIX} sACN send error:`, err);
    }
  }

  return {
    name: 'sacn-bridge',
    apply: 'serve', // Only active in dev mode

    configureServer(server) {
      const cubeIp = process.env['VITE_CUBE_IP'] || '192.168.1.160';

      // ── WLED REST Proxy ──────────────────────────────────────────────────────
      // Routes /api/wled-proxy?target=IP&path=/json/state to the cube's HTTP API.
      // Bypasses Chrome Private Network Access (PNA) blocks by keeping requests
      // same-origin (localhost → localhost proxy → cube IP).
      server.middlewares.use('/api/wled-proxy', (req, res) => {
        try {
          const rawUrl = req.url ?? '/';
          // req.url on a mounted path includes the query string but not the mount path
          const parsedUrl = new URL(`http://localhost${rawUrl}`);
          const target = parsedUrl.searchParams.get('target');
          const path = parsedUrl.searchParams.get('path');

          if (!target || !path) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing required query params: target, path' }));
            return;
          }

          const upstreamOptions: http.RequestOptions = {
            hostname: target,
            port: 80,
            path: path,
            method: req.method ?? 'GET',
            headers: req.method === 'POST' ? { 'Content-Type': 'application/json' } : {},
          };

          const upstreamReq = http.request(upstreamOptions, (upstreamRes) => {
            res.statusCode = upstreamRes.statusCode ?? 200;
            res.setHeader('Content-Type', 'application/json');
            upstreamRes.pipe(res);
          });

          upstreamReq.on('error', (err) => {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Upstream error: ${err.message}` }));
          });

          if (req.method === 'POST') {
            req.pipe(upstreamReq);
          } else {
            upstreamReq.end();
          }
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Proxy error: ${String(err)}` }));
        }
      });
      // ────────────────────────────────────────────────────────────────────────

      // Create sACN senders
      sender1 = new Sender({
        universe: 1,
        reuseAddr: true,
        useUnicastDestination: cubeIp,
        defaultPacketOptions: {
          useRawDmxValues: true,
          sourceName: 'HyperCube Bridge',
          priority: 100,
        },
        minRefreshRate: 0,
      });

      sender2 = new Sender({
        universe: 2,
        reuseAddr: true,
        useUnicastDestination: cubeIp,
        defaultPacketOptions: {
          useRawDmxValues: true,
          sourceName: 'HyperCube Bridge',
          priority: 100,
        },
        minRefreshRate: 0,
      });

      // Create WebSocket server
      wss = new WebSocketServer({ port: WS_PORT });

      let clientCount = 0;

      wss.on('connection', (ws: WebSocket) => {
        clientCount++;
        console.log(`${PREFIX} Client connected (${clientCount} total)`);

        ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
          if (!isBinary) {
            const text = data.toString();
            console.log(`${PREFIX} Text message: ${text}`);
            return;
          }

          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

          if (buf.length !== FRAME_SIZE) {
            console.warn(`${PREFIX} Expected ${FRAME_SIZE} bytes, got ${buf.length} -- ignoring`);
            return;
          }

          sendFrame(buf);
        });

        ws.on('close', () => {
          clientCount--;
          console.log(`${PREFIX} Client disconnected (${clientCount} remaining)`);
        });

        ws.on('error', (err) => {
          console.error(`${PREFIX} WebSocket error:`, err);
        });

        // Send bridge info so the client knows the bridge is ready
        ws.send(JSON.stringify({
          type: 'bridge-info',
          cubeIp,
          ledCount: LED_COUNT,
          universes: 2,
          maxFps: MAX_FPS,
        }));
      });

      wss.on('error', (err) => {
        console.error(`${PREFIX} Server error:`, err);
      });

      // Log startup banner
      const addr = server.httpServer?.address();
      const port = addr && typeof addr === 'object' ? addr.port : 5173;
      console.log('');
      console.log(`  ${PREFIX} Embedded sACN/E1.31 Bridge started`);
      console.log(`  ${PREFIX} WebSocket : ws://localhost:${WS_PORT}`);
      console.log(`  ${PREFIX} Cube IP   : ${cubeIp}`);
      console.log(`  ${PREFIX} LEDs      : ${LED_COUNT} (Universe 1: 510ch + Universe 2: 162ch)`);
      console.log(`  ${PREFIX} Max FPS   : ${MAX_FPS}`);
      console.log(`  ${PREFIX} WLED Proxy : http://localhost:${port}/api/wled-proxy?target=${cubeIp}&path=/json/state`);
      console.log('');

      // Clean shutdown when Vite stops
      server.httpServer?.on('close', () => {
        console.log(`${PREFIX} Shutting down...`);
        if (wss) {
          wss.close();
          wss = null;
        }
        if (sender1) {
          sender1.close();
          sender1 = null;
        }
        if (sender2) {
          sender2.close();
          sender2 = null;
        }
      });
    },
  };
}
