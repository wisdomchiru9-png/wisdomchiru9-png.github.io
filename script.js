import { firebaseConfig, adminEmails, authProviders } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';
let entries = [];
let filteredEntries = [];
let songMap = {};
let lyricsDB = null;
let currentNum = null;
let favoritesOnly = false;
let searchTerm = '';
let favorites = new Set();
let recent = [];
let comments = {};
let commentDirty = false;
let commentAutoSaveTimer = null;
let globalCommentAuthor = '';
let reactions = {};
let reactionCountsRemote = {};
let authUser = null;
let authReady = false;
let firebaseReady = false;
let assetsLoaded = false;
let speechUtterance = null;
let speechActive = false;
let audioTryToken = 0;
let audioAvailable = false;
let audioIndex = null;
let readerSettings = {
  fontSize: 1.1,
  lineHeight: 1.8,
  fontMode: 'serif',
  theme: 'light',
  autoPlayNext: false,
  rememberLast: true,
  showAudio: true,
  fullView: false
};

const indexListEl = document.getElementById('index-list');
const songCountEl = document.getElementById('song-count');
const indexCountEl = document.getElementById('index-count');
const songNumberEl = document.getElementById('song-number');
const songTitleEl = document.getElementById('song-title');
const songRefEl = document.getElementById('song-ref');
const songMetaEl = document.getElementById('song-meta');
const songBodyEl = document.getElementById('song-body');
const favoriteBtn = document.getElementById('favorite-btn');
const shareBtn = document.getElementById('share-btn');
const qrBtn = document.getElementById('qr-btn');
const readBtn = document.getElementById('read-btn');
const favoritesToggle = document.getElementById('favorites-toggle');
const exportBtn = document.getElementById('export-btn');
const recentListEl = document.getElementById('recent-list');
const recentCountEl = document.getElementById('recent-count');
const coverArtEl = document.getElementById('cover-art');
const audioPlayer = document.getElementById('audio-player');
const audioStatus = document.getElementById('audio-status');
const audioPanel = document.getElementById('audio-panel');
const reactionPanel = document.getElementById('reaction-panel');
const reactionButtons = Array.from(document.querySelectorAll('.reaction-btn'));
const commentInput = document.getElementById('comment-input');
const commentAuthor = document.getElementById('comment-author');
const commentAuthorSaveBtn = document.getElementById('comment-author-save');
const commentSaveBtn = document.getElementById('comment-save');
const commentCopyBtn = document.getElementById('comment-copy');
const commentClearBtn = document.getElementById('comment-clear');
const commentMetaEl = document.getElementById('comment-meta');
const fontDecreaseBtn = document.getElementById('font-decrease');
const fontIncreaseBtn = document.getElementById('font-increase');
const lineDecreaseBtn = document.getElementById('line-decrease');
const lineIncreaseBtn = document.getElementById('line-increase');
const fontToggleBtn = document.getElementById('font-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsClose = document.getElementById('settings-close');
const qrModal = document.getElementById('qr-modal');
const qrBackdrop = document.getElementById('qr-backdrop');
const qrClose = document.getElementById('qr-close');
const qrImage = document.getElementById('qr-image');
const qrCaption = document.getElementById('qr-caption');
const themeSegment = document.getElementById('theme-segment');
const fontSegment = document.getElementById('font-segment');
const fontSizeRange = document.getElementById('font-size-range');
const fontSizeValue = document.getElementById('font-size-value');
const lineHeightRange = document.getElementById('line-height-range');
const lineHeightValue = document.getElementById('line-height-value');
const toggleAudio = document.getElementById('toggle-audio');
const toggleAutoplay = document.getElementById('toggle-autoplay');
const toggleRemember = document.getElementById('toggle-remember');
const toggleFullview = document.getElementById('toggle-fullview');
const exitFullviewBtn = document.getElementById('exit-fullview');
const commentExportBtn = document.getElementById('comment-export');
const commentClearAllBtn = document.getElementById('comment-clear-all');
const authGate = document.getElementById('auth-gate');
const authGoogleBtn = document.getElementById('auth-google');
const authFacebookBtn = document.getElementById('auth-facebook');
const authStatusEl = document.getElementById('auth-status');
const userChip = document.getElementById('user-chip');
const userNameEl = document.getElementById('user-name');
const userEmailEl = document.getElementById('user-email');
const userAvatarEl = document.getElementById('user-avatar');
const signOutBtn = document.getElementById('signout-btn');
const commentListEl = document.getElementById('comment-list');
const onboardingModal = document.getElementById('onboarding-modal');
const onboardingBackdrop = document.getElementById('onboarding-backdrop');
const onboardingClose = document.getElementById('onboarding-close');
const onboardingStepEl = document.getElementById('onboarding-step');
const onboardingPrevBtn = document.getElementById('onboarding-prev');
const onboardingNextBtn = document.getElementById('onboarding-next');

const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const randomBtn = document.getElementById('random-btn');
const jumpInput = document.getElementById('jump-input');
const jumpBtn = document.getElementById('jump-btn');

const firebaseConfigValid = firebaseConfig &&
  firebaseConfig.apiKey &&
  !String(firebaseConfig.apiKey).includes('PASTE_');

let app = null;
let auth = null;
let db = null;
let googleProvider = null;
let facebookProvider = null;

if (firebaseConfigValid) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  facebookProvider = new FacebookAuthProvider();
  firebaseReady = true;
} else if (authStatusEl) {
  authStatusEl.textContent = 'Firebase setup is missing. Contact the owner.';
}

