import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
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

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8'
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
    'script.js',
    'style.css',
    'sw.js',
    'manifest.json',
    'firebase-config.js',
    'admin/index.html',
    'admin/admin.js',
    'all-lyrics/index.txt',
    'lyrics-data/songs-map.json',
    'twa/gradlew.bat',
    'twa/app/src/main/AndroidManifest.xml'
  ];
}

function checkRequiredFiles() {
  const missing = getRequiredFiles().filter((file) => !pathExists(file));
  if (missing.length > 0) {
    fail('Required files', `Missing: ${missing.join(', ')}`);
    return;
  }
  pass('Required files', `${getRequiredFiles().length} key files are present.`);
}

function checkJavaScriptSyntax() {
  const files = ['script.js', 'admin/admin.js', 'sw.js'];
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
    const text = readText('firebase-config.js');
    const hasPlaceholder = /PASTE_|YOUR_|example/i.test(text);
    const googleEnabled = /google:\s*true/.test(text);
    const facebookEnabled = /facebook:\s*true/.test(text);
    const adminEmails = [...text.matchAll(/"([^"]+@[^"]+)"/g)].map((match) => match[1]);

    if (hasPlaceholder) {
      fail('Firebase config', 'firebase-config.js still contains placeholder values.');
      return;
    }

    if (!googleEnabled && !facebookEnabled) {
      warn('Firebase auth providers', 'No sign-in provider is enabled in firebase-config.js.');
    } else {
      pass(
        'Firebase config',
        `Providers enabled: ${[
          googleEnabled ? 'Google' : null,
          facebookEnabled ? 'Facebook' : null
        ].filter(Boolean).join(', ')}. Admin emails listed: ${adminEmails.length}.`
      );
    }
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

function checkAndroidBuild() {
  if (process.argv.includes('--skip-android')) {
    warn('Android build', 'Skipped because --skip-android was provided.');
    return;
  }

  if (!pathExists('twa/gradlew.bat')) {
    warn('Android build', 'Gradle wrapper is missing, so the Android build check was skipped.');
    return;
  }

  const javaHome = findJavaHome();
  if (!javaHome) {
    warn('Android build', 'JAVA_HOME or bundled JDK was not found, so the Android build check was skipped.');
    return;
  }

  const env = { ...process.env, JAVA_HOME: javaHome };
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  env[pathKey] = `${path.join(javaHome, 'bin')}${path.delimiter}${env[pathKey] || ''}`;

  const result = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --console=plain'], {
        cwd: path.join(root, 'twa'),
        env,
        encoding: 'utf8'
      })
    : runCommand('./gradlew', ['assembleDebug', '--console=plain'], {
        cwd: path.join(root, 'twa'),
        env
      });

  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
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
    const audioDisabled = /const AUDIO_FEATURE_ENABLED\s*=\s*false\s*;/.test(scriptText);
    const usesLocalApk = /href=["']downloads\/bek-nah-lah\.apk["']/.test(downloadText);

    if (audioDisabled) {
      notes.push('audio is intentionally disabled');
    } else if (pathExists('all-lyrics/audio/index.json')) {
      notes.push('audio index is present');
    } else {
      warn('Optional assets', 'Audio is enabled in code, but all-lyrics/audio/index.json is missing.');
      return;
    }

    if (usesLocalApk) {
      if (!pathExists('downloads/bek-nah-lah.apk')) {
        warn('Optional assets', 'download.html points to downloads/bek-nah-lah.apk, but that file is missing.');
        return;
      }
      notes.push('local APK is present');
    } else {
      notes.push('download page uses a hosted APK link');
    }

    pass('Optional assets', `${notes.join('; ')}.`);
  } catch (error) {
    fail('Optional assets', error instanceof Error ? error.message : String(error));
  }
}

console.log('Bek Na Lah Health Check');
console.log('');

checkRequiredFiles();
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
