// ============================================
// FIXED app.js - SIMPLE & WORKING
// ============================================

let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let audio = new Audio();
let isPlaying = false;

// Playlist
let playlist = [];
let playlistIndex = -1;
let isPlaylistMode = false;

// DOM Elements
let playPauseBtn, prevBtn, nextBtn, playlistBtn, themeToggle;
let npTitle, npSub, npProgress, npCurrentTime, npDuration;
let backBtn;

// ========== HELPER ==========
function showToast(msg, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function savePlaylist() {
    localStorage.setItem('elfeki_playlist', JSON.stringify(playlist));
}

// ========== PLAYLIST FUNCTIONS ==========
function addToPlaylist(song, chapterName) {
    if (playlist.some(s => s.audio === song.audio)) {
        showToast(`"${song.title}" already in playlist`, 'info');
        return;
    }
    playlist.push({
        title: song.title,
        audio: song.audio,
        image: song.image || '',
        chapterName: chapterName
    });
    savePlaylist();
    showToast(`Added "${song.title}" to playlist`, 'success');
}

function showPlaylist() {
    if (playlist.length === 0) {
        showToast('Playlist is empty', 'info');
        return;
    }
    let msg = "📋 MY PLAYLIST:\n\n";
    playlist.forEach((song, i) => {
        msg += `${i+1}. ${song.title} - ${song.chapterName}\n`;
    });
    msg += "\n🎵 To play: Use 'Play from Playlist' button below";
    alert(msg);
}

function playFromPlaylist(index) {
    if (!playlist[index]) return;
    isPlaylistMode = true;
    playlistIndex = index;
    const song = playlist[index];
    audio.src = song.audio;
    audio.play();
    isPlaying = true;
    if (playPauseBtn) playPauseBtn.textContent = '⏸';
    if (npTitle) npTitle.textContent = song.title;
    if (npSub) npSub.textContent = song.chapterName;
}

// ========== PLAYBACK ==========
function playSong(chapter, songIndex) {
    if (!chapter || !chapter.songs || !chapter.songs[songIndex]) return;
    const song = chapter.songs[songIndex];
    if (!song.audio) {
        showToast('No audio URL', 'error');
        return;
    }
    isPlaylistMode = false;
    currentChapter = chapter;
    currentSongIndex = songIndex;
    audio.src = song.audio;
    audio.play();
    isPlaying = true;
    if (playPauseBtn) playPauseBtn.textContent = '⏸';
    if (npTitle) npTitle.textContent = song.title;
    if (npSub) npSub.textContent = chapter.name;
}

function togglePlayPause() {
    if (!audio.src) {
        if (chapters.length > 0 && chapters[0].songs?.length > 0) {
            playSong(chapters[0], 0);
        } else {
            showToast('No episodes available', 'error');
        }
        return;
    }
    if (isPlaying) {
        audio.pause();
        if (playPauseBtn) playPauseBtn.textContent = '▶';
    } else {
        audio.play();
        if (playPauseBtn) playPauseBtn.textContent = '⏸';
    }
    isPlaying = !isPlaying;
}

function nextTrack() {
    // Playlist mode
    if (isPlaylistMode && playlist.length > 0) {
        let next = playlistIndex + 1;
        if (next >= playlist.length) next = 0;
        playFromPlaylist(next);
        return;
    }
    // Chapter mode
    if (!currentChapter || !currentChapter.songs) return;
    if (currentSongIndex + 1 < currentChapter.songs.length) {
        playSong(currentChapter, currentSongIndex + 1);
    } else {
        // Next chapter
        const idx = chapters.findIndex(c => c.id === currentChapter.id);
        for (let i = idx + 1; i < chapters.length; i++) {
            if (chapters[i].songs?.length > 0) {
                playSong(chapters[i], 0);
                return;
            }
        }
        showToast('No more episodes', 'info');
    }
}

function prevTrack() {
    // Playlist mode
    if (isPlaylistMode && playlist.length > 0) {
        let prev = playlistIndex - 1;
        if (prev < 0) prev = playlist.length - 1;
        playFromPlaylist(prev);
        return;
    }
    // Chapter mode
    if (!currentChapter || !currentChapter.songs) return;
    if (currentSongIndex - 1 >= 0) {
        playSong(currentChapter, currentSongIndex - 1);
    } else {
        const idx = chapters.findIndex(c => c.id === currentChapter.id);
        for (let i = idx - 1; i >= 0; i--) {
            if (chapters[i].songs?.length > 0) {
                const last = chapters[i].songs.length - 1;
                playSong(chapters[i], last);
                return;
            }
        }
        showToast('No previous episodes', 'info');
    }
}

// ========== UI RENDER ==========
function renderChapters() {
    const grid = document.getElementById('chapters-grid');
    if (!grid) return;
    if (!chapters.length) {
        grid.innerHTML = '<p style="text-align:center;padding:40px">No courses yet. Add via admin panel.</p>';
        return;
    }
    grid.innerHTML = chapters.map(ch => `
        <div class="chapter-card" data-id="${ch.id}">
            <div class="chapter-icon">${ch.icon || '📚'}</div>
            <h3>${escapeHtml(ch.name)}</h3>
            <p>${ch.songs?.length || 0} episodes</p>
            <button class="btn-view-chapter" data-id="${ch.id}">Browse →</button>
        </div>
    `).join('');
    
    document.querySelectorAll('.btn-view-chapter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            const ch = chapters.find(c => c.id === id);
            if (ch) showSongsView(ch);
        });
    });
}