function splitTitleRef(raw) {
  let title = raw.trim();
  let ref = '';

  const paren = title.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    ref = paren[1].trim();
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
  const lines = text.split(/\r?\n/);
  const parsed = [];
  lines.forEach((line) => {
    const match = line.match(/^(\d+)\.\s*(.+)$/);
    if (!match) return;
    const num = Number(match[1]);
    const raw = match[2].trim();
    const { title, ref } = splitTitleRef(raw);
    parsed.push({
      num,
      rawTitle: raw,
      title: title || raw,
      ref: ref || ''
    });
  });
  return parsed;
}

function sanitizeFileTitle(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .trim();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char] || char;
  });
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem('lyricsFavorites');
    if (!raw) {
      favorites = new Set();
      return;
    }
    const list = JSON.parse(raw);
    favorites = new Set(Array.isArray(list) ? list.map(Number) : []);
  } catch (err) {
    favorites = new Set();
  }
}

function saveFavorites() {
  localStorage.setItem('lyricsFavorites', JSON.stringify(Array.from(favorites)));
}

function loadReaderSettings() {
  try {
    const raw = localStorage.getItem('lyricsReaderSettings');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.fontSize === 'number') readerSettings.fontSize = data.fontSize;
    if (typeof data.lineHeight === 'number') readerSettings.lineHeight = data.lineHeight;
    if (data.fontMode === 'sans' || data.fontMode === 'serif') readerSettings.fontMode = data.fontMode;
    if (data.theme === 'dark' || data.theme === 'light') readerSettings.theme = data.theme;
    if (typeof data.autoPlayNext === 'boolean') readerSettings.autoPlayNext = data.autoPlayNext;
    if (typeof data.rememberLast === 'boolean') readerSettings.rememberLast = data.rememberLast;
    if (typeof data.showAudio === 'boolean') readerSettings.showAudio = data.showAudio;
    if (typeof data.fullView === 'boolean') readerSettings.fullView = data.fullView;
  } catch (err) {
    // ignore parse errors
  }
}

function saveReaderSettings() {
  localStorage.setItem('lyricsReaderSettings', JSON.stringify(readerSettings));
}

function applyReaderSettings() {
  document.documentElement.style.setProperty('--song-font-size', `${readerSettings.fontSize}rem`);
  document.documentElement.style.setProperty('--song-line-height', `${readerSettings.lineHeight}`);
  document.body.classList.toggle('font-sans', readerSettings.fontMode === 'sans');
  document.body.classList.toggle('font-serif', readerSettings.fontMode === 'serif');
  document.body.classList.toggle('theme-dark', readerSettings.theme === 'dark');
  document.body.classList.toggle('full-view', readerSettings.fullView);
  fontToggleBtn.textContent = readerSettings.fontMode === 'serif' ? 'Serif' : 'Sans';
  audioPanel.style.display = readerSettings.showAudio && audioAvailable ? '' : 'none';
  syncSettingsUI();
}

function syncSettingsUI() {
  fontSizeRange.value = readerSettings.fontSize;
  fontSizeValue.textContent = readerSettings.fontSize.toFixed(2);
  lineHeightRange.value = readerSettings.lineHeight;
  lineHeightValue.textContent = readerSettings.lineHeight.toFixed(2);
  toggleAudio.checked = readerSettings.showAudio;
  toggleAudio.disabled = !audioAvailable;
  toggleAutoplay.checked = readerSettings.autoPlayNext;
  toggleRemember.checked = readerSettings.rememberLast;
  toggleFullview.checked = readerSettings.fullView;

  const themeButtons = themeSegment.querySelectorAll('button');
  themeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === readerSettings.theme);
  });

  const fontButtons = fontSegment.querySelectorAll('button');
  fontButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.font === readerSettings.fontMode);
  });
}

function openSettings() {
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
}

function loadRecent() {
  try {
    const raw = localStorage.getItem('lyricsRecent');
    if (!raw) {
      recent = [];
      return;
    }
    const list = JSON.parse(raw);
    recent = Array.isArray(list) ? list.map(Number) : [];
  } catch (err) {
    recent = [];
  }
}

function saveRecent() {
  localStorage.setItem('lyricsRecent', JSON.stringify(recent));
}

function loadComments() {
  try {
    const raw = localStorage.getItem('lyricsComments');
    if (!raw) {
      comments = {};
      return;
    }
    const data = JSON.parse(raw);
    comments = typeof data === 'object' && data ? data : {};
  } catch (err) {
    comments = {};
  }
}

function saveComments() {
  localStorage.setItem('lyricsComments', JSON.stringify(comments));
}

function loadReactions() {
  try {
    const raw = localStorage.getItem('lyricsReactions');
    reactions = raw ? JSON.parse(raw) : {};
  } catch (err) {
    reactions = {};
  }
}

function saveReactions() {
  localStorage.setItem('lyricsReactions', JSON.stringify(reactions));
}

function setAuthLocked(locked) {
  document.body.classList.toggle('auth-locked', locked);
  if (authGate) {
    authGate.classList.toggle('hidden', !locked);
  }
}

