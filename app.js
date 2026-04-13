/**
 * El-Feki App.js — Complete Application Logic
 * Features: Playlist system, cross-chapter playback, background music,
 * PersistDB integration, theme toggle, scroll animations, cookie/ads, nav
 */

// ─── State ───────────────────────────────────────────────────────────────────
let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let audio = null;            // main song audio
let isPlaying = false;

// Playlist
let playlist = [];           // [{id, title, audio, image, chapterName, chapterId}]
let playlistIndex = -1;

// Background music
let bgMusic = null;
let bgMusicEnabled = true;

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2000) {
  let toast = document.getElementById('elfeki-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'elfeki-toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--accent, #6c5ce7)', color: '#fff', padding: '10px 24px',
      borderRadius: '8px', fontSize: '14px', zIndex: '10000', opacity: '0',
      transition: 'opacity 0.3s', pointerEvents: 'none', whiteSpace: 'nowrap'
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
}

// ─── Theme ───────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('elfeki_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('elfeki_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function initNav() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
    // Close menu on link click
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }

  // Theme toggle button
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Scroll → shrink nav
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

function showHome() {
  const hero = document.querySelector('.hero');
  const features = document.querySelector('.features');
  const chaptersSection = document.getElementById('chapters') || document.querySelector('.chapters-section');
  const cta = document.querySelector('.cta');
  const songsView = document.getElementById('songs-view');

  [hero, features, chaptersSection, cta].forEach(el => { if (el) el.style.display = ''; });
  if (songsView) songsView.style.display = 'none';

  // Hide any playlist panel
  hidePlaylistPanel();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSongsView(chapter) {
  const hero = document.querySelector('.hero');
  const features = document.querySelector('.features');
  const chaptersSection = document.getElementById('chapters') || document.querySelector('.chapters-section');
  const cta = document.querySelector('.cta');
  const songsView = document.getElementById('songs-view');

  [hero, features, chaptersSection, cta].forEach(el => { if (el) el.style.display = 'none'; });

  if (!songsView) return;
  songsView.style.display = '';

  // Header
  const headerEl = document.getElementById('songs-chapter-title') || songsView.querySelector('.songs-header h2');
  if (headerEl) headerEl.textContent = chapter.title || chapter.name || 'Chapter';

  // Back button — already exists in HTML, wired in initChapters()

  // Play-all / shuffle-all buttons — already in HTML, just update context
  currentChapter = chapter;

  // Render song cards
  const grid = document.getElementById('songs-grid') || songsView.querySelector('.songs-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const songs = chapter.songs || [];
  songs.forEach((song, i) => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
      <button class="song-play-btn" data-index="${i}" aria-label="Play ${song.title}">▶</button>
      <span class="song-title">${song.title}</span>
      <button class="song-add-btn" data-index="${i}" aria-label="Add to playlist" title="Add to playlist">📋</button>
    `;

    // Play button
    card.querySelector('.song-play-btn').addEventListener('click', () => {
      playSong(i);
    });

    // Add to playlist button
    card.querySelector('.song-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      addToPlaylist(song, chapter.title || chapter.name, chapter.id);
    });

    // Click card to play
    card.addEventListener('click', () => playSong(i));

    grid.appendChild(card);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Chapters Grid ───────────────────────────────────────────────────────────
function initChapters() {
  renderChapters();
  // Wire back button
  const backBtn = document.getElementById('songs-back-btn');
  if (backBtn) backBtn.addEventListener('click', showHome);
  // Wire play all / shuffle
  const playAllBtn = document.getElementById('btn-play-all');
  if (playAllBtn) playAllBtn.addEventListener('click', () => { if (currentChapter) buildPlaylistFromChapter(currentChapter, false); });
  const shuffleBtn = document.getElementById('btn-shuffle-all');
  if (shuffleBtn) shuffleBtn.addEventListener('click', () => { if (currentChapter) buildPlaylistFromChapter(currentChapter, true); });
}

function renderChapters() {
  const grid = document.getElementById('chapters-grid');
  if (!grid) return;
  grid.innerHTML = '';

  chapters.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'chapter-card';
    const icon = ch.icon || '📖';
    const name = ch.name || ch.title || 'Chapter';
    const songCount = (ch.songs || []).length;
    card.innerHTML = `
      <span class="chapter-icon">${icon}</span>
      <h3>${name}</h3>
      <span class="chapter-songs-count">${songCount} episode${songCount !== 1 ? 's' : ''}</span>
    `;
    card.addEventListener('click', () => showSongsView(ch));
    grid.appendChild(card);
  });
}

// ─── Play Song ───────────────────────────────────────────────────────────────
function playSong(i) {
  if (!currentChapter) return;
  const songs = currentChapter.songs || [];
  if (i < 0 || i >= songs.length) return;

  currentSongIndex = i;
  const song = songs[i];

  // Also set playlist context (but don't overwrite existing playlist unless empty)
  if (playlist.length === 0) {
    buildPlaylistFromChapter(currentChapter, false);
    playlistIndex = i;
  }

  loadAndPlay(song, currentChapter.title || currentChapter.name, currentChapter.id);
}

function loadAndPlay(song, chapterName, chapterId) {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener('ended', onSongEnd);
    audio.addEventListener('timeupdate', updateProgressBar);
    audio.addEventListener('loadedmetadata', onMetadataLoaded);
  }

  audio.src = song.audio || song.url || '';
  audio.play().catch(() => { /* user gesture required */ });
  isPlaying = true;

  updateNowPlaying(song, chapterName);
  updatePlayPauseBtn();
}

function onSongEnd() {
  nextTrack();
}

function onMetadataLoaded() {
  const durationEl = document.getElementById('np-duration');
  if (durationEl && audio.duration) {
    durationEl.textContent = formatTime(audio.duration);
  }
}

function updateProgressBar() {
  if (!audio || !audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  const bar = document.getElementById('np-progress');
  if (bar) bar.style.width = pct + '%';

  const curEl = document.getElementById('np-current-time');
  if (curEl) curEl.textContent = formatTime(audio.currentTime);
}

function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function updatePlayPauseBtn() {
  const btn = document.getElementById('np-play-pause');
  if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
}

function togglePlayPause() {
  if (!audio || !audio.src) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    audio.play().catch(() => {});
    isPlaying = true;
  }
  updatePlayPauseBtn();
}

// ─── Now Playing Bar ─────────────────────────────────────────────────────────
function updateNowPlaying(song, chapterName) {
  const bar = document.getElementById('now-playing');
  if (!bar) return;
  bar.style.display = '';

  const titleEl = bar.querySelector('.np-title') || document.getElementById('np-title');
  if (titleEl) titleEl.textContent = song.title || '';

  const chapterEl = bar.querySelector('.np-chapter') || document.getElementById('np-chapter');
  if (chapterEl) chapterEl.textContent = chapterName || '';

  const imgEl = bar.querySelector('.np-img') || document.getElementById('np-img');
  if (imgEl && (song.image || song.cover)) imgEl.src = song.image || song.cover;

  // Play/pause button
  const ppBtn = document.getElementById('np-play-pause');
  if (ppBtn && !ppBtn._bound) {
    ppBtn._bound = true;
    ppBtn.addEventListener('click', togglePlayPause);
  }

  // Next / Prev buttons
  const nextBtn = document.getElementById('np-next');
  if (nextBtn && !nextBtn._bound) {
    nextBtn._bound = true;
    nextBtn.addEventListener('click', nextTrack);
  }
  const prevBtn = document.getElementById('np-prev');
  if (prevBtn && !prevBtn._bound) {
    prevBtn._bound = true;
    prevBtn.addEventListener('click', prevTrack);
  }

  // Progress bar seek
  const progContainer = document.getElementById('np-progress-bar');
  if (progContainer && !progContainer._bound) {
    progContainer._bound = true;
    progContainer.addEventListener('click', (e) => {
      if (!audio || !audio.duration) return;
      const rect = progContainer.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pct * audio.duration;
    });
  }

  // Playlist button in now-playing bar
  const plBtn = document.getElementById('np-playlist-btn');
  if (plBtn && !plBtn._bound) {
    plBtn._bound = true;
    plBtn.addEventListener('click', () => {
      const panel = document.getElementById('playlist-panel');
      if (panel && panel.style.display !== 'none') {
        hidePlaylistPanel();
      } else {
        showPlaylistPanel();
      }
    });
  }

  // Background music toggle button
  const bgBtn = document.getElementById('np-bg-music-btn');
  if (bgBtn && !bgBtn._bound) {
    bgBtn._bound = true;
    bgBtn.addEventListener('click', toggleBgMusic);
  }
}

// ─── Playback Controls (Cross-Chapter) ───────────────────────────────────────
function nextTrack() {
  if (playlist.length > 0) {
    playlistIndex = (playlistIndex + 1) % playlist.length;
    playSongFromPlaylist(playlistIndex);
  } else if (currentChapter) {
    const songs = currentChapter.songs || [];
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    playSong(currentSongIndex);
  }
}

function prevTrack() {
  if (playlist.length > 0) {
    playlistIndex = (playlistIndex - 1 + playlist.length) % playlist.length;
    playSongFromPlaylist(playlistIndex);
  } else if (currentChapter) {
    const songs = currentChapter.songs || [];
    currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    playSong(currentSongIndex);
  }
}

// ─── Playlist System ─────────────────────────────────────────────────────────
function addToPlaylist(song, chapterName, chapterId) {
  const audioUrl = song.audio || song.url || '';
  const exists = playlist.some(p => (p.audio || p.url) === audioUrl);
  if (exists) {
    showToast('Already in playlist');
    return;
  }

  playlist.push({
    id: song.id || audioUrl,
    title: song.title,
    audio: audioUrl,
    image: song.image || song.cover || '',
    chapterName: chapterName,
    chapterId: chapterId
  });

  savePlaylist();
  showToast('Added to playlist ✓');

  // Refresh panel if open
  const panel = document.getElementById('playlist-panel');
  if (panel && panel.style.display !== 'none') renderPlaylistPanel();
}

function removeFromPlaylist(index) {
  if (index < 0 || index >= playlist.length) return;
  playlist.splice(index, 1);

  // Adjust playlistIndex
  if (playlistIndex === index) {
    // Removed currently playing — stop
    if (audio) { audio.pause(); audio.src = ''; }
    isPlaying = false;
    playlistIndex = -1;
  } else if (playlistIndex > index) {
    playlistIndex--;
  }

  savePlaylist();
  renderPlaylistPanel();
  showToast('Removed from playlist');
}

function clearPlaylist() {
  playlist = [];
  playlistIndex = -1;
  savePlaylist();
  renderPlaylistPanel();
  showToast('Playlist cleared');
}

function savePlaylist() {
  try {
    PersistDB.savePlaylist(playlist);
  } catch (e) {
    // Fallback: save directly to localStorage
    localStorage.setItem('elfeki_playlist', JSON.stringify(playlist));
  }
}

function buildPlaylistFromChapter(chapter, shuffle) {
  const songs = chapter.songs || [];
  if (songs.length === 0) return;

  playlist = songs.map(s => ({
    id: s.id || s.audio || s.url,
    title: s.title,
    audio: s.audio || s.url || '',
    image: s.image || s.cover || '',
    chapterName: chapter.title || chapter.name || '',
    chapterId: chapter.id
  }));

  if (shuffle) shuffleArray(playlist);

  playlistIndex = 0;
  savePlaylist();
  playSongFromPlaylist(0);
}

function buildPlaylistFromAll(shuffle) {
  const allSongs = [];
  chapters.forEach(ch => {
    (ch.songs || []).forEach(s => {
      allSongs.push({
        id: s.id || s.audio || s.url,
        title: s.title,
        audio: s.audio || s.url || '',
        image: s.image || s.cover || '',
        chapterName: ch.title || ch.name || '',
        chapterId: ch.id
      });
    });
  });

  if (allSongs.length === 0) return;

  playlist = allSongs;
  if (shuffle) shuffleArray(playlist);

  playlistIndex = 0;
  savePlaylist();
  playSongFromPlaylist(0);
}

function playSongFromPlaylist(index) {
  if (index < 0 || index >= playlist.length) return;
  playlistIndex = index;
  const item = playlist[index];

  loadAndPlay(item, item.chapterName, item.chapterId);

  // Update active state in panel
  const panel = document.getElementById('playlist-panel');
  if (panel && panel.style.display !== 'none') {
    panel.querySelectorAll('.pl-item').forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Playlist Panel UI ───────────────────────────────────────────────────────
function showPlaylistPanel() {
  let panel = document.getElementById('playlist-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'playlist-panel';
    Object.assign(panel.style, {
      position: 'fixed', top: '0', right: '0', width: '340px', maxWidth: '90vw',
      height: '100vh', background: 'var(--bg, #fff)', color: 'var(--text, #333)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', zIndex: '9999',
      overflowY: 'auto', transition: 'transform 0.3s', display: 'flex',
      flexDirection: 'column'
    });
    document.body.appendChild(panel);
  }

  // Header
  panel.innerHTML = `
    <div class="pl-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border,#eee);position:sticky;top:0;background:inherit;z-index:1;">
      <h3 style="margin:0;font-size:18px;">Playlist (${playlist.length})</h3>
      <div style="display:flex;gap:8px;">
        <button id="pl-clear" title="Clear playlist" style="border:none;background:none;cursor:pointer;font-size:16px;">🗑️</button>
        <button id="pl-close" title="Close" style="border:none;background:none;cursor:pointer;font-size:20px;">✕</button>
      </div>
    </div>
    <div id="pl-list" style="flex:1;"></div>
  `;

  document.getElementById('pl-close').addEventListener('click', hidePlaylistPanel);
  document.getElementById('pl-clear').addEventListener('click', clearPlaylist);

  renderPlaylistPanel();

  // Animate in
  requestAnimationFrame(() => {
    panel.style.transform = 'translateX(0)';
  });
  panel.style.display = 'flex';

  // Backdrop
  let backdrop = document.getElementById('pl-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'pl-backdrop';
    Object.assign(backdrop.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.4)', zIndex: '9998', display: 'none'
    });
    backdrop.addEventListener('click', hidePlaylistPanel);
    document.body.appendChild(backdrop);
  }
  backdrop.style.display = 'block';
}

function hidePlaylistPanel() {
  const panel = document.getElementById('playlist-panel');
  if (panel) panel.style.display = 'none';
  const backdrop = document.getElementById('pl-backdrop');
  if (backdrop) backdrop.style.display = 'none';
}

function renderPlaylistPanel() {
  const list = document.getElementById('pl-list');
  if (!list) return;

  if (playlist.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary,#999);padding:40px 20px;">Playlist is empty.<br>Add songs from any chapter!</p>';
    return;
  }

  list.innerHTML = '';
  playlist.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'pl-item' + (i === playlistIndex ? ' active' : '');
    Object.assign(el.style, {
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
      cursor: 'pointer', borderBottom: '1px solid var(--border,#eee)',
      background: i === playlistIndex ? 'var(--accent-light, #6c5ce720)' : 'transparent',
      transition: 'background 0.15s'
    });

    el.innerHTML = `
      <span class="pl-item-num" style="font-size:12px;color:var(--text-secondary,#999);min-width:24px;">${i + 1}</span>
      <div class="pl-item-info" style="flex:1;min-width:0;">
        <div class="pl-item-title" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title}</div>
        <div class="pl-item-chapter" style="font-size:12px;color:var(--text-secondary,#999);">${item.chapterName}</div>
      </div>
      <button class="pl-item-remove" title="Remove" style="border:none;background:none;cursor:pointer;font-size:14px;opacity:0.5;transition:opacity 0.15s;">✕</button>
    `;

    // Click to play
    el.querySelector('.pl-item-info').addEventListener('click', () => playSongFromPlaylist(i));

    // Remove button
    el.querySelector('.pl-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromPlaylist(i);
    });

    // Hover effect
    el.addEventListener('mouseenter', () => { el.style.background = i === playlistIndex ? 'var(--accent-light, #6c5ce720)' : 'var(--hover-bg, #f5f5f5)'; });
    el.addEventListener('mouseleave', () => { el.style.background = i === playlistIndex ? 'var(--accent-light, #6c5ce720)' : 'transparent'; });

    list.appendChild(el);
  });
}

// ─── Background Music ────────────────────────────────────────────────────────
function initBgMusic() {
  const saved = localStorage.getItem('elfeki_bg_music_enabled');
  bgMusicEnabled = saved !== 'false'; // default true

  bgMusic = new Audio('default-music.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.15;

  // Auto-play background music immediately
  if (bgMusicEnabled) {
    bgMusic.play().catch(() => {
      // Fallback: play on first user interaction if autoplay blocked
      const tryPlayBg = () => {
        if (bgMusicEnabled && bgMusic.paused) {
          bgMusic.play().catch(() => {});
        }
        document.removeEventListener('click', tryPlayBg);
        document.removeEventListener('touchstart', tryPlayBg);
      };
      document.addEventListener('click', tryPlayBg, { once: true });
      document.addEventListener('touchstart', tryPlayBg, { once: true });
    });
  }

  updateBgMusicBtn();
}

function toggleBgMusic() {
  bgMusicEnabled = !bgMusicEnabled;
  localStorage.setItem('elfeki_bg_music_enabled', bgMusicEnabled);

  if (bgMusicEnabled && bgMusic) {
    bgMusic.play().catch(() => {});
    showToast('Background music on');
  } else if (bgMusic) {
    bgMusic.pause();
    showToast('Background music off');
  }

  updateBgMusicBtn();
}

function setBgMusicVolume(vol) {
  if (bgMusic) bgMusic.volume = Math.max(0, Math.min(1, vol));
  localStorage.setItem('elfeki_bg_music_volume', vol);
}

function updateBgMusicBtn() {
  const btn = document.getElementById('np-bg-music-btn');
  if (btn) {
    btn.textContent = bgMusicEnabled ? '🎵' : '🔇';
    btn.title = bgMusicEnabled ? 'Mute background music' : 'Play background music';
  }
}

// ─── Scroll Animations ──────────────────────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.chapter-card, .feature-card, .animate-on-scroll').forEach(el => {
    el.classList.add('scroll-hidden');
    observer.observe(el);
  });
}

// ─── Cookie Consent ──────────────────────────────────────────────────────────
function initCookieBanner() {
  if (localStorage.getItem('elfeki_cookies_accepted')) return;

  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  Object.assign(banner.style, {
    position: 'fixed', bottom: '0', left: '0', right: '0',
    background: 'var(--bg-overlay, #2d3436)', color: '#fff',
    padding: '16px 24px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '16px', zIndex: '9000',
    flexWrap: 'wrap', fontSize: '14px'
  });
  banner.innerHTML = `
    <span>We use cookies to improve your experience. By continuing, you agree to our cookie policy.</span>
    <button id="cookie-accept" style="background:var(--accent,#6c5ce7);color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;">Accept</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('cookie-accept').addEventListener('click', () => {
    localStorage.setItem('elfeki_cookies_accepted', '1');
    banner.remove();
  });
}

// ─── Ads ─────────────────────────────────────────────────────────────────────
function initAds() {
  const adSlots = document.querySelectorAll('.ad-slot');
  adSlots.forEach(slot => {
    // In production, replace with real ad network code
    // For now, hide empty ad slots gracefully
    if (!slot.querySelector('iframe') && !slot.querySelector('img')) {
      slot.style.display = 'none';
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await PersistDB.init();
  } catch (e) {
    console.warn('PersistDB init failed, using fallback:', e);
  }

  try {
    chapters = PersistDB.getChapters() || [];
  } catch (e) {
    console.warn('Failed to load chapters:', e);
    chapters = [];
  }

  try {
    playlist = PersistDB.getPlaylist() || [];
  } catch (e) {
    console.warn('Failed to load playlist:', e);
    // Fallback from localStorage
    try {
      playlist = JSON.parse(localStorage.getItem('elfeki_playlist') || '[]');
    } catch (_) {
      playlist = [];
    }
  }

  initTheme();
  initNav();
  initScrollAnimations();
  initChapters();
  initCookieBanner();
  initAds();
  initBgMusic();

  // Ensure now-playing bar exists with controls
  ensureNowPlayingBar();

  renderChapters();
});

// ─── Ensure Now Playing Bar Has All Controls ─────────────────────────────────
function ensureNowPlayingBar() {
  const bar = document.getElementById('now-playing');
  if (!bar) return;

  // Inject controls if missing
  if (!document.getElementById('np-play-pause')) {
    const controls = bar.querySelector('.np-controls');
    if (controls) {
      controls.innerHTML = `
        <button id="np-prev" class="np-btn" title="Previous">⏮</button>
        <button id="np-play-pause" class="np-btn" title="Play/Pause">▶</button>
        <button id="np-next" class="np-btn" title="Next">⏭</button>
        <button id="np-playlist-btn" class="np-btn" title="Playlist">📋</button>
        <button id="np-bg-music-btn" class="np-btn" title="Background music">🎵</button>
      `;
    }
  }

  // Progress bar
  if (!document.getElementById('np-progress-bar')) {
    const progWrap = bar.querySelector('.np-progress-wrap');
    if (progWrap) {
      progWrap.innerHTML = `
        <div id="np-progress-bar" style="width:100%;height:6px;background:var(--border,#ddd);border-radius:3px;cursor:pointer;position:relative;">
          <div id="np-progress" style="width:0%;height:100%;background:var(--accent,#6c5ce7);border-radius:3px;transition:width 0.1s linear;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-secondary,#999);margin-top:4px;">
          <span id="np-current-time">0:00</span>
          <span id="np-duration">0:00</span>
        </div>
      `;
    }
  }
}
