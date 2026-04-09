# Phase 5: Audio-Reactive Input — Research

## Web Audio API: Core Components

### AudioContext
- Created via `new AudioContext()` — represents the audio processing graph
- **Must be created/resumed inside a user gesture handler** (click/touch/keydown)
- States: `suspended` (initial if no gesture), `running`, `closed`
- Call `audioContext.resume()` inside a click handler to transition from suspended to running
- Default sample rate: 44100 Hz (or 48000 Hz on some systems)

### AnalyserNode
- Non-modifying passthrough node that provides real-time FFT data
- `fftSize`: Power of 2, from 32 to 32768. Default 2048. Controls resolution.
  - `frequencyBinCount` = `fftSize / 2` (read-only)
  - With fftSize=2048, get 1024 frequency bins
  - Each bin covers `sampleRate / fftSize` Hz (e.g., 44100/2048 = ~21.5 Hz per bin)
- `smoothingTimeConstant`: 0.0 to 1.0 (default 0.8). Higher = smoother but slower response.
- `minDecibels` / `maxDecibels`: Range for byte scaling (default -100 to -30 dB)
- `getByteFrequencyData(Uint8Array)`: Copies FFT magnitude data scaled 0-255
- `getFloatFrequencyData(Float32Array)`: Copies FFT magnitude data in dB

### GainNode
- `gain.value`: Multiplier. 1.0 = unity, 0.0 = silent, 2.0 = double volume
- Use `gain.setValueAtTime(value, context.currentTime)` for glitch-free changes
- Insert between source and analyser for sensitivity/gain control

### Audio Graph for This Feature
```
MediaStreamSource → GainNode → AnalyserNode → (no destination needed for analysis-only)
```
Note: For analysis-only (no playback), we don't connect to `context.destination`.

## Device Enumeration

### navigator.mediaDevices.enumerateDevices()
- Returns `Promise<MediaDeviceInfo[]>`
- Each device: `{ deviceId, groupId, kind, label }`
- `kind` values: `'audioinput'`, `'audiooutput'`, `'videoinput'`
- **Labels are empty until permission is granted** — must call `getUserMedia()` first
- Filter for `kind === 'audioinput'` to get microphones + virtual devices
- BlackHole virtual audio devices appear as regular `audioinput` devices
- Default device has `deviceId === 'default'`

### Selecting a Specific Device
```ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { deviceId: { exact: selectedDeviceId } }
});
```

### BlackHole Virtual Devices
- BlackHole 2ch / 16ch appear as standard audioinput devices
- No special handling needed — `enumerateDevices()` lists them like any mic
- Used for system audio capture on macOS (route system audio to BlackHole)

## AudioContext Suspended State Handling

### The Problem
- Chrome/Safari autoplay policy: AudioContext created without user gesture starts `suspended`
- Calling `resume()` outside a gesture handler may silently fail
- Safari is stricter — must create AND resume inside a gesture

### Recommended Pattern
```ts
let audioContext: AudioContext | null = null;

function initAudio() { // Called from click/touch handler
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}
```

### UI Handling
- Show "Click to enable audio" button when AudioContext is suspended
- Listen to `audioContext.onstatechange` to update UI
- Never auto-create AudioContext on page load

## Frequency-to-LED Mapping Strategies

### Linear Mapping (Simple)
- Divide frequencyBinCount evenly across LED count
- Problem: Most musical content is in low frequencies, which get very few bins
- Results in bottom LEDs being very active, top LEDs barely moving

### Logarithmic/Mel Scale Mapping (Recommended)
- Human hearing is logarithmic — mel scale transforms Hz to perceptual space
- Low frequencies get more LED representation, high frequencies compressed
- Formula: `mel = 2595 * Math.log10(1 + freq / 700)`
- Group FFT bins into mel-scaled bands, sum energy per band
- Map bands to LEDs — much better visual result

### Bark Scale
- 24 critical bands matching auditory system
- Similar to mel but with fixed boundaries
- Good for grouping into a small number of bands (e.g., 12 edges)

