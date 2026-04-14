# Play Store (TWA) Setup

This project already works as a PWA with offline support via `sw.js`.

## Current app values
1. Domain: `https://Beek-Na-Lah.in/`
2. Android package: `com.wisdomchiru.beeknalah`
3. Signing alias: keep your existing keystore alias, or set it explicitly with `BEEKNALAH_KEY_ALIAS`

## What you still need
1. Your live HTTPS site must keep serving this folder as the site root.
2. Your release keystore must stay available locally.
3. The SHA-256 certificate fingerprint in `.well-known/assetlinks.json` must match that keystore.

## Steps
1. Host the site on your domain (HTTPS required).
2. Confirm `.well-known/assetlinks.json` matches your signing key fingerprint.
3. Set `BEEKNALAH_KEYSTORE_PASSWORD` and `BEEKNALAH_KEY_PASSWORD` in your shell, or use the Bubblewrap password variables.
4. Run `build-android.cmd release` from the project root.
5. Upload the generated `.aab` or signed `.apk` from `twa/app/build/outputs/`.

## Local build commands
```bat
build-android.cmd debug
build-android.cmd release
build-android.cmd all
```

Release builds use these environment variables if present:
```bat
set BEEKNALAH_KEYSTORE_PASSWORD=your-keystore-password
set BEEKNALAH_KEY_PASSWORD=your-key-password
```

Legacy `BEKNALAH_*` variable names are still accepted for compatibility.

## Bubblewrap commands (example)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.json
bubblewrap build
```

## Notes
1. The site must stay online for updates. Your existing service worker will keep the app usable offline after the first successful load.
2. If you change the domain, you must update and re-host `assetlinks.json`.
3. `build-android.cmd` automatically uses the bundled `jdk-17`, `android-sdk`, and Gradle cache inside this repo.
