/* ============================================
   Dr. Ibrahim El-Feki — Main App
   ============================================ */

const player = document.getElementById('player');
let currentChapter = null;
let currentSong = -1;
let chapters = [];

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  initScrollAnimations();
  initChapters();
  initCookieBanner();
  initAds();
});

// ═══ Cookie Consent ═══
function initCookieBanner() {
  const consent = localStorage.getItem('elfeki_cookie_consent');
  if (!consent) {
    setTimeout(() => {
      document.getElementById('cookieBanner')?.classList.add('show');
    }, 2000);
  }
}

function acceptCookies() {
  localStorage.setItem('elfeki_cookie_consent', 'accepted');
  document.getElementById('cookieBanner')?.classList.remove('show');
}

function declineCookies() {
  localStorage.setItem('elfeki_cookie_consent', 'declined');
  document.getElementById('cookieBanner')?.classList.remove('show');
}

// ═══ Ad Rendering ═══
function initAds() {
  try {
    const ads = JSON.parse(localStorage.getItem('elfeki_ads') || '{}');
    if (!ads.publisherId && !ads.headerCode && !ads.bodyCode) return;

    // Inject header ad code
    if (ads.headerCode) {
      const div = document.createElement('div');
      div.innerHTML = ads.headerCode;
      document.head.appendChild(div);
    }

    // Inject AdSense script if publisher ID exists
    if (ads.publisherId) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ads.publisherId;
      s.crossOrigin = 'anonymous';
      document.head.appendChild(s);
    }

    // Show and configure ad slots
    const slots = [
      { id: 'ad-slot-1', slot: ads.slot1 },
      { id: 'ad-slot-2', slot: ads.slot2 },
      { id: 'ad-slot-3', slot: ads.slot3 },
    ];
    slots.forEach(({ id, slot }) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (slot && ads.publisherId) {
        const ins = el.querySelector('.adsbygoogle');
        if (ins) {
          ins.setAttribute('data-ad-client', ads.publisherId);
          ins.setAttribute('data-ad-slot', slot);
        }
        el.style.display = 'block';
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
      }
    });

    // Show body ad code
    if (ads.bodyCode) {
      const slot1 = document.getElementById('ad-slot-1');
      if (slot1) {
        slot1.innerHTML = ads.bodyCode;
        slot1.style.display = 'block';
      }
    }
  } catch (e) {
    console.warn('Ad init error:', e);
  }
}

function initTheme() {
  const saved = localStorage.getItem('elfeki_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('elfeki_theme', next);
    });
  }
}

function initNav() {
  const header = document.getElementById('header');
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('navMenu');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('open');
    });
    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('open');
      });
    });
  }
}

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const parent = el.parentElement;
        if (parent && parent.classList.contains('chapters-grid')) {
          const siblings = Array.from(parent.children);
          const i = siblings.indexOf(el);
          el.style.transitionDelay = `${i * 0.05}s`;
        }
        el.classList.add('visible');
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.card, .animate-on-scroll').forEach(el => observer.observe(el));
}

async function initChapters() {
  await DB.init();
  chapters = DB.getChapters();
  renderChapters();
}

function renderChapters() {
  const grid = document.getElementById('chaptersGrid');
  if (!grid) return;
  grid.innerHTML = chapters.map(c => `
    <div class="card" onclick="openChapter(${c.id})">
      <div class="num">${c.id}</div>
      <div class="name">${c.icon} ${c.name}</div>
      <div class="count">${(c.songs || []).length} episode${(c.songs || []).length !== 1 ? 's' : ''}</div>
    </div>
  `).join('');

  setTimeout(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const siblings = Array.from(el.parentElement.children);
          el.style.transitionDelay = `${siblings.indexOf(el) * 0.05}s`;
          el.classList.add('visible');
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    grid.querySelectorAll('.card').forEach(c => observer.observe(c));
  }, 100);
}