function updateUserChip(user) {
  if (!userChip) return;
  if (!user) {
    userChip.classList.add('hidden');
    userNameEl.textContent = 'Signed in';
    userEmailEl.textContent = '';
    userAvatarEl.removeAttribute('src');
    return;
  }
  userChip.classList.remove('hidden');
  userNameEl.textContent = user.displayName || 'Signed in';
  userEmailEl.textContent = user.email || '';
  if (user.photoURL) {
    userAvatarEl.src = user.photoURL;
  } else {
    userAvatarEl.removeAttribute('src');
  }
}

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function logSignIn(user) {
  if (!db || !user) return;
  const dayKey = getDayKey();
  const providerId = user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'unknown';
  const docId = `${user.uid}_${dayKey}`;
  try {
    await setDoc(doc(db, 'signins', docId), {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '',
      provider: providerId,
      dayKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    // ignore logging errors
  }
}

async function loadReactionCountsRemote(num) {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, 'reactionCounts', String(num)));
    if (snap.exists()) {
      reactionCountsRemote[num] = snap.data().counts || {};
    } else {
      reactionCountsRemote[num] = {};
    }
    renderReactions(num);
  } catch (err) {
    // ignore fetch errors
  }
}

async function recordReaction(num, emoji) {
  if (!db || !authUser) return;
  const countsPath = `counts.${emoji}`;
  try {
    await setDoc(doc(db, 'reactionCounts', String(num)), {
      songNum: num,
      updatedAt: serverTimestamp(),
      [countsPath]: increment(1)
    }, { merge: true });
    await addDoc(collection(db, 'reactions'), {
      songNum: num,
      emoji,
      uid: authUser.uid,
      email: authUser.email || '',
      name: authUser.displayName || '',
      provider: authUser.providerData && authUser.providerData[0] ? authUser.providerData[0].providerId : 'unknown',
      createdAt: serverTimestamp()
    });
    if (!reactionCountsRemote[num]) reactionCountsRemote[num] = {};
    reactionCountsRemote[num][emoji] = (reactionCountsRemote[num][emoji] || 0) + 1;
    renderReactions(num);
  } catch (err) {
    // ignore
  }
}

async function loadRemoteComments(num) {
  if (!db || !authUser || !commentListEl) return;
  commentListEl.textContent = 'Loading shared comments...';
  try {
    const q = query(
      collection(db, 'comments'),
      where('songNum', '==', num),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      commentListEl.textContent = 'No shared comments yet.';
      return;
    }
    commentListEl.innerHTML = '';
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const item = document.createElement('div');
      item.className = 'comment-item';
      const meta = document.createElement('div');
      meta.className = 'meta';
      const name = data.authorName || data.name || 'Anonymous';
      const when = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleString() : '';
      meta.textContent = `${name} • ${when}`;
      const body = document.createElement('div');
      body.textContent = data.text || '';
      item.appendChild(meta);
      item.appendChild(body);
      commentListEl.appendChild(item);
    });
  } catch (err) {
    commentListEl.textContent = 'Unable to load comments right now.';
  }
}

async function submitCommentToCloud() {
  if (!db || !authUser || !currentNum) return;
  const text = commentInput.value.trim();
  if (!text) return;
  const entry = getEntry(currentNum);
  try {
    await addDoc(collection(db, 'comments'), {
      songNum: currentNum,
      songTitle: entry ? entry.title : '',
      text,
      authorName: commentAuthor.value.trim() || globalCommentAuthor || authUser.displayName || 'Anonymous',
      uid: authUser.uid,
      email: authUser.email || '',
      name: authUser.displayName || '',
      provider: authUser.providerData && authUser.providerData[0] ? authUser.providerData[0].providerId : 'unknown',
      createdAt: serverTimestamp()
    });
    commentMetaEl.textContent = 'Submitted to owner dashboard.';
    loadRemoteComments(currentNum);
  } catch (err) {
    commentMetaEl.textContent = 'Could not submit. Please try again.';
  }
}

const onboardingSteps = [
  'Search songs by title or number using the search bar.',
  'Save favorites with the Save button so you can find them quickly.',
  'Use Share or QR to send a song to friends.',
  'Leave corrections or notes in the Comments section and tap Save to share.',
  'Turn on offline mode by opening the app once while online.'
];

let onboardingIndex = 0;

function openOnboarding() {
  if (!onboardingModal) return;
  onboardingIndex = 0;
  onboardingModal.classList.add('open');
  onboardingModal.setAttribute('aria-hidden', 'false');
  renderOnboarding();
}

function closeOnboarding() {
  if (!onboardingModal) return;
  onboardingModal.classList.remove('open');
  onboardingModal.setAttribute('aria-hidden', 'true');
}

function renderOnboarding() {
  if (!onboardingStepEl) return;
  onboardingStepEl.textContent = onboardingSteps[onboardingIndex] || '';
  onboardingPrevBtn.disabled = onboardingIndex === 0;
  onboardingNextBtn.textContent = onboardingIndex === onboardingSteps.length - 1 ? 'Finish' : 'Next';
}

function renderReactions(num) {
  if (!reactionButtons.length) return;
  const remote = reactionCountsRemote[num];
  const data = remote && Object.keys(remote).length ? remote : (reactions[num] || {});
  reactionButtons.forEach((btn) => {
    const emoji = btn.dataset.emoji;
    const count = data && data[emoji] ? data[emoji] : 0;
    const countEl = btn.querySelector('.count');
    if (countEl) countEl.textContent = String(count);
  });
}

function loadGlobalAuthor() {
  try {
    const raw = localStorage.getItem('lyricsCommentAuthor');
    globalCommentAuthor = raw ? raw : '';
  } catch (err) {
    globalCommentAuthor = '';
  }
}

