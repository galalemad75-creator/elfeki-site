// ============================================
// CONFIG — Dr. Ibrahim El-Feki — Direct Supabase
// ============================================

const SB_URL = 'https://begzpqnbgroanrbicixs.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ3pwcW5iZ3JvYW5yYmljaXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODI5NDQsImV4cCI6MjA5MDQ1ODk0NH0.9xGGVm7Xrk2cftHguE0iL92CmE7C5Yk3wjeBqb7XL0c';

const SB_TABLE_CHAPTERS = 'ef_chapters';
const SB_TABLE_SETTINGS = 'ef_settings';

// ---- Supabase REST helpers ----
function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Prefer': 'return=representation'
  };
}

async function sbGet(url) {
  const r = await fetch(url, { headers: sbHeaders(), cache: 'no-store' });
  if (!r.ok) throw new Error('SB GET ' + r.status);
  return r.json();
}

async function sbPost(url, body, prefer) {
  const headers = { ...sbHeaders() };
  if (prefer) headers['Prefer'] = prefer;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('SB POST ' + r.status + ': ' + err);
  }
  return r.json();
}

async function sbPatch(url, body) {
  const r = await fetch(url, { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('SB PATCH ' + r.status + ': ' + err);
  }
  return r.json();
}

// ============================================
// DATABASE — Direct Supabase (no Vercel proxy)
// ============================================
const DB = {
  _cache: null,
  _source: 'none',

  async init() {
    try {
      // Read chapters from Supabase
      const chapters = await sbGet(SB_URL + '/rest/v1/' + SB_TABLE_CHAPTERS + '?order=id');

      // Read settings from Supabase
      let settings = {};
      try {
        const settingsRows = await sbGet(SB_URL + '/rest/v1/' + SB_TABLE_SETTINGS);
        (settingsRows || []).forEach(s => { settings[s.key] = s.value; });
      } catch (e) { console.warn('Settings read:', e.message); }

      // Check if Supabase has real data (chapters with songs)
      const hasSongs = chapters && chapters.length > 0 && chapters.some(c => (c.songs || []).length > 0);

      if (hasSongs) {
        this._cache = {
          chapters: chapters,
          nextId: settings.nextId || { chapter: 7, song: 31 },
          admin: settings.admin || { email: '', password: '' },
        };
        this._source = 'supabase';
        console.log('[DB] Loaded from Supabase:', chapters.length, 'chapters');
      } else {
        // Supabase has chapters but no songs — fall back and sync up
        throw new Error('Supabase chapters have no songs — using data.json');
      }
    } catch (e) {
      console.warn('[DB] Supabase read failed, trying data.json:', e.message);
      // Fallback: read data.json directly
      try {
        const r = await fetch('data.json?t=' + Date.now());
        if (r.ok) {
          const data = await r.json();
          this._cache = {
            chapters: data.chapters || [],
            nextId: data.nextId || { chapter: 7, song: 31 },
            admin: data.admin || { email: '', password: '' },
          };
          this._source = 'local';
          console.log('[DB] Loaded from data.json:', this._cache.chapters.length, 'chapters');
          // Try to sync local data up to Supabase
          this._syncUp();
        }
      } catch (e2) {
        console.warn('[DB] data.json also failed:', e2.message);
        this._cache = { chapters: [], nextId: { chapter: 7, song: 31 }, admin: { email: '', password: '' } };
        this._source = 'fallback';
      }
    }

    localStorage.setItem('elfeki_cache', JSON.stringify(this._cache));
    try { localStorage.setItem('elfeki_chapters', JSON.stringify(this._cache)); } catch(e) {}
    return this._cache;
  },

  // Sync local data up to Supabase (one-time migration)
  async _syncUp() {
    if (!this._cache || !this._cache.chapters.length) return;
    console.log('[DB] Syncing local data to Supabase...');
    try {
      for (const ch of this._cache.chapters) {
        await sbPost(
          SB_URL + '/rest/v1/' + SB_TABLE_CHAPTERS,
          {
            id: ch.id,
            name: ch.name,
            icon: ch.icon || '📚',
            songs: ch.songs || [],
            updated_at: new Date().toISOString()
          },
          'resolution=merge-duplicates'
        );
      }
      // Sync settings
      if (this._cache.nextId) {
        await sbPost(SB_URL + '/rest/v1/' + SB_TABLE_SETTINGS,
          { key: 'nextId', value: this._cache.nextId, updated_at: new Date().toISOString() },
          'resolution=merge-duplicates');
      }
      if (this._cache.admin && this._cache.admin.email) {
        await sbPost(SB_URL + '/rest/v1/' + SB_TABLE_SETTINGS,
          { key: 'admin', value: this._cache.admin, updated_at: new Date().toISOString() },
          'resolution=merge-duplicates');
      }
      console.log('[DB] Sync complete!');
    } catch (e) {
      console.warn('[DB] Sync failed:', e.message);
    }
  },

  getData() { return this._cache || { chapters: [], nextId: { chapter: 7, song: 31 }, admin: {} }; },

  async save(message) {
    const data = this._cache;
    // Save to localStorage first (instant)
    localStorage.setItem('elfeki_cache', JSON.stringify(data));
    try { localStorage.setItem('elfeki_chapters', JSON.stringify(data)); } catch(e) {}

    // Save to Supabase
    try {
      for (const ch of data.chapters) {
        await sbPatch(
          SB_URL + '/rest/v1/' + SB_TABLE_CHAPTERS + '?id=eq.' + ch.id,
          {
            name: ch.name,
            icon: ch.icon,
            songs: ch.songs || [],
            updated_at: new Date().toISOString()
          }
        );
      }
      // Save settings
      if (data.nextId) {
        await sbPost(SB_URL + '/rest/v1/' + SB_TABLE_SETTINGS,
          { key: 'nextId', value: data.nextId, updated_at: new Date().toISOString() },
          'resolution=merge-duplicates');
      }
      if (data.admin) {
        await sbPost(SB_URL + '/rest/v1/' + SB_TABLE_SETTINGS,
          { key: 'admin', value: data.admin, updated_at: new Date().toISOString() },
          'resolution=merge-duplicates');
      }
      console.log('[DB] Saved to Supabase');
    } catch (e) {
      console.warn('[DB] Supabase save failed (cached locally):', e.message);
    }
  },

  // ---- Chapters ----
  getChapters() { return this.getData().chapters; },

  addChapter(name, icon) {
    const data = this._cache;
    const ch = { id: data.nextId.chapter++, name, icon, songs: [] };
    data.chapters.push(ch);
    this.save();
    // Also insert new row to Supabase
    sbPost(SB_URL + '/rest/v1/' + SB_TABLE_CHAPTERS, {
      id: ch.id, name: ch.name, icon: ch.icon, songs: [],
      updated_at: new Date().toISOString()
    }, 'resolution=merge-duplicates').catch(e => console.warn('[DB] Insert chapter:', e.message));
    return ch;
  },

  updateChapter(id, updates) {
    const ch = this._cache.chapters.find(c => c.id === id);
    if (ch) { Object.assign(ch, updates); this.save(); }
    return ch;
  },

  deleteChapter(id) {
    this._cache.chapters = this._cache.chapters.filter(c => c.id !== id);
    this.save();
    // Also delete from Supabase
    fetch(SB_URL + '/rest/v1/' + SB_TABLE_CHAPTERS + '?id=eq.' + id, {
      method: 'DELETE',
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
    }).catch(e => console.warn('[DB] Delete chapter:', e.message));
  },

  // ---- Songs/Episodes ----
  addSong(chapterId, title, fileUrl, fileId, imageUrl) {
    const ch = this._cache.chapters.find(c => c.id === chapterId);
    if (!ch) return null;
    const song = {
      id: this._cache.nextId.song++,
      title,
      audio: fileUrl,
      image: imageUrl || '',
      file_path: fileId,
      created: new Date().toISOString(),
    };
    if (!ch.songs) ch.songs = [];
    ch.songs.push(song);
    this.save();
    return song;
  },

  deleteSong(chapterId, songId) {
    const ch = this._cache.chapters.find(c => c.id === chapterId);
    if (ch) {
      ch.songs = (ch.songs || []).filter(s => s.id !== songId);
      this.save();
    }
  },

  // ---- File Upload (via Cloudinary unsigned) ----
  async uploadFile(file, folder, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const cloudName = 'dse1s0loh';
      const uploadPreset = 'ml_default';

      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          resolve({ url: result.secure_url, path: result.public_id, sha: null });
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || 'Upload failed: ' + xhr.status));
          } catch (_) {
            reject(new Error('Upload failed: ' + xhr.status));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      if (folder) formData.append('folder', folder);

      xhr.send(formData);
    });
  },

  // ---- Auth ----
  login(email, password) {
    const e = String(email || '').trim().toLowerCase();
    const p = String(password || '').trim();
    const admin = this._cache?.admin;
    if (admin && e === String(admin.email || '').trim().toLowerCase() && p === String(admin.password || '').trim()) return true;
    return false;
  },

  async changePassword(oldPass, newPass, newEmail) {
    const admin = this._cache?.admin || {};
    if (oldPass && oldPass !== String(admin.password || '').trim()) return { ok: false, error: 'Current password is wrong' };
    this._cache.admin = { email: newEmail || admin.email || '', password: newPass };
    await this.save('Password updated');
    return { ok: true };
  },

  async resetPassword(newPass, newEmail) {
    this._cache = this._cache || {};
    this._cache.admin = { email: newEmail || 'admin@elfeki.com', password: newPass };
    await this.save('Password reset');
    return { ok: true };
  },

  isLoggedIn() { return !!localStorage.getItem('elfeki_admin'); },
  setSession(email) { localStorage.setItem('elfeki_admin', JSON.stringify({ email, ts: Date.now() })); },
  logout() { localStorage.removeItem('elfeki_admin'); },
};
