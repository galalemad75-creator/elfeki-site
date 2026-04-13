/* ============================================
   Dr. Ibrahim El-Feki Podcast Site — app.v4.js
   All-in-one JavaScript
   ============================================ */

(function() {
  'use strict';

  // ─── Constants ───
  const SITE_ID = 'elfeki-site';
  const DEFAULT_BG_MUSIC = 'default-music.mp3';
  const LS_CHAPTERS = SITE_ID + '_chapters';
  const LS_CHAPTERS_BACKUP = SITE_ID + '_chapters_backup';
  const LS_PLAYLIST = SITE_ID + '_playlist';
  const LS_THEME = SITE_ID + '_theme';
  const LS_COOKIE = SITE_ID + '_cookie_consent';
  const LS_BG_MUSIC = SITE_ID + '_bg_music_on';

  // ─── Supabase Config ───
  const SUPABASE_URL = 'https://begzpqnbgroanrbicixs.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ3pwcW5iZ3JvYW5yYmljaXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODI5NDQsImV4cCI6MjA5MDQ1ODk0NH0.9xGGVm7Xrk2cftHguE0iL92CmE7C5Yk3wjeBqb7XL0c';
  const SUPABASE_TABLE = SITE_ID + '_kv_store';

  // ─── Cloudinary Config ───
  const CLOUDINARY_CLOUD_NAME = 'dse1s0loh';
  const CLOUDINARY_UPLOAD_PRESET = 'ml_default';

  // ─── State ───
  let chapters = [];
  let currentChapter = null;
  let currentSong = null;
  let isPlaying = false;
  let playlist = [];
  let playlistIndex = -1;
  let bgMusic = null;
  let bgMusicOn = false;

  // ─── DOM Refs ───
  let audioEl = null;
  let chaptersGrid = null;
  let songsView = null;
  let songsList = null;
  let songsViewTitle = null;
  let npTitle = null;
  let npChapter = null;
  let npProgressFill = null;
  let npProgress = null;
  let npPlayPause = null;
  let npTime = null;
  let playlistPanel = null;
  let playlistItems = null;
  let themeToggle = null;

  // ═══════════════════════════════════════════
  //  PersistDB — localStorage with backup
  // ═══════════════════════════════════════════

  const DB = {
    save(key, data) {
      try {
        const json = JSON.stringify(data);
        localStorage.setItem(key, json);
        if (key === LS_CHAPTERS) {
          localStorage.setItem(LS_CHAPTERS_BACKUP, json);
        }
        return true;
      } catch (e) {
        console.warn('DB.save failed:', e);
        return false;
      }
    },

    load(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.warn('DB.load failed for', key, e);
        return null;
      }
    },

    async loadChapters() {
      // Priority: localStorage → backup → data.json
      let data = this.load(LS_CHAPTERS);
      if (data && Array.isArray(data) && data.length > 0) {
        return data;
      }
      data = this.load(LS_CHAPTERS_BACKUP);
      if (data && Array.isArray(data) && data.length > 0) {
        this.save(LS_CHAPTERS, data);
        return data;
      }
      // Fallback to data.json
      try {
        const resp = await fetch('data.json');
        const json = await resp.json();
        if (json.chapters && json.chapters.length > 0) {
          this.save(LS_CHAPTERS, json.chapters);
          return json.chapters;
        }
      } catch (e) {
        console.warn('Failed to load data.json:', e);
      }
      return [];
    },

    saveChapters(data) {
      return this.save(LS_CHAPTERS, data);
    }
  };

  // ═══════════════════════════════════════════
  //  Supabase Sync (push UP only)
  // ═══════════════════════════════════════════

  async function syncToSupabase() {
    try {
      const payload = {
        key: 'chapters',
        value: JSON.stringify(chapters),
        site_id: SITE_ID,
        updated_at: new Date().toISOString()
      };
      const resp = await fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        console.warn('Supabase sync failed:', resp.status);
      }
    } catch (e) {
      console.warn('Supabase sync error:', e);
    }
  }

  // ═══════════════════════════════════════════
  //  Cloudinary Upload
  // ═══════════════════════════════════════════

  async function uploadToCloudinary(file) {
    const url = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const resp = await fetch(url, { method: 'POST', body: formData });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('Cloudinary upload failed: ' + resp.status + ' ' + text);
    }
    return resp.json();
  }

  // ═══════════════════════════════════════════
  //  Theme
  // ═══════════════════════════════════════════

  function initTheme() {
    const saved = DB.load(LS_THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);

    themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    DB.save(LS_THEME, next);
  }

  // ═══════════════════════════════════════════
  //  Background Music
  // ═══════════════════════════════════════════

  function initBgMusic() {
    bgMusic = new Audio(DEFAULT_BG_MUSIC);
    bgMusic.loop = true;
    bgMusic.volume = 0.3;

    const saved = DB.load(LS_BG_MUSIC);
    bgMusicOn = saved === null ? true : saved; // default ON

    const bgBtn = document.getElementById('bgMusicToggle');
    if (bgBtn) {
      updateBgBtn(bgBtn);
      bgBtn.addEventListener('click', () => {
        bgMusicOn = !bgMusicOn;
        DB.save(LS_BG_MUSIC, bgMusicOn);
        updateBgBtn(bgBtn);
        if (bgMusicOn) {
          bgMusic.play().catch(() => {});
        } else {
          bgMusic.pause();
        }
      });
    }

    if (bgMusicOn) {
      bgMusic.play().catch(() => {
        // Autoplay blocked — wait for user interaction
        const resume = () => {
          bgMusic.play().catch(() => {});
          document.removeEventListener('click', resume);
          document.removeEventListener('touchstart', resume);
        };
        document.addEventListener('click', resume, { once: true });
        document.addEventListener('touchstart', resume, { once: true });
      });
    }
  }

  function updateBgBtn(btn) {
    btn.textContent = bgMusicOn ? '🔊' : '🔇';
    btn.title = bgMusicOn ? 'Mute background music' : 'Play background music';
    btn.classList.toggle('active', bgMusicOn);
  }

  // ═══════════════════════════════════════════
  //  Playlist System
  // ═══════════════════════════════════════════

  function loadPlaylist() {
    const saved = DB.load(LS_PLAYLIST);
    playlist = Array.isArray(saved) ? saved : [];
  }

  function savePlaylist() {
    DB.save(LS_PLAYLIST, playlist);
  }

  function addToPlaylist(song, chapterName) {
    const exists = playlist.some(s => s.id === song.id);
    if (exists) return;
    playlist.push({ ...song, chapterName: chapterName || '' });
    savePlaylist();
    renderPlaylist();
    renderSongsView(); // update + buttons
  }

  function removeFromPlaylist(songId) {
    playlist = playlist.filter(s => s.id !== songId);
    if (playlistIndex >= playlist.length) playlistIndex = playlist.length - 1;
    savePlaylist();
    renderPlaylist();
    renderSongsView();
  }

  function clearPlaylist() {
    playlist = [];
    playlistIndex = -1;
    savePlaylist();
    renderPlaylist();
    renderSongsView();
  }

  function playFromPlaylist(index) {
    if (index < 0 || index >= playlist.length) return;
    playlistIndex = index;
    playSong(playlist[index]);
    renderPlaylist();
  }

  function buildPlaylistFromChapter(chapter, shuffle) {
    playlist = chapter.songs.map(s => ({ ...s, chapterName: chapter.name }));
    if (shuffle) {
      for (let i = playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
      }
    }
    playlistIndex = 0;
    savePlaylist();
    playSong(playlist[0]);
    renderPlaylist();
  }

  function buildPlaylistAll(shuffle) {
    playlist = [];
    chapters.forEach(ch => {
      ch.songs.forEach(s => {
        playlist.push({ ...s, chapterName: ch.name });
      });
    });
    if (shuffle) {
      for (let i = playlist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
      }
    }
    playlistIndex = 0;
    savePlaylist();
    if (playlist.length > 0) {
      playSong(playlist[0]);
    }
    renderPlaylist();
  }

  function playNext() {
    if (playlist.length === 0) return;
    playlistIndex = (playlistIndex + 1) % playlist.length;
    playSong(playlist[playlistIndex]);
    renderPlaylist();
  }

  function playPrev() {
    if (playlist.length === 0) return;
    playlistIndex = (playlistIndex - 1 + playlist.length) % playlist.length;
    playSong(playlist[playlistIndex]);
    renderPlaylist();
  }

  // ═══════════════════════════════════════════
  //  Audio Playback
  // ═══════════════════════════════════════════

  function playSong(song) {
    if (!song || !song.audio) {
      console.warn('No audio URL for song:', song ? song.title : 'null');
      return;
    }
    currentSong = song;
    audioEl.src = song.audio;
    audioEl.play().then(() => {
      isPlaying = true;
      updateNowPlaying();
    }).catch(e => {
      console.warn('Playback failed:', e);
      isPlaying = false;
      updateNowPlaying();
    });
  }

  function togglePlay() {
    if (!audioEl.src && playlist.length > 0) {
      playFromPlaylist(0);
      return;
    }
    if (isPlaying) {
      audioEl.pause();
      isPlaying = false;
    } else {
      audioEl.play().then(() => { isPlaying = true; }).catch(() => {});
    }
    updateNowPlaying();
  }

  function updateNowPlaying() {
    if (npTitle) {
      npTitle.textContent = currentSong ? currentSong.title : 'No song selected';
    }
    if (npChapter) {
      npChapter.textContent = currentSong ? (currentSong.chapterName || '') : '';
    }
    if (npPlayPause) {
      npPlayPause.textContent = isPlaying ? '⏸' : '▶';
    }
    renderSongsView();
  }

  function updateProgress() {
    if (!audioEl.duration || !npProgressFill) return;
    const pct = (audioEl.currentTime / audioEl.duration) * 100;
    npProgressFill.style.width = pct + '%';
    if (npTime) {
      npTime.textContent = formatTime(audioEl.currentTime) + ' / ' + formatTime(audioEl.duration);
    }
  }

  function seekAudio(e) {
    if (!audioEl.duration || !npProgress) return;
    const rect = npProgress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioEl.currentTime = pct * audioEl.duration;
  }

  function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ═══════════════════════════════════════════
  //  Rendering
  // ═══════════════════════════════════════════

  function renderChapters() {
    if (!chaptersGrid) return;
    chaptersGrid.innerHTML = '';
    chapters.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'chapter-card reveal';
      card.innerHTML = `
        <div class="chapter-icon">${escHtml(ch.icon)}</div>
        <h3>${escHtml(ch.name)}</h3>
        <p class="song-count">${ch.songs.length} episode${ch.songs.length !== 1 ? 's' : ''}</p>
        <button class="play-chapter-btn" data-chapter="${ch.id}">
          ▶ Play All
        </button>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-chapter-btn')) {
          e.stopPropagation();
          buildPlaylistFromChapter(ch, false);
        } else {
          showChapter(ch);
        }
      });
      chaptersGrid.appendChild(card);
    });
    initRevealObserver();
  }

  function showChapter(chapter) {
    currentChapter = chapter;
    if (chaptersGrid) chaptersGrid.parentElement.style.display = 'none';
    if (songsView) {
      songsView.classList.add('active');
      renderSongsView();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showChaptersList() {
    currentChapter = null;
    if (chaptersGrid) chaptersGrid.parentElement.style.display = '';
    if (songsView) songsView.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSongsView() {
    if (!songsList || !currentChapter) return;
    if (songsViewTitle) songsViewTitle.textContent = currentChapter.name;
    songsList.innerHTML = '';
    currentChapter.songs.forEach((song, i) => {
      const inPlaylist = playlist.some(s => s.id === song.id);
      const isCurrent = currentSong && currentSong.id === song.id;
      const item = document.createElement('div');
      item.className = 'song-item' + (isCurrent && isPlaying ? ' playing' : '');
      item.innerHTML = `
        <div class="song-num">${isCurrent && isPlaying ? '♫' : (i + 1)}</div>
        <div class="song-info">
          <div class="title">${escHtml(song.title)}</div>
          <div class="meta">${escHtml(currentChapter.name)}</div>
        </div>
        <div class="song-actions">
          <button class="song-btn play-song-btn" title="Play" data-song-id="${song.id}">▶</button>
          <button class="song-btn add-to-pl-btn ${inPlaylist ? 'added' : ''}" title="${inPlaylist ? 'In playlist' : 'Add to playlist'}" data-song-id="${song.id}">${inPlaylist ? '✓' : '+'}</button>
        </div>
      `;
      item.querySelector('.play-song-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        // Add to playlist if not there, set as current
        if (!playlist.some(s => s.id === song.id)) {
          addToPlaylist(song, currentChapter.name);
        }
        const idx = playlist.findIndex(s => s.id === song.id);
        if (idx >= 0) {
          playlistIndex = idx;
          playSong(playlist[idx]);
          renderPlaylist();
        }
      });
      item.querySelector('.add-to-pl-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (inPlaylist) {
          removeFromPlaylist(song.id);
        } else {
          addToPlaylist(song, currentChapter.name);
        }
      });
      songsList.appendChild(item);
    });
  }

  function renderPlaylist() {
    if (!playlistItems) return;
    if (playlist.length === 0) {
      playlistItems.innerHTML = '<div class="playlist-empty">Playlist is empty.<br>Add songs to get started!</div>';
      return;
    }
    playlistItems.innerHTML = '';
    playlist.forEach((song, i) => {
      const item = document.createElement('div');
      item.className = 'playlist-item' + (i === playlistIndex ? ' active' : '');
      item.innerHTML = `
        <span class="pl-num">${i + 1}</span>
        <span class="pl-title">${escHtml(song.title)}</span>
        <button class="pl-remove" title="Remove" data-idx="${i}">✕</button>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.pl-remove')) return;
        playFromPlaylist(i);
      });
      item.querySelector('.pl-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromPlaylist(song.id);
      });
      playlistItems.appendChild(item);
    });
  }

  // ═══════════════════════════════════════════
  //  Scroll Animations
  // ═══════════════════════════════════════════

  function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
  }

  // ═══════════════════════════════════════════
  //  Stars Background
  // ═══════════════════════════════════════════

  function createStars() {
    const container = document.querySelector('.stars-container');
    if (!container) return;
    const count = 60;
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.setProperty('--duration', (2 + Math.random() * 4) + 's');
      star.style.setProperty('--delay', (Math.random() * 3) + 's');
      star.style.width = (2 + Math.random() * 3) + 'px';
      star.style.height = star.style.width;
      container.appendChild(star);
    }
  }

  // ═══════════════════════════════════════════
  //  Cookie Consent
  // ═══════════════════════════════════════════

  function initCookieConsent() {
    const banner = document.getElementById('cookieBanner');
    if (!banner) return;
    if (DB.load(LS_COOKIE)) return;
    setTimeout(() => banner.classList.add('show'), 1500);
    const btn = banner.querySelector('.cookie-accept');
    if (btn) {
      btn.addEventListener('click', () => {
        DB.save(LS_COOKIE, true);
        banner.classList.remove('show');
      });
    }
  }

  // ═══════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════
  //  Boot Sequence
  // ═══════════════════════════════════════════

  async function boot() {
    // DOM refs
    audioEl = document.getElementById('mainAudio');
    chaptersGrid = document.getElementById('chaptersGrid');
    songsView = document.getElementById('songsView');
    songsList = document.getElementById('songsList');
    songsViewTitle = document.getElementById('songsViewTitle');
    npTitle = document.getElementById('npTitle');
    npChapter = document.getElementById('npChapter');
    npProgressFill = document.getElementById('npProgressFill');
    npProgress = document.getElementById('npProgress');
    npPlayPause = document.getElementById('npPlayPause');
    npTime = document.getElementById('npTime');
    playlistPanel = document.getElementById('playlistPanel');
    playlistItems = document.getElementById('playlistItems');

    // Theme
    initTheme();

    // Stars
    createStars();

    // Load data
    chapters = await DB.loadChapters();

    // Load playlist
    loadPlaylist();

    // Render
    renderChapters();
    renderPlaylist();

    // Background music
    initBgMusic();

    // Audio events
    if (audioEl) {
      audioEl.addEventListener('timeupdate', updateProgress);
      audioEl.addEventListener('ended', playNext);
      audioEl.addEventListener('loadedmetadata', updateProgress);
    }

    // Now-playing controls
    const npPrevBtn = document.getElementById('npPrev');
    const npNextBtn = document.getElementById('npNext');
    const npPlaylistBtn = document.getElementById('npPlaylistToggle');

    if (npPrevBtn) npPrevBtn.addEventListener('click', playPrev);
    if (npPlayPause) npPlayPause.addEventListener('click', togglePlay);
    if (npNextBtn) npNextBtn.addEventListener('click', playNext);
    if (npProgress) npProgress.addEventListener('click', seekAudio);

    if (npPlaylistBtn) {
      npPlaylistBtn.addEventListener('click', () => {
        if (playlistPanel) {
          playlistPanel.classList.toggle('open');
          npPlaylistBtn.classList.toggle('active');
        }
      });
    }

    // Back to chapters btn
    const backToChapters = document.getElementById('backToChapters');
    if (backToChapters) backToChapters.addEventListener('click', showChaptersList);

    // Play All / Shuffle All in songs view
    const playAllBtn = document.getElementById('playAllBtn');
    const shuffleAllBtn = document.getElementById('shuffleAllBtn');
    if (playAllBtn) {
      playAllBtn.addEventListener('click', () => {
        if (currentChapter) buildPlaylistFromChapter(currentChapter, false);
      });
    }
    if (shuffleAllBtn) {
      shuffleAllBtn.addEventListener('click', () => {
        if (currentChapter) buildPlaylistFromChapter(currentChapter, true);
      });
    }

    // Playlist clear button
    const clearBtn = document.getElementById('playlistClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearPlaylist);

    // Cookie consent
    initCookieConsent();

    // Scroll reveals
    initRevealObserver();

    console.log('[El-Feki] Site booted. Chapters:', chapters.length);
  }

  // Go!
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ─── Expose for admin page ───
  window.ElFeki = {
    DB,
    uploadToCloudinary,
    syncToSupabase,
    getChapters: () => chapters,
    setChapters: (c) => { chapters = c; DB.saveChapters(c); renderChapters(); },
    SITE_ID,
    SUPABASE_URL,
    SUPABASE_KEY,
    SUPABASE_TABLE,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_UPLOAD_PRESET
  };

})();