async function checkAudioAvailability() {
  audioAvailable = false;
  audioIndex = null;
  try {
    const res = await fetch('all-lyrics/audio/index.json', { cache: 'no-store' });
    if (res.ok) {
      audioIndex = await res.json();
      audioAvailable = true;
    }
  } catch (err) {
    audioAvailable = false;
  }
  if (!audioAvailable) {
    readerSettings.showAudio = false;
  }
}

function saveGlobalAuthor() {
  localStorage.setItem('lyricsCommentAuthor', globalCommentAuthor);
}

function formatTimestamp(ts) {
  if (!ts) return 'Saved locally.';
  const date = new Date(ts);
  return `Saved ${date.toLocaleString()}`;
}

function loadCommentForSong(num) {
  const entry = comments[num];
  commentInput.value = entry && entry.text ? entry.text : '';
  commentAuthor.value = entry && entry.author ? entry.author : globalCommentAuthor;
  if (entry && entry.updatedAt) {
    const author = entry.author ? ` by ${entry.author}` : '';
    commentMetaEl.textContent = `${formatTimestamp(entry.updatedAt)}${author}`;
  } else {
    commentMetaEl.textContent = 'Saved locally. Use Save to share with the owner.';
  }
  commentDirty = false;
}

function saveCommentForSong(num, text) {
  const trimmed = text.trim();
  const authorName = commentAuthor.value.trim();
  if (authorName) {
    globalCommentAuthor = authorName;
    saveGlobalAuthor();
  }
  if (!trimmed) {
    delete comments[num];
  } else {
    comments[num] = { text: text, author: authorName, updatedAt: Date.now() };
  }
  saveComments();
  if (comments[num]) {
    const author = comments[num].author ? ` by ${comments[num].author}` : '';
    commentMetaEl.textContent = `${formatTimestamp(comments[num].updatedAt)}${author}`;
  } else {
    commentMetaEl.textContent = 'Saved locally. Use Save to share with the owner.';
  }
  commentDirty = false;
}

function addRecent(num) {
  recent = recent.filter((item) => item !== num);
  recent.unshift(num);
  recent = recent.slice(0, 12);
  saveRecent();
  renderRecent();
}

async function loadAssets() {
  loadReaderSettings();
  await checkAudioAvailability();
  applyReaderSettings();
  loadFavorites();
  loadRecent();
  loadComments();
  loadReactions();
  loadGlobalAuthor();
  updateReadButton();

  const indexText = await fetch('all-lyrics/index.txt').then((res) => res.text());
  entries = parseIndex(indexText);

  try {
    const mapRes = await fetch('lyrics-data/songs-map.json');
    if (mapRes.ok) {
      songMap = await mapRes.json();
    }
  } catch (err) {
    songMap = {};
  }

  try {
    const lyricsRes = await fetch('lyrics-data/lyrics.json');
    if (lyricsRes.ok) {
      lyricsDB = await lyricsRes.json();
    }
  } catch (err) {
    lyricsDB = null;
  }

  applyFilters();
  renderRecent();

  if (entries.length > 0) {
    let initialNum = entries[0].num;
    if (readerSettings.rememberLast) {
      const last = Number(localStorage.getItem('lyricsLastSong'));
      if (!Number.isNaN(last) && getEntry(last)) {
        initialNum = last;
      }
    }
    showSong(initialNum);
  }
}

async function ensureAssetsLoaded() {
  if (assetsLoaded) return;
  await loadAssets();
  assetsLoaded = true;
}

function updateCounts() {
  const count = entries.length;
  const favCount = favorites.size;
  songCountEl.textContent = `${count} songs • ${favCount} saved`;
  indexCountEl.textContent = filteredEntries.length;
  recentCountEl.textContent = recent.length;
  jumpInput.max = count;
}

function renderIndex(list) {
  indexListEl.innerHTML = '';
  list.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'index-item';
    item.dataset.num = entry.num;

    const badge = favorites.has(entry.num) ? '<span class="fav-badge">Saved</span>' : '';
    item.innerHTML = `<span class="idx">${entry.num}</span><span class="name">${escapeHtml(entry.title)}${badge}</span>`;

    item.addEventListener('click', () => showSong(entry.num));
    indexListEl.appendChild(item);
  });
  highlightActive();
}

function renderRecent() {
  recentListEl.innerHTML = '';
  if (recent.length === 0) {
    const item = document.createElement('li');
    item.className = 'recent-item';
    item.textContent = 'No recent songs yet.';
    recentListEl.appendChild(item);
    updateCounts();
    return;
  }

  recent.forEach((num) => {
    const entry = getEntry(num);
    if (!entry) return;
    const item = document.createElement('li');
    item.className = 'recent-item';
    item.innerHTML = `<span>${num}. ${escapeHtml(entry.title)}</span><span>Open</span>`;
    item.addEventListener('click', () => showSong(num));
    recentListEl.appendChild(item);
  });
  updateCounts();
}

function highlightActive() {
  if (!currentNum) return;
  const items = indexListEl.querySelectorAll('.index-item');
  items.forEach((item) => {
    item.classList.toggle('active', Number(item.dataset.num) === currentNum);
  });
  const active = indexListEl.querySelector('.index-item.active');
  if (active) {
    active.scrollIntoView({ block: 'center' });
  }
}

function updateFavoriteButton() {
  if (!currentNum) return;
  const isFav = favorites.has(currentNum);
  favoriteBtn.textContent = isFav ? 'Saved' : 'Save';
  favoriteBtn.classList.toggle('active', isFav);
}

