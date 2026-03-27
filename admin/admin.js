const SESSION_KEY = 'bekNaLahAdminUnlocked';
const FAIL_COUNT_KEY = 'bekNaLahAdminFailCount';
const LOCK_UNTIL_KEY = 'bekNaLahAdminLockUntil';
const PASSWORD_SALT = 'bek-na-lah-admin-v1';
const PASSWORD_HASH = '8405d136ee16702cb24ad2d195928e7f93623533afd0bc18f85b99c60c337ee0';

const lockscreenEl = document.getElementById('admin-lockscreen');
const protectedEl = document.getElementById('admin-protected');
const loginForm = document.getElementById('admin-login-form');
const passwordInput = document.getElementById('admin-password');
const unlockBtn = document.getElementById('admin-unlock');
const logoutBtn = document.getElementById('admin-logout');
const loginStatusEl = document.getElementById('admin-login-status');
const statusEl = document.getElementById('admin-status');

let cooldownTimer = null;

if (statusEl) {
  statusEl.textContent = 'Legacy cloud loading is disabled on this page.';
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

function getLockUntil() {
  const value = Number(localStorage.getItem(LOCK_UNTIL_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

function getFailCount() {
  const value = Number(localStorage.getItem(FAIL_COUNT_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

function clearFailureState() {
  localStorage.removeItem(FAIL_COUNT_KEY);
  localStorage.removeItem(LOCK_UNTIL_KEY);
}

function setProtectedVisible(visible) {
  if (lockscreenEl) lockscreenEl.classList.toggle('hidden', visible);
  if (protectedEl) {
    protectedEl.classList.toggle('hidden', !visible);
    protectedEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !visible);
}

function setStatus(message, type) {
  if (!loginStatusEl) return;
  loginStatusEl.textContent = message;
  loginStatusEl.classList.remove('status-error', 'status-success');
  if (type === 'error') loginStatusEl.classList.add('status-error');
  if (type === 'success') loginStatusEl.classList.add('status-success');
}

function applyCooldownState() {
  if (!unlockBtn) return;

  const lockUntil = getLockUntil();
  const remainingMs = lockUntil - Date.now();

  if (cooldownTimer) {
    clearTimeout(cooldownTimer);
    cooldownTimer = null;
  }

  if (remainingMs <= 0) {
    unlockBtn.disabled = false;
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setStatus('Dashboard is locked.', '');
    }
    return;
  }

  unlockBtn.disabled = true;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  setStatus(`Too many wrong attempts. Try again in ${remainingSeconds}s.`, 'error');

  cooldownTimer = setTimeout(applyCooldownState, Math.min(remainingMs, 1000));
}

function lockDashboard() {
  sessionStorage.removeItem(SESSION_KEY);
  setProtectedVisible(false);
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.focus();
  }
  applyCooldownState();
}

function unlockDashboard() {
  sessionStorage.setItem(SESSION_KEY, '1');
  clearFailureState();
  setProtectedVisible(true);
  setStatus('Dashboard unlocked for this tab.', 'success');
  if (passwordInput) passwordInput.value = '';
}

async function verifyPassword(password) {
  const hashed = await derivePasswordHash(password);
  return hashed === PASSWORD_HASH;
}

async function handleUnlock(event) {
  event.preventDefault();
  if (!passwordInput || !unlockBtn) return;

  const password = passwordInput.value.trim();
  if (!password) {
    setStatus('Enter the password first.', 'error');
    passwordInput.focus();
    return;
  }

  const lockUntil = getLockUntil();
  if (lockUntil > Date.now()) {
    applyCooldownState();
    return;
  }

  unlockBtn.disabled = true;
  setStatus('Checking password...', '');

  try {
    const valid = await verifyPassword(password);
    if (valid) {
      unlockDashboard();
      unlockBtn.disabled = false;
      return;
    }

    const failCount = getFailCount() + 1;
    localStorage.setItem(FAIL_COUNT_KEY, String(failCount));
    const delayMs = Math.min(3000 * failCount, 30000);
    localStorage.setItem(LOCK_UNTIL_KEY, String(Date.now() + delayMs));
    passwordInput.select();
    applyCooldownState();
  } catch (error) {
    unlockBtn.disabled = false;
    setStatus('Password check failed in this browser. Please try again.', 'error');
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleUnlock);
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', lockDashboard);
}

if (sessionStorage.getItem(SESSION_KEY)) {
  setProtectedVisible(true);
  setStatus('Dashboard unlocked for this tab.', 'success');
} else {
  setProtectedVisible(false);
  applyCooldownState();
}
