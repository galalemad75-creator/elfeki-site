// ============================================
// CONFIG — Dr. Ibrahim El-Feki — Human Development
// All secrets are server-side, nothing exposed
// ============================================

const API = '/api/data';

// ============================================
// DATABASE — API-based (server-side secrets)
// ============================================
const DB = {
  _cache: null,
  _source: 'none',

  async init() {
    try {
      const res = await fetch(API + '?action=read&t=' + Date.now());
      if (!res.ok) throw new Error('API read failed');
      const data = await res.json();

      if (data.chapters && data.chapters.length > 0) {
        this._cache = {
          chapters: data.chapters,
          nextId: data.settings?.nextId || { chapter: 7, song: 31 },
          admin: data.settings?.admin || { email: '', password: '' },
        };
        this._source = data.source || 'api';
      } else {
        this._cache = { chapters: [], nextId: { chapter: 7, song: 31 }, admin: { email: '', password: '' } };
        this._source = 'empty';
      }
    } catch (e) {
      console.warn('DB init error, trying local data.json:', e.message);
      // Fallback: read data.json directly (for GitHub Pages / static hosting)
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
          localStorage.setItem('elfeki_cache', JSON.stringify(this._cache));
          return this._cache;
        }
      } catch (e2) {
        console.warn('Local data.json also failed:', e2.message);
      }
      this._cache = { chapters: [], nextId: { chapter: 7, song: 31 }, admin: { email: '', password: '' } };
      this._source = 'fallback';
    }

    localStorage.setItem('elfeki_cache', JSON.stringify(this._cache));
    return this._cache;
  },

  getData() { return this._cache || { chapters: [], nextId: { chapter: 7, song: 31 }, admin: {} }; },

  async save(message) {
    const data = this._cache;
    localStorage.setItem('elfeki_cache', JSON.stringify(data));

    try {
      await fetch(API + '?action=save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapters: data.chapters,
          settings: { nextId: data.nextId, admin: data.admin },
        }),
      });
    } catch (e) {
      console.warn('Save failed (cached locally):', e.message);
    }
  },

  // ---- Chapters ----
  getChapters() { return this.getData().chapters; },

  addChapter(name, icon) {
    const data = this._cache;
    const ch = { id: data.nextId.chapter++, name, icon, songs: [] };
    data.chapters.push(ch);
    this.save();
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

  // ---- File Upload (via serverless proxy) ----
  async uploadFile(file, folder, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          if (onProgress) onProgress(50);
          const base64 = reader.result.split(',')[1];
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filename = `${Date.now()}_${safeName}`;

          const res = await fetch(API + '?action=upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content: base64, folder: folder || 'audio' }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
          }

          const result = await res.json();
          if (onProgress) onProgress(100);
          resolve({ url: result.url, path: result.path, sha: result.sha });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
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
    this._cache.admin = {
      email: newEmail || admin.email || '',
      password: newPass,
    };
    await this.save('Password updated');
    return { ok: true };
  },

  async resetPassword(newPass, newEmail) {
    this._cache = this._cache || {};
    this._cache.admin = {
      email: newEmail || 'admin@elfeki.com',
      password: newPass,
    };
    await this.save('Password reset');
    return { ok: true };
  },

  isLoggedIn() { return !!localStorage.getItem('elfeki_admin'); },
  setSession(email) { localStorage.setItem('elfeki_admin', JSON.stringify({ email, ts: Date.now() })); },
  logout() { localStorage.removeItem('elfeki_admin'); },
};
