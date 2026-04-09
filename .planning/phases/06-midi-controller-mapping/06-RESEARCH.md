# Phase 6 Research: MIDI Controller Mapping

## WEBMIDI.js v3 API

### Initialization
```typescript
import { WebMidi } from 'webmidi';

// Enable with promise — returns resolved when ready
await WebMidi.enable();

// Access inputs after enable
WebMidi.inputs; // Input[]
WebMidi.inputs[0].name; // "Akai MPK Mini"
```

### Device Enumeration & Hot-plug
```typescript
// React to device connect/disconnect
WebMidi.addListener('connected', (e) => {
  // e.port — the Input or Output that was connected
  // Fires for all existing devices right after enable()
});

WebMidi.addListener('disconnected', (e) => {
  // e.port — the Input or Output that was disconnected
  // May fire multiple times per physical device
});
```

### Control Change Listening
```typescript
input.addListener('controlchange', (e) => {
  e.controller.number; // CC number 0-127
  e.value;             // normalized 0.0-1.0
  e.rawValue;          // raw 0-127
  e.message.channel;   // MIDI channel 1-16
});
```

### Note-On Listening
```typescript
input.addListener('noteon', (e) => {
  e.note.number;       // MIDI note number 0-127
  e.note.name;         // "C", "D#", etc.
  e.note.octave;       // -1 to 9
  e.velocity;          // normalized 0.0-1.0
  e.rawVelocity;       // raw 0-127
  e.message.channel;   // MIDI channel 1-16
});
```

### Cleanup
```typescript
input.removeListener(); // Remove all listeners from this input
WebMidi.disable();      // Full cleanup
```

## Browser Support

| Browser | Web MIDI API | Notes |
|---------|-------------|-------|
| Chrome 43+ | YES | Full support, requires HTTPS in production |
| Edge 79+ | YES | Chromium-based, same as Chrome |
| Opera 30+ | YES | Chromium-based |
| Firefox 108+ | YES | Behind `about:config` flag until 108; now enabled by default with site permission |
| Safari (all) | NO | Apple refuses due to fingerprinting concerns (since 2020) |
| iOS Safari | NO | Same as desktop Safari |
| iOS Chrome | NO | Uses WebKit engine on iOS, no Web MIDI |

**Key insight**: ALL iOS browsers use WebKit, so Web MIDI is unavailable on any iOS browser. Graceful degradation must detect `navigator.requestMIDIAccess` absence.

## MIDI Learn Pattern

Standard DAW-style MIDI learn workflow:
1. User clicks "Learn" button next to a parameter (e.g., brightness slider)
2. UI enters learn mode — visual indicator (pulsing border, amber highlight)
3. User moves a knob/fader on their MIDI controller
4. App captures the first incoming CC message: `{ channel, cc }`
5. Binding is created: `{ channel, cc } -> parameterName`
6. UI exits learn mode — shows green confirmation with CC number
7. Subsequent CC messages on that channel+cc update the parameter value

**Constraints:**
- One CC can map to one parameter (1:1)
- One parameter can have multiple CC sources (many:1 is optional, skip for v1)
- Note-on mapping: similar flow but captures note number instead of CC

## CC Value Mapping (0-127 to Parameters)

| Parameter | WLED Range | Mapping |
|-----------|-----------|---------|
| Brightness | 0-255 | `ccValue * 2` (0-127 -> 0-254) |
| Speed | 0-255 | `ccValue * 2` |
| Intensity | 0-255 | `ccValue * 2` |
| Color Hue | 0-360 | `ccValue * (360/127)` (0-127 -> 0-360 degrees) |

## Note-On to Actions

| Note Range | Action |
|------------|--------|
| User-defined | Activate preset by index in preset list |
| User-defined | Switch to effect by index in effect list |

## Persistence (localStorage)

```typescript
interface MIDIMappingConfig {
  version: 1;
  ccMappings: Array<{
    channel: number;   // 1-16
    cc: number;        // 0-127
    target: 'brightness' | 'speed' | 'intensity' | 'hue';
  }>;
  noteMappings: Array<{
    channel: number;   // 1-16
    note: number;      // 0-127
    action: 'preset' | 'effect';
    actionIndex: number; // preset or effect index
  }>;
}

const STORAGE_KEY = 'hypercube-midi-mappings';
localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
```

## Feature Detection

```typescript
function isMIDISupported(): boolean {
  return typeof navigator !== 'undefined' 
    && typeof navigator.requestMIDIAccess === 'function';
}
```

WebMidi.js internally checks this during `enable()` and throws if unavailable. We should check BEFORE calling enable() to show a user-friendly message.

## Sources
- [WEBMIDI.js GitHub](https://github.com/djipco/webmidi)
- [WEBMIDI.js Basics](https://webmidijs.org/docs/getting-started/basics/)
- [WEBMIDI.js Input API](https://webmidijs.org/api/classes/Input)
- [Can I Use: Web MIDI API](https://caniuse.com/midi)
- [WEBMIDI.js Supported Environments](https://webmidijs.org/docs/getting-started/)
- [Ableton MIDI Learn](https://help.ableton.com/hc/en-us/articles/360000038859-Making-custom-MIDI-Mappings)
