# HyperCube Control — Technical Learnings

## 2026-04-10

### Three.js InstancedMesh + vertexColors
`MeshBasicMaterial({ vertexColors: true })` expects per-vertex color attributes on the geometry. SphereGeometry has none, so vertex colors default to (0,0,0). Instance colors (from `setColorAt`) get MULTIPLIED by vertex colors = always black. Fix: don't set `vertexColors: true` when using only instance colors.

### WLED seg.i JSON Format
WLED's JSON parser (`json.cpp`) uses type-checking: plain integers in `seg.i` arrays are LED indices, strings/arrays are colors. Sending `[0, 255, 0, 0]` sets indices, not an RGB color. Must use hex strings: `[0, "ff0000"]`. This bug was invisible when using sACN (raw UDP bypasses JSON parser).

### macOS Local Network Permission
macOS blocks non-Apple-signed processes from accessing local network IPs. Node.js (Homebrew) is blocked, but Python (also Homebrew) was already approved. System binaries (curl, nc) always work. Fix: use Python subprocess for UDP. The `systemextensionsctl` approach requires SIP disabled.

### sACN vs REST Priority in WLED
When sACN is actively streaming to WLED, REST API state changes (seg.col, fx, etc.) are ignored — sACN realtime data takes absolute priority. To change colors during sACN, must send through the sACN stream. To use REST, must stop sACN first (pause keep-alive).

### Capacitor Android HTTP
Capacitor WebView defaults to `https://localhost`. Set `androidScheme: 'http'` and `plugins.CapacitorHttp.enabled: true` to route all fetch() through native HTTP layer, bypassing WebView CORS/mixed content restrictions. Also need `android:usesCleartextTraffic="true"` and network_security_config.xml.

### Chrome Mixed Content
HTTPS-to-HTTP requests from Vercel to local cube IPs actually work in some browsers/configurations despite mixed content policy. Don't preemptively block — just catch errors silently.

### ESP32 Concurrent Request Limitation
WLED's ESP32 cannot handle HTTP REST polling AND sACN streaming simultaneously. REST polls during sACN cause the cube to flicker/blank intermittently. Fix: skip REST polling when sACN is active.

### Tailscale Network Extension
Even when Tailscale VPN is "disconnected" and "logged out", its network extension (`io.tailscale.ipn.macsys.network-extension`) remains `[activated enabled]` and can interfere with network routing. Disabling via System Settings > Network Extensions is required for clean network behavior.
