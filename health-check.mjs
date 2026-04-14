import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const hostingRoot = getHostingRoot();
const failures = [];
const warnings = [];

function log(level, title, detail) {
  console.log(`[${level}] ${title}`);
  if (detail) {
    console.log(`       ${detail}`);
  }
}

function pass(title, detail) {
  log('PASS', title, detail);
}

function warn(title, detail) {
  warnings.push({ title, detail });
  log('WARN', title, detail);
}

function fail(title, detail) {
  failures.push({ title, detail });
  log('FAIL', title, detail);
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function pathExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function projectPath(relativePath, baseDir = '.') {
  return path.join(root, baseDir === '.' ? relativePath : path.join(baseDir, relativePath));
}

function readTextFrom(baseDir, relativePath) {
  return fs.readFileSync(projectPath(relativePath, baseDir), 'utf8');
}

function readBufferFrom(baseDir, relativePath) {
  return fs.readFileSync(projectPath(relativePath, baseDir));
}

function pathExistsIn(baseDir, relativePath) {
  return fs.existsSync(projectPath(relativePath, baseDir));
}

function getHostingRoot() {
  try {
    if (!pathExists('firebase.json')) {
      return '.';
    }

    const config = JSON.parse(stripBom(readText('firebase.json')));
    const configuredRoot = config?.hosting?.public;
    return typeof configuredRoot === 'string' && configuredRoot.trim() ? configuredRoot.trim() : '.';
  } catch {
    return '.';
  }
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
}

function formatCommandFailure(result, fallbackMessage) {
  const output = `${result.stderr || ''}\n${result.stdout || ''}`.trim();
  if (output) {
    return output.split(/\r?\n/).filter(Boolean).join(' | ');
  }

  if (result.error instanceof Error) {
    return result.error.message;
  }

  return fallbackMessage;
}

function looksLikeModuleSource(source) {
  return /^\s*(import|export)\b/m.test(source);
}

function transformModuleSourceForFallback(source) {
  return source
    .replace(/^\s*import[\s\S]*?;\s*$/gm, '')
    .replace(/^\s*export\s+\*\s+from\s+['"][^'"]+['"]\s*;\s*$/gm, '')
    .replace(/^\s*export\s*\{[\s\S]*?\}\s*(?:from\s+['"][^'"]+['"])?\s*;\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, 'const __default__ = ')
    .replace(/^\s*export\s+/gm, '');
}

function checkJavaScriptSyntaxInProcess(file) {
  const source = stripBom(readText(file));
  const isModule = looksLikeModuleSource(source);
  const parseSource = isModule
    ? `(async () => {\n${transformModuleSourceForFallback(source)}\n});`
    : source;

  try {
    new vm.Script(parseSource, { filename: file });
    return {
      ok: true,
      usedFallback: true
    };
  } catch (error) {
    return {
      ok: false,
      usedFallback: true,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function getRequiredFiles() {
  return [
    'index.html',
    'download.html',
    'install-apk.html',
    'script.js',
    'download.js',
    'style.css',
    'sw.js',
    'manifest.json',
    'apple-touch-icon.png',
    'build-android.cmd',
    '.well-known/assetlinks.json',
    'admin/index.html',
    'admin/admin.js',
    'all-lyrics/index.txt',
    'lyrics-data/songs-map.json',
    'twa/gradlew.bat',
    'twa/app/src/main/AndroidManifest.xml',
    'twa/app/src/main/res/raw/web_app_manifest.json',
    'twa/app/src/main/res/values/strings.xml',
    'twa/twa-manifest.json'
  ];
}

function getHostedRequiredFiles() {
  return [
    'index.html',
    'download.html',
    'install-apk.html',
    'script.js',
    'download.js',
    'style.css',
    'sw.js',
    'manifest.json',
    'apple-touch-icon.png',
    '.well-known/assetlinks.json',
    'admin/index.html',
    'admin/admin.css',
    'admin/admin.js',
    'all-lyrics/index.txt',
    'lyrics-data/songs-map.json',
    'icons/logo-mark.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'images/qr-download.png',
    'images/install-guide.svg'
  ];
}

function getMirroredWebFiles() {
  return [
    'index.html',
    'download.html',
    'install-apk.html',
    'script.js',
    'download.js',
    'style.css',
    'sw.js',
    'manifest.json',
    'firebase-config.js',
    'apple-touch-icon.png',
    '.well-known/assetlinks.json',
    'admin/index.html',
    'admin/admin.css',
    'admin/admin.js',
    'all-lyrics/index.txt',
    'lyrics-data/songs-map.json',
    'icons/logo-mark.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'images/qr-download.png',
    'images/install-guide.svg'
  ];
}

function normalizeManifestValue(field, value) {
  if (['background_color', 'theme_color'].includes(field)) {
    return String(value || '').toLowerCase();
  }

  return value || '';
}

function normalizeManifestIcons(icons) {
  return JSON.stringify(
    (icons || []).map((icon) => ({
      src: icon?.src || '',
      sizes: icon?.sizes || '',
      type: icon?.type || '',
      purpose: icon?.purpose || ''
    }))
  );
}

function readSongFileNames(baseDir = '.') {
  return fs.readdirSync(projectPath('all-lyrics/songs', baseDir)).sort();
}

function normalizeFingerprint(fingerprint) {
  return String(fingerprint || '').trim().toUpperCase();
}

function checkRequiredFiles() {
  const missing = getRequiredFiles().filter((file) => !pathExists(file));
  if (missing.length > 0) {
    fail('Required files', `Missing: ${missing.join(', ')}`);
    return;
  }
  pass('Required files', `${getRequiredFiles().length} key files are present.`);
}

function checkManifestSync() {
  try {
    const webManifest = JSON.parse(stripBom(readText('manifest.json')));
    const embeddedManifest = JSON.parse(stripBom(readText('twa/app/src/main/res/raw/web_app_manifest.json')));
    const fields = [
      'id',
      'name',
      'short_name',
      'start_url',
      'scope',
      'display',
      'background_color',
      'theme_color',
      'description'
    ];
    const mismatches = fields
      .filter((field) => normalizeManifestValue(field, webManifest[field]) !== normalizeManifestValue(field, embeddedManifest[field]))
      .map((field) => `${field}: web=${JSON.stringify(webManifest[field] || '')}, android=${JSON.stringify(embeddedManifest[field] || '')}`);
    const webIcons = normalizeManifestIcons(webManifest.icons);
    const embeddedIcons = normalizeManifestIcons(embeddedManifest.icons);

    if (webIcons !== embeddedIcons) {
      mismatches.push('icons: web and embedded manifest icon lists differ');
    }

    if (mismatches.length > 0) {
      fail('Manifest sync', mismatches.join(' | '));
      return;
    }

    pass('Manifest sync', 'Web manifest and embedded Android web manifest are aligned.');
  } catch (error) {
    fail('Manifest sync', error instanceof Error ? error.message : String(error));
  }
}

function checkTwaOriginConfig() {
  try {
    const twaManifest = JSON.parse(stripBom(readText('twa/twa-manifest.json')));
    const assetLinks = JSON.parse(stripBom(readText('.well-known/assetlinks.json')));
    const stringsText = readText('twa/app/src/main/res/values/strings.xml');
    const buildGradleText = readText('twa/app/build.gradle');
    const expectedSite = `https://${twaManifest.host}`;
    const expectedFullScopeUrl = `${expectedSite}/`;
    const expectedWebManifestUrl = `${expectedSite}/manifest.json`;
    const issues = [];

    const stringsSite = stringsText.match(/\\"site\\":\s*\\"([^"]+)\\"/)?.[1] || '';
    const hostName = buildGradleText.match(/hostName:\s*'([^']+)'/)?.[1] || '';
    const webManifestUrl = buildGradleText.match(/webManifestUrl",\s*'([^']+)'/)?.[1] || '';
    const fullScopeUrl = buildGradleText.match(/fullScopeUrl",\s*'([^']+)'/)?.[1] || '';

    if (stringsSite !== expectedSite) {
      issues.push(`strings.xml site=${JSON.stringify(stringsSite)}, expected=${JSON.stringify(expectedSite)}`);
    }

    if (hostName !== twaManifest.host) {
      issues.push(`build.gradle hostName=${JSON.stringify(hostName)}, twa-manifest host=${JSON.stringify(twaManifest.host)}`);
    }

    if (webManifestUrl !== expectedWebManifestUrl) {
      issues.push(`build.gradle webManifestUrl=${JSON.stringify(webManifestUrl)}, expected=${JSON.stringify(expectedWebManifestUrl)}`);
    }

    if (fullScopeUrl !== expectedFullScopeUrl) {
      issues.push(`build.gradle fullScopeUrl=${JSON.stringify(fullScopeUrl)}, expected=${JSON.stringify(expectedFullScopeUrl)}`);
    }

    const trustedAssetLink = assetLinks.find((entry) => Array.isArray(entry?.relation) && entry.relation.includes('delegate_permission/common.handle_all_urls'));
    const packageName = trustedAssetLink?.target?.package_name || '';
    const assetFingerprints = new Set((trustedAssetLink?.target?.sha256_cert_fingerprints || []).map(normalizeFingerprint));
    const manifestFingerprints = new Set((twaManifest.fingerprints || []).map((entry) => normalizeFingerprint(entry?.value)));

    if (packageName !== twaManifest.packageId) {
      issues.push(`assetlinks package_name=${JSON.stringify(packageName)}, expected=${JSON.stringify(twaManifest.packageId)}`);
    }

    const missingFingerprints = [...manifestFingerprints].filter((fingerprint) => !assetFingerprints.has(fingerprint));
    const extraFingerprints = [...assetFingerprints].filter((fingerprint) => !manifestFingerprints.has(fingerprint));
    if (missingFingerprints.length || extraFingerprints.length) {
      issues.push(
        [
          missingFingerprints.length ? `missing fingerprints: ${missingFingerprints.join(', ')}` : '',
          extraFingerprints.length ? `extra fingerprints: ${extraFingerprints.join(', ')}` : ''
        ].filter(Boolean).join(' | ')
      );
    }

    if (issues.length > 0) {
      fail('TWA origin config', issues.join(' | '));
      return;
    }

    pass('TWA origin config', `Host ${twaManifest.host} is aligned across Bubblewrap config, Android resources, and asset links.`);
  } catch (error) {
    fail('TWA origin config', error instanceof Error ? error.message : String(error));
  }
}

function checkHostingLayout() {
  if (hostingRoot === '.') {
    pass('Hosting layout', 'Firebase hosting is configured to serve the project root.');
    return;
  }

  try {
    if (!pathExists(hostingRoot)) {
      fail('Hosting layout', `firebase.json points to ${hostingRoot}, but that directory does not exist.`);
      return;
    }

    const missing = getHostedRequiredFiles().filter((file) => !pathExistsIn(hostingRoot, file));
    if (missing.length > 0) {
      fail('Hosting layout', `firebase.json points to ${hostingRoot}, but required hosted files are missing: ${missing.join(', ')}`);
      return;
    }

    pass('Hosting layout', `firebase.json points to ${hostingRoot}, and the required hosted files are present.`);
  } catch (error) {
    fail('Hosting layout', error instanceof Error ? error.message : String(error));
  }
}

function checkHostedMirrorSync() {
  if (hostingRoot === '.') {
    return;
  }

  try {
    const mismatchedFiles = getMirroredWebFiles().filter((file) => {
      if (!pathExists(file) || !pathExistsIn(hostingRoot, file)) {
        return false;
      }

      return Buffer.compare(readBufferFrom('.', file), readBufferFrom(hostingRoot, file)) !== 0;
    });

    const rootSongFiles = readSongFileNames('.');
    const hostedSongFiles = pathExistsIn(hostingRoot, 'all-lyrics/songs') ? readSongFileNames(hostingRoot) : [];
    const hostedSongSet = new Set(hostedSongFiles);
    const rootSongSet = new Set(rootSongFiles);
    const missingSongs = rootSongFiles.filter((file) => !hostedSongSet.has(file));
    const extraSongs = hostedSongFiles.filter((file) => !rootSongSet.has(file));
    const mismatchedSongs = [];

    if (!missingSongs.length && !extraSongs.length) {
      for (const file of rootSongFiles) {
        if (Buffer.compare(readBufferFrom('.', `all-lyrics/songs/${file}`), readBufferFrom(hostingRoot, `all-lyrics/songs/${file}`)) !== 0) {
          mismatchedSongs.push(file);
          if (mismatchedSongs.length >= 5) {
            break;
          }
        }
      }
    }

    if (mismatchedFiles.length || missingSongs.length || extraSongs.length || mismatchedSongs.length) {
      fail(
        'Hosted mirror sync',
        [
          mismatchedFiles.length ? `mismatched files: ${mismatchedFiles.join(', ')}` : '',
          missingSongs.length ? `missing song files: ${missingSongs.slice(0, 10).join(', ')}${missingSongs.length > 10 ? ', ...' : ''}` : '',
          extraSongs.length ? `extra song files: ${extraSongs.slice(0, 10).join(', ')}${extraSongs.length > 10 ? ', ...' : ''}` : '',
          mismatchedSongs.length ? `mismatched song files: ${mismatchedSongs.join(', ')}` : ''
        ].filter(Boolean).join(' | ')
      );
      return;
    }

    pass('Hosted mirror sync', `${hostingRoot} matches the checked source files and all ${rootSongFiles.length} song files.`);
  } catch (error) {
    fail('Hosted mirror sync', error instanceof Error ? error.message : String(error));
  }
}

function checkJavaScriptSyntax() {
  const files = ['script.js', 'download.js', 'admin/admin.js', 'sw.js'];
  const broken = [];
  const fallbackFiles = [];

  files.forEach((file) => {
    const result = runCommand(process.execPath, ['--check', file]);
    if (result.status === 0) {
      return;
    }

    const canUseFallback = result.error instanceof Error && ['EPERM', 'EACCES'].includes(result.error.code || '');
    if (canUseFallback) {
      const fallback = checkJavaScriptSyntaxInProcess(file);
      if (fallback.ok) {
        fallbackFiles.push(file);
        return;
      }

      broken.push(`${file}: ${fallback.message}`);
      return;
    }

    const message = formatCommandFailure(result, 'Syntax check failed.');
    broken.push(`${file}: ${message}`);
  });

  if (broken.length > 0) {
    fail('JavaScript syntax', broken.join(' | '));
    return;
  }

  const detail = fallbackFiles.length > 0
    ? `${files.join(', ')}. In-process fallback used for: ${fallbackFiles.join(', ')}.`
    : files.join(', ');

  pass('JavaScript syntax', detail);
}

function parseIndexNumbers(indexText) {
  return [...indexText.matchAll(/^(\d+)\./gm)].map((match) => Number(match[1]));
}

function checkLyricsData() {
  try {
    const indexText = readText('all-lyrics/index.txt');
    const indexNumbers = parseIndexNumbers(indexText);
    const songsMapText = readText('lyrics-data/songs-map.json');
    const songsMap = JSON.parse(stripBom(songsMapText));
    const songFiles = new Set(fs.readdirSync(path.join(root, 'all-lyrics', 'songs')));

    const missingMap = indexNumbers.filter((num) => !songsMap[String(num)]);
    const missingFiles = indexNumbers.filter((num) => songsMap[String(num)] && !songFiles.has(songsMap[String(num)]));
    const extraMap = Object.keys(songsMap).map(Number).filter((num) => !indexNumbers.includes(num));

    if (missingMap.length || missingFiles.length || extraMap.length) {
      fail(
        'Lyrics data consistency',
        [
          missingMap.length ? `missing map: ${missingMap.join(', ')}` : '',
          missingFiles.length ? `missing files: ${missingFiles.join(', ')}` : '',
          extraMap.length ? `extra map keys: ${extraMap.join(', ')}` : ''
        ].filter(Boolean).join(' | ')
      );
      return;
    }

    pass(
      'Lyrics data consistency',
      `${indexNumbers.length} index entries, ${Object.keys(songsMap).length} map entries, ${songFiles.size} song files.`
    );

    if (songsMapText.charCodeAt(0) === 0xfeff) {
      warn('songs-map encoding', 'lyrics-data/songs-map.json still starts with a UTF-8 BOM.');
    }
  } catch (error) {
    fail('Lyrics data consistency', error instanceof Error ? error.message : String(error));
  }
}

function checkFirebaseConfig() {
  try {
    if (!pathExists('firebase-config.js')) {
      warn('Firebase config', 'Optional for the current local-only app.');
      return;
    }

    const text = readText('firebase-config.js');
    const hasPlaceholder = /PASTE_|YOUR_|example/i.test(text);
    const adminEmails = [...text.matchAll(/"([^"]+@[^"]+)"/g)].map((match) => match[1]);

    if (hasPlaceholder) {
      fail('Firebase config', 'firebase-config.js still contains placeholder values.');
      return;
    }

    pass('Firebase config', `Optional config present. Admin emails listed: ${adminEmails.length}.`);
  } catch (error) {
    fail('Firebase config', error instanceof Error ? error.message : String(error));
  }
}

function findJavaHome() {
  const executable = process.platform === 'win32' ? 'java.exe' : 'java';
  const envJavaHome = process.env.JAVA_HOME;
  if (envJavaHome && fs.existsSync(path.join(envJavaHome, 'bin', executable))) {
    return envJavaHome;
  }

  const bundledRoot = path.join(root, 'jdk-17');
  if (!fs.existsSync(bundledRoot)) {
    return null;
  }

  const children = fs.readdirSync(bundledRoot, { withFileTypes: true });
  for (const child of children) {
    if (!child.isDirectory()) continue;
    const candidate = path.join(bundledRoot, child.name);
    if (fs.existsSync(path.join(candidate, 'bin', executable))) {
      return candidate;
    }
  }

  return null;
}

function findAndroidSdk() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(root, 'android-sdk')];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (fs.existsSync(path.join(candidate, 'platforms'))) {
      return candidate;
    }
  }

  return null;
}

function buildToolingEnv() {
  const env = { ...process.env };
  const javaHome = findJavaHome();
  const androidSdk = findAndroidSdk();
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';

  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
  }

  if (androidSdk) {
    env.ANDROID_HOME = androidSdk;
    env.ANDROID_SDK_ROOT = androidSdk;
  }

  env.GRADLE_USER_HOME = process.env.GRADLE_USER_HOME || path.join(root, 'twa', '.gradle-cache');

  return { env, javaHome, androidSdk };
}

