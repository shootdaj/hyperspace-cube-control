# Phase 7 Research: Video & Camera Input

## OffscreenCanvas + Web Worker for Video Frame Processing

**Approach:** Transfer video frames to a Web Worker using `OffscreenCanvas` and `postMessage` with transferable `Uint8Array` buffers.

**Key findings:**
- `OffscreenCanvas` can be created in a Worker and used with `canvas.getContext('2d')` to call `drawImage()` and `getImageData()` off the main thread
- Main thread draws video frame to a regular canvas, then transfers `ImageBitmap` via `createImageBitmap(videoElement)` to the worker
- Worker receives `ImageBitmap`, draws to `OffscreenCanvas`, calls `getImageData()` for pixel sampling
- Final `Uint8Array(480*3)` result is posted back via `postMessage(result, [result.buffer])` as a transferable — zero-copy transfer
- `getImageData()` on a 1080p canvas takes 6-10ms — doing this on main thread at 60fps blocks rendering

**Worker message protocol:**
```typescript
// Main → Worker
type WorkerRequest = 
  | { type: 'processFrame'; bitmap: ImageBitmap; strategy: 'edge-sampling' | 'face-extraction'; width: number; height: number }
  | { type: 'processMotion'; bitmap: ImageBitmap; sensitivity: number; width: number; height: number }
  | { type: 'configure'; canvasWidth: number; canvasHeight: number }

// Worker → Main
type WorkerResponse =
  | { type: 'frameResult'; leds: Uint8Array }
  | { type: 'motionResult'; leds: Uint8Array; motionLevel: number }
  | { type: 'error'; message: string }
```

## Canvas 2D getImageData for Pixel Sampling

- `ctx.getImageData(x, y, 1, 1)` returns a single pixel (4 bytes RGBA) — efficient for point sampling
- For sampling 480 points, batch into one `getImageData()` call on the full canvas then index into the result
- `ImageData.data` is a `Uint8ClampedArray` with RGBA layout: `[r, g, b, a, r, g, b, a, ...]`
- Pixel at (x, y) on canvas of width W: `offset = (y * W + x) * 4`

## Video Element as Texture Source

- `HTMLVideoElement` can be drawn to canvas via `ctx.drawImage(video, 0, 0, width, height)`
- `createImageBitmap(video)` creates a transferable bitmap from the current video frame
- `requestVideoFrameCallback()` is the preferred API for frame-accurate video processing (Chrome 83+, Safari 15.4+)
- Fallback: use `requestAnimationFrame` and check `video.currentTime` changes
- Video file loading: `URL.createObjectURL(file)` for local files, direct URL for remote

## getUserMedia for Webcam Access

- `navigator.mediaDevices.getUserMedia({ video: true })` returns a `MediaStream`
- Assign stream to `video.srcObject = stream`
- Permission states: 'granted', 'denied', 'prompt' — query via `navigator.permissions.query({ name: 'camera' })`
- On deny: catch `NotAllowedError` and show UI guidance
- Cleanup: `stream.getTracks().forEach(t => t.stop())` on destroy

## Frame Differencing for Motion Detection

**Algorithm:**
1. Capture current frame as grayscale pixel data
2. Compare with previous frame: `diff = abs(current[i] - previous[i])`
3. Apply threshold: `motion[i] = diff > threshold ? 1 : 0`
4. Count motion pixels for overall motion level
5. Map motion intensity to LED brightness/color

**Implementation:**
```typescript
// In worker
function computeMotion(current: Uint8ClampedArray, previous: Uint8ClampedArray, threshold: number): { motionMap: Uint8Array; motionLevel: number } {
  let motionPixels = 0;
  const motionMap = new Uint8Array(current.length / 4);
  for (let i = 0; i < current.length; i += 4) {
    const gray1 = (current[i] + current[i+1] + current[i+2]) / 3;
    const gray2 = (previous[i] + previous[i+1] + previous[i+2]) / 3;
    const diff = Math.abs(gray1 - gray2);
    const pixel = i / 4;
    motionMap[pixel] = diff > threshold ? Math.min(255, diff * 2) : 0;
    if (diff > threshold) motionPixels++;
  }
  return { motionMap, motionLevel: motionPixels / (current.length / 4) };
}
```

## Edge Sampling Strategy

**Concept:** Map the 12 cube edges to lines on the 2D video frame. Sample 40 evenly-spaced pixels along each line.

**Mapping approach:**
- Project cube edges onto a 2D rectangle (the video frame)
- Bottom 4 edges: sample along bottom quarter of frame
- Top 4 edges: sample along top quarter of frame  
- Vertical 4 edges: sample along left/right/front/back vertical strips
- Each edge samples 40 pixels linearly interpolated along its projected line
- Uses normalized coordinates (0-1) so it works at any resolution

## Face-to-Edge Extraction Strategy

**Concept:** Map each of the 6 cube faces to a region of the video frame, then extract pixel colors along the edges of each face region.

**Mapping approach:**
- Divide video frame into 6 regions (3x2 grid or unfolded cube net)
- For each face region, sample pixels along the 4 border edges
- Each edge gets 40 samples from the adjacent pixels at the border
- This captures the "edge" of each face's content, creating a more spatially-coherent mapping

## Transferable Uint8Array Between Worker and Main Thread

- `postMessage(data, [data.buffer])` transfers ownership of the ArrayBuffer — zero copy
- After transfer, the sender's reference becomes detached (length 0)
- Worker must allocate a new buffer for next frame after transferring
- `ImageBitmap` is also transferable: `postMessage({ bitmap }, [bitmap])`

## Browser Compatibility Notes

- `OffscreenCanvas`: Chrome 69+, Firefox 105+, Safari 16.4+
- `createImageBitmap`: Chrome 50+, Firefox 42+, Safari 15+
- `requestVideoFrameCallback`: Chrome 83+, Safari 15.4+, Firefox 130+ (with flag)
- `getUserMedia`: All modern browsers, requires HTTPS in production
- Web Workers: Universal support

---
*Researched: 2026-04-09*
