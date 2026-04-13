/* ============================================
   supabase-sync.js — Sync UP to Supabase
   Push-only, never overrides local data
   ============================================ */

(function() {
  'use strict';

  const SITE_ID = 'elfeki-site';
  const SUPABASE_URL = 'https://begzpqnbgroanrbicixs.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZ3pwcW5iZ3JvYW5yYmljaXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODI5NDQsImV4cCI6MjA5MDQ1ODk0NH0.9xGGVm7Xrk2cftHguE0iL92CmE7C5Yk3wjeBqb7XL0c';
  const SUPABASE_TABLE = SITE_ID + '_kv_store';

  async function syncUp() {
    try {
      const raw = localStorage.getItem(SITE_ID + '_chapters');
      if (!raw) {
        console.warn('[Sync] No local data to sync.');
        return false;
      }

      const payload = {
        key: 'chapters',
        value: raw,
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
        const text = await resp.text();
        console.error('[Sync] Supabase error:', resp.status, text);
        return false;
      }

      console.log('[Sync] Data synced to Supabase successfully.');
      return true;
    } catch (e) {
      console.error('[Sync] Sync failed:', e);
      return false;
    }
  }

  // Expose globally
  window.SupabaseSync = { syncUp };

  // Auto-sync every 5 minutes if on main page
  if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
    setInterval(syncUp, 5 * 60 * 1000);
  }
})();
