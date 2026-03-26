import { firebaseConfig, adminEmails, authProviders } from '../firebase-config.js';
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
  setDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const loginPanel = document.getElementById('admin-login');
const dashboard = document.getElementById('admin-dashboard');
const loginStatus = document.getElementById('admin-login-status');
const googleBtn = document.getElementById('admin-google');
const facebookBtn = document.getElementById('admin-facebook');
const signoutBtn = document.getElementById('admin-signout');
const todaySigninsEl = document.getElementById('today-signins');
const todayDateEl = document.getElementById('today-date');
const weeklySigninsEl = document.getElementById('weekly-signins');
const signinsListEl = document.getElementById('signins-list');
const commentFeed = document.getElementById('comment-feed');
const reactionFeed = document.getElementById('reaction-feed');
const refreshSigninsBtn = document.getElementById('refresh-signins');
const refreshCommentsBtn = document.getElementById('refresh-comments');
const refreshReactionsBtn = document.getElementById('refresh-reactions');

const firebaseConfigValid = firebaseConfig &&
  firebaseConfig.apiKey &&
  !String(firebaseConfig.apiKey).includes('PASTE_');

let auth = null;
let db = null;
let googleProvider = null;
let facebookProvider = null;

if (firebaseConfigValid) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  facebookProvider = new FacebookAuthProvider();
} else if (loginStatus) {
  loginStatus.textContent = 'Firebase setup is missing. Contact the owner.';
}

function getAuthErrorMessage(err) {
  const code = err && err.code ? String(err.code) : '';
  if (code === 'auth/unauthorized-domain') {
    return 'Sign-in blocked: add this domain in Firebase Authorized domains.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Sign-in method is disabled in Firebase Authentication.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'This email already uses another sign-in method.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check internet and try again.';
  }
  return 'Sign-in failed. Please try again.';
}

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLastDays(count) {
  const days = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(getDayKey(d));
  }
  return days.reverse();
}

function isAdmin(user) {
  if (!user || !user.email) return false;
  const normalized = user.email.toLowerCase();
  return adminEmails.map((email) => String(email).toLowerCase()).includes(normalized);
}

function setSignedInUI(isSignedIn) {
  if (!signoutBtn) return;
  signoutBtn.classList.toggle('hidden', !isSignedIn);
}

async function ensureAdminRecord(user) {
  if (!db || !user) return;
  try {
    await setDoc(doc(db, 'admins', user.uid), {
      uid: user.uid,
      email: user.email || '',
      name: user.displayName || '',
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    // ignore
  }
}

async function loadTodaySignins() {
  if (!db) return;
  try {
    const todayKey = getDayKey();
    todayDateEl.textContent = todayKey;
    const q = query(collection(db, 'signins'), where('dayKey', '==', todayKey));
    const snap = await getDocs(q);
    todaySigninsEl.textContent = String(snap.size);
  } catch (err) {
    todaySigninsEl.textContent = '-';
  }
}

async function loadWeeklySignins() {
  if (!db) return;
  try {
    const days = getLastDays(7);
    const q = query(collection(db, 'signins'), where('dayKey', 'in', days));
    const snap = await getDocs(q);
    const counts = {};
    days.forEach((day) => {
      counts[day] = 0;
    });
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.dayKey && counts[data.dayKey] !== undefined) {
        counts[data.dayKey] += 1;
      }
    });

    weeklySigninsEl.innerHTML = '';
    days.forEach((day) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.textContent = `${day}: ${counts[day]} sign-ins`;
      weeklySigninsEl.appendChild(item);
    });
  } catch (err) {
    weeklySigninsEl.textContent = 'Could not load 7-day sign-ins.';
  }
}

async function loadTodaySigninsList() {
  if (!db || !signinsListEl) return;
  signinsListEl.textContent = 'Loading...';

  try {
    const todayKey = getDayKey();
    const q = query(collection(db, 'signins'), where('dayKey', '==', todayKey));
    const snap = await getDocs(q);

    if (snap.empty) {
      signinsListEl.textContent = 'No sign-ins yet today.';
      return;
    }

    const items = [];
    snap.forEach((docSnap) => items.push(docSnap.data()));
    items.sort((a, b) => {
      const at = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const bt = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });

    signinsListEl.innerHTML = '';
    items.slice(0, 20).forEach((data) => {
      const item = document.createElement('div');
      item.className = 'list-item';

      const meta = document.createElement('div');
      meta.className = 'meta';
      const when = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleTimeString() : '';
      meta.textContent = `${data.provider || 'unknown'} - ${when}`;

      const body = document.createElement('div');
      body.textContent = data.email || data.name || data.uid || 'User';

      item.appendChild(meta);
      item.appendChild(body);
      signinsListEl.appendChild(item);
    });
  } catch (err) {
    signinsListEl.textContent = 'Could not load sign-ins right now.';
  }
}