function buildShareText() {
  if (!currentNum) return '';
  const entry = getEntry(currentNum);
  const title = entry ? `${entry.num}. ${entry.title}` : `Song ${currentNum}`;
  const ref = songRefEl.textContent ? `\n${songRefEl.textContent}` : '';
  const meta = Array.from(songMetaEl.querySelectorAll('span')).map((span) => span.textContent).join(' • ');
  const metaLine = meta ? `\n${meta}` : '';
  const body = songBodyEl.textContent ? `\n\n${songBodyEl.textContent}` : '';
  return `${title}${ref}${metaLine}${body}`.trim();
}

function buildQrText() {
  if (!currentNum) return '';
  const entry = getEntry(currentNum);
  const title = entry ? `${entry.num}. ${entry.title}` : `Song ${currentNum}`;
  return `Chiru Lyrics Book\n${title}\nUse search to open this song.`;
}

function openQr() {
  const text = buildQrText();
  if (!text) return;
  const encoded = encodeURIComponent(text);
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
  qrCaption.textContent = text.replace(/\n/g, ' • ');
  qrModal.classList.add('open');
  qrModal.setAttribute('aria-hidden', 'false');
}

function closeQr() {
  qrModal.classList.remove('open');
  qrModal.setAttribute('aria-hidden', 'true');
}

function updateReadButton() {
  readBtn.textContent = speechActive ? 'Stop' : 'Read';
}

function stopReading() {
  if (window.speechSynthesis && speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  speechActive = false;
  updateReadButton();
}

function startReading() {
  if (!window.speechSynthesis) {
    alert('Voice reading is not supported in this browser.');
    return;
  }
  const text = songBodyEl.textContent.trim();
  if (!text) return;
  stopReading();
  speechUtterance = new SpeechSynthesisUtterance(text);
  speechUtterance.rate = 0.95;
  speechUtterance.onend = () => {
    speechActive = false;
    updateReadButton();
  };
  speechUtterance.onerror = () => {
    speechActive = false;
    updateReadButton();
  };
  speechActive = true;
  updateReadButton();
  speechSynthesis.speak(speechUtterance);
}

function getEntry(num) {
  return entries.find((entry) => entry.num === num);
}

function getFileName(num, entry) {
  if (songMap && songMap[num]) {
    return songMap[num];
  }
  const baseTitle = entry ? entry.title : `Song ${num}`;
  return `${num}. ${sanitizeFileTitle(baseTitle)}.txt`;
}

function parseSongText(text, entry) {
  const lines = text.split(/\r?\n/);
  let headerLine = lines[0] ? lines[0].trim() : '';

  let title = entry ? entry.title : headerLine;
  let ref = entry ? entry.ref : '';

  if (headerLine && /^\d+\./.test(headerLine)) {
    const headerContent = headerLine.replace(/^\d+\./, '').trim();
    const parsed = splitTitleRef(headerContent);
    title = parsed.title || title;
    ref = parsed.ref || ref;
  }

  let meta = [];
  let bodyStart = 1;
  let verseIndex = -1;

  for (let i = bodyStart; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^\d+\./.test(line)) {
      verseIndex = i;
      break;
    }
    meta.push(line);
  }

  if (verseIndex === -1) {
    verseIndex = bodyStart;
  }

  const body = lines.slice(verseIndex).join('\n').trim();

  return { title, ref, meta, body };
}

function getAudioCandidates(num, entry) {
  if (audioIndex && typeof audioIndex === 'object') {
    const fromIndex = audioIndex[String(num)];
    if (fromIndex) {
      const list = Array.isArray(fromIndex) ? fromIndex : [fromIndex];
      return list.map((name) => `all-lyrics/audio/${name}`);
    }
  }
  const candidates = [];
  const numStr = String(num);
  const pad3 = numStr.padStart(3, '0');

  const addWithExt = (base) => {
    candidates.push(`${base}.mp3`);
    candidates.push(`${base}.m4a`);
    candidates.push(`${base}.wav`);
  };

  if (songMap && songMap[num]) {
    const baseName = songMap[num].replace(/\.txt$/i, '');
    addWithExt(`all-lyrics/audio/${baseName}`);
  }

  addWithExt(`all-lyrics/audio/${numStr}`);
  addWithExt(`all-lyrics/audio/${pad3}`);

  if (entry) {
    const titleBase = sanitizeFileTitle(entry.title);
    addWithExt(`all-lyrics/audio/${titleBase}`);
  }

  return Array.from(new Set(candidates));
}

function loadAudio(num, entry) {
  if (!audioAvailable) {
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
    audioStatus.textContent = 'Audio files are not available yet.';
    return;
  }
  const sources = getAudioCandidates(num, entry);
  let idx = 0;
  const token = ++audioTryToken;

  const trySource = () => {
    if (token !== audioTryToken) return;
    if (idx >= sources.length) {
      audioPlayer.removeAttribute('src');
      audioPlayer.load();
      audioStatus.textContent = 'No audio file found for this song.';
      return;
    }
    const src = sources[idx++];
    audioStatus.textContent = 'Checking audio...';
    audioPlayer.src = src;
    audioPlayer.load();
  };

  audioPlayer.oncanplay = () => {
    if (token !== audioTryToken) return;
    audioStatus.textContent = 'Audio ready.';
  };

  audioPlayer.onended = () => {
    if (readerSettings.autoPlayNext) {
      nextSong();
    }
  };

  audioPlayer.onerror = () => {
    if (token !== audioTryToken) return;
    trySource();
  };

  trySource();
}