function openChapter(id) {
  currentChapter = chapters.find(c => c.id === id);
  if (!currentChapter) return;

  const hero = document.getElementById('hero');
  const features = document.getElementById('features');
  const chaptersSection = document.getElementById('chapters');
  const ctaSection = document.querySelector('.cta-section');

  if (hero) hero.style.display = 'none';
  if (features) features.style.display = 'none';
  if (chaptersSection) chaptersSection.style.display = 'none';
  if (ctaSection) ctaSection.style.display = 'none';

  let sv = document.getElementById('songsView');
  if (!sv) { createSongsView(); sv = document.getElementById('songsView'); }
  sv.style.display = 'block';

  document.getElementById('chapterTitle').textContent = currentChapter.icon + ' ' + currentChapter.name;

  const sl = document.getElementById('songsList');
  if (!currentChapter.songs || !currentChapter.songs.length) {
    sl.innerHTML = `<div class="empty"><div class="empty-icon">🎙️</div><h3 style="margin-bottom:8px;">No episodes yet</h3><p>Episodes coming soon — stay tuned!</p></div>`;
  } else {
    sl.innerHTML = currentChapter.songs.map((s, i) => `
      <div class="song-card" id="sc-${i}">
        <button class="song-play" onclick="event.stopPropagation(); playSong(${i})">▶</button>
        <span class="song-title">${s.title}</span>
      </div>
    `).join('');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function createSongsView() {
  const sv = document.createElement('div');
  sv.id = 'songsView';
  sv.className = 'songs-view';
  sv.innerHTML = `
    <button class="back-btn" onclick="showHome()">← Back to Topics</button>
    <h2 id="chapterTitle" style="margin-bottom:24px;"></h2>
    <div id="songsList"></div>
  `;
  document.querySelector('main')?.appendChild(sv) || document.body.insertBefore(sv, document.querySelector('.np-bar'));
}

function showHome() {
  ['hero', 'features', 'chapters'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  const cta = document.querySelector('.cta-section');
  if (cta) cta.style.display = '';
  const sv = document.getElementById('songsView');
  if (sv) sv.style.display = 'none';
  currentChapter = null;
}

function playSong(i) {
  if (!currentChapter || !currentChapter.songs || !currentChapter.songs[i]) return;
  currentSong = i;
  const s = currentChapter.songs[i];
  if (!s.audio) return;
  player.src = s.audio;
  player.play().catch(() => {});

  document.querySelector('.np-bar').classList.add('show');
  document.getElementById('npTitle').textContent = s.title;
  document.getElementById('npSub').textContent = currentChapter.name;
  const npImg = document.getElementById('npImg');
  if (s.image) { npImg.src = s.image; npImg.style.display = 'block'; }
  else { npImg.style.display = 'none'; }

  document.getElementById('playBtn').textContent = '⏸';
  document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
  document.getElementById('sc-' + i)?.classList.add('playing');
}

function togglePlay() {
  if (!player.src) return;
  if (player.paused) { player.play(); document.getElementById('playBtn').textContent = '⏸'; }
  else { player.pause(); document.getElementById('playBtn').textContent = '▶'; }
}

function stopAudio() { player.pause(); player.currentTime = 0; document.getElementById('playBtn').textContent = '▶'; }

function closePlayer() {
  player.pause(); player.src = '';
  document.querySelector('.np-bar').classList.remove('show');
  document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
}

function prevSong() { if (currentChapter && currentSong > 0) playSong(currentSong - 1); }
function nextSong() { if (currentChapter && currentSong + 1 < currentChapter.songs.length) playSong(currentSong + 1); }

function seekAudio(e) {
  const bar = e.currentTarget;
  const pct = e.offsetX / bar.offsetWidth;
  player.currentTime = pct * player.duration;
}

player?.addEventListener('timeupdate', () => {
  if (!player.duration) return;
  document.getElementById('npFill').style.width = (player.currentTime / player.duration * 100) + '%';
});

player?.addEventListener('ended', () => {
  if (currentChapter && currentSong + 1 < currentChapter.songs.length) playSong(currentSong + 1);
  else {
    document.getElementById('playBtn').textContent = '▶';
    document.querySelectorAll('.song-card').forEach(c => c.classList.remove('playing'));
  }
});