function isRepositoryAccessFailure(output) {
  return /Permission denied: getsockopt|Could not (?:HEAD|GET) 'https?:\/\/|Could not get resource 'https?:\/\//.test(output);
}

function checkAndroidBuild() {
  if (process.argv.includes('--skip-android')) {
    warn('Android build', 'Skipped because --skip-android was provided.');
    return;
  }

  if (!pathExists('twa/gradlew.bat')) {
    warn('Android build', 'Gradle wrapper is missing, so the Android build check was skipped.');
    return;
  }

  const { env, javaHome, androidSdk } = buildToolingEnv();
  if (!javaHome) {
    warn('Android build', 'JAVA_HOME or bundled JDK was not found, so the Android build check was skipped.');
    return;
  }

  if (!androidSdk) {
    warn('Android build', 'ANDROID_HOME/ANDROID_SDK_ROOT or bundled android-sdk was not found, so the Android build check was skipped.');
    return;
  }

  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --console=plain --no-daemon'], {
        cwd: path.join(root, 'twa'),
        env,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      })
    : runCommand('./gradlew', ['assembleDebug', '--console=plain', '--no-daemon'], {
        cwd: path.join(root, 'twa'),
        env
      });

  if (result.error instanceof Error && ['EPERM', 'EACCES'].includes(result.error.code || '')) {
    warn(
      'Android build',
      'Gradle could not be launched from this sandboxed environment. Run health-check.cmd or gradlew from a normal local shell to verify the APK build.'
    );
    return;
  }

  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    if (isRepositoryAccessFailure(output)) {
      warn(
        'Android build',
        'Gradle could not reach Maven repositories from this environment. The project is configured to use the bundled JDK/SDK, but dependency downloads still need network access.'
      );
      return;
    }
    const lines = output.split(/\r?\n/).filter(Boolean);
    fail('Android build', lines.slice(-12).join(' | ') || 'assembleDebug failed.');
    return;
  }

  const apkPath = 'twa/app/build/outputs/apk/debug/app-debug.apk';
  if (pathExists(apkPath)) {
    pass('Android build', `assembleDebug passed and ${apkPath} exists.`);
  } else {
    warn('Android build', 'assembleDebug passed, but the debug APK was not found where expected.');
  }
}

