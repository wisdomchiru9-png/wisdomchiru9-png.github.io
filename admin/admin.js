const STORAGE_KEYS = {
  session: 'bekNaLahAdminUnlocked',
  failCount: 'bekNaLahAdminFailCount',
  lockUntil: 'bekNaLahAdminLockUntil',
  drafts: 'bekNaLahAdminDraftsV1'
};

const PASSWORD_SALT = 'bek-na-lah-admin-v1';
const PASSWORD_HASH = '8405d136ee16702cb24ad2d195928e7f93623533afd0bc18f85b99c60c337ee0';
const SITE_ROOT = '../';

const dom = {
  lockscreen: document.getElementById('admin-lockscreen'),
  protectedArea: document.getElementById('admin-protected'),
  loginForm: document.getElementById('admin-login-form'),
  passwordInput: document.getElementById('admin-password'),
  unlockButton: document.getElementById('admin-unlock'),
  logoutButton: document.getElementById('admin-logout'),
  loginStatus: document.getElementById('admin-login-status'),

  statTotalSongs: document.getElementById('stat-total-songs'),
  statDraftCount: document.getElementById('stat-draft-count'),
  statNextNumber: document.getElementById('stat-next-number'),
  statActiveSong: document.getElementById('stat-active-song'),
  overviewSourceMode: document.getElementById('overview-source-mode'),
  overviewCurrentFile: document.getElementById('overview-current-file'),
  overviewDraftHealth: document.getElementById('overview-draft-health'),

  connectProjectButton: document.getElementById('connect-project'),
  reloadSourceButton: document.getElementById('reload-source'),
  writeAllProjectButton: document.getElementById('write-all-project'),
  exportBackupButton: document.getElementById('export-backup'),
  importBackupTrigger: document.getElementById('import-backup-trigger'),
  importBackupInput: document.getElementById('import-backup-input'),
  downloadIndexButton: document.getElementById('download-index'),
  downloadMapButton: document.getElementById('download-map'),
  clearAllDraftsButton: document.getElementById('clear-all-drafts'),
  projectStatus: document.getElementById('admin-project-status'),
  adminStatus: document.getElementById('admin-status'),

  songSearchInput: document.getElementById('song-search'),
  songListMeta: document.getElementById('song-list-meta'),
  songList: document.getElementById('song-list'),
  newSongButton: document.getElementById('new-song'),

  editorBadge: document.getElementById('editor-badge'),
  songEditorForm: document.getElementById('song-editor-form'),
  songNumInput: document.getElementById('song-num-input'),
  songTitleInput: document.getElementById('song-title-input'),
  songRefInput: document.getElementById('song-ref-input'),
  songFileNameInput: document.getElementById('song-file-name-input'),
  regenFileNameButton: document.getElementById('regen-file-name'),
  songMetaInput: document.getElementById('song-meta-input'),
  songBodyInput: document.getElementById('song-body-input'),
  saveDraftButton: document.getElementById('save-draft'),
  resetDraftButton: document.getElementById('reset-draft'),
  writeCurrentProjectButton: document.getElementById('write-current-project'),
  downloadCurrentSongButton: document.getElementById('download-current-song'),

  previewFileName: document.getElementById('preview-file-name'),
  previewIndexLine: document.getElementById('preview-index-line'),
  previewDraftState: document.getElementById('preview-draft-state'),
  previewSongText: document.getElementById('preview-song-text')
};

const state = {
  initialized: false,
  initPromise: null,
  dashboardEventsBound: false,
  baseSongs: [],
  baseSongMap: new Map(),
  drafts: {},
  currentSongId: null,
  searchTerm: '',
  projectHandle: null,
  sourceMode: 'site',
  cooldownTimer: null
};

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeNewlines(text) {
  return stripBom(String(text || '')).replace(/\r\n/g, '\n');
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatSongLabel(song) {
  const number = Number.isInteger(song && song.num) ? song.num : '?';
  const title = song && song.title ? song.title : 'Untitled Song';
  return `${number}. ${title}`;
}

function sanitizeFileTitle(name) {
  return String(name || '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .trim();
}

function defaultFileName(num, title) {
  const safeNumber = Number.isInteger(num) && num > 0 ? num : 1;
  const safeTitle = sanitizeFileTitle(title || 'Untitled Song') || 'Untitled Song';
  return `${safeNumber}. ${safeTitle}.txt`;
}

function normalizeFileName(rawValue, num, title) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    return defaultFileName(num, title);
  }

  let cleaned = trimmed
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');

  if (!/\.txt$/i.test(cleaned)) {
    cleaned = `${cleaned}.txt`;
  }

  return cleaned || defaultFileName(num, title);
}

function songIdForBase(num) {
  return `song-${num}`;
}

function splitTitleRef(raw) {
  let title = String(raw || '').trim();
  let ref = '';

  const paren = title.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    ref = `(${paren[1].trim()})`;
    title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  const suffix = title.match(/\s+([A-Z][A-Z.\s]*\d+\.?)+\s*$/);
  if (suffix) {
    const tail = suffix[0].trim();
    if (tail && /\d/.test(tail)) {
      ref = ref ? `${ref} ${tail}` : tail;
      title = title.slice(0, suffix.index).trim();
    }
  }

  title = title.replace(/\.+$/, '').trim();
  return { title, ref };
}

function parseIndex(text) {
  const lines = normalizeNewlines(text).split('\n');
  const parsed = [];

  lines.forEach((line) => {
    const match = line.match(/^(\d+)\.\s*(.+)$/);
    if (!match) return;
    const num = Number(match[1]);
    const rawTitle = match[2].trim();
    const parts = splitTitleRef(rawTitle);
    parsed.push({
      num,
      rawTitle,
      title: parts.title || rawTitle,
      ref: parts.ref || ''
    });
  });

  return parsed;
}

function looksLikeMetaLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;

  return (
    /^key\b/i.test(trimmed) ||
    /^[1-3]?\s*[A-Za-z][A-Za-z.'\s-]*\d(?::\d+)?/.test(trimmed) ||
    /^[A-Z][A-Za-z.'\s-]+\d/.test(trimmed) ||
    /^[A-Za-z][A-Za-z.'\s-]+\(\S+\)/.test(trimmed)
  );
}

function parseSongText(text, fallbackSong) {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split('\n');
  const headerLine = lines[0] ? lines[0].trim() : '';

  let title = fallbackSong && fallbackSong.title ? fallbackSong.title : '';
  let ref = fallbackSong && fallbackSong.ref ? fallbackSong.ref : '';

  if (headerLine) {
    const headerContent = /^\d+\./.test(headerLine)
      ? headerLine.replace(/^\d+\./, '').trim()
      : headerLine;
    const parsedHeader = splitTitleRef(headerContent);
    title = parsedHeader.title || title || headerContent;
    ref = parsedHeader.ref || ref;
  }

  const contentLines = lines.slice(1);
  const verseIndex = contentLines.findIndex((line) => /^\s*\d+\./.test(line.trim()));

  if (verseIndex >= 0) {
    return {
      title,
      ref,
      metaLines: contentLines
        .slice(0, verseIndex)
        .map((line) => line.trim())
        .filter(Boolean),
      body: contentLines.slice(verseIndex).join('\n').trim()
    };
  }

  let blankDivider = -1;
  let seenContent = false;
  for (let index = 0; index < contentLines.length; index += 1) {
    const trimmed = contentLines[index].trim();
    if (trimmed) {
      seenContent = true;
      continue;
    }

    if (seenContent) {
      const remaining = contentLines.slice(index + 1).join('\n').trim();
      if (remaining) {
        blankDivider = index;
        break;
      }
    }
  }

  if (blankDivider >= 0) {
    return {
      title,
      ref,
      metaLines: contentLines
        .slice(0, blankDivider)
        .map((line) => line.trim())
        .filter(Boolean),
      body: contentLines.slice(blankDivider + 1).join('\n').trim()
    };
  }

  const leadingMeta = [];
  let bodyStart = 0;
  for (let index = 0; index < contentLines.length; index += 1) {
    const trimmed = contentLines[index].trim();
    if (!trimmed) {
      bodyStart = index + 1;
      continue;
    }

    if (leadingMeta.length < 3 && looksLikeMetaLine(trimmed)) {
      leadingMeta.push(trimmed);
      bodyStart = index + 1;
      continue;
    }

    bodyStart = index;
    break;
  }

  return {
    title,
    ref,
    metaLines: leadingMeta,
    body: contentLines.slice(bodyStart).join('\n').trim()
  };
}

function buildIndexLine(song) {
  const number = Number.isInteger(song && song.num) ? song.num : '';
  const title = String((song && song.title) || '').trim();
  const ref = String((song && song.ref) || '').trim();
  return `${number}. ${title}${ref ? ` ${ref}` : ''}`.trim();
}

function buildSongText(song) {
  const header = buildIndexLine(song);
  const metaLines = Array.isArray(song.metaLines) ? song.metaLines.filter(Boolean) : [];
  const body = normalizeNewlines(song.body || '').trim();
  const parts = [header];

  if (metaLines.length > 0) {
    parts.push(...metaLines);
  }

  if (body) {
    parts.push('', body);
  }

  return `${parts.join('\n').trimEnd()}\n`;
}

function cloneSong(song) {
  return {
    id: song.id,
    sourceNum: song.sourceNum,
    isNew: Boolean(song.isNew),
    num: song.num,
    title: song.title || '',
    ref: song.ref || '',
    fileName: song.fileName || defaultFileName(song.num, song.title),
    metaLines: Array.isArray(song.metaLines) ? [...song.metaLines] : [],
    body: song.body || '',
    updatedAt: song.updatedAt || 0,
    loaded: Boolean(song.loaded),
    loadError: song.loadError || ''
  };
}

function mergeSong(baseSong, overlaySong) {
  const base = baseSong ? cloneSong(baseSong) : null;
  const overlay = overlaySong ? cloneSong(overlaySong) : null;
  const result = base || overlay;

  if (!result) {
    return null;
  }

  if (!overlay) {
    return result;
  }

  result.sourceNum = overlay.sourceNum !== undefined ? overlay.sourceNum : result.sourceNum;
  result.isNew = Boolean(overlay.isNew);
  result.num = overlay.num;
  result.title = overlay.title;
  result.ref = overlay.ref;
  result.fileName = overlay.fileName;
  result.metaLines = Array.isArray(overlay.metaLines) ? [...overlay.metaLines] : [];
  result.body = overlay.body || '';
  result.updatedAt = overlay.updatedAt || result.updatedAt || 0;
  result.loaded = overlay.loaded || result.loaded || false;
  result.loadError = overlay.loadError || result.loadError || '';
  return result;
}

function sortSongs(a, b) {
  const aNum = Number.isInteger(a.num) ? a.num : Number.MAX_SAFE_INTEGER;
  const bNum = Number.isInteger(b.num) ? b.num : Number.MAX_SAFE_INTEGER;

  if (aNum !== bNum) {
    return aNum - bNum;
  }

  return formatSongLabel(a).localeCompare(formatSongLabel(b));
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'just now';

  const deltaMs = Date.now() - timestamp;
  const absMs = Math.abs(deltaMs);
  const seconds = Math.round(absMs / 1000);
  const minutes = Math.round(absMs / 60000);
  const hours = Math.round(absMs / 3600000);
  const days = Math.round(absMs / 86400000);

  if (seconds < 45) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatDownloadStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function createBaseSong(entry, mappedFileName) {
  return {
    id: songIdForBase(entry.num),
    sourceNum: entry.num,
    isNew: false,
    num: entry.num,
    title: entry.title,
    ref: entry.ref || '',
    fileName: mappedFileName || defaultFileName(entry.num, entry.title),
    metaLines: [],
    body: '',
    updatedAt: 0,
    loaded: false,
    loadError: ''
  };
}

function normalizeDraft(rawDraft) {
  if (!rawDraft || typeof rawDraft !== 'object') {
    return null;
  }

  let id = typeof rawDraft.id === 'string' && rawDraft.id
    ? rawDraft.id
    : null;

  if (!id && Number.isInteger(rawDraft.sourceNum)) {
    id = songIdForBase(rawDraft.sourceNum);
  }

  if (!id && Number.isInteger(rawDraft.num)) {
    id = `draft-import-${rawDraft.num}-${Date.now()}`;
  }

  if (!id) {
    return null;
  }

  const num = parsePositiveInteger(rawDraft.num);
  const title = String(rawDraft.title || '').trim();
  const ref = String(rawDraft.ref || '').trim();
  const fileName = normalizeFileName(rawDraft.fileName, num, title);

  return {
    id,
    sourceNum: Number.isInteger(rawDraft.sourceNum) ? rawDraft.sourceNum : null,
    isNew: Boolean(rawDraft.isNew) || !state.baseSongMap.has(id),
    num,
    title,
    ref,
    fileName,
    metaLines: Array.isArray(rawDraft.metaLines)
      ? rawDraft.metaLines.map((line) => String(line || '').trim()).filter(Boolean)
      : [],
    body: normalizeNewlines(rawDraft.body || '').trim(),
    updatedAt: Number.isFinite(rawDraft.updatedAt) ? rawDraft.updatedAt : Date.now(),
    loaded: true,
    loadError: ''
  };
}

function setMessage(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('status-error', 'status-success', 'status-info');
  if (type === 'error') element.classList.add('status-error');
  if (type === 'success') element.classList.add('status-success');
  if (type === 'info') element.classList.add('status-info');
}

function setLoginStatus(message, type) {
  setMessage(dom.loginStatus, message, type);
}

function setAdminStatus(message, type) {
  setMessage(dom.adminStatus, message, type);
}

function setProjectStatus(message, type) {
  setMessage(dom.projectStatus, message, type);
}

function setProtectedVisible(visible) {
  if (dom.lockscreen) {
    dom.lockscreen.classList.toggle('hidden', visible);
  }

  if (dom.protectedArea) {
    dom.protectedArea.classList.toggle('hidden', !visible);
    dom.protectedArea.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  if (dom.logoutButton) {
    dom.logoutButton.classList.toggle('hidden', !visible);
  }
}

function getLockUntil() {
  const value = Number(localStorage.getItem(STORAGE_KEYS.lockUntil) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getFailCount() {
  const value = Number(localStorage.getItem(STORAGE_KEYS.failCount) || 0);
  return Number.isFinite(value) ? value : 0;
}

function clearFailureState() {
  localStorage.removeItem(STORAGE_KEYS.failCount);
  localStorage.removeItem(STORAGE_KEYS.lockUntil);
}

function applyCooldownState() {
  if (!dom.unlockButton) return;

  const remainingMs = getLockUntil() - Date.now();
  if (state.cooldownTimer) {
    clearTimeout(state.cooldownTimer);
    state.cooldownTimer = null;
  }

  if (remainingMs <= 0) {
    dom.unlockButton.disabled = false;
    if (!sessionStorage.getItem(STORAGE_KEYS.session)) {
      setLoginStatus('Dashboard is locked.');
    }
    return;
  }

  dom.unlockButton.disabled = true;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  setLoginStatus(`Too many wrong attempts. Try again in ${remainingSeconds}s.`, 'error');
  state.cooldownTimer = window.setTimeout(applyCooldownState, Math.min(remainingMs, 1000));
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function derivePasswordHash(password) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(PASSWORD_SALT),
      iterations: 150000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return toHex(bits);
}

async function verifyPassword(password) {
  const hashed = await derivePasswordHash(password);
  return hashed === PASSWORD_HASH;
}

async function handleUnlock(event) {
  event.preventDefault();
  if (!dom.passwordInput || !dom.unlockButton) return;

  const password = dom.passwordInput.value.trim();
  if (!password) {
    setLoginStatus('Enter the password first.', 'error');
    dom.passwordInput.focus();
    return;
  }

  const lockUntil = getLockUntil();
  if (lockUntil > Date.now()) {
    applyCooldownState();
    return;
  }

  dom.unlockButton.disabled = true;
  setLoginStatus('Checking password...');

  try {
    const valid = await verifyPassword(password);
    if (valid) {
      await unlockDashboard();
      dom.unlockButton.disabled = false;
      return;
    }

    const failCount = getFailCount() + 1;
    localStorage.setItem(STORAGE_KEYS.failCount, String(failCount));
    localStorage.setItem(STORAGE_KEYS.lockUntil, String(Date.now() + Math.min(3000 * failCount, 30000)));
    dom.passwordInput.select();
    applyCooldownState();
  } catch (error) {
    dom.unlockButton.disabled = false;
    setLoginStatus('Password check failed in this browser. Please try again.', 'error');
  }
}

function lockDashboard() {
  sessionStorage.removeItem(STORAGE_KEYS.session);
  setProtectedVisible(false);
  if (dom.passwordInput) {
    dom.passwordInput.value = '';
    dom.passwordInput.focus();
  }
  applyCooldownState();
}

async function unlockDashboard() {
  sessionStorage.setItem(STORAGE_KEYS.session, '1');
  clearFailureState();
  setProtectedVisible(true);
  setLoginStatus('Dashboard unlocked for this tab.', 'success');
  if (dom.passwordInput) {
    dom.passwordInput.value = '';
  }

  try {
    await ensureDashboardInitialized();
  } catch (error) {
    setAdminStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function getSourceLabel() {
  return state.sourceMode === 'project' ? 'connected project' : 'website files';
}

function getProjectSupportMessage() {
  if (!('showDirectoryPicker' in window)) {
    return 'Project folder sync needs a Chromium-based browser that supports the File System Access API.';
  }

  return 'Project folder not connected yet.';
}

function loadDraftsFromStorage() {
  state.drafts = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.drafts);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const draftList = Array.isArray(parsed) ? parsed : Object.values(parsed || {});

    draftList.forEach((item) => {
      const draft = normalizeDraft(item);
      if (draft) {
        state.drafts[draft.id] = draft;
      }
    });
  } catch (error) {
    state.drafts = {};
  }
}

function saveDraftsToStorage() {
  const serialized = Object.values(state.drafts).map((draft) => ({
    id: draft.id,
    sourceNum: draft.sourceNum,
    isNew: draft.isNew,
    num: draft.num,
    title: draft.title,
    ref: draft.ref,
    fileName: draft.fileName,
    metaLines: Array.isArray(draft.metaLines) ? [...draft.metaLines] : [],
    body: draft.body || '',
    updatedAt: draft.updatedAt || Date.now()
  }));

  localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(serialized));
}

function getSavedSongById(songId) {
  const baseSong = state.baseSongMap.get(songId) || null;
  const draftSong = state.drafts[songId] || null;
  return draftSong ? mergeSong(baseSong, draftSong) : baseSong ? cloneSong(baseSong) : null;
}

function buildWorkingSongFromEditor() {
  if (!state.currentSongId) return null;

  const savedSong = getSavedSongById(state.currentSongId);
  const title = String(dom.songTitleInput ? dom.songTitleInput.value : '').trim();
  const ref = String(dom.songRefInput ? dom.songRefInput.value : '').trim();
  const num = parsePositiveInteger(dom.songNumInput ? dom.songNumInput.value : '');
  const fileName = normalizeFileName(dom.songFileNameInput ? dom.songFileNameInput.value : '', num, title);
  const metaLines = normalizeNewlines(dom.songMetaInput ? dom.songMetaInput.value : '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const body = normalizeNewlines(dom.songBodyInput ? dom.songBodyInput.value : '').trim();

  return {
    id: state.currentSongId,
    sourceNum: savedSong ? savedSong.sourceNum : null,
    isNew: savedSong ? Boolean(savedSong.isNew) : state.currentSongId.startsWith('draft-'),
    num,
    title,
    ref,
    fileName,
    metaLines,
    body,
    updatedAt: Date.now(),
    loaded: true,
    loadError: ''
  };
}

function songSignature(song) {
  if (!song) return '';
  return JSON.stringify({
    num: song.num,
    title: song.title || '',
    ref: song.ref || '',
    fileName: song.fileName || '',
    metaLines: Array.isArray(song.metaLines) ? song.metaLines : [],
    body: song.body || ''
  });
}

function hasUnsavedChanges() {
  if (!state.currentSongId) return false;
  const workingSong = buildWorkingSongFromEditor();
  const savedSong = getSavedSongById(state.currentSongId);
  return songSignature(workingSong) !== songSignature(savedSong);
}

function confirmDiscardUnsavedChanges(actionLabel) {
  if (!hasUnsavedChanges()) return true;
  return window.confirm(`You have unsaved changes in the editor. ${actionLabel} will discard them unless you save a draft first. Continue?`);
}

function buildEffectiveSongs(includeWorkingCopy) {
  const songs = new Map();

  state.baseSongs.forEach((song) => {
    songs.set(song.id, cloneSong(song));
  });

  Object.values(state.drafts).forEach((draft) => {
    const existing = songs.get(draft.id);
    songs.set(draft.id, mergeSong(existing, draft));
  });

  if (includeWorkingCopy) {
    const workingSong = buildWorkingSongFromEditor();
    if (workingSong) {
      const existing = songs.get(workingSong.id);
      songs.set(workingSong.id, mergeSong(existing, workingSong));
    }
  }

  return Array.from(songs.values()).sort(sortSongs);
}

function findSongInCollection(songId, includeWorkingCopy) {
  return buildEffectiveSongs(includeWorkingCopy).find((song) => song.id === songId) || null;
}

function getNextSongNumber() {
  const songs = buildEffectiveSongs(true);
  const maxNumber = songs.reduce((highest, song) => {
    if (!Number.isInteger(song.num)) return highest;
    return Math.max(highest, song.num);
  }, 0);
  return maxNumber + 1;
}

function fillEditor(song) {
  if (!song) {
    if (dom.songNumInput) dom.songNumInput.value = '';
    if (dom.songTitleInput) dom.songTitleInput.value = '';
    if (dom.songRefInput) dom.songRefInput.value = '';
    if (dom.songFileNameInput) dom.songFileNameInput.value = '';
    if (dom.songMetaInput) dom.songMetaInput.value = '';
    if (dom.songBodyInput) dom.songBodyInput.value = '';
    return;
  }

  if (dom.songNumInput) dom.songNumInput.value = song.num || '';
  if (dom.songTitleInput) dom.songTitleInput.value = song.title || '';
  if (dom.songRefInput) dom.songRefInput.value = song.ref || '';
  if (dom.songFileNameInput) dom.songFileNameInput.value = song.fileName || defaultFileName(song.num, song.title);
  if (dom.songMetaInput) dom.songMetaInput.value = Array.isArray(song.metaLines) ? song.metaLines.join('\n') : '';
  if (dom.songBodyInput) dom.songBodyInput.value = song.body || '';
}

function validateSongCollection(songs, options = {}) {
  const errors = [];
  const byNumber = new Map();
  const byFileName = new Map();
  const requireBodyIds = new Set(
    Array.isArray(options.requireBodyIds) ? options.requireBodyIds : []
  );

  songs.forEach((song) => {
    if (!Number.isInteger(song.num) || song.num < 1) {
      errors.push(`${formatSongLabel(song)} needs a valid positive song number.`);
    }

    if (!song.title) {
      errors.push(`${formatSongLabel(song)} needs a title.`);
    }

    if (!song.fileName) {
      errors.push(`${formatSongLabel(song)} needs a file name.`);
    }

    if (requireBodyIds.has(song.id) && (!song.body || !song.body.trim())) {
      errors.push(`${formatSongLabel(song)} needs lyrics in the body.`);
    }

    if (Number.isInteger(song.num)) {
      const numberKey = String(song.num);
      if (byNumber.has(numberKey)) {
        errors.push(`Song number ${song.num} is used by both ${formatSongLabel(byNumber.get(numberKey))} and ${formatSongLabel(song)}.`);
      } else {
        byNumber.set(numberKey, song);
      }
    }

    const fileKey = String(song.fileName || '').toLowerCase();
    if (fileKey) {
      if (byFileName.has(fileKey)) {
        errors.push(`File name "${song.fileName}" is used by both ${formatSongLabel(byFileName.get(fileKey))} and ${formatSongLabel(song)}.`);
      } else {
        byFileName.set(fileKey, song);
      }
    }
  });

  return errors;
}

function buildOutputBundle(songs) {
  const sortedSongs = [...songs].sort(sortSongs);
  const indexText = `${sortedSongs.map((song) => buildIndexLine(song)).join('\n').trim()}\n`;
  const songsMapObject = {};

  sortedSongs.forEach((song) => {
    songsMapObject[String(song.num)] = song.fileName;
  });

  const mapText = `${JSON.stringify(songsMapObject, null, 4)}\n`;
  return {
    songs: sortedSongs,
    indexText,
    songsMapObject,
    mapText
  };
}

function collectRenamedFiles(songs) {
  const staleFiles = [];

  songs.forEach((song) => {
    const baseSong = state.baseSongMap.get(song.id);
    if (!baseSong) return;
    if (baseSong.fileName && baseSong.fileName !== song.fileName) {
      staleFiles.push(baseSong.fileName);
    }
  });

  return staleFiles;
}

function getVisibleSongs() {
  const allSongs = buildEffectiveSongs(true);
  const query = state.searchTerm.trim().toLowerCase();

  if (!query) {
    return allSongs;
  }

  return allSongs.filter((song) => {
    const numberMatch = Number.isInteger(song.num) && String(song.num).includes(query);
    const titleMatch = String(song.title || '').toLowerCase().includes(query);
    const refMatch = String(song.ref || '').toLowerCase().includes(query);
    const fileMatch = String(song.fileName || '').toLowerCase().includes(query);
    return numberMatch || titleMatch || refMatch || fileMatch;
  });
}

function renderStats() {
  const songs = buildEffectiveSongs(true);
  const activeSong = state.currentSongId ? findSongInCollection(state.currentSongId, true) : null;

  if (dom.statTotalSongs) dom.statTotalSongs.textContent = String(songs.length);
  if (dom.statDraftCount) dom.statDraftCount.textContent = String(Object.keys(state.drafts).length);
  if (dom.statNextNumber) dom.statNextNumber.textContent = String(getNextSongNumber());
  if (dom.statActiveSong) dom.statActiveSong.textContent = activeSong ? formatSongLabel(activeSong) : 'None';
}

function renderOverview() {
  const workingSong = buildWorkingSongFromEditor();
  const draftCount = Object.keys(state.drafts).length;

  if (dom.overviewSourceMode) {
    dom.overviewSourceMode.textContent = state.projectHandle ? 'Project folder' : 'Website files';
  }

  if (dom.overviewCurrentFile) {
    dom.overviewCurrentFile.textContent = workingSong && workingSong.fileName
      ? workingSong.fileName
      : 'No file selected';
  }

  if (dom.overviewDraftHealth) {
    if (hasUnsavedChanges()) {
      dom.overviewDraftHealth.textContent = 'Unsaved edits in editor';
    } else if (draftCount === 0) {
      dom.overviewDraftHealth.textContent = 'No drafts saved';
    } else if (draftCount === 1) {
      dom.overviewDraftHealth.textContent = '1 draft ready';
    } else {
      dom.overviewDraftHealth.textContent = `${draftCount} drafts ready`;
    }
  }
}

function renderSongList() {
  if (!dom.songList || !dom.songListMeta) return;

  const allSongs = buildEffectiveSongs(true);
  const visibleSongs = getVisibleSongs();
  const fragment = document.createDocumentFragment();

  dom.songList.innerHTML = '';

  if (visibleSongs.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'muted';
    emptyState.textContent = state.searchTerm
      ? 'No songs match this search yet.'
      : 'No songs are available yet.';
    dom.songList.appendChild(emptyState);
  } else {
    visibleSongs.forEach((song) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'song-item';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', song.id === state.currentSongId ? 'true' : 'false');
      if (song.id === state.currentSongId) {
        button.classList.add('active');
      }

      const head = document.createElement('div');
      head.className = 'song-item-head';

      const info = document.createElement('div');

      const number = document.createElement('div');
      number.className = 'song-item-num';
      number.textContent = Number.isInteger(song.num) ? `#${song.num}` : '#?';

      const title = document.createElement('div');
      title.className = 'song-item-title';
      title.textContent = song.title || 'Untitled Song';

      const ref = document.createElement('div');
      ref.className = 'song-item-ref';
      ref.textContent = song.ref || 'No reference';

      info.append(number, title, ref);

      const badgeWrap = document.createElement('div');
      badgeWrap.className = 'song-badges';

      if (state.drafts[song.id]) {
        const draftBadge = document.createElement('span');
        draftBadge.className = 'badge';
        draftBadge.textContent = 'Draft';
        badgeWrap.appendChild(draftBadge);
      }

      if (song.isNew) {
        const newBadge = document.createElement('span');
        newBadge.className = 'badge new';
        newBadge.textContent = 'New';
        badgeWrap.appendChild(newBadge);
      }

      head.append(info, badgeWrap);

      const fileLine = document.createElement('div');
      fileLine.className = 'song-item-file';
      fileLine.textContent = song.fileName || defaultFileName(song.num, song.title);

      button.append(head, fileLine);
      button.addEventListener('click', () => {
        void selectSong(song.id);
      });

      fragment.appendChild(button);
    });

    dom.songList.appendChild(fragment);
  }

  dom.songListMeta.textContent = `${visibleSongs.length} of ${allSongs.length} songs shown from ${getSourceLabel()}.`;
}

function renderEditorBadge() {
  if (!dom.editorBadge) return;

  if (!state.currentSongId) {
    dom.editorBadge.textContent = 'No song selected';
    return;
  }

  const workingSong = buildWorkingSongFromEditor();
  const draft = state.drafts[state.currentSongId];

  if (hasUnsavedChanges()) {
    dom.editorBadge.textContent = 'Unsaved changes';
    return;
  }

  if (draft) {
    dom.editorBadge.textContent = `Draft saved ${formatRelativeTime(draft.updatedAt)}`;
    return;
  }

  dom.editorBadge.textContent = workingSong && workingSong.isNew
    ? 'New song'
    : `Editing ${workingSong ? formatSongLabel(workingSong) : 'song'}`;
}

function renderPreview() {
  if (!dom.previewFileName || !dom.previewIndexLine || !dom.previewDraftState || !dom.previewSongText) return;

  const workingSong = buildWorkingSongFromEditor();
  const draft = state.currentSongId ? state.drafts[state.currentSongId] : null;

  if (!workingSong) {
    dom.previewFileName.textContent = 'No file';
    dom.previewIndexLine.textContent = '-';
    dom.previewDraftState.textContent = 'No draft yet.';
    dom.previewSongText.textContent = 'Select a song to start editing.';
    return;
  }

  dom.previewFileName.textContent = workingSong.fileName || 'No file';
  dom.previewIndexLine.textContent = workingSong.num && workingSong.title
    ? buildIndexLine(workingSong)
    : 'Complete the song number and title to generate the index line.';

  if (hasUnsavedChanges()) {
    dom.previewDraftState.textContent = 'Unsaved changes are in the editor.';
  } else if (draft) {
    dom.previewDraftState.textContent = `Draft saved locally ${formatRelativeTime(draft.updatedAt)}.`;
  } else {
    dom.previewDraftState.textContent = `Using ${getSourceLabel()} data.`;
  }

  if (!workingSong.num || !workingSong.title) {
    dom.previewSongText.textContent = 'Add the number and title to generate the song file preview.';
    return;
  }

  dom.previewSongText.textContent = buildSongText(workingSong);
}

function updateActionStates() {
  const fileSystemSupported = 'showDirectoryPicker' in window;
  const hasSelection = Boolean(state.currentSongId);
  const hasDrafts = Object.keys(state.drafts).length > 0;

  if (dom.connectProjectButton) {
    dom.connectProjectButton.disabled = !fileSystemSupported;
    dom.connectProjectButton.textContent = state.projectHandle ? 'Reconnect Project Folder' : 'Connect Project Folder';
  }

  if (dom.reloadSourceButton) {
    dom.reloadSourceButton.disabled = !state.initialized;
  }

  if (dom.writeAllProjectButton) {
    dom.writeAllProjectButton.disabled = !state.projectHandle || !hasDrafts;
  }

  if (dom.exportBackupButton) {
    dom.exportBackupButton.disabled = !state.initialized || !hasDrafts;
  }

  if (dom.importBackupTrigger) {
    dom.importBackupTrigger.disabled = !state.initialized;
  }

  if (dom.downloadIndexButton) {
    dom.downloadIndexButton.disabled = !state.initialized;
  }

  if (dom.downloadMapButton) {
    dom.downloadMapButton.disabled = !state.initialized;
  }

  if (dom.clearAllDraftsButton) {
    dom.clearAllDraftsButton.disabled = !hasDrafts;
  }

  if (dom.resetDraftButton) {
    dom.resetDraftButton.disabled = !hasSelection;
  }

  if (dom.saveDraftButton) {
    dom.saveDraftButton.disabled = !hasSelection;
  }

  if (dom.writeCurrentProjectButton) {
    dom.writeCurrentProjectButton.disabled = !state.projectHandle || !hasSelection;
  }

  if (dom.downloadCurrentSongButton) {
    dom.downloadCurrentSongButton.disabled = !hasSelection;
  }

  [
    dom.songNumInput,
    dom.songTitleInput,
    dom.songRefInput,
    dom.songFileNameInput,
    dom.regenFileNameButton,
    dom.songMetaInput,
    dom.songBodyInput
  ].forEach((element) => {
    if (!element) return;
    element.disabled = !hasSelection;
  });
}

function renderAll() {
  renderStats();
  renderOverview();
  renderSongList();
  renderEditorBadge();
  renderPreview();
  updateActionStates();
}

async function fetchSiteText(relativePath) {
  const response = await fetch(`${SITE_ROOT}${relativePath}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load ${relativePath} (${response.status}).`);
  }

  return stripBom(await response.text());
}

async function loadSourceFromSite() {
  const [indexText, songsMapText] = await Promise.all([
    fetchSiteText('all-lyrics/index.txt'),
    fetchSiteText('lyrics-data/songs-map.json')
  ]);

  return {
    indexText,
    songsMap: JSON.parse(songsMapText)
  };
}

async function getDirectoryHandle(rootHandle, pathParts, create) {
  let current = rootHandle;

  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create });
  }

  return current;
}

async function ensureProjectPermission(mode) {
  if (!state.projectHandle) {
    throw new Error('Connect the project folder first.');
  }

  if (typeof state.projectHandle.queryPermission === 'function') {
    const permissionOptions = { mode };
    let permission = await state.projectHandle.queryPermission(permissionOptions);
    if (permission !== 'granted') {
      permission = await state.projectHandle.requestPermission(permissionOptions);
    }

    if (permission !== 'granted') {
      throw new Error('Project folder permission was not granted.');
    }
  }
}

async function readProjectText(relativePath) {
  await ensureProjectPermission('read');
  const parts = relativePath.split('/');
  const fileName = parts.pop();
  const directory = await getDirectoryHandle(state.projectHandle, parts, false);
  const fileHandle = await directory.getFileHandle(fileName, { create: false });
  const file = await fileHandle.getFile();
  return stripBom(await file.text());
}

async function writeProjectText(relativePath, content) {
  await ensureProjectPermission('readwrite');
  const parts = relativePath.split('/');
  const fileName = parts.pop();
  const directory = await getDirectoryHandle(state.projectHandle, parts, true);
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function validateProjectHandle(handle) {
  let current = await handle.getDirectoryHandle('all-lyrics', { create: false });
  await current.getDirectoryHandle('songs', { create: false });
  await current.getFileHandle('index.txt', { create: false });

  current = await handle.getDirectoryHandle('lyrics-data', { create: false });
  await current.getFileHandle('songs-map.json', { create: false });
}

async function loadSourceFromProject() {
  const [indexText, songsMapText] = await Promise.all([
    readProjectText('all-lyrics/index.txt'),
    readProjectText('lyrics-data/songs-map.json')
  ]);

  return {
    indexText,
    songsMap: JSON.parse(songsMapText)
  };
}

function clearEditorSelection() {
  state.currentSongId = null;
  fillEditor(null);
}

function getPreferredSelection(preferredSongId, preferredSongNum) {
  const songs = buildEffectiveSongs(false);
  if (preferredSongId && songs.some((song) => song.id === preferredSongId)) {
    return preferredSongId;
  }

  if (Number.isInteger(preferredSongNum)) {
    const songByNumber = songs.find((song) => song.num === preferredSongNum);
    if (songByNumber) {
      return songByNumber.id;
    }
  }

  return songs.length > 0 ? songs[0].id : null;
}

async function loadSongDetails(songId) {
  const baseSong = state.baseSongMap.get(songId);
  if (!baseSong || baseSong.loaded) {
    return;
  }

  try {
    let text = '';

    if (state.projectHandle) {
      text = await readProjectText(`all-lyrics/songs/${baseSong.fileName}`);
    } else {
      text = await fetchSiteText(`all-lyrics/songs/${baseSong.fileName}`);
    }

    const parsed = parseSongText(text, baseSong);
    baseSong.title = parsed.title || baseSong.title;
    baseSong.ref = parsed.ref || baseSong.ref;
    baseSong.metaLines = parsed.metaLines;
    baseSong.body = parsed.body;
    baseSong.loaded = true;
    baseSong.loadError = '';
  } catch (error) {
    baseSong.loaded = true;
    baseSong.loadError = error instanceof Error ? error.message : String(error);
    baseSong.metaLines = [];
    baseSong.body = '';
  }
}

async function loadDashboardSource(options = {}) {
  const preferredSongId = options.preferredSongId || state.currentSongId;
  const currentWorkingSong = buildWorkingSongFromEditor();
  const preferredSongNum = Number.isInteger(options.preferredSongNum)
    ? options.preferredSongNum
    : (currentWorkingSong ? currentWorkingSong.num : null);

  setAdminStatus(
    state.projectHandle
      ? 'Loading songs from the connected project...'
      : 'Loading songs from the website files...',
    'info'
  );

  const source = state.projectHandle
    ? await loadSourceFromProject()
    : await loadSourceFromSite();

  state.baseSongs = parseIndex(source.indexText).map((entry) => createBaseSong(entry, source.songsMap[String(entry.num)]));
  state.baseSongMap = new Map(state.baseSongs.map((song) => [song.id, song]));
  state.sourceMode = state.projectHandle ? 'project' : 'site';

  Object.values(state.drafts).forEach((draft) => {
    draft.isNew = !state.baseSongMap.has(draft.id);
    if (state.baseSongMap.has(draft.id) && !Number.isInteger(draft.sourceNum)) {
      draft.sourceNum = state.baseSongMap.get(draft.id).sourceNum;
    }
  });

  setProjectStatus(
    state.projectHandle
      ? `Connected to "${state.projectHandle.name}". Reload and write actions now use your local project files.`
      : getProjectSupportMessage(),
    state.projectHandle ? 'success' : 'info'
  );

  setAdminStatus(`Loaded ${state.baseSongs.length} songs from ${getSourceLabel()}.`, 'success');

  const selectionId = getPreferredSelection(preferredSongId, preferredSongNum);
  renderAll();

  if (selectionId) {
    await selectSong(selectionId, { skipConfirm: true, silent: true });
  } else {
    clearEditorSelection();
    renderAll();
  }
}

function scrollActiveSongIntoView() {
  if (!dom.songList) return;
  const active = dom.songList.querySelector('.song-item.active');
  if (active) {
    active.scrollIntoView({ block: 'nearest' });
  }
}

async function selectSong(songId, options = {}) {
  if (!options.skipConfirm && !confirmDiscardUnsavedChanges('Switching songs')) {
    return false;
  }

  const savedSong = getSavedSongById(songId);
  if (!savedSong) {
    return false;
  }

  state.currentSongId = songId;

  if (!state.drafts[songId] && state.baseSongMap.has(songId)) {
    await loadSongDetails(songId);
  }

  const nextSong = getSavedSongById(songId);
  fillEditor(nextSong);
  renderAll();
  scrollActiveSongIntoView();

  if (!options.silent) {
    setAdminStatus(`Opened ${formatSongLabel(nextSong)}.`, 'info');
  }

  return true;
}

function downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveCurrentDraft(options = {}) {
  if (!state.currentSongId) {
    setAdminStatus('Select a song first.', 'error');
    return false;
  }

  const workingSong = buildWorkingSongFromEditor();
  const effectiveSongs = buildEffectiveSongs(true);
  const errors = validateSongCollection(effectiveSongs, {
    requireBodyIds: [workingSong.id]
  });

  if (errors.length > 0) {
    setAdminStatus(errors[0], 'error');
    return false;
  }

  state.drafts[workingSong.id] = {
    ...workingSong,
    sourceNum: state.baseSongMap.has(workingSong.id) ? state.baseSongMap.get(workingSong.id).sourceNum : null,
    isNew: !state.baseSongMap.has(workingSong.id)
  };
  saveDraftsToStorage();
  renderAll();

  if (!options.silent) {
    setAdminStatus(`Saved draft for ${formatSongLabel(workingSong)}.`, 'success');
  }

  return true;
}

async function resetCurrentDraft() {
  if (!state.currentSongId) {
    setAdminStatus('Select a song first.', 'error');
    return;
  }

  const hasSavedDraft = Boolean(state.drafts[state.currentSongId]);
  const isNewOnlyDraft = hasSavedDraft && !state.baseSongMap.has(state.currentSongId);

  if (hasSavedDraft) {
    delete state.drafts[state.currentSongId];
    saveDraftsToStorage();
  }

  if (isNewOnlyDraft) {
    const nextSelection = getPreferredSelection(null, null);
    if (nextSelection) {
      await selectSong(nextSelection, { skipConfirm: true, silent: true });
    } else {
      clearEditorSelection();
      renderAll();
    }

    setAdminStatus('Removed the new song draft.', 'success');
    return;
  }

  if (state.baseSongMap.has(state.currentSongId)) {
    await loadSongDetails(state.currentSongId);
  }

  fillEditor(getSavedSongById(state.currentSongId));
  renderAll();
  setAdminStatus(
    hasSavedDraft
      ? 'Removed the saved draft and restored the source values.'
      : 'Restored the last saved values in the editor.',
    'success'
  );
}

async function createNewSong() {
  if (!confirmDiscardUnsavedChanges('Opening a new song')) {
    return;
  }

  const nextNumber = getNextSongNumber();
  const title = 'Untitled Song';
  const newSongId = `draft-${Date.now()}`;

  state.drafts[newSongId] = {
    id: newSongId,
    sourceNum: null,
    isNew: true,
    num: nextNumber,
    title,
    ref: '',
    fileName: defaultFileName(nextNumber, title),
    metaLines: [],
    body: '',
    updatedAt: Date.now(),
    loaded: true,
    loadError: ''
  };

  saveDraftsToStorage();
  await selectSong(newSongId, { skipConfirm: true, silent: true });
  setAdminStatus('Created a new song draft. Add the lyrics and save when you are ready.', 'success');
}

function regenerateFileName() {
  if (!state.currentSongId || !dom.songFileNameInput) return;

  const num = parsePositiveInteger(dom.songNumInput ? dom.songNumInput.value : '');
  const title = String(dom.songTitleInput ? dom.songTitleInput.value : '').trim();
  dom.songFileNameInput.value = defaultFileName(num, title);
  renderAll();
}

async function downloadCurrentSong() {
  if (!state.currentSongId) {
    setAdminStatus('Select a song first.', 'error');
    return;
  }

  const workingSong = buildWorkingSongFromEditor();
  const effectiveSongs = buildEffectiveSongs(true);
  const errors = validateSongCollection(effectiveSongs, {
    requireBodyIds: [workingSong.id]
  });
  if (errors.length > 0) {
    setAdminStatus(errors[0], 'error');
    return;
  }

  downloadTextFile(workingSong.fileName, buildSongText(workingSong));
  setAdminStatus(`Downloaded ${workingSong.fileName}.`, 'success');
}

async function downloadGeneratedIndex() {
  const songs = buildEffectiveSongs(true);
  const errors = validateSongCollection(songs);
  if (errors.length > 0) {
    setAdminStatus(errors[0], 'error');
    return;
  }

  const bundle = buildOutputBundle(songs);
  downloadTextFile('index.txt', bundle.indexText);
  setAdminStatus('Downloaded the generated index.txt file.', 'success');
}

async function downloadGeneratedMap() {
  const songs = buildEffectiveSongs(true);
  const errors = validateSongCollection(songs);
  if (errors.length > 0) {
    setAdminStatus(errors[0], 'error');
    return;
  }

  const bundle = buildOutputBundle(songs);
  downloadTextFile('songs-map.json', bundle.mapText, 'application/json;charset=utf-8');
  setAdminStatus('Downloaded the generated songs-map.json file.', 'success');
}

async function exportBackup() {
  if (hasUnsavedChanges()) {
    const saved = await saveCurrentDraft({ silent: true });
    if (!saved) return;
  }

  const drafts = Object.values(state.drafts).sort(sortSongs);
  if (drafts.length === 0) {
    setAdminStatus('There are no saved drafts to export yet.', 'error');
    return;
  }

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    drafts
  };

  downloadTextFile(
    `bek-na-lah-admin-backup-${formatDownloadStamp()}.json`,
    `${JSON.stringify(backup, null, 2)}\n`,
    'application/json;charset=utf-8'
  );
  setAdminStatus(`Exported ${drafts.length} draft${drafts.length === 1 ? '' : 's'} to a backup file.`, 'success');
}

async function importBackup(file) {
  if (!file) return;

  if (hasUnsavedChanges()) {
    const saved = await saveCurrentDraft({ silent: true });
    if (!saved) return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const draftList = Array.isArray(parsed && parsed.drafts) ? parsed.drafts : [];
    let importedCount = 0;
    let firstImportedId = null;

    draftList.forEach((item) => {
      const normalized = normalizeDraft(item);
      if (!normalized) return;
      state.drafts[normalized.id] = normalized;
      importedCount += 1;
      if (!firstImportedId) {
        firstImportedId = normalized.id;
      }
    });

    saveDraftsToStorage();
    renderAll();

    if (firstImportedId) {
      await selectSong(firstImportedId, { skipConfirm: true, silent: true });
    }

    setAdminStatus(`Imported ${importedCount} draft${importedCount === 1 ? '' : 's'} from backup.`, 'success');
  } catch (error) {
    setAdminStatus('That backup file could not be imported.', 'error');
  } finally {
    if (dom.importBackupInput) {
      dom.importBackupInput.value = '';
    }
  }
}

async function clearAllDrafts() {
  if (!confirmDiscardUnsavedChanges('Clearing drafts')) {
    return;
  }

  if (!window.confirm('Clear every saved admin draft from this browser? This will not change project files.')) {
    return;
  }

  state.drafts = {};
  saveDraftsToStorage();

  if (state.currentSongId && !state.baseSongMap.has(state.currentSongId)) {
    const nextSelection = getPreferredSelection(null, null);
    if (nextSelection) {
      await selectSong(nextSelection, { skipConfirm: true, silent: true });
    } else {
      clearEditorSelection();
      renderAll();
    }
  } else if (state.currentSongId) {
    await selectSong(state.currentSongId, { skipConfirm: true, silent: true });
  } else {
    renderAll();
  }

  setAdminStatus('Cleared all saved drafts from this browser.', 'success');
}

async function connectProjectFolder() {
  if (!('showDirectoryPicker' in window)) {
    setProjectStatus(getProjectSupportMessage(), 'error');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await validateProjectHandle(handle);
    state.projectHandle = handle;
    setProjectStatus(`Connected to "${handle.name}".`, 'success');
    await loadDashboardSource();
  } catch (error) {
    if (error && error.name === 'AbortError') {
      setProjectStatus('Project folder selection was cancelled.', 'info');
      return;
    }

    state.projectHandle = null;
    setProjectStatus('That folder does not look like this Bek Na Lah project root.', 'error');
    renderAll();
  }
}

async function reloadSource() {
  if (!confirmDiscardUnsavedChanges('Reloading the source')) {
    return;
  }

  await loadDashboardSource();
}

async function writeCurrentToProject() {
  if (!state.projectHandle) {
    setProjectStatus('Connect the project folder before writing files.', 'error');
    return;
  }

  if (!state.currentSongId) {
    setAdminStatus('Select a song first.', 'error');
    return;
  }

  const workingSong = buildWorkingSongFromEditor();
  const effectiveSongs = buildEffectiveSongs(true);
  const errors = validateSongCollection(effectiveSongs, {
    requireBodyIds: [workingSong.id]
  });
  if (errors.length > 0) {
    setAdminStatus(errors[0], 'error');
    return;
  }

  const bundle = buildOutputBundle(effectiveSongs);
  const staleFiles = collectRenamedFiles([workingSong]);

  setAdminStatus(`Writing ${formatSongLabel(workingSong)} to the connected project...`, 'info');

  try {
    await writeProjectText('all-lyrics/index.txt', bundle.indexText);
    await writeProjectText('lyrics-data/songs-map.json', bundle.mapText);
    await writeProjectText(`all-lyrics/songs/${workingSong.fileName}`, buildSongText(workingSong));

    delete state.drafts[workingSong.id];
    saveDraftsToStorage();

    await loadDashboardSource({
      preferredSongNum: workingSong.num
    });

    const staleNote = staleFiles.length > 0
      ? ` Old file not deleted automatically: ${staleFiles.join(', ')}.`
      : '';

    setAdminStatus(`Wrote ${formatSongLabel(workingSong)} and updated index/map in the connected project.${staleNote}`, 'success');
  } catch (error) {
    setAdminStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

async function writeAllDraftsToProject() {
  if (!state.projectHandle) {
    setProjectStatus('Connect the project folder before writing files.', 'error');
    return;
  }

  if (hasUnsavedChanges()) {
    const saved = await saveCurrentDraft({ silent: true });
    if (!saved) return;
  }

  const drafts = Object.values(state.drafts);
  if (drafts.length === 0) {
    setAdminStatus('There are no saved drafts to write yet.', 'error');
    return;
  }

  const effectiveSongs = buildEffectiveSongs(false);
  const errors = validateSongCollection(effectiveSongs, {
    requireBodyIds: drafts.map((draft) => draft.id)
  });
  if (errors.length > 0) {
    setAdminStatus(errors[0], 'error');
    return;
  }

  const bundle = buildOutputBundle(effectiveSongs);
  const staleFiles = collectRenamedFiles(drafts);
  const preferredNum = state.currentSongId && getSavedSongById(state.currentSongId)
    ? getSavedSongById(state.currentSongId).num
    : null;

  setAdminStatus(`Writing ${drafts.length} draft${drafts.length === 1 ? '' : 's'} to the connected project...`, 'info');

  try {
    await writeProjectText('all-lyrics/index.txt', bundle.indexText);
    await writeProjectText('lyrics-data/songs-map.json', bundle.mapText);

    for (const draft of drafts) {
      const song = effectiveSongs.find((item) => item.id === draft.id);
      if (!song) continue;
      await writeProjectText(`all-lyrics/songs/${song.fileName}`, buildSongText(song));
    }

    state.drafts = {};
    saveDraftsToStorage();

    await loadDashboardSource({
      preferredSongNum: preferredNum
    });

    const staleNote = staleFiles.length > 0
      ? ` Old files not deleted automatically: ${staleFiles.join(', ')}.`
      : '';

    setAdminStatus(`Wrote ${drafts.length} draft${drafts.length === 1 ? '' : 's'} to the connected project and refreshed the source.${staleNote}`, 'success');
  } catch (error) {
    setAdminStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function handleSearchInput() {
  state.searchTerm = String(dom.songSearchInput ? dom.songSearchInput.value : '').trim();
  renderSongList();
}

function handleEditorInput() {
  renderAll();
}

function bindDashboardEvents() {
  if (state.dashboardEventsBound) {
    return;
  }

  if (dom.connectProjectButton) {
    dom.connectProjectButton.addEventListener('click', () => {
      void connectProjectFolder();
    });
  }

  if (dom.reloadSourceButton) {
    dom.reloadSourceButton.addEventListener('click', () => {
      void reloadSource();
    });
  }

  if (dom.writeAllProjectButton) {
    dom.writeAllProjectButton.addEventListener('click', () => {
      void writeAllDraftsToProject();
    });
  }

  if (dom.exportBackupButton) {
    dom.exportBackupButton.addEventListener('click', () => {
      void exportBackup();
    });
  }

  if (dom.importBackupTrigger && dom.importBackupInput) {
    dom.importBackupTrigger.addEventListener('click', () => {
      dom.importBackupInput.click();
    });
    dom.importBackupInput.addEventListener('change', () => {
      const file = dom.importBackupInput.files && dom.importBackupInput.files[0];
      if (file) {
        void importBackup(file);
      }
    });
  }

  if (dom.downloadIndexButton) {
    dom.downloadIndexButton.addEventListener('click', () => {
      void downloadGeneratedIndex();
    });
  }

  if (dom.downloadMapButton) {
    dom.downloadMapButton.addEventListener('click', () => {
      void downloadGeneratedMap();
    });
  }

  if (dom.clearAllDraftsButton) {
    dom.clearAllDraftsButton.addEventListener('click', () => {
      void clearAllDrafts();
    });
  }

  if (dom.newSongButton) {
    dom.newSongButton.addEventListener('click', () => {
      void createNewSong();
    });
  }

  if (dom.songSearchInput) {
    dom.songSearchInput.addEventListener('input', handleSearchInput);
  }

  if (dom.songEditorForm) {
    dom.songEditorForm.addEventListener('submit', (event) => {
      event.preventDefault();
      void saveCurrentDraft();
    });
  }

  if (dom.regenFileNameButton) {
    dom.regenFileNameButton.addEventListener('click', regenerateFileName);
  }

  if (dom.resetDraftButton) {
    dom.resetDraftButton.addEventListener('click', () => {
      void resetCurrentDraft();
    });
  }

  if (dom.writeCurrentProjectButton) {
    dom.writeCurrentProjectButton.addEventListener('click', () => {
      void writeCurrentToProject();
    });
  }

  if (dom.downloadCurrentSongButton) {
    dom.downloadCurrentSongButton.addEventListener('click', () => {
      void downloadCurrentSong();
    });
  }

  [
    dom.songNumInput,
    dom.songTitleInput,
    dom.songRefInput,
    dom.songFileNameInput,
    dom.songMetaInput,
    dom.songBodyInput
  ].forEach((element) => {
    if (!element) return;
    element.addEventListener('input', handleEditorInput);
  });

  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  state.dashboardEventsBound = true;
}

async function ensureDashboardInitialized() {
  if (state.initialized) {
    return;
  }

  if (state.initPromise) {
    return state.initPromise;
  }

  state.initPromise = (async () => {
    loadDraftsFromStorage();
    bindDashboardEvents();
    setProjectStatus(getProjectSupportMessage(), 'info');
    renderAll();
    await loadDashboardSource();
    state.initialized = true;
    renderAll();
  })();

  try {
    await state.initPromise;
  } finally {
    state.initPromise = null;
  }
}

if (dom.loginForm) {
  dom.loginForm.addEventListener('submit', handleUnlock);
}

if (dom.logoutButton) {
  dom.logoutButton.addEventListener('click', lockDashboard);
}

if (sessionStorage.getItem(STORAGE_KEYS.session)) {
  setProtectedVisible(true);
  setLoginStatus('Dashboard unlocked for this tab.', 'success');
  void ensureDashboardInitialized();
} else {
  setProtectedVisible(false);
  applyCooldownState();
}
