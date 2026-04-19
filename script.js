let entries = [];
let filteredEntries = [];
let songMap = {};
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
let assetsLoaded = false;
let speechUtterance = null;
let speechActive = false;
let audioTryToken = 0;
let audioAvailable = false;
let audioIndex = null;
let aiSearchEnabled = true;
const AUDIO_FEATURE_ENABLED = false;

const AI_INSIGHT_TEMPLATES = {
  praise: [
    "This hymn is a powerful declaration of worship, focusing on the majesty and glory of God. The lyrics encourage a heart of gratitude and reverence.",
    "A vibrant song of praise that celebrates divine grace and the joy of spiritual devotion. It often resonates in communal worship settings.",
    "The themes here center on exalting the Creator, using poetic language to describe the wonders of faith and the beauty of holiness."
  ],
  trust: [
    "A comforting song of trust and reliance on divine guidance. It speaks to the soul's need for strength during times of trial.",
    "This hymn emphasizes the importance of unwavering faith and the peace that comes from surrendering one's path to a higher power.",
    "The lyrics provide a sense of security and hope, reminding the believer of the constant presence and support available through faith."
  ],
  service: [
    "This hymn is a call to action, encouraging believers to live out their faith through service, love, and dedication to others.",
    "A motivating song that focuses on the mission of the church and the individual's role in spreading a message of hope and grace.",
    "The themes highlight the beauty of a life dedicated to a higher purpose, emphasizing sacrifice, labor, and spiritual growth."
  ],
  general: [
    "A classic hymn that reflects deep spiritual truths and the enduring nature of faith across generations.",
    "This song captures a moment of spiritual reflection, offering a poetic perspective on the relationship between the human and the divine.",
    "The lyrics provide a timeless message of hope, peace, and the transformative power of spiritual connection."
  ]
};

function generateAIInsight(title, body) {
  const text = (title + ' ' + body).toLowerCase();
  let category = 'general';
  
  if (text.includes('praise') || text.includes('glory') || text.includes('great') || text.includes('hallelujah') || text.includes('king')) {
    category = 'praise';
  } else if (text.includes('trust') || text.includes('faith') || text.includes('guide') || text.includes('lead') || text.includes('safe')) {
    category = 'trust';
  } else if (text.includes('work') || text.includes('serve') || text.includes('go') || text.includes('labor') || text.includes('soul')) {
    category = 'service';
  }
  
  const templates = AI_INSIGHT_TEMPLATES[category];
  const seed = title.length + body.length;
   return templates[seed % templates.length];
 }
 
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
const recentClearBtn = document.getElementById('recent-clear');
const coverArtEl = document.getElementById('cover-art');
const audioPlayer = document.getElementById('audio-player');
const audioStatus = document.getElementById('audio-status');
const audioPanel = document.getElementById('audio-panel');
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
const tutorialBtn = document.getElementById('tutorial-btn');
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

const aiSearchToggle = document.getElementById('ai-search-toggle');
const aiInsightPanel = document.getElementById('ai-insight-panel');
const aiInsightContent = document.getElementById('ai-insight-content');

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

