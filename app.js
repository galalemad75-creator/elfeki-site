/* El-Feki App.js — rebuilt stable version */

let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let audio = null;
let isPlaying = false;
let playlist = [];
let playlistIndex = -1;
let bgMusic = null;
let bgMusicEnabled = true;

function showToast(msg, duration = 2000) {
  let toast = document.getElementById('elfeki-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'elfeki-toast';
    Object.assign(toast.style, {position:'fixed',bottom:'100px',left:'50%',transform:'translateX(-50%)',background:'var(--accent, #6c5ce7)',color:'#fff',padding:'10px 24px',borderRadius:'8px',fontSize:'14px',zIndex:'10000',opacity:'0',transition:'opacity 0.3s',pointerEvents:'none',whiteSpace:'nowrap'});
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
}

function initTheme() {
  const saved = PersistDB.getTheme() || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  PersistDB.saveTheme(next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) { btn.textContent = theme === 'dark' ? '☀️' : '🌙'; btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`); }
}

function initNav() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navMenu');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => { navLinks.classList.toggle('open'); hamburger.classList.toggle('active'); });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click