function checkOptionalAssets() {
  try {
    const notes = [];
    const scriptText = readText('script.js');
    const downloadText = readText('download.html');
    const installApkText = readText('install-apk.html');
    const downloadScriptText = readText('download.js');
    const audioDisabled = /const AUDIO_FEATURE_ENABLED\s*=\s*false\s*;/.test(scriptText);
    const localApkPattern = /downloads\/Beek-Na-Lah\.apk/;
    const hostedApkPattern = /https:\/\/github\.com\/wisdomchiru9-png\/wisdomchiru9-png\.github\.io\/releases\/download\/v([\d.]+)\/Beek-Na-Lah\.apk/;
    const usesInstallPage = /href=["']install-apk\.html["']/.test(downloadText);
    const installUsesLocalApk = localApkPattern.test(installApkText);
    const scriptUsesLocalApk = localApkPattern.test(downloadScriptText);
    const installHostedMatch = installApkText.match(hostedApkPattern);
    const scriptHostedMatch = downloadScriptText.match(hostedApkPattern);
    const hostedVersions = new Set([installHostedMatch?.[1], scriptHostedMatch?.[1]].filter(Boolean));

    if (!usesInstallPage) {
      warn('Optional assets', 'download.html no longer routes Android installs through install-apk.html.');
    }

    if (hostedVersions.size > 1) {
      fail('Optional assets', `install-apk.html and download.js reference different hosted APK versions: ${[...hostedVersions].join(', ')}`);
      return;
    }

    if (!installUsesLocalApk && !scriptUsesLocalApk && hostedVersions.size === 0) {
      warn('Optional assets', 'install-apk.html and download.js do not point to a hosted or local Beek-Na-Lah.apk.');
    }

    if (audioDisabled) {
      notes.push('audio is intentionally disabled');
    } else if (pathExists('all-lyrics/audio/index.json')) {
      notes.push('audio index is present');
    } else {
      warn('Optional assets', 'Audio is enabled in code, but all-lyrics/audio/index.json is missing.');
      return;
    }

    if (installUsesLocalApk || scriptUsesLocalApk) {
      if (!pathExists('downloads/Beek-Na-Lah.apk')) {
        warn('Optional assets', 'install flow points to downloads/Beek-Na-Lah.apk, but that file is missing.');
        return;
      }
      notes.push('local APK is present');
    } else if (hostedVersions.size === 1) {
      notes.push(`hosted APK link uses v${[...hostedVersions][0]}`);
    }

    pass('Optional assets', `${notes.join('; ')}.`);
  } catch (error) {
    fail('Optional assets', error instanceof Error ? error.message : String(error));
  }
}

console.log('Beek-Na-Lah Health Check');
console.log('');

checkRequiredFiles();
checkManifestSync();
checkTwaOriginConfig();
checkHostingLayout();
checkHostedMirrorSync();
checkJavaScriptSyntax();
checkLyricsData();
checkFirebaseConfig();
checkAndroidBuild();
checkOptionalAssets();

console.log('');
if (failures.length > 0) {
  console.log(`Summary: ${failures.length} failure(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`Summary: all required checks passed with ${warnings.length} warning(s).`);