### Mapping to HyperCube (480 LEDs, 12 edges x 40 LEDs)
- **Per-Edge Spectrum**: Map 12 frequency bands to 12 edges. Each edge = one band.
  - Brightness of all 40 LEDs on an edge = amplitude of that band
  - Color = fixed per band (rainbow low→high) or HSL hue mapping
- **Waveform Per-Edge**: Each edge shows a waveform section (40 LEDs = 40 amplitude values)
- **Full Spectrum**: Map all 480 LEDs linearly/logarithmically across the full spectrum
- **Energy Pulse**: Overall energy drives brightness of all LEDs, color shifts with dominant frequency

### Color Mapping Approaches
- **Hue from frequency**: Low freq = red (0°), mid = green (120°), high = blue (240°)
- **Brightness from amplitude**: Louder = brighter
- **Saturation from bandwidth**: Narrow peak = saturated, broad = desaturated
- **Gamma correction**: Apply `brightness = Math.pow(linear, 2.2)` for perceptual linearity

## Smoothing and Performance

### Temporal Smoothing
- `AnalyserNode.smoothingTimeConstant` handles basic smoothing (0.8 default)
- Additional exponential smoothing per-bin: `smoothed[i] = alpha * current[i] + (1-alpha) * smoothed[i]`
- Decay factor for "falling" effect: LEDs dim gradually rather than snapping to black

### Performance
- Reuse `Uint8Array` buffer — never allocate in the animation loop
- `getByteFrequencyData()` is fast — sub-millisecond
- FFT computation happens internally in the audio thread, not on main thread
- Only the data copy to the Uint8Array happens on main thread

## Architecture Decisions for This Phase

### AudioPlugin as InputPlugin
- `initialize()`: Store context, prepare buffers (no AudioContext creation yet)
- `tick()`: Call `getByteFrequencyData()`, return `FrameData { type: 'audio', spectrum }`
- `destroy()`: Stop stream tracks, close AudioContext
- Separate `startAudio(deviceId)` method triggered by user gesture
- `stopAudio()` to release stream without destroying plugin

### AudioSpectrumMappingStrategy as MappingStrategy
- `map(frame, ledCount)`: Takes `frame.spectrum` Float32Array, returns `Uint8Array[ledCount*3]`
- Configurable modes: 'spectrum' (per-edge bands), 'energy' (pulse), 'waveform'
- Internal mel-scale binning for perceptual mapping
- HSL-to-RGB conversion for frequency-to-color mapping

### Zustand Store for Audio State
- `audioDevices: MediaDeviceInfo[]`
- `selectedDeviceId: string | null`
- `isAudioActive: boolean`
- `audioContextState: 'suspended' | 'running' | 'closed' | null`
- `gain: number` (0.0 to 5.0, default 1.0)
- `sensitivity: number` (threshold, 0-255)
- `visualizationMode: 'spectrum' | 'energy' | 'waveform'`

### UI Integration
- New "Audio" tab in ControlPanel
- Device selector dropdown (populated after user gesture grants permission)
- Start/Stop audio button (handles AudioContext lifecycle)
- Gain slider (0.0 to 5.0)
- Sensitivity/threshold slider
- Visualization mode selector (spectrum/energy/waveform)

## Sources
- [MDN: AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [MDN: getByteFrequencyData](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteFrequencyData)
- [MDN: Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
- [MDN: Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [MDN: GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode)
- [MDN: enumerateDevices](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)
- [Audio Reactive LED Strips Are Diabolically Hard](https://scottlawsonbc.com/post/audio-led)
- [Addpipe: Understanding Audio Frequency Analysis](https://blog.addpipe.com/understanding-audio-frequency-analysis-in-javascript-a-guide-to-using-analysernode-and-getbytefrequencydata/)
- [Unlock Web Audio in Safari](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos)
- [Chrome Media Devices](https://developer.chrome.com/blog/media-devices)