function showSongsView(chapter) {
    currentChapter = chapter;
    const songsView = document.getElementById('songs-view');
    const chaptersSection = document.getElementById('chapters');
    const titleEl = document.getElementById('songs-chapter-title');
    const grid = document.getElementById('songs-grid');
    
    if (songsView) songsView.style.display = 'block';
    if (chaptersSection) chaptersSection.style.display = 'none';
    if (titleEl) titleEl.textContent = `${chapter.icon || '📚'} ${chapter.name}`;
    
    if (!grid) return;
    if (!chapter.songs?.length) {
        grid.innerHTML = '<p style="text-align:center;padding:40px">No episodes yet.</p>';
        return;
    }
    
    grid.innerHTML = chapter.songs.map((song, idx) => `
        <div class="song-card">
            <div class="song-info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${chapter.name}</p>
            </div>
            <div class="song-actions">
                <button class="play-song" data-idx="${idx}">▶ Play</button>
                <button class="add-playlist" data-idx="${idx}">+ Playlist</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.play-song').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            playSong(chapter, idx);
        });
    });
    
    document.querySelectorAll('.add-playlist').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            addToPlaylist(chapter.songs[idx], chapter.name);
        });
    });
}

function goBack() {
    const songsView = document.getElementById('songs-view');
    const chaptersSection = document.getElementById('chapters');
    if (songsView) songsView.style.display = 'none';
    if (chaptersSection) chaptersSection.style.display = 'block';
}

// ========== AUDIO PROGRESS ==========
function updateProgress() {
    if (audio.duration && !isNaN(audio.duration)) {
        const percent = (audio.currentTime / audio.duration) * 100;
        if (npProgress) npProgress.style.width = `${percent}%`;
        if (npCurrentTime) {
            const m = Math.floor(audio.currentTime / 60);
            const s = Math.floor(audio.currentTime % 60);
            npCurrentTime.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
        }
        if (npDuration) {
            const m = Math.floor(audio.duration / 60);
            const s = Math.floor(audio.duration % 60);
            npDuration.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
        }
    }
}

// ========== THEME ==========
function initTheme() {
    const saved = localStorage.getItem('elfeki_theme');
    const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (themeToggle) themeToggle.textContent = dark ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('elfeki_theme', newTheme);
    if (themeToggle) themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// ========== MAIN INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App starting...');
    
    // Get elements
    playPauseBtn = document.getElementById('np-play-pause');
    prevBtn = document.getElementById('np-prev');
    nextBtn = document.getElementById('np-next');
    playlistBtn = document.getElementById('np-playlist-btn');
    themeToggle = document.getElementById('themeToggle');
    npTitle = document.getElementById('npTitle');
    npSub = document.getElementById('npSub');
    npProgress = document.getElementById('np-progress');
    npCurrentTime = document.getElementById('np-current-time');
    npDuration = document.getElementById('np-duration');
    backBtn = document.getElementById('songs-back-btn');
    
    // Add listeners
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    if (playlistBtn) playlistBtn.addEventListener('click', showPlaylist);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (backBtn) backBtn.addEventListener('click', goBack);
    
    // Audio events
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => nextTrack());
    
    // Progress bar seek
    const progressWrap = document.querySelector('.np-progress-wrap');
    if (progressWrap) {
        progressWrap.addEventListener('click', (e) => {
            const rect = progressWrap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            if (audio.duration && !isNaN(audio.duration)) {
                audio.currentTime = percent * audio.duration;
            }
        });
    }
    
    // Load playlist
    const savedPlaylist = localStorage.getItem('elfeki_playlist');
    if (savedPlaylist) {
        try { playlist = JSON.parse(savedPlaylist); } catch(e) {}
    }
    
    // Init theme
    initTheme();
    
    // Load data - FROM localStorage FIRST (admin saves here)
    let loaded = false;
    try {
        const localRaw = localStorage.getItem('elfeki_chapters');
        if (localRaw) {
            const localData = JSON.parse(localRaw);
            if (localData.chapters && localData.chapters.length > 0) {
                chapters = localData.chapters;
                loaded = true;
                console.log('Loaded from localStorage');
            }
        }
    } catch(e) {}
    
    // Fallback to data.json
    if (!loaded) {
        try {
            const resp = await fetch('data.json?t=' + Date.now());
            if (resp.ok) {
                const data = await resp.json();
                if (data.chapters && data.chapters.length > 0) {
                    chapters = data.chapters;
                    loaded = true;
                    localStorage.setItem('elfeki_chapters', JSON.stringify({ chapters: chapters }));
                    console.log('Loaded from data.json');
                }
            }
        } catch(e) {}
    }
    
    // Final fallback
    if (!loaded || chapters.length === 0) {
        chapters = [{
            id: 1,
            name: "Sample Course",
            icon: "📚",
            songs: [{
                id: 1,
                title: "Welcome Episode",
                audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                image: ""
            }]
        }];
        console.log('Using demo data');
    }
    
    // Render
    renderChapters();
    
    // Update stats
    const totalCourses = chapters.length;
    const totalEpisodes = chapters.reduce((s, c) => s + (c.songs?.length || 0), 0);
    const chCount = document.getElementById('chCount');
    const epCount = document.getElementById('epCount');
    if (chCount) chCount.textContent = totalCourses;
    if (epCount) epCount.textContent = totalEpisodes;
    
    console.log('App ready!');
});