function renderFeed(container, items, format) {
  container.innerHTML = '';
  if (!items.length) {
    container.textContent = 'No data yet.';
    return;
  }

  items.forEach((item) => {
    const view = format(item);
    const el = document.createElement('div');
    el.className = 'list-item';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = view.meta;

    const body = document.createElement('div');
    body.textContent = view.body;

    el.appendChild(meta);
    el.appendChild(body);
    container.appendChild(el);
  });
}

async function loadRecentComments() {
  if (!db) return;
  commentFeed.textContent = 'Loading...';

  try {
    const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((docSnap) => items.push(docSnap.data()));
    renderFeed(commentFeed, items, (data) => ({
      meta: `${data.songNum || ''} - ${data.authorName || data.name || 'Anonymous'}`,
      body: data.text || ''
    }));
  } catch (err) {
    commentFeed.textContent = 'Could not load comments right now.';
  }
}

async function loadRecentReactions() {
  if (!db) return;
  reactionFeed.textContent = 'Loading...';

  try {
    const q = query(collection(db, 'reactions'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((docSnap) => items.push(docSnap.data()));
    renderFeed(reactionFeed, items, (data) => ({
      meta: `${data.songNum || ''} - ${data.name || data.email || 'User'}`,
      body: `Reacted with ${data.emoji || 'like'}`
    }));
  } catch (err) {
    reactionFeed.textContent = 'Could not load reactions right now.';
  }
}

async function refreshDashboard() {
  await Promise.all([
    loadTodaySignins(),
    loadWeeklySignins(),
    loadTodaySigninsList(),
    loadRecentComments(),
    loadRecentReactions()
  ]);
}

async function handleSignIn(provider) {
  if (!auth || !provider) return;
  loginStatus.textContent = 'Redirecting to sign-in...';
  try {
    await signInWithRedirect(auth, provider);
  } catch (err) {
    loginStatus.textContent = getAuthErrorMessage(err);
  }
}

function initAuth() {
  if (!firebaseConfigValid) {
    if (googleBtn) googleBtn.disabled = true;
    if (facebookBtn) facebookBtn.disabled = true;
    setSignedInUI(false);
    return;
  }

  googleBtn.disabled = !authProviders.google;
  facebookBtn.disabled = !authProviders.facebook;
  if (!authProviders.google) googleBtn.classList.add('hidden');
  if (!authProviders.facebook) facebookBtn.classList.add('hidden');
  if (!authProviders.google && !authProviders.facebook) {
    loginStatus.textContent = 'No sign-in provider is enabled right now.';
  }

  googleBtn.addEventListener('click', () => handleSignIn(googleProvider));
  facebookBtn.addEventListener('click', () => handleSignIn(facebookProvider));
  signoutBtn.addEventListener('click', () => signOut(auth));
  setSignedInUI(false);

  getRedirectResult(auth).catch((err) => {
    loginStatus.textContent = getAuthErrorMessage(err);
  });

  onAuthStateChanged(auth, (user) => {
    if (user && isAdmin(user)) {
      loginPanel.classList.add('hidden');
      dashboard.classList.remove('hidden');
      setSignedInUI(true);
      loginStatus.textContent = `Signed in as ${user.email || 'admin'}.`;
      ensureAdminRecord(user).then(refreshDashboard);
      return;
    }

    dashboard.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    setSignedInUI(Boolean(user));

    if (user && !isAdmin(user)) {
      loginStatus.textContent = `Access denied for ${user.email || 'this account'}. Use the owner admin email.`;
    } else {
      loginStatus.textContent = 'Waiting for sign-in.';
    }
  });
}

if (refreshCommentsBtn) refreshCommentsBtn.addEventListener('click', loadRecentComments);
if (refreshReactionsBtn) refreshReactionsBtn.addEventListener('click', loadRecentReactions);
if (refreshSigninsBtn) refreshSigninsBtn.addEventListener('click', loadTodaySigninsList);

initAuth();
