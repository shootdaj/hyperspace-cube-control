---
id: quick-6
type: quick
description: Add network device discovery to connection wizard
---

## Task 1: Create device scanner service

**Files:** src/core/wled/DeviceScanner.ts (new)
**Action:**
1. Create a DeviceScanner class that scans a subnet for WLED devices
2. Method `scanSubnet(baseIp: string)`: takes a base like "192.168.1" and tries IPs 1-254
3. For each IP, fetch `/json/info` with AbortController timeout of 800ms
4. Run 20 parallel requests at a time (batch scanning)
5. Returns array of `{ ip: string, name: string, ledCount: number, brand: string }` for successful hits
6. Auto-detect the user's subnet from their local IP if possible (not critical -- default to 192.168.1)
7. Export a `scanForDevices()` function that handles the full flow
**Verify:** DeviceScanner can be imported
**Done:** Scanner service ready

## Task 2: Add discovery UI to SetupWizard Step 1

**Files:** src/setup/SetupWizard.tsx (modify)
**Action:**
1. Read the current SetupWizard.tsx to understand Step 1 layout
2. Add a "Scan Network" button with a Search/Wifi lucide icon
3. When clicked, call scanForDevices() and show a scanning spinner
4. Display found devices as clickable cards: device name, IP, LED count
5. Clicking a device auto-fills the IP input
6. Show "No devices found" if scan completes with 0 results, with a retry button
7. Keep manual IP input below the scan results
8. Style: dark theme consistent with existing UI
**Verify:** Wizard shows scan button, found devices are clickable
**Done:** Discovery integrated into wizard
