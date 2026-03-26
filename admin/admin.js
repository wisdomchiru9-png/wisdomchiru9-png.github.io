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
const commentFeed = document.getElementById('comment-feed');
const reactionFeed = document.getElementById('reaction-feed');
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
  return adminEmails.map((e) => e.toLowerCase()).includes(user.email.toLowerCase());
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
  const todayKey = getDayKey();
  todayDateEl.textContent = todayKey;
  const q = query(collection(db, 'signins'), where('dayKey', '==', todayKey));
  const snap = await getDocs(q);
  todaySigninsEl.textContent = snap.size;
}

async function loadWeeklySignins() {
  if (!db) return;
  const days = getLastDays(7);
  const q = query(collection(db, 'signins'), where('dayKey', 'in', days));
  const snap = await getDocs(q);
  const counts = {};
  days.forEach((d) => {
    counts[d] = 0;
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
}

function renderFeed(container, items, format) {
  container.innerHTML = '';
  if (!items.length) {
    container.textContent = 'No data yet.';
    return;
  }
  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'list-item';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = format(item).meta;
    const body = document.createElement('div');
    body.textContent = format(item).body;
    el.appendChild(meta);
    el.appendChild(body);
    container.appendChild(el);
  });
}

async function loadRecentComments() {
  if (!db) return;
  commentFeed.textContent = 'Loading...';
  const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  const items = [];
  snap.forEach((docSnap) => items.push(docSnap.data()));
  renderFeed(commentFeed, items, (data) => ({
    meta: `${data.songNum || ''} • ${data.authorName || data.name || 'Anonymous'}`,
    body: data.text || ''
  }));
}

async function loadRecentReactions() {
  if (!db) return;
  reactionFeed.textContent = 'Loading...';
  const q = query(collection(db, 'reactions'), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  const items = [];
  snap.forEach((docSnap) => items.push(docSnap.data()));
  renderFeed(reactionFeed, items, (data) => ({
    meta: `${data.songNum || ''} • ${data.name || data.email || 'User'}`,
    body: `Reacted with ${data.emoji || '👍'}`
  }));
}

async function refreshDashboard() {
  await Promise.all([loadTodaySignins(), loadWeeklySignins(), loadRecentComments(), loadRecentReactions()]);
}

async function handleSignIn(provider) {
  if (!auth || !provider) return;
  loginStatus.textContent = 'Redirecting to sign-in...';
  try {
    await signInWithRedirect(auth, provider);
  } catch (err) {
    loginStatus.textContent = 'Sign-in failed.';
  }
}

function initAuth() {
  if (!firebaseConfigValid) {
    if (googleBtn) googleBtn.disabled = true;
    if (facebookBtn) facebookBtn.disabled = true;
    return;
  }

  googleBtn.disabled = !authProviders.google;
  facebookBtn.disabled = !authProviders.facebook;
  googleBtn.addEventListener('click', () => handleSignIn(googleProvider));
  facebookBtn.addEventListener('click', () => handleSignIn(facebookProvider));
  signoutBtn.addEventListener('click', () => signOut(auth));

  getRedirectResult(auth).catch(() => {
    loginStatus.textContent = 'Sign-in was cancelled.';
  });

  onAuthStateChanged(auth, (user) => {
    if (user && isAdmin(user)) {
      loginPanel.classList.add('hidden');
      dashboard.classList.remove('hidden');
      loginStatus.textContent = 'Signed in.';
      ensureAdminRecord(user);
      refreshDashboard();
      return;
    }
    dashboard.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    if (user && !isAdmin(user)) {
      loginStatus.textContent = 'Access denied. This account is not an admin.';
      signOut(auth);
    } else {
      loginStatus.textContent = 'Waiting for sign-in.';
    }
  });
}

refreshCommentsBtn.addEventListener('click', loadRecentComments);
refreshReactionsBtn.addEventListener('click', loadRecentReactions);

initAuth();
