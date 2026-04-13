/**
 * ═══════════════════════════════════════════════════════════════
 *  PersistDB — El-Feki Podcast Data Persistence Module
 * ═══════════════════════════════════════════════════════════════
 *
 *  Self-contained persistence layer for the El-Feki podcast site.
 *  localStorage is the source of truth. data.json is ONLY a fallback.
 *
 *  Key design decisions:
 *   - NEVER clears user data (no removeItem on chapter keys)
 *   - Dual-write redundancy: main key + backup key always in sync
 *   - Load priority: localStorage → backup key → data.json fetch
 *   - Every localStorage operation wrapped in try/catch
 *   - All methods synchronous EXCEPT init() which is async
 *
 *  Usage:
 *    await PersistDB.init();
 *    const chapters = PersistDB.getChapters();
 *    PersistDB.addChapter('New Chapter', '📖');
 *
 * ═══════════════════════════════════════════════════════════════
 */

const PersistDB = {

  // ── Storage Keys ──────────────────────────────────────────
  KEYS: {
    chapters:       'elfeki_chapters',
    chaptersBackup: 'elfeki_chapters_backup',
    playlist:       'elfeki_playlist',
    bgMusic:        'elfeki_bg_music_pref',
    theme:          'elfeki_theme',
    cookies:        'elfeki_cookie_consent',
    admin:          'elfeki_admin',
    ads:            'elfeki_ads',
  },

  // ── In-memory state ───────────────────────────────────────
  _chapters: [],
  _nextId:   { chapter: 7, song: 31 },
  _admin:    { email: '', password: '' },
  _ready:    false,

  // ══════════════════════════════════════════════════════════
  //  INIT — async, call once on page load
  // ══════════════════════════════════════════════════════════

  /**
   * Initialise PersistDB. Tries localStorage first, then backup,
   * then falls back to fetching data.json. Always writes a backup
   * after a successful load from any source.
   */
  async init() {
    // 1. Try primary localStorage
    let data = this._loadFromStorage();

    // 2. Try Supabase (cross-device sync) — with 5s timeout to avoid blocking
    if (!data) {
      try {
        await Promise.race([
          this._initSupabase(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), 5000))
        ]);
      } catch (e) {
        console.warn('[PersistDB] Supabase init skipped:', e.message);
      }
      const supaChapters = await this._loadFromSupabase();
      if (supaChapters) {
        data = { chapters: supaChapters, nextId: this._nextId, admin: this._admin };
        console.log('[PersistDB] Restored from Supabase');
      }
    }

    // 3. If still null, fall back to data.json
    if (!data) {
      data = await this._loadFromJSON();
    }

    // 3. Apply loaded data (or defaults if everything failed)
    if (data) {
      this._chapters = Array.isArray(data.chapters) ? data.chapters : [];
      this._nextId   = data.nextId   || { chapter: 7, song: 31 };
      this._admin    = data.admin    || { email: '', password: '' };
    }

    // 3b. Sanity check: if chapters exist but ALL have zero songs, reload from data.json
    const totalSongs = this._chapters.reduce((s, c) => s + (c.songs ? c.songs.length : 0), 0);
    if (this._chapters.length > 0 && totalSongs === 0) {
      console.warn('[PersistDB] Chapters loaded but 0 songs found — forcing reload from data.json');
      const freshData = await this._loadFromJSON();
      if (freshData && Array.isArray(freshData.chapters)) {
        this._chapters = freshData.chapters;
        this._nextId   = freshData.nextId   || { chapter: 7, song: 31 };
        this._admin    = freshData.admin    || this._admin;
        this._save();
      }
    }

    // 4. Ensure backup is current
    this._save();
    this._ready = true;

    console.log(`[PersistDB] Initialised — ${this._chapters.length} chapters loaded.`);
  },

  // ══════════════════════════════════════════════════════════
  //  CHAPTERS CRUD
  // ══════════════════════════════════════════════════════════

  /** Return all chapters from in-memory cache. */
  getChapters() {
    return this._chapters;
  },

  /**
   * Add a new chapter.
   * @param {string} name  — chapter display name
   * @param {string} icon  — emoji or icon string
   * @returns {object} the created chapter
   */
  addChapter(name, icon) {
    const chapter = {
      id: this._nextId.chapter++,
      name: name || 'Untitled Chapter',
      icon: icon || '📖',
      songs: [],
    };
    this._chapters.push(chapter);
    this._save();
    return chapter;
  },

  /**
   * Update chapter fields by ID.
   * @param {number} id       — chapter ID
   * @param {object} updates  — fields to merge (name, icon, songs, …)
   * @returns {object|null} updated chapter or null if not found
   */
  updateChapter(id, updates) {
    const ch = this._chapters.find(c => c.id === id);
    if (!ch) return null;
    Object.assign(ch, updates);
    this._save();
    return ch;
  },

  /**
   * Delete a chapter by ID.
   * @param {number} id — chapter ID
   * @returns {boolean} true if deleted
   */
  deleteChapter(id) {
    const idx = this._chapters.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this._chapters.splice(idx, 1);
    this._save();
    return true;
  },

  // ══════════════════════════════════════════════════════════
  //  SONGS CRUD
  // ══════════════════════════════════════════════════════════

  /**
   * Add a song to a chapter.
   * @param {number} chapterId
   * @param {string} title
   * @param {string} audioUrl
   * @param {string} imageUrl
   * @returns {object|null} the created song or null if chapter not found
   */
  addSong(chapterId, title, audioUrl, imageUrl) {
    const ch = this._chapters.find(c => c.id === chapterId);
    if (!ch) return null;

    const song = {
      id: this._nextId.song++,
      title: title || 'Untitled',
      audio: audioUrl || '',
      image: imageUrl || '',
    };
    if (!Array.isArray(ch.songs)) ch.songs = [];
    ch.songs.push(song);
    this._save();
    return song;
  },

  /**
   * Delete a song from a chapter.
   * @param {number} chapterId
   * @param {number} songId
   * @returns {boolean} true if deleted
   */
  deleteSong(chapterId, songId) {
    const ch = this._chapters.find(c => c.id === chapterId);
    if (!ch || !Array.isArray(ch.songs)) return false;

    const idx = ch.songs.findIndex(s => s.id === songId);
    if (idx === -1) return false;

    ch.songs.splice(idx, 1);
    this._save();
    return true;
  },

  /**
   * Update a song's fields.
   * @param {number} chapterId
   * @param {number} songId
   * @param {object} updates  — fields to merge (title, audio, image, …)
   * @returns {object|null} updated song or null if not found
   */
  updateSong(chapterId, songId, updates) {
    const ch = this._chapters.find(c => c.id === chapterId);
    if (!ch || !Array.isArray(ch.songs)) return null;

    const song = ch.songs.find(s => s.id === songId);
    if (!song) return null;

    Object.assign(song, updates);
    this._save();
    return song;
  },

  // ══════════════════════════════════════════════════════════
  //  PLAYLIST
  // ══════════════════════════════════════════════════════════

  /**
   * Get playlist from localStorage.
   * @returns {Array} playlist items
   */
  getPlaylist() {
    try {
      const raw = localStorage.getItem(this.KEYS.playlist);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[PersistDB] getPlaylist error:', e);
    }
    return [];
  },

  /**
   * Save entire playlist to localStorage.
   * @param {Array} playlist
   */
  savePlaylist(playlist) {
    try {
      localStorage.setItem(this.KEYS.playlist, JSON.stringify(playlist));
    } catch (e) {
      console.warn('[PersistDB] savePlaylist error:', e);
    }
  },

  /**
   * Add a song to the playlist (prevents duplicates by audio URL).
   * @param {object} song         — { id, title, audio, image }
   * @param {string} chapterName  — display name of source chapter
   * @param {number} chapterId    — ID of source chapter
   * @returns {Array} updated playlist
   */
  addToPlaylist(song, chapterName, chapterId) {
    const list = this.getPlaylist();

    // Duplicate check by audio URL
    const exists = list.some(item => item.audio === song.audio);
    if (exists) return list;

    list.push({
      id:          song.id || Date.now(),
      title:       song.title  || 'Untitled',
      audio:       song.audio  || '',
      image:       song.image  || '',
      chapterName: chapterName || '',
      chapterId:   chapterId   || null,
    });

    this.savePlaylist(list);
    return list;
  },

  /**
   * Remove a song from the playlist by index.
   * @param {number} index
   * @returns {Array} updated playlist
   */
  removeFromPlaylist(index) {
    const list = this.getPlaylist();
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
      this.savePlaylist(list);
    }
    return list;
  },

  /**
   * Clear the entire playlist.
   * @returns {Array} empty array
   */
  clearPlaylist() {
    this.savePlaylist([]);
    return [];
  },

  // ══════════════════════════════════════════════════════════
  //  BACKGROUND MUSIC PREFERENCES
  // ══════════════════════════════════════════════════════════

  /**
   * Get background music preference.
   * @returns {{ enabled: boolean, volume: number }}
   */
  getBgMusicPref() {
    try {
      const raw = localStorage.getItem(this.KEYS.bgMusic);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[PersistDB] getBgMusicPref error:', e);
    }
    return { enabled: true, volume: 0.3 };
  },

  /**
   * Save background music preference.
   * @param {{ enabled?: boolean, volume?: number }} pref
   */
  saveBgMusicPref(pref) {
    try {
      const current = this.getBgMusicPref();
      const merged  = { ...current, ...pref };
      localStorage.setItem(this.KEYS.bgMusic, JSON.stringify(merged));
    } catch (e) {
      console.warn('[PersistDB] saveBgMusicPref error:', e);
    }
  },

  // ══════════════════════════════════════════════════════════
  //  THEME
  // ══════════════════════════════════════════════════════════

  /**
   * Get saved theme string.
   * @returns {string|null}
   */
  getTheme() {
    try {
      return localStorage.getItem(this.KEYS.theme);
    } catch (e) {
      console.warn('[PersistDB] getTheme error:', e);
      return null;
    }
  },

  /**
   * Save theme string.
   * @param {string} theme
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.KEYS.theme, theme);
    } catch (e) {
      console.warn('[PersistDB] saveTheme error:', e);
    }
  },

  // ══════════════════════════════════════════════════════════
  //  COOKIE CONSENT
  // ══════════════════════════════════════════════════════════

  /** @returns {boolean} */
  getCookieConsent() {
    try {
      return localStorage.getItem(this.KEYS.cookies) === 'true';
    } catch (e) {
      return false;
    }
  },

  /** @param {boolean} accepted */
  saveCookieConsent(accepted) {
    try {
      localStorage.setItem(this.KEYS.cookies, accepted ? 'true' : 'false');
    } catch (e) {
      console.warn('[PersistDB] saveCookieConsent error:', e);
    }
  },

  // ══════════════════════════════════════════════════════════
  //  ADS
  // ══════════════════════════════════════════════════════════

  /** @returns {Array} ads config or empty array */
  getAds() {
    try {
      const raw = localStorage.getItem(this.KEYS.ads);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[PersistDB] getAds error:', e);
    }
    return [];
  },

  /** @param {Array} ads */
  saveAds(ads) {
    try {
      localStorage.setItem(this.KEYS.ads, JSON.stringify(ads));
    } catch (e) {
      console.warn('[PersistDB] saveAds error:', e);
    }
  },

  // ══════════════════════════════════════════════════════════
  //  INTERNAL — persistence helpers
  // ══════════════════════════════════════════════════════════

  /**
   * Save chapters + nextId + admin to BOTH localStorage keys
   * (main + backup) for redundancy. Wrapped in try/catch.
   */
  _save() {
    const payload = JSON.stringify({
      chapters: this._chapters,
      nextId:   this._nextId,
      admin:    this._admin,
    });

    // Write to primary key
    try {
      localStorage.setItem(this.KEYS.chapters, payload);
    } catch (e) {
      console.warn('[PersistDB] _save primary error:', e);
    }

    // Write to backup key (redundancy)
    try {
      localStorage.setItem(this.KEYS.chaptersBackup, payload);
    } catch (e) {
      console.warn('[PersistDB] _save backup error:', e);
    }

    // Write to config.js shared key (sync with admin panel)
    try {
      localStorage.setItem('elfeki_cache', payload);
    } catch (e) {
      console.warn('[PersistDB] _save elfeki_cache error:', e);
    }
  },

  /**
   * Try to load data from localStorage: primary key first,
   * then backup key. Returns parsed object or null.
   * @returns {object|null}
   */
  _loadFromStorage() {
    // Try primary
    try {
      const raw = localStorage.getItem(this.KEYS.chapters);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.chapters)) {
          console.log('[PersistDB] Loaded from primary localStorage.');
          return data;
        }
      }
    } catch (e) {
      console.warn('[PersistDB] Primary load error:', e);
    }

    // Try backup
    try {
      const raw = localStorage.getItem(this.KEYS.chaptersBackup);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.chapters)) {
          console.log('[PersistDB] Loaded from backup localStorage.');
          return data;
        }
      }
    } catch (e) {
      console.warn('[PersistDB] Backup load error:', e);
    }

    // Try config.js key (elfeki_cache) — shared with admin panel
    try {
      const raw = localStorage.getItem('elfeki_cache');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.chapters)) {
          console.log('[PersistDB] Loaded from elfeki_cache (config.js shared).');
          return data;
        }
      }
    } catch (e) {
      console.warn('[PersistDB] elfeki_cache load error:', e);
    }

    return null;
  },

  /**
   * Fetch data.json from the server as a last resort.
   * Saves the fetched data to localStorage on success.
   * @returns {object|null}
   */
  async _loadFromJSON() {
    try {
      const resp = await fetch('data.json');
      if (!resp.ok) {
        console.warn('[PersistDB] data.json fetch failed:', resp.status);
        return null;
      }
      const data = await resp.json();
      if (data && Array.isArray(data.chapters)) {
        console.log('[PersistDB] Loaded from data.json (fallback).');
        return data;
      }
    } catch (e) {
      console.warn('[PersistDB] data.json fetch error:', e);
    }
    return null;
  },

  // ══════════════════════════════════════════════════════════
  //  AUTH — simple admin login
  // ══════════════════════════════════════════════════════════

  /**
   * Attempt admin login. Checks email/password against stored admin.
   * On success, sets a session marker in sessionStorage.
   * @param {string} email
   * @param {string} password
   * @returns {boolean} true if credentials match
   */
  login(email, password) {
    if (
      this._admin.email &&
      this._admin.password &&
      email === this._admin.email &&
      password === this._admin.password
    ) {
      try {
        sessionStorage.setItem('elfeki_admin_session', 'true');
      } catch (e) {
        console.warn('[PersistDB] login session error:', e);
      }
      return true;
    }
    return false;
  },

  /**
   * Check if an admin session is active.
   * @returns {boolean}
   */
  isLoggedIn() {
    try {
      return sessionStorage.getItem('elfeki_admin_session') === 'true';
    } catch (e) {
      return false;
    }
  },

  /** Clear the admin session. */
  logout() {
    try {
      sessionStorage.removeItem('elfeki_admin_session');
    } catch (e) {
      console.warn('[PersistDB] logout error:', e);
    }
  },

  // ══════════════════════════════════════════════════════════
  //  UTILITIES
  // ══════════════════════════════════════════════════════════

  /**
   * Find a chapter by ID.
   * @param {number} id
   * @returns {object|null}
   */
  getChapterById(id) {
    return this._chapters.find(c => c.id === id) || null;
  },

  /**
   * Find a song across all chapters by song ID.
   * @param {number} songId
   * @returns {{ chapter: object, song: object }|null}
   */
  findSongById(songId) {
    for (const ch of this._chapters) {
      if (!Array.isArray(ch.songs)) continue;
      const song = ch.songs.find(s => s.id === songId);
      if (song) return { chapter: ch, song };
    }
    return null;
  },

  /**
   * Get total song count across all chapters.
   * @returns {number}
   */
  getTotalSongs() {
    return this._chapters.reduce((sum, ch) => sum + (ch.songs ? ch.songs.length : 0), 0);
  },

  /**
   * Export all data as a JSON string (for backup/download).
   * @returns {string}
   */
  exportData() {
    return JSON.stringify({
      chapters: this._chapters,
      nextId:   this._nextId,
      admin:    this._admin,
    }, null, 2);
  },
};