function parseSongNumber(value) {
  const num = Number.parseInt(String(value || '').replace(/^#/, ''), 10);
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
}

function getSongNumberFromHash() {
  return parseSongNumber(window.location.hash);
}

function buildSongUrl(num) {
  const url = new URL(window.location.href);
  url.hash = String(num);
  return url.toString();
}

function syncSongHash(num) {
  if (!num) return;
  const nextHash = `#${num}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, '', nextHash);
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

const onboardingSteps = [
  'Search songs by title or number, or jump straight to a song with the number box.',
  'Save favorites with the Save button so your most-used songs stay easy to reach.',
  'Use Share or QR to send the current song to family, friends, or the church team.',
  'Write notes or corrections in the Notes section. They stay saved locally on this device.',
  'Open Settings any time to change the theme, font, spacing, and reading view.',
  'On iPhone or iPad, open this site in Safari and use Share > Add to Home Screen. On Android, use Install app or Add to Home screen.',
  'Open the app once while online so the songbook can stay available offline later.'
];

const ONBOARDING_STORAGE_KEY = 'lyricsOnboardingSeen_v3';
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

function maybeOpenOnboarding() {
  try {
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch (err) {
    // Ignore storage errors and still show the tutorial.
  }
  openOnboarding();
}

function renderOnboarding() {
  if (!onboardingStepEl) return;
  onboardingStepEl.textContent = onboardingSteps[onboardingIndex] || '';
  onboardingPrevBtn.disabled = onboardingIndex === 0;
  onboardingNextBtn.textContent = onboardingIndex === onboardingSteps.length - 1 ? 'Finish' : 'Next';
}

function renderReactions(num) {
  if (!reactionButtons.length) return;
  const data = reactions[num] || {};
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
  if (!AUDIO_FEATURE_ENABLED) {
    audioAvailable = false;
    audioIndex = null;
    readerSettings.showAudio = false;
    return;
  }

  audioAvailable = false;
  audioIndex = null;
  try {
    const cacheBustedIndexUrl = `all-lyrics/audio/index.json?v=${Date.now()}`;
    const res = await fetch(cacheBustedIndexUrl, { cache: 'no-store' });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        audioIndex = parsed;
        audioAvailable = true;
      }
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
  if (!ts) return 'Saved locally on this device.';
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
    commentMetaEl.textContent = 'Saved locally on this device.';
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
    commentMetaEl.textContent = 'Saved locally on this device.';
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

function clearRecent() {
  recent = [];
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

  applyFilters();
  renderRecent();

  if (entries.length > 0) {
    let initialNum = entries[0].num;
    const hashNum = getSongNumberFromHash();
    if (hashNum && getEntry(hashNum)) {
      initialNum = hashNum;
    } else if (readerSettings.rememberLast) {
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
  
  // Hide splash screen
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.remove();
    }, 600);
  }
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
  if (recentClearBtn) {
    recentClearBtn.disabled = recent.length === 0;
  }
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
    item.innerHTML = `
      <span class="recent-song">
        <span class="recent-num">#${num}</span>
        <span class="recent-name">${escapeHtml(entry.title)}</span>
      </span>
      <span class="recent-action">Open</span>
    `;
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
  const link = buildSongUrl(currentNum);
  return `${title}${ref}${metaLine}${body}\n\nOpen this song: ${link}`.trim();
}

function buildQrPayload() {
  if (!currentNum) return null;
  const entry = getEntry(currentNum);
  const title = entry ? `${entry.num}. ${entry.title}` : `Song ${currentNum}`;
  return {
    title,
    url: buildSongUrl(currentNum)
  };
}

function openQr() {
  const payload = buildQrPayload();
  if (!payload) return;
  const encoded = encodeURIComponent(payload.url);
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
  qrCaption.textContent = `${payload.title} • Open this exact song on another phone.`;
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

function getAudioCandidates(num) {
  if (!audioIndex || typeof audioIndex !== 'object') return [];
  const fromIndex = audioIndex[String(num)];
  if (!fromIndex) return [];
  const list = Array.isArray(fromIndex) ? fromIndex : [fromIndex];
  return list
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => `all-lyrics/audio/${name.trim()}`);
}

function loadAudio(num, entry) {
  if (!audioAvailable) {
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
    audioStatus.textContent = 'Audio files are not available yet.';
    return;
  }
  const sources = getAudioCandidates(num);
  if (!sources.length) {
    audioPlayer.removeAttribute('src');
    audioPlayer.load();
    audioStatus.textContent = 'Audio is not available for this song yet.';
    return;
  }
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
  syncSongHash(num);
  songNumberEl.textContent = `No. ${num}`;
  songTitleEl.textContent = entry.title;
  songRefEl.textContent = entry.ref || '';
  songMetaEl.innerHTML = '';
  songBodyEl.textContent = 'Loading...';

  updateFavoriteButton();
  updateCover(entry);
  loadCommentForSong(num);
  renderReactions(num);

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

  // AI Insight Generation
  aiInsightContent.textContent = "Generating AI insights...";
  setTimeout(() => {
    aiInsightContent.textContent = generateAIInsight(parsed.title || entry.title, parsed.body || text);
  }, 400);

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
  const term = searchTerm.trim().toLowerCase();
  
  if (!term) {
    filteredEntries = favoritesOnly ? entries.filter(e => favorites.has(e.num)) : [...entries];
  } else {
    // Smart AI Search Logic
    if (aiSearchEnabled) {
      filteredEntries = entries.filter((entry) => {
        if (favoritesOnly && !favorites.has(entry.num)) return false;
        
        const titleMatch = entry.title.toLowerCase().includes(term);
        const numMatch = String(entry.num) === term;
        const refMatch = entry.ref && entry.ref.toLowerCase().includes(term);
        
        // Simple semantic ranking
        let score = 0;
        if (numMatch) score += 100;
        if (titleMatch) score += 50;
        if (refMatch) score += 30;
        
        // Add a bit of fuzzy logic (words starting with term)
        const words = entry.title.toLowerCase().split(/\s+/);
        if (words.some(w => w.startsWith(term))) score += 20;
        
        entry.searchScore = score;
        return score > 0;
      }).sort((a, b) => b.searchScore - a.searchScore);
    } else {
      // Basic Search
      filteredEntries = entries.filter((entry) => {
        if (favoritesOnly && !favorites.has(entry.num)) return false;
        return (
          entry.title.toLowerCase().includes(term) ||
          String(entry.num).includes(term) ||
          (entry.ref && entry.ref.toLowerCase().includes(term))
        );
      });
    }
  }

  renderIndex(filteredEntries);
  updateCounts();

  if (!autoSelect || filteredEntries.length === 0) return;

  const exactNum = Number(term);
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

function showSongFromHash() {
  const hashNum = getSongNumberFromHash();
  if (!hashNum || !getEntry(hashNum) || hashNum === currentNum) return;
  showSong(hashNum);
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
  commentMetaEl.textContent = 'Saved locally on this device.';
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
  });
});

favoritesToggle.addEventListener('click', () => {
  favoritesOnly = !favoritesOnly;
  favoritesToggle.classList.toggle('active', favoritesOnly);
  favoritesToggle.textContent = favoritesOnly ? 'All Songs' : 'Favorites';
  applyFilters();
});

aiSearchToggle.addEventListener('change', () => {
  aiSearchEnabled = aiSearchToggle.checked;
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
if (recentClearBtn) {
  recentClearBtn.addEventListener('click', () => {
    if (recent.length === 0) return;
    if (!confirm('Clear recently viewed songs?')) return;
    clearRecent();
  });
}
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
  const url = currentNum ? buildSongUrl(currentNum) : window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
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

window.addEventListener('hashchange', () => {
  if (!assetsLoaded) return;
  showSongFromHash();
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

if (tutorialBtn) {
  tutorialBtn.addEventListener('click', openOnboarding);
}

window.addEventListener('load', async () => {
  await ensureAssetsLoaded();
  maybeOpenOnboarding();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      // Check if already ready
      if (registration.active) {
        document.getElementById('offline-badge')?.removeAttribute('hidden');
      }
    }).catch(() => {
      // ignore registration errors
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'OFFLINE_READY') {
        document.getElementById('offline-badge')?.removeAttribute('hidden');
      }
    });
  });
}