function updateCover(entry) {
  if (!entry) return;
  const hue = (entry.num * 47) % 360;
  const hue2 = (hue + 60) % 360;
  coverArtEl.style.background = `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${hue2}, 60%, 45%))`;

  const words = entry.title.split(/\s+/).slice(0, 3).join(' ');
  const shortTitle = words.length > 18 ? `${words.slice(0, 18)}...` : words;
  coverArtEl.innerHTML = `<div class="cover-num">#${entry.num}</div><div class="cover-title">${escapeHtml(shortTitle)}</div>`;
}

async function showSong(num) {
  const entry = getEntry(num);
  if (!entry) return;

  if (currentNum && commentDirty) {
    saveCommentForSong(currentNum, commentInput.value);
  }
  if (speechActive) {
    stopReading();
  }

  currentNum = num;
  songNumberEl.textContent = `No. ${num}`;
  songTitleEl.textContent = entry.title;
  songRefEl.textContent = entry.ref || '';
  songMetaEl.innerHTML = '';
  songBodyEl.textContent = 'Loading...';

  updateFavoriteButton();
  updateCover(entry);
  loadCommentForSong(num);
  renderReactions(num);
  loadRemoteComments(num);
  loadReactionCountsRemote(num);

  if (readerSettings.rememberLast) {
    localStorage.setItem('lyricsLastSong', String(num));
  }

  const fileName = getFileName(num, entry);
  let text = '';

  try {
    const fileRes = await fetch(encodeURI(`all-lyrics/songs/${fileName}`));
    if (fileRes.ok) {
      text = await fileRes.text();
    }
  } catch (err) {
    text = '';
  }

  if (!text && lyricsDB && lyricsDB[num]) {
    const data = lyricsDB[num];
    songTitleEl.textContent = data.title || entry.title;
    songRefEl.textContent = data.ref || entry.ref || '';
    const meta = [];
    if (data.scripture) meta.push(data.scripture);
    if (data.key) meta.push(data.key);
    songMetaEl.innerHTML = meta.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
    songBodyEl.textContent = data.content || 'Lyrics not available.';
    if (readerSettings.showAudio) {
      loadAudio(num, entry);
    }
    addRecent(num);
    highlightActive();
    return;
  }

  if (!text) {
    songBodyEl.textContent = 'Lyrics not found for this song yet.';
    if (readerSettings.showAudio) {
      loadAudio(num, entry);
    }
    addRecent(num);
    highlightActive();
    return;
  }

  const parsed = parseSongText(text, entry);
  songTitleEl.textContent = parsed.title || entry.title;
  songRefEl.textContent = parsed.ref || entry.ref || '';
  songMetaEl.innerHTML = parsed.meta.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
  songBodyEl.textContent = parsed.body || text;

  if (readerSettings.showAudio) {
    loadAudio(num, entry);
  }
  updateFavoriteButton();
  addRecent(num);
  highlightActive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyFilters(options = {}) {
  const { autoSelect = false } = options;
  let list = [...entries];

  if (favoritesOnly) {
    list = list.filter((entry) => favorites.has(entry.num));
  }

  if (searchTerm) {
    const num = Number(searchTerm);
    if (!Number.isNaN(num) && searchTerm.length <= 4) {
      list = list.filter((entry) => entry.num === num || entry.num.toString().includes(searchTerm));
    } else {
      list = list.filter((entry) => entry.title.toLowerCase().includes(searchTerm) || entry.rawTitle.toLowerCase().includes(searchTerm));
    }
  }

  filteredEntries = list;
  renderIndex(filteredEntries);
  updateCounts();

  if (!autoSelect) return;
  if (filteredEntries.length === 0) return;

  const exactNum = Number(searchTerm);
  if (!Number.isNaN(exactNum)) {
    const exactEntry = filteredEntries.find((entry) => entry.num === exactNum);
    if (exactEntry) {
      showSong(exactEntry.num);
      return;
    }
  }

  if (filteredEntries.length === 1) {
    showSong(filteredEntries[0].num);
  }
}

function searchEntries() {
  searchTerm = searchInput.value.trim().toLowerCase();
  applyFilters({ autoSelect: true });
}

function prevSong() {
  const idx = entries.findIndex((entry) => entry.num === currentNum);
  if (idx > 0) {
    showSong(entries[idx - 1].num);
  }
}

function nextSong() {
  const idx = entries.findIndex((entry) => entry.num === currentNum);
  if (idx >= 0 && idx < entries.length - 1) {
    showSong(entries[idx + 1].num);
  }
}

function randomSong() {
  if (entries.length === 0) return;
  const pick = entries[Math.floor(Math.random() * entries.length)];
  showSong(pick.num);
}

function exportFavorites() {
  const list = entries.filter((entry) => favorites.has(entry.num));
  if (list.length === 0) {
    alert('No favorites yet.');
    return;
  }

  const lines = ['Chiru Lyrics Book Favorites', new Date().toLocaleString(), ''];
  list.forEach((entry) => {
    lines.push(`${entry.num}. ${entry.title}`);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'chiru-lyrics-favorites.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportComments() {
  const keys = Object.keys(comments);
  if (keys.length === 0) {
    alert('No comments yet.');
    return;
  }

  const lines = ['Chiru Lyrics Book Comments', new Date().toLocaleString(), ''];
  keys.sort((a, b) => Number(a) - Number(b)).forEach((key) => {
    const entry = getEntry(Number(key));
    const title = entry ? entry.title : `Song ${key}`;
    const author = comments[key].author ? ` (by ${comments[key].author})` : '';
    lines.push(`${key}. ${title}${author}`);
    lines.push(comments[key].text);
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'chiru-lyrics-comments.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

searchInput.addEventListener('input', searchEntries);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    if (filteredEntries.length > 0) {
      showSong(filteredEntries[0].num);
    }
  }
});
searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchEntries();
});

commentInput.addEventListener('input', () => {
  commentDirty = true;
  commentMetaEl.textContent = 'Unsaved changes.';
  if (commentAutoSaveTimer) {
    clearTimeout(commentAutoSaveTimer);
  }
  commentAutoSaveTimer = setTimeout(() => {
    if (currentNum) {
      saveCommentForSong(currentNum, commentInput.value);
    }
  }, 600);
});

commentAuthor.addEventListener('input', () => {
  commentDirty = true;
  commentMetaEl.textContent = 'Unsaved changes.';
  globalCommentAuthor = commentAuthor.value.trim();
  saveGlobalAuthor();
  if (commentAutoSaveTimer) {
    clearTimeout(commentAutoSaveTimer);
  }
  commentAutoSaveTimer = setTimeout(() => {
    if (currentNum && commentInput.value.trim()) {
      saveCommentForSong(currentNum, commentInput.value);
    }
  }, 600);
});

commentAuthorSaveBtn.addEventListener('click', () => {
  const name = commentAuthor.value.trim();
  if (!name) {
    alert('Please enter a name first.');
    return;
  }
  globalCommentAuthor = name;
  saveGlobalAuthor();
  commentMetaEl.textContent = 'Default name saved.';
});

commentSaveBtn.addEventListener('click', () => {
  if (!currentNum) return;
  saveCommentForSong(currentNum, commentInput.value);
  if (!authUser) {
    commentMetaEl.textContent = 'Saved locally.';
    return;
  }
  submitCommentToCloud();
});

commentCopyBtn.addEventListener('click', async () => {
  const text = commentInput.value.trim();
  if (!text) {
    alert('No comment to copy.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    commentMetaEl.textContent = 'Copied to clipboard.';
  } catch (err) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
    commentMetaEl.textContent = 'Copied to clipboard.';
  }
});

commentClearBtn.addEventListener('click', () => {
  if (!currentNum) return;
  commentInput.value = '';
  saveCommentForSong(currentNum, '');
});

reactionButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!currentNum) return;
    const emoji = btn.dataset.emoji;
    if (!reactions[currentNum]) {
      reactions[currentNum] = {};
    }
    reactions[currentNum][emoji] = (reactions[currentNum][emoji] || 0) + 1;
    saveReactions();
    renderReactions(currentNum);
    recordReaction(currentNum, emoji);
  });
});