// ══════════════════════════════════════════════════════════
//  SUPABASE SYNC — Cross-device persistence
// ══════════════════════════════════════════════════════════

PersistDB._supa = null;
PersistDB._supaReady = false;

/**
 * Initialize Supabase client and test connection.
 * Called automatically from init().
 */
PersistDB._initSupabase = async function() {
  const SB_URL = 'https://begzpqnbgroanrbicixs.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ3pwcW5iZ3JvYW5yYmljaXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODI5NDQsImV4cCI6MjA5MDQ1ODk0NH0.9xGGVm7Xrk2cftHguE0iL92CmE7C5Yk3wjeBqb7XL0c';

  try {
    // Load Supabase JS client
    if (!window.supabase) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      document.head.appendChild(s);
      await new Promise((resolve, reject) => { s.onload = resolve; s.onerror = reject; });
    }

    this._supa = window.supabase.createClient(SB_URL, SB_KEY);

    // Test connection
    await this._supa.from('ef_chapters').select('id').limit(1);
    this._supaReady = true;
    console.log('[PersistDB] Supabase connected ✅');
  } catch (e) {
    console.warn('[PersistDB] Supabase offline:', e.message || e);
    this._supaReady = false;
  }
};

/**
 * Load chapters from Supabase (for new visitors / cross-device).
 * @returns {Array|null} chapters array or null if empty/error
 */
