# Play Store (TWA) Setup

This project already works as a PWA with offline support via `sw.js`.

## What you still need
1. A live HTTPS domain that serves this folder as the site root.
2. Your Android package name, for example `com.yourcompany.beknalah`.
3. The SHA-256 certificate fingerprint from your signing keystore.

## Steps
1. Host the site on your domain (HTTPS required).
2. Update `.well-known/assetlinks.json` with your real package name and SHA-256 fingerprint.
3. Install Bubblewrap and initialize the Android wrapper from your manifest.
4. Build the signed APK or AAB.
5. Upload to the Play Console.

## Bubblewrap commands (example)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.json
bubblewrap build
```

## Notes
1. The site must stay online for updates. Your existing service worker will keep the app usable offline after the first successful load.
2. If you change the domain, you must update and re-host `assetlinks.json`.