favoritesToggle.addEventListener('click', () => {
  favoritesOnly = !favoritesOnly;
  favoritesToggle.classList.toggle('active', favoritesOnly);
  favoritesToggle.textContent = favoritesOnly ? 'All Songs' : 'Favorites';
  applyFilters();
});

favoriteBtn.addEventListener('click', () => {
  if (!currentNum) return;
  if (favorites.has(currentNum)) {
    favorites.delete(currentNum);
  } else {
    favorites.add(currentNum);
  }
  saveFavorites();
  updateFavoriteButton();
  applyFilters();
});

exportBtn.addEventListener('click', exportFavorites);
commentExportBtn.addEventListener('click', exportComments);
commentClearAllBtn.addEventListener('click', () => {
  if (!confirm('Clear all saved comments?')) return;
  comments = {};
  saveComments();
  if (currentNum) {
    loadCommentForSong(currentNum);
  }
});

shareBtn.addEventListener('click', async () => {
  const text = buildShareText();
  if (!text) return;
  const title = songTitleEl.textContent || 'Chiru Lyrics';
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      // fallback to copy
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    alert('Lyrics copied to clipboard.');
  } catch (err) {
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
    alert('Lyrics copied to clipboard.');
  }
});

qrBtn.addEventListener('click', openQr);
qrBackdrop.addEventListener('click', closeQr);
qrClose.addEventListener('click', closeQr);

readBtn.addEventListener('click', () => {
  if (speechActive) {
    stopReading();
  } else {
    startReading();
  }
});

prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', nextSong);
randomBtn.addEventListener('click', randomSong);

settingsBtn.addEventListener('click', openSettings);
settingsBackdrop.addEventListener('click', closeSettings);
settingsClose.addEventListener('click', closeSettings);
if (onboardingBackdrop) onboardingBackdrop.addEventListener('click', closeOnboarding);
if (onboardingClose) onboardingClose.addEventListener('click', closeOnboarding);
if (onboardingPrevBtn) {
  onboardingPrevBtn.addEventListener('click', () => {
    onboardingIndex = Math.max(0, onboardingIndex - 1);
    renderOnboarding();
  });
}
if (onboardingNextBtn) {
  onboardingNextBtn.addEventListener('click', () => {
    if (onboardingIndex >= onboardingSteps.length - 1) {
      closeOnboarding();
      return;
    }
    onboardingIndex = Math.min(onboardingSteps.length - 1, onboardingIndex + 1);
    renderOnboarding();
  });
}

themeSegment.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => {
    readerSettings.theme = button.dataset.theme;
    applyReaderSettings();
    saveReaderSettings();
  });
});