PersistDB._loadFromSupabase = async function() {
  if (!this._supaReady) return null;

  try {
    const { data, error } = await this._supa.from('ef_chapters').select('*').order('id');
    if (error) { console.warn('[PersistDB] Supabase load error:', error); return null; }
    if (!data || data.length === 0) return null;

    // Check if any chapter has songs
    const hasSongs = data.some(ch => {
      const songs = Array.isArray(ch.songs) ? ch.songs : JSON.parse(ch.songs || '[]');
      return songs.length > 0;
    });
    if (!hasSongs) return null;

    console.log('[PersistDB] Loaded from Supabase ✅');
    return data.map(ch => ({
      id: ch.id,
      name: ch.name,
      icon: ch.icon || '📖',
      songs: Array.isArray(ch.songs) ? ch.songs : JSON.parse(ch.songs || '[]'),
    }));
  } catch (e) {
    console.warn('[PersistDB] Supabase load failed:', e);
    return null;
  }
};

/**
 * Sync all chapters to Supabase (fire-and-forget).
 */
PersistDB._syncToSupabase = async function() {
  if (!this._supaReady || !this._chapters || this._chapters.length === 0) return;

  try {
    for (const ch of this._chapters) {
      await this._supa.from('ef_chapters').upsert({
        id: ch.id,
        name: ch.name,
        icon: ch.icon || '📖',
        songs: ch.songs || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }
    console.log('[PersistDB] Synced to Supabase ✅');
  } catch (e) {
    console.warn('[PersistDB] Supabase sync error:', e);
  }
};

// Override _save to also sync to Supabase
const _origSave = PersistDB._save.bind(PersistDB);
PersistDB._save = function() {
  _origSave();
  // Sync to Supabase in background (don't block)
  this._syncToSupabase();
};

// ── Global export ─────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.PersistDB = PersistDB;
}
