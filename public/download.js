function isIOSDevice() {
  const userAgent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateDownloadPageForPlatform() {
  const isIOS = isIOSDevice();
  const isStandalone = isStandaloneMode();

  document.documentElement.classList.toggle('platform-ios', isIOS);
  document.documentElement.classList.toggle('platform-standalone', isStandalone);

  const heroKicker = document.getElementById('platform-hero-kicker');
  const heroTitle = document.getElementById('platform-hero-title');
  const heroCopy = document.getElementById('platform-hero-copy');
  const primaryAction = document.getElementById('platform-primary-action');
  const secondaryTitle = document.getElementById('platform-secondary-title');
  const step1 = document.getElementById('platform-step-1');
  const step2 = document.getElementById('platform-step-2');
  const step3 = document.getElementById('platform-step-3');
  const qrTitle = document.getElementById('platform-qr-title');
  const qrCopy = document.getElementById('platform-qr-copy');
  const installPageSubtitle = document.getElementById('install-page-subtitle');

  if (!isIOS) {
    if (window.location.pathname.endsWith('/install-apk.html') || window.location.pathname.endsWith('install-apk.html')) {
      window.setTimeout(() => {
        window.location.href = 'https://github.com/wisdomchiru9-png/wisdomchiru9-png.github.io/releases/download/v4.0.1/Beek-Na-Lah.apk';
      }, 600);
    }
    return;
  }

  if (heroKicker) {
    heroKicker.textContent = 'iPhone and iPad';
  }

  if (heroTitle) {
    heroTitle.textContent = isStandalone ? 'Songbook installed on this iPhone' : 'Add this app to your Home Screen';
  }

  if (heroCopy) {
    heroCopy.textContent = isStandalone
      ? 'The songbook is already installed like an app. Open it from your Home Screen any time.'
      : 'Use Safari on iPhone or iPad, then tap Share and choose Add to Home Screen.';
  }

  if (primaryAction) {
    primaryAction.textContent = isStandalone ? 'Open Songbook' : 'See iPhone Steps';
    primaryAction.href = isStandalone ? 'index.html' : '#ios-install-card';
  }

  if (secondaryTitle) {
    secondaryTitle.textContent = 'Install from Safari';
  }

  if (step1) {
    step1.textContent = 'Open this site in Safari on your iPhone or iPad.';
  }

  if (step2) {
    step2.textContent = 'Tap the Share button, then choose Add to Home Screen.';
  }

  if (step3) {
    step3.textContent = 'Open the new icon from your Home Screen and the app will run full screen.';
  }

  if (qrTitle) {
    qrTitle.textContent = 'Scan to open on iPhone';
  }

  if (qrCopy) {
    qrCopy.innerHTML = 'After scanning on iPhone, open in <strong>Safari</strong> and tap <strong>Add to Home Screen</strong>.';
  }

  const apkStartCard = document.getElementById('apk-start-card');
  const iosBlockCard = document.getElementById('ios-apk-block-card');
  if (apkStartCard && iosBlockCard) {
    apkStartCard.classList.add('is-hidden');
    iosBlockCard.classList.remove('is-hidden');
  }

  if (installPageSubtitle) {
    installPageSubtitle.textContent = 'Use Home Screen install on iPhone or iPad.';
  }
}

window.addEventListener('DOMContentLoaded', updateDownloadPageForPlatform);