fontSegment.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => {
    readerSettings.fontMode = button.dataset.font;
    applyReaderSettings();
    saveReaderSettings();
  });
});

fontSizeRange.addEventListener('input', () => {
  readerSettings.fontSize = Number(fontSizeRange.value);
  applyReaderSettings();
  saveReaderSettings();
});

lineHeightRange.addEventListener('input', () => {
  readerSettings.lineHeight = Number(lineHeightRange.value);
  applyReaderSettings();
  saveReaderSettings();
});

toggleAudio.addEventListener('change', () => {
  if (!audioAvailable) {
    toggleAudio.checked = false;
    readerSettings.showAudio = false;
    audioPanel.style.display = 'none';
    audioStatus.textContent = 'Audio files are not available yet.';
    return;
  }
  readerSettings.showAudio = toggleAudio.checked;
  if (!readerSettings.showAudio) {
    audioPlayer.pause();
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
  }
  applyReaderSettings();
  saveReaderSettings();
});

toggleAutoplay.addEventListener('change', () => {
  readerSettings.autoPlayNext = toggleAutoplay.checked;
  saveReaderSettings();
});

toggleRemember.addEventListener('change', () => {
  readerSettings.rememberLast = toggleRemember.checked;
  if (!readerSettings.rememberLast) {
    localStorage.removeItem('lyricsLastSong');
  }
  saveReaderSettings();
});

toggleFullview.addEventListener('change', () => {
  readerSettings.fullView = toggleFullview.checked;
  applyReaderSettings();
  saveReaderSettings();
});

exitFullviewBtn.addEventListener('click', () => {
  readerSettings.fullView = false;
  applyReaderSettings();
  saveReaderSettings();
});

jumpBtn.addEventListener('click', () => {
  const num = Number(jumpInput.value);
  if (!Number.isNaN(num)) {
    showSong(num);
  }
});

jumpInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const num = Number(jumpInput.value);
    if (!Number.isNaN(num)) {
      showSong(num);
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (qrModal.classList.contains('open')) {
      closeQr();
    }
    if (readerSettings.fullView) {
      readerSettings.fullView = false;
      applyReaderSettings();
      saveReaderSettings();
    }
  }
  if (event.key === 'ArrowLeft') {
    prevSong();
  }
  if (event.key === 'ArrowRight') {
    nextSong();
  }
});

fontDecreaseBtn.addEventListener('click', () => {
  readerSettings.fontSize = Math.max(0.9, Number((readerSettings.fontSize - 0.1).toFixed(2)));
  applyReaderSettings();
  saveReaderSettings();
});

fontIncreaseBtn.addEventListener('click', () => {
  readerSettings.fontSize = Math.min(1.6, Number((readerSettings.fontSize + 0.1).toFixed(2)));
  applyReaderSettings();
  saveReaderSettings();
});

lineDecreaseBtn.addEventListener('click', () => {
  readerSettings.lineHeight = Math.max(1.4, Number((readerSettings.lineHeight - 0.1).toFixed(2)));
  applyReaderSettings();
  saveReaderSettings();
});

lineIncreaseBtn.addEventListener('click', () => {
  readerSettings.lineHeight = Math.min(2.4, Number((readerSettings.lineHeight + 0.1).toFixed(2)));
  applyReaderSettings();
  saveReaderSettings();
});

fontToggleBtn.addEventListener('click', () => {
  readerSettings.fontMode = readerSettings.fontMode === 'serif' ? 'sans' : 'serif';
  applyReaderSettings();
  saveReaderSettings();
});

async function handleSignIn(provider) {
  if (!auth || !provider) return;
  if (authStatusEl) authStatusEl.textContent = 'Redirecting to sign-in...';
  try {
    await signInWithRedirect(auth, provider);
  } catch (err) {
    if (authStatusEl) authStatusEl.textContent = 'Sign-in failed. Please try again.';
  }
}

function initAuth() {
  if (!firebaseReady) {
    setAuthLocked(false);
    if (authGoogleBtn) authGoogleBtn.disabled = true;
    if (authFacebookBtn) authFacebookBtn.disabled = true;
    return;
  }

  setAuthLocked(false);

  if (authGoogleBtn) {
    authGoogleBtn.disabled = !authProviders.google;
    authGoogleBtn.addEventListener('click', () => handleSignIn(googleProvider));
  }
  if (authFacebookBtn) {
    authFacebookBtn.disabled = !authProviders.facebook;
    authFacebookBtn.addEventListener('click', () => handleSignIn(facebookProvider));
  }
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (auth) signOut(auth);
    });
  }

  getRedirectResult(auth).catch(() => {
    if (authStatusEl) authStatusEl.textContent = 'Sign-in was cancelled.';
  });

  onAuthStateChanged(auth, (user) => {
    authUser = user;
    authReady = true;
    updateUserChip(user);
    if (user) {
      setAuthLocked(false);
      logSignIn(user);
      if (currentNum) {
        loadRemoteComments(currentNum);
        loadReactionCountsRemote(currentNum);
      }
      const seenKey = `lyricsOnboardingSeen_${user.uid}`;
      if (!localStorage.getItem(seenKey)) {
        openOnboarding();
        localStorage.setItem(seenKey, '1');
      }
    } else {
      setAuthLocked(false);
      if (commentListEl) {
        commentListEl.textContent = 'Shared comments are available when signed in.';
      }
    }
  });
}

window.addEventListener('load', () => {
  setAuthLocked(false);
  ensureAssetsLoaded();
  initAuth();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // ignore registration errors
    });
  });
}


