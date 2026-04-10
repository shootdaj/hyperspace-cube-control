/**
 * Vite plugin: Embedded sACN/E1.31 Bridge
 *
 * Starts a WebSocket server alongside the Vite dev server that bridges
 * browser WebSocket frames to sACN unicast UDP for the HyperCube.
 *
 * sACN packets are sent via a Python subprocess (sacn-relay.py) to bypass
 * macOS Local Network permission restrictions on Node.js.
 *
 * The browser sends 672-byte binary frames (224 LEDs x 3 RGB bytes).
 * The Python relay splits them into 2 DMX universes and forwards via sACN unicast.
 *
 * Config:
 *   VITE_CUBE_IP env var or .env file (default: 192.168.1.160)
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { URL } from 'node:url';
import type { Plugin } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

const PREFIX = '[sACN Bridge]';

const LED_COUNT = 224;
const BYTES_PER_LED = 3;
const FRAME_SIZE = LED_COUNT * BYTES_PER_LED; // 672
const MAX_FPS = 44;
const MIN_FRAME_INTERVAL_MS = 1000 / MAX_FPS; // ~22.7ms
const WS_PORT = 3001;

export default function sacnBridgePlugin(): Plugin {
  let wss: WebSocketServer | null = null;
  let relay: ChildProcess | null = null;

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

  function sendFrame(data: Buffer | Uint8Array): void {
    if (!relay || !relay.stdin || relay.killed) return;

    const now = performance.now();
    if (now - lastFrameTime < MIN_FRAME_INTERVAL_MS) {
      return; // Drop frame -- too fast
    }
    lastFrameTime = now;

    // Write length-prefixed frame to Python relay stdin
    const header = Buffer.alloc(2);
    header.writeUInt16BE(data.length);
    try {
      relay.stdin.write(header);
      relay.stdin.write(data);
      frameCount++;
      logFps();
    } catch (err) {
      console.error(`${PREFIX} relay write error:`, err);
    }
  }

  return {
    name: 'sacn-bridge',
    apply: 'serve', // Only active in dev mode

    configureServer(server) {
      const cubeIp = process.env['VITE_CUBE_IP'] || '192.168.1.160';

      // ── WLED REST Proxy ──────────────────────────────────────────────────
      server.middlewares.use('/api/wled-proxy', (req, res) => {
        try {
          const rawUrl = req.url ?? '/';
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
      // ────────────────────────────────────────────────────────────────────

      // Spawn Python sACN relay subprocess
      const relayScript = resolve(dirname(fileURLToPath(import.meta.url)), 'sacn-relay.py');
      relay = spawn('python3', [relayScript, cubeIp], {
        stdio: ['pipe', 'inherit', 'inherit'],
      });

      relay.on('error', (err) => {
        console.error(`${PREFIX} Failed to start Python sACN relay:`, err.message);
      });

      relay.on('exit', (code) => {
        if (code !== null && code !== 0) {
          console.error(`${PREFIX} Python sACN relay exited with code ${code}`);
        }
        relay = null;
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
      console.log('');
      console.log(`  ${PREFIX} Embedded sACN/E1.31 Bridge started`);
      console.log(`  ${PREFIX} WebSocket : ws://localhost:${WS_PORT}`);
      console.log(`  ${PREFIX} Cube IP   : ${cubeIp}`);
      console.log(`  ${PREFIX} LEDs      : ${LED_COUNT} (via Python sACN relay)`);
      console.log(`  ${PREFIX} Max FPS   : ${MAX_FPS}`);
      console.log('');

      // Clean shutdown when Vite stops
      server.httpServer?.on('close', () => {
        console.log(`${PREFIX} Shutting down...`);
        if (wss) {
          wss.close();
          wss = null;
        }
        if (relay && !relay.killed) {
          relay.kill();
          relay = null;
        }
      });
    },
  };
}
