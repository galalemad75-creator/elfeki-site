/**
 * El-Feki App.js — Complete + Fixed
 * Bugs fixed: time progress, playlist, cross-chapter
 */

// ─── State ───────────────────────────────────────────────────────────────────
let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let audio = null;
let isPlaying = false;

// Playlist
let playlist = [];
let playlistIndex = -1;
let isPlaylistMode = false;

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
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('elfeki_theme', next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) { btn.textContent = theme === 'dark' ? '☀️' : '🌙'; }
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function initNav() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navMenu');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.classList.toggle('active');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
      });
    });
  }
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
}

function showHome() {
  document.querySelectorAll('.hero,.features,#chapters,.cta-section').forEach(el => { if (el) el.style.display = ''; });
  var sv = document.getElementById('songs-view');
  if (sv) sv.style.display = 'none';
  hidePlaylistPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSongsView(chapter) {
  document.querySelectorAll('.hero,.features,#chapters,.cta-section').forEach(el => { if (el) el.style.display = 'none'; });
  var sv = document.getElementById('songs-view');
  if (!sv) return;
  sv.style.display = 'block';

  var ht = document.getElementById('songs-chapter-title');
  if (ht) ht.textContent = (chapter.title || chapter.name || 'Chapter');

  currentChapter = chapter;
  isPlaylistMode = false;

  var grid = document.getElementById('songs-grid');
  if (!grid) return;
  grid.innerHTML = '';

  (chapter.songs || []).forEach(function(song, i) {
    var card = document.createElement('div');
    card.className = 'song-card';
    card.id = 'sc-' + i;
    var imgSrc = song.image || song.cover || song.thumbnail || '';
    var thumb = imgSrc
      ? '<img class="song-thumb" src="' + imgSrc + '" alt="" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;">'
      : '<div style="width:44px;height:44px;border-radius:8px;background:var(--accent,#6c5ce7);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">🎙️</div>';
    card.innerHTML = thumb
      + '<button class="song-play-btn" data-i="' + i + '">▶</button>'
      + '<span class="song-title">' + (song.title || 'Untitled') + '</span>'
      + '<button class="song-add-btn" data-i="' + i + '" title="Add to playlist">📋</button>';

    card.querySelector('.song-play-btn').addEventListener('click', function(e) { e.stopPropagation(); playSong(i); });
    card.querySelector('.song-add-btn').addEventListener('click', function(e) { e.stopPropagation(); addToPlaylistBtn(chapter.id, i); });
    card.addEventListener('click', function() { playSong(i); });
    grid.appendChild(card);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Chapters ────────────────────────────────────────────────────────────────
function initChapters() {
  renderChapters();
  var backBtn = document.getElementById('songs-back-btn');
  if (backBtn) backBtn.addEventListener('click', showHome);
  var playAll = document.getElementById('btn-play-all');
  if (playAll) playAll.addEventListener('click', function() { if (currentChapter) buildPlaylistFromChapter(currentChapter, false); });
  var shuffle = document.getElementById('btn-shuffle-all');
  if (shuffle) shuffle.addEventListener('click', function() { if (currentChapter) buildPlaylistFromChapter(currentChapter, true); });
}

function renderChapters() {
  var grid = document.getElementById('chapters-grid');
  if (!grid) return;
  grid.innerHTML = '';
  chapters.forEach(function(ch) {
    var card = document.createElement('div');
    card.className = 'chapter-card';
    var icon = ch.icon || '📖';
    var name = ch.name || ch.title || 'Chapter';
    var n = (ch.songs || []).length;
    card.innerHTML = '<span class="chapter-icon">' + icon + '</span><h3>' + name + '</h3><span class="chapter-songs-count">' + n + ' episode' + (n !== 1 ? 's' : '') + '</span>';
    card.addEventListener('click', function() { showSongsView(ch); });
    grid.appendChild(card);
  });
}

// ─── Play Song ───────────────────────────────────────────────────────────────
function playSong(i) {
  if (!currentChapter) return;
  var songs = currentChapter.songs || [];
  if (i < 0 || i >= songs.length) return;
  currentSongIndex = i;
  isPlaylistMode = false;
  var song = songs[i];
  // Build temp playlist if empty
  if (playlist.length === 0) {
    buildPlaylistFromChapter(currentChapter, false);
    playlistIndex = i;
  }
  loadAndPlay(song, currentChapter.title || currentChapter.name, currentChapter.id);
}

function loadAndPlay(song, chapterName, chapterId) {
  // Pause bg music
  if (bgMusic && !bgMusic.paused) bgMusic.pause();

  audio.src = song.audio || song.url || '';
  audio.play().catch(function(){});
  isPlaying = true;

  updateNowPlaying(song, chapterName);
  updatePlayPauseBtn();

  // Highlight current card
  document.querySelectorAll('.song-card').forEach(function(c) { c.classList.remove('playing'); });
  if (!isPlaylistMode) {
    var sc = document.getElementById('sc-' + currentSongIndex);
    if (sc) sc.classList.add('playing');
  }
}

// ★ BUG FIX: event listeners attached ONCE in boot, not here ★
function onSongEnd() {
  if (!isPlaylistMode && bgMusic && bgMusicEnabled) bgMusic.play().catch(function(){});
  nextTrack();
}
function onMetadataLoaded() {
  var el = document.getElementById('np-duration');
  if (el && audio.duration) el.textContent = formatTime(audio.duration);
}
function updateProgressBar() {
  if (!audio || !audio.duration) return;
  var pct = (audio.currentTime / audio.duration) * 100;
  var bar = document.getElementById('np-progress');
  if (bar) bar.style.width = pct + '%';
  var cur = document.getElementById('np-current-time');
  if (cur) cur.textContent = formatTime(audio.currentTime);
}
function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  var m = Math.floor(s / 60);
  var sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}
function updatePlayPauseBtn() {
  var btn = document.getElementById('np-play-pause');
  if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
}
function togglePlayPause() {
  if (!audio || !audio.src) return;
  if (isPlaying) { audio.pause(); isPlaying = false; }
  else { audio.play().catch(function(){}); isPlaying = true; }
  updatePlayPauseBtn();
}

// ─── Now Playing Bar ─────────────────────────────────────────────────────────
function updateNowPlaying(song, chapterName) {
  var bar = document.getElementById('now-playing');
  if (!bar) return;
  bar.style.display = '';
  bar.classList.add('show');

  var t = document.getElementById('npTitle');
  if (t) t.textContent = song.title || '';
  var s = document.getElementById('npSub');
  if (s) s.textContent = chapterName || '';
  var img = document.getElementById('npImg');
  if (img) {
    var src = song.image || song.cover || '';
    if (src) { img.src = src; img.style.display = ''; }
    else img.style.display = 'none';
  }
}

// ★ Bind controls ONCE in boot ★
function bindNowPlayingControls() {
  var pp = document.getElementById('np-play-pause');
  if (pp) pp.addEventListener('click', togglePlayPause);
  var nx = document.getElementById('np-next');
  if (nx) nx.addEventListener('click', nextTrack);
  var pv = document.getElementById('np-prev');
  if (pv) pv.addEventListener('click', prevTrack);
  var pc = document.getElementById('np-progress-bar');
  if (pc) pc.addEventListener('click', function(e) {
    if (!audio || !audio.duration) return;
    var rect = pc.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });
  var pl = document.getElementById('np-playlist-btn');
  if (pl) pl.addEventListener('click', function() {
    var p = document.getElementById('playlist-panel');
    if (p && p.style.display !== 'none') hidePlaylistPanel();
    else showPlaylistPanel();
  });
  var bg = document.getElementById('np-bg-music-btn');
  if (bg) bg.addEventListener('click', toggleBgMusic);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ★ التنقّل بين الفصول (Cross-Chapter) ★
// ═══════════════════════════════════════════════════════════════════════════════
function nextTrack() {
  if (isPlaylistMode && playlist.length > 0) {
    var next = playlistIndex + 1;
    if (next < playlist.length) playSongFromPlaylist(next);
    else playSongFromPlaylist(0);
    return;
  }
  if (currentChapter && currentSongIndex + 1 < currentChapter.songs.length) {
    playSong(currentSongIndex + 1);
  } else if (currentChapter) {
    var chIdx = chapters.findIndex(function(c) { return c.id === currentChapter.id; });
    for (var i = chIdx + 1; i < chapters.length; i++) {
      if (chapters[i].songs.length > 0) {
        currentChapter = chapters[i];
        showSongsView(currentChapter);
        setTimeout(function() { playSong(0); }, 100);
        return;
      }
    }
  }
}

function prevTrack() {
  if (isPlaylistMode && playlist.length > 0) {
    var prev = playlistIndex - 1;
    if (prev >= 0) playSongFromPlaylist(prev);
    else playSongFromPlaylist(playlist.length - 1);
    return;
  }
  if (currentChapter && currentSongIndex > 0) {
    playSong(currentSongIndex - 1);
  } else if (currentChapter) {
    var chIdx = chapters.findIndex(function(c) { return c.id === currentChapter.id; });
    for (var i = chIdx - 1; i >= 0; i--) {
      if (chapters[i].songs.length > 0) {
        currentChapter = chapters[i];
        showSongsView(currentChapter);
        var lastIdx = chapters[i].songs.length - 1;
        (function(idx) { setTimeout(function() { playSong(idx); }, 100); })(lastIdx);
        return;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ★ قائمة التشغيل (Playlist) ★
// ═══════════════════════════════════════════════════════════════════════════════
function addToPlaylistBtn(chapterId, songIdx) {
  var ch = chapters.find(function(c) { return c.id === chapterId; });
  if (!ch) return;
  var song = ch.songs[songIdx];
  if (!song) return;
  var audioUrl = song.audio || song.url || '';
  if (playlist.some(function(s) { return s.audio === audioUrl; })) {
    showToast('Already in playlist');
    return;
  }
  playlist.push({ title: song.title, audio: audioUrl, image: song.image || '', chapterName: ch.title || ch.name || '', chapterId: chapterId });
  savePlaylist();
  showToast('Added to playlist ✓');
  var panel = document.getElementById('playlist-panel');
  if (panel && panel.style.display !== 'none') renderPlaylistPanel();
}

function removeFromPlaylist(index) {
  if (index < 0 || index >= playlist.length) return;
  playlist.splice(index, 1);
  if (playlistIndex === index) { if (audio) { audio.pause(); audio.src = ''; } isPlaying = false; playlistIndex = -1; updatePlayPauseBtn(); }
  else if (playlistIndex > index) playlistIndex--;
  savePlaylist(); renderPlaylistPanel(); showToast('Removed');
}

function clearPlaylist() {
  playlist = []; playlistIndex = -1; isPlaylistMode = false;
  savePlaylist(); renderPlaylistPanel(); showToast('Playlist cleared');
}

function moveInPlaylist(from, to) {
  if (from < 0 || from >= playlist.length || to < 0 || to >= playlist.length) return;
  var item = playlist.splice(from, 1)[0];
  playlist.splice(to, 0, item);
  if (playlistIndex === from) playlistIndex = to;
  else if (from < playlistIndex && to >= playlistIndex) playlistIndex--;
  else if (from > playlistIndex && to <= playlistIndex) playlistIndex++;
  savePlaylist(); renderPlaylistPanel();
}

function savePlaylist() {
  try { PersistDB.savePlaylist(playlist); }
  catch(e) { localStorage.setItem('elfeki_playlist', JSON.stringify(playlist)); }
}

function buildPlaylistFromChapter(chapter, shuffle) {
  var songs = chapter.songs || [];
  if (!songs.length) return;
  playlist = songs.map(function(s) {
    return { id: s.id || s.audio, title: s.title, audio: s.audio || s.url || '', image: s.image || '', chapterName: chapter.title || chapter.name || '', chapterId: chapter.id };
  });
  if (shuffle) shuffleArray(playlist);
  playlistIndex = 0; savePlaylist(); playSongFromPlaylist(0);
}

function playSongFromPlaylist(index) {
  if (index < 0 || index >= playlist.length) return;
  isPlaylistMode = true;
  playlistIndex = index;
  var item = playlist[index];
  loadAndPlay(item, item.chapterName, item.chapterId);
  // Update panel
  var panel = document.getElementById('playlist-panel');
  if (panel && panel.style.display !== 'none') {
    panel.querySelectorAll('.pl-item').forEach(function(el, i) { el.classList.toggle('active', i === index); });
  }
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; }
  return arr;
}

// ─── Playlist Panel ──────────────────────────────────────────────────────────
function showPlaylistPanel() {
  var panel = document.getElementById('playlist-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'playlist-panel';
    Object.assign(panel.style, {
      position: 'fixed', top: '0', right: '0', width: '360px', maxWidth: '92vw',
      height: '100vh', background: 'var(--bg, #fff)', color: 'var(--text, #333)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.15)', zIndex: '9999',
      overflowY: 'auto', display: 'flex', flexDirection: 'column'
    });
    document.body.appendChild(panel);
  }
  panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border,#eee);position:sticky;top:0;background:inherit;z-index:1;">'
    + '<h3 style="margin:0;font-size:18px;">Playlist (' + playlist.length + ')</h3>'
    + '<div style="display:flex;gap:8px;"><button id="pl-clear" style="border:none;background:none;cursor:pointer;font-size:16px;">🗑️</button>'
    + '<button id="pl-close" style="border:none;background:none;cursor:pointer;font-size:20px;">✕</button></div></div>'
    + '<div id="pl-list" style="flex:1;"></div>';
  document.getElementById('pl-close').addEventListener('click', hidePlaylistPanel);
  document.getElementById('pl-clear').addEventListener('click', clearPlaylist);
  renderPlaylistPanel();
  panel.style.display = 'flex';

  var bd = document.getElementById('pl-backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'pl-backdrop';
    Object.assign(bd.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', zIndex: '9998', display: 'none' });
    bd.addEventListener('click', hidePlaylistPanel);
    document.body.appendChild(bd);
  }
  bd.style.display = 'block';
}

function hidePlaylistPanel() {
  var p = document.getElementById('playlist-panel');
  if (p) p.style.display = 'none';
  var bd = document.getElementById('pl-backdrop');
  if (bd) bd.style.display = 'none';
}

function renderPlaylistPanel() {
  var list = document.getElementById('pl-list');
  if (!list) return;
  if (playlist.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary,#999);padding:40px 20px;">Playlist is empty</p>';
    return;
  }
  list.innerHTML = '';
  playlist.forEach(function(item, i) {
    var el = document.createElement('div');
    el.className = 'pl-item' + (i === playlistIndex ? ' active' : '');
    Object.assign(el.style, {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
      cursor: 'pointer', borderBottom: '1px solid var(--border,#eee)',
      background: i === playlistIndex ? 'var(--accent-light, #6c5ce720)' : 'transparent'
    });

    var reorderUp = (i > 0) ? '<button class="pl-up" style="border:none;background:none;cursor:pointer;font-size:10px;padding:0;line-height:1;">▲</button>' : '<span style="font-size:10px;opacity:0.2;">▲</span>';
    var reorderDown = (i < playlist.length - 1) ? '<button class="pl-down" style="border:none;background:none;cursor:pointer;font-size:10px;padding:0;line-height:1;">▼</button>' : '<span style="font-size:10px;opacity:0.2;">▼</span>';

    el.innerHTML = '<span style="font-size:12px;color:var(--text-secondary,#999);min-width:20px;">' + (i + 1) + '</span>'
      + '<div style="display:flex;flex-direction:column;gap:2px;">' + reorderUp + reorderDown + '</div>'
      + '<div class="pl-info" style="flex:1;min-width:0;"><div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.title + '</div>'
      + '<div style="font-size:12px;color:var(--text-secondary,#999);">' + (item.chapterName || '') + '</div></div>'
      + '<button class="pl-rm" style="border:none;background:none;cursor:pointer;font-size:14px;opacity:0.5;">✕</button>';

    el.querySelector('.pl-info').addEventListener('click', function() { playSongFromPlaylist(i); });
    el.querySelector('.pl-rm').addEventListener('click', function(e) { e.stopPropagation(); removeFromPlaylist(i); });
    var upBtn = el.querySelector('.pl-up');
    var downBtn = el.querySelector('.pl-down');
    if (upBtn && i > 0) upBtn.addEventListener('click', function(e) { e.stopPropagation(); moveInPlaylist(i, i - 1); });
    if (downBtn && i < playlist.length - 1) downBtn.addEventListener('click', function(e) { e.stopPropagation(); moveInPlaylist(i, i + 1); });

    list.appendChild(el);
  });
}

// ─── Background Music ────────────────────────────────────────────────────────
function initBgMusic() {
  var saved = localStorage.getItem('elfeki_bg_music_enabled');
  bgMusicEnabled = saved !== 'false';
  bgMusic = new Audio('default-music.mp3');
  bgMusic.loop = true; bgMusic.volume = 0.15;
  if (bgMusicEnabled) {
    bgMusic.play().catch(function() {
      var handler = function() {
        if (bgMusicEnabled && bgMusic.paused) bgMusic.play().catch(function(){});
        document.removeEventListener('click', handler);
        document.removeEventListener('touchstart', handler);
      };
      document.addEventListener('click', handler, { once: true });
      document.addEventListener('touchstart', handler, { once: true });
    });
  }
  updateBgMusicBtn();
}
function toggleBgMusic() {
  bgMusicEnabled = !bgMusicEnabled;
  localStorage.setItem('elfeki_bg_music_enabled', bgMusicEnabled);
  if (bgMusicEnabled && bgMusic) { bgMusic.play().catch(function(){}); showToast('Background music on'); }
  else if (bgMusic) { bgMusic.pause(); showToast('Background music off'); }
  updateBgMusicBtn();
}
function updateBgMusicBtn() {
  var btn = document.getElementById('np-bg-music-btn');
  if (btn) { btn.textContent = bgMusicEnabled ? '🎵' : '🔇'; }
}

// ─── Scroll Animations ──────────────────────────────────────────────────────
function initScrollAnimations() {
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.chapter-card,.feature-card,.animate-on-scroll').forEach(function(el) { el.classList.add('scroll-hidden'); obs.observe(el); });
}

// ─── Cookie ──────────────────────────────────────────────────────────────────
function initCookieBanner() {
  if (localStorage.getItem('elfeki_cookies_accepted')) return;
  var b = document.createElement('div');
  Object.assign(b.style, { position: 'fixed', bottom: '0', left: '0', right: '0', background: '#2d3436', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', zIndex: '9000', flexWrap: 'wrap', fontSize: '14px' });
  b.innerHTML = '<span>We use cookies to improve your experience.</span><button id="c-accept" style="background:var(--accent,#6c5ce7);color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600;">Accept</button>';
  document.body.appendChild(b);
  document.getElementById('c-accept').addEventListener('click', function() { localStorage.setItem('elfeki_cookies_accepted', '1'); b.remove(); });
}

function initAds() {
  document.querySelectorAll('.ad-slot').forEach(function(s) { if (!s.querySelector('iframe') && !s.querySelector('img')) s.style.display = 'none'; });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  try { await PersistDB.init(); } catch(e) {}

  var loaded = false;

  try {
    var res = await fetch('/api/data?action=read&t=' + Date.now());
    if (res.ok) { var d = await res.json(); if (d && d.chapters && d.chapters.length) { chapters = d.chapters; loaded = true; } }
  } catch(e) {}

  if (!loaded) { try { chapters = PersistDB.getChapters() || []; if (chapters.length) loaded = true; } catch(e) {} }

  if (!loaded) {
    try {
      var resp = await fetch('data.json?t=' + Date.now());
      if (resp.ok) { var sd = await resp.json(); if (sd && sd.chapters) { chapters = sd.chapters; loaded = true; } }
    } catch(e) {}
  }

  if (!loaded) chapters = [];

  try { playlist = PersistDB.getPlaylist() || []; } catch(e) { try { playlist = JSON.parse(localStorage.getItem('elfeki_playlist') || '[]'); } catch(_) { playlist = []; } }

  // ★ FIX: get audio element + attach listeners HERE (not in loadAndPlay) ★
  audio = document.getElementById('player');
  audio.addEventListener('ended', onSongEnd);
  audio.addEventListener('timeupdate', updateProgressBar);
  audio.addEventListener('loadedmetadata', onMetadataLoaded);

  initTheme();
  initNav();
  initScrollAnimations();
  initChapters();
  initCookieBanner();
  initAds();
  initBgMusic();
  bindNowPlayingControls();
  renderChapters();

  try {
    var chEl = document.getElementById('chCount');
    var epEl = document.getElementById('epCount');
    if (chEl) chEl.textContent = chapters.length;
    if (epEl) epEl.textContent = chapters.reduce(function(s, c) { return s + (c.songs || []).length; }, 0);
  } catch(e) {}
});
