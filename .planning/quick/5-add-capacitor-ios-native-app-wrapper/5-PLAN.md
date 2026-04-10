---
id: quick-5
type: quick
description: Add Capacitor iOS native app wrapper
---

## Task 1: Install Capacitor and configure iOS platform

**Files:** package.json, capacitor.config.ts, ios/ (new)
**Action:**
1. Install @capacitor/core and @capacitor/cli as dependencies
2. Run `npx cap init "HyperCube" "com.hypercube.control" --web-dir dist`
3. Install @capacitor/ios
4. Run `npm run build` to generate dist/
5. Run `npx cap add ios`
6. Add NSLocalNetworkUsageDescription to ios/App/App/Info.plist: "HyperCube Control needs local network access to communicate with your HyperCube LED controller"
7. Also add NSBonjourServices with _http._tcp to Info.plist for local network discovery
8. Add npm scripts to package.json: "cap:sync": "npm run build && npx cap sync", "cap:ios": "npx cap open ios"
9. Run `npx cap sync` to sync the build
10. Do NOT run `npx cap open ios`
**Verify:** capacitor.config.ts exists, ios/ directory exists, package.json has cap scripts
**Done:** Capacitor iOS project scaffolded and synced
