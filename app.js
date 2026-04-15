// ============================================
// COMPLETE app.js - ALL FEATURES WORKING
// ============================================

let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let audio = new Audio();
let isPlaying = false;

// Playlist variables
let playlist = [];
let playlistIndex = -1;
let isPlaylistMode = false;

// DOM Elements
let playPauseBtn, prevBtn, nextBtn, playlistBtn, themeToggle, bgMusicBtn;
let npTitle, npSub, npProgress, npCurrentTime, npDuration;
let backBtn;

// Background music
let bgMusic = null;
let bgMusicEnabled = true;

// ========== HELPER FUNCTIONS ==========
function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
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

// ========== PLAYLIST CORE FUNCTIONS ==========
function savePlaylist() {
    localStorage.setItem('elfeki_playlist', JSON.stringify(playlist));
}

function loadPlaylist() {
    const saved = localStorage.getItem('elfeki_playlist');
    if (saved) {
        try {
            playlist = JSON.parse(saved);
        } catch(e) { playlist = []; }
    } else {
        playlist = [];
    }
}

// إضافة أغنية مع منع التكرار
function addToPlaylist(song, chapterName, chapterId) {
    if (playlist.some(s => s.audio === song.audio)) {
        showToast(`"${song.title}" is already in playlist`, 'info');
        return false;
    }
    playlist.push({
        id: Date.now(),
        title: song.title,
        audio: song.audio,
        image: song.image || '',
        chapterName: chapterName,
        chapterId: chapterId
    });
    savePlaylist();
    renderPlaylistUI();
    showToast(`Added "${song.title}" to playlist`, 'success');
    return true;
}

// حذف من القائمة
function removeFromPlaylist(index) {
    if (index >= 0 && index < playlist.length) {
        playlist.splice(index, 1);
        savePlaylist();
        renderPlaylistUI();
        if (isPlaylistMode && playlistIndex === index) {
            isPlaylistMode = false;
            playlistIndex = -1;
        } else if (isPlaylistMode && playlistIndex > index) {
            playlistIndex--;
        }
        showToast('Removed from playlist', 'info');
    }
}

// إعادة ترتيب القائمة
function moveInPlaylist(from, to) {
    if (from === to || from < 0 || to < 0 || from >= playlist.length || to >= playlist.length) return;
    const [item] = playlist.splice(from, 1);
    playlist.splice(to, 0, item);
    savePlaylist();
    renderPlaylistUI();
    
    // Update playlistIndex if needed
    if (isPlaylistMode && playlistIndex === from) {
        playlistIndex = to;
    } else if (isPlaylistMode && playlistIndex > from && playlistIndex <= to) {
        playlistIndex--;
    } else if (isPlaylistMode && playlistIndex < from && playlistIndex >= to) {
        playlistIndex++;
    }
    showToast('Playlist reordered', 'success');
}

// تشغيل من القائمة
function playFromPlaylist(index) {
    if (!playlist[index] || !playlist[index].audio) {
        showToast('Cannot play this episode', 'error');
        return;
    }
    
    isPlaylistMode = true;
    playlistIndex = index;
    const song = playlist[index];
    
    audio.src = song.audio;
    audio.load();
    audio.play().catch(e => console.error("Playback failed:", e));
    isPlaying = true;
    if (playPauseBtn) playPauseBtn.textContent = '⏸';
    
    // Update now playing bar
    if (npTitle) npTitle.textContent = song.title || 'Unknown Title';
    if (npSub) npSub.textContent = song.chapterName || 'Playlist';
    
    // Find and set current chapter for context
    if (song.chapterId) {
        currentChapter = chapters.find(c => c.id === song.chapterId);
        if (currentChapter && currentChapter.songs) {
            const songInChapter = currentChapter.songs.find(s => s.audio === song.audio);
            if (songInChapter) {
                currentSongIndex = currentChapter.songs.indexOf(songInChapter);
            }
        }
    }
}

// عرض قائمة التشغيل (UI منبثق)
function renderPlaylistUI() {
    let panel = document.getElementById('playlist-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'playlist-panel';
        panel.className = 'playlist-panel';
        panel.innerHTML = `
            <div class="playlist-header">
                <h3>📋 My Playlist</h3>
                <button class="close-playlist">✖</button>
            </div>
            <div class="playlist-items"></div>
        `;
        document.body.appendChild(panel);
        panel.querySelector('.close-playlist').addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }
    
    const itemsContainer = panel.querySelector('.playlist-items');
    
    if (playlist.length === 0) {
        itemsContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Playlist is empty.<br>Add episodes using + button.</p>';
        return;
    }
    
    itemsContainer.innerHTML = playlist.map((song, idx) => `
        <div class="playlist-item" draggable="true" data-index="${idx}">
            <div class="playlist-item-drag">⋮⋮</div>
            <div class="playlist-item-img">
                <img src="${song.image || 'https://via.placeholder.com/40?text=🎵'}" onerror="this.src='https://via.placeholder.com/40?text=🎵'">
            </div>
            <div class="playlist-item-info" data-index="${idx}">
                <div class="playlist-item-title">${escapeHtml(song.title)}</div>
                <div class="playlist-item-chapter">${escapeHtml(song.chapterName || 'Unknown')}</div>
            </div>
            <div class="playlist-item-actions">
                <button class="playlist-play-btn" data-index="${idx}" title="Play">▶</button>
                <button class="playlist-remove-btn" data-index="${idx}" title="Remove">🗑</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    itemsContainer.querySelectorAll('.playlist-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            playFromPlaylist(idx);
            panel.style.display = 'none';
        });
    });
    
    itemsContainer.querySelectorAll('.playlist-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            removeFromPlaylist(idx);
        });
    });
    
    // Drag and drop for reordering
    const items = itemsContainer.querySelectorAll('.playlist-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.dataset.index);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = parseInt(item.dataset.index);
            if (!isNaN(fromIdx) && !isNaN(toIdx)) {
                moveInPlaylist(fromIdx, toIdx);
            }
        });
    });
}

function togglePlaylistPanel() {
    const panel = document.getElementById('playlist-panel');
    if (!panel) {
        renderPlaylistUI();
        document.getElementById('playlist-panel').style.display = 'block';
    } else if (panel.style.display === 'none' || !panel.style.display) {
        renderPlaylistUI();
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

// ========== PLAYBACK WITH CROSS-CHAPTER NAVIGATION ==========
function playSong(chapter, songIndex) {
    if (!chapter || !chapter.songs || !chapter.songs[songIndex]) return;
    const song = chapter.songs[songIndex];
    if (!song.audio) {
        showToast('Error: No audio URL found for this episode.', 'error');
        return;
    }
    
    // Exit playlist mode
    isPlaylistMode = false;
    currentChapter = chapter;
    currentSongIndex = songIndex;
    
    audio.src = song.audio;
    audio.load();
    audio.play().catch(e => console.error("Playback failed:", e));
    isPlaying = true;
    if (playPauseBtn) playPauseBtn.textContent = '⏸';
    
    // Update now playing bar
    if (npTitle) npTitle.textContent = song.title || 'Unknown Title';
    if (npSub) npSub.textContent = chapter.name || 'Unknown Course';
    
    // Highlight current song in UI
    document.querySelectorAll('.song-card').forEach(card => card.classList.remove('playing'));
    const currentCard = document.querySelector(`.song-card[data-song-index="${songIndex}"]`);
    if (currentCard) currentCard.classList.add('playing');
}

// NEXT TRACK with cross-chapter navigation
function nextTrack() {
    // PLAYLIST MODE
    if (isPlaylistMode && playlist.length > 0) {
        let nextIndex = playlistIndex + 1;
        if (nextIndex >= playlist.length) {
            nextIndex = 0; // Loop to beginning
        }
        playFromPlaylist(nextIndex);
        return;
    }
    
    // CHAPTER MODE - Next song in current chapter
    if (!currentChapter || !currentChapter.songs || currentChapter.songs.length === 0) return;
    
    if (currentSongIndex + 1 < currentChapter.songs.length) {
        // Next song in same chapter
        playSong(currentChapter, currentSongIndex + 1);
    } else {
        // Move to next chapter that has songs
        const currentChapterIndex = chapters.findIndex(c => c.id === currentChapter.id);
        for (let i = currentChapterIndex + 1; i < chapters.length; i++) {
            if (chapters[i].songs && chapters[i].songs.length > 0) {
                playSong(chapters[i], 0);
                return;
            }
        }
        // Loop to first chapter with songs
        for (let i = 0; i < currentChapterIndex; i++) {
            if (chapters[i].songs && chapters[i].songs.length > 0) {
                playSong(chapters[i], 0);
                return;
            }
        }
        showToast('No more episodes', 'info');
    }
}

// PREV TRACK with cross-chapter navigation
function prevTrack() {
    // PLAYLIST MODE
    if (isPlaylistMode && playlist.length > 0) {
        let prevIndex = playlistIndex - 1;
        if (prevIndex < 0) {
            prevIndex = playlist.length - 1; // Loop to end
        }
        playFromPlaylist(prevIndex);
        return;
    }
    
    // CHAPTER MODE - Previous song in current chapter
    if (!currentChapter || !currentChapter.songs || currentChapter.songs.length === 0) return;
    
    if (currentSongIndex - 1 >= 0) {
        // Previous song in same chapter
        playSong(currentChapter, currentSongIndex - 1);
    } else {
        // Move to previous chapter that has songs
        const currentChapterIndex = chapters.findIndex(c => c.id === currentChapter.id);
        for (let i = currentChapterIndex - 1; i >= 0; i--) {
            if (chapters[i].songs && chapters[i].songs.length > 0) {
                const lastSongIndex = chapters[i].songs.length - 1;
                playSong(chapters[i], lastSongIndex);
                return;
            }
        }
        // Loop to last chapter with songs
        for (let i = chapters.length - 1; i > currentChapterIndex; i--) {
            if (chapters[i].songs && chapters[i].songs.length > 0) {
                const lastSongIndex = chapters[i].songs.length - 1;
                playSong(chapters[i], lastSongIndex);
                return;
            }
        }
        showToast('No previous episodes', 'info');
    }
}

function togglePlayPause() {
    if (!audio.src) {
        // If nothing is playing, play first song from first chapter
        if (chapters.length > 0 && chapters[0].songs && chapters[0].songs.length > 0) {
            playSong(chapters[0], 0);
        } else {
            showToast('No episodes available to play.', 'error');
        }
        return;
    }
    
    if (isPlaying) {
        audio.pause();
        if (playPauseBtn) playPauseBtn.textContent = '▶';
    } else {
        audio.play().catch(e => console.error("Playback failed:", e));
        if (playPauseBtn) playPauseBtn.textContent = '⏸';
    }
    isPlaying = !isPlaying;
}

// ========== AUDIO PROGRESS ==========
function updateProgress() {
    if (audio.duration && !isNaN(audio.duration)) {
        const percent = (audio.currentTime / audio.duration) * 100;
        if (npProgress) npProgress.style.width = `${percent}%`;
        
        if (npCurrentTime) {
            const mins = Math.floor(audio.currentTime / 60);
            const secs = Math.floor(audio.currentTime % 60);
            npCurrentTime.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        
        if (npDuration) {
            const mins = Math.floor(audio.duration / 60);
            const secs = Math.floor(audio.duration % 60);
            npDuration.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
    }
}

// ========== UI RENDERING ==========
function renderChapters() {
    const grid = document.getElementById('chapters-grid');
    if (!grid) return;
    
    if (!chapters || chapters.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);grid-column:1/-1;padding:40px">No courses found. Please add some via the admin panel.</p>';
        return;
    }
    
    grid.innerHTML = chapters.map(ch => `
        <div class="chapter-card animate-on-scroll" data-chapter-id="${ch.id}">
            <div class="chapter-icon">${ch.icon || '📚'}</div>
            <h3>${escapeHtml(ch.name)}</h3>
            <p>${ch.songs?.length || 0} episodes</p>
            <button class="btn-view-chapter" data-chapter-id="${ch.id}">Browse Episodes →</button>
        </div>
    `).join('');
    
    document.querySelectorAll('.btn-view-chapter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.chapterId);
            const chapter = chapters.find(c => c.id === id);
            if (chapter) showSongsView(chapter);
        });
    });
}

function showSongsView(chapter) {
    if (!chapter) return;
    currentChapter = chapter;
    
    const songsView = document.getElementById('songs-view');
    const chaptersSection = document.getElementById('chapters');
    const songsChapterTitle = document.getElementById('songs-chapter-title');
    const songsGrid = document.getElementById('songs-grid');
    
    if (songsView) songsView.style.display = 'block';
    if (chaptersSection) chaptersSection.style.display = 'none';
    if (songsChapterTitle) songsChapterTitle.textContent = `${chapter.icon || '📚'} ${escapeHtml(chapter.name)}`;
    
    if (songsGrid) {
        if (!chapter.songs || chapter.songs.length === 0) {
            songsGrid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">No episodes in this course yet.</p>';
            return;
        }
        
        songsGrid.innerHTML = chapter.songs.map((song, idx) => `
            <div class="song-card" data-song-index="${idx}">
                <div class="song-art">
                    <img src="${song.image || 'https://via.placeholder.com/60?text=🎵'}" alt="${escapeHtml(song.title)}" onerror="this.src='https://via.placeholder.com/60?text=🎵'">
                </div>
                <div class="song-info">
                    <h4>${escapeHtml(song.title)}</h4>
                    <p>${escapeHtml(chapter.name)}</p>
                </div>
                <div class="song-actions">
                    <button class="play-song-btn" data-song-index="${idx}" data-chapter-id="${chapter.id}">▶ Play</button>
                    <button class="add-to-playlist-btn" data-song-index="${idx}" data-chapter-id="${chapter.id}">+ Playlist</button>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.play-song-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.songIndex);
                const chId = parseInt(btn.dataset.chapterId);
                const ch = chapters.find(c => c.id === chId);
                if (ch && ch.songs && ch.songs[idx]) {
                    playSong(ch, idx);
                }
            });
        });
        
        document.querySelectorAll('.add-to-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.songIndex);
                const chId = parseInt(btn.dataset.chapterId);
                const ch = chapters.find(c => c.id === chId);
                if (ch && ch.songs && ch.songs[idx]) {
                    addToPlaylist(ch.songs[idx], ch.name, ch.id);
                }
            });
        });
    }
}

function goBackToCourses() {
    const songsView = document.getElementById('songs-view');
    const chaptersSection = document.getElementById('chapters');
    const playlistPanel = document.getElementById('playlist-panel');
    
    if (songsView) songsView.style.display = 'none';
    if (chaptersSection) chaptersSection.style.display = 'block';
    if (playlistPanel) playlistPanel.style.display = 'none';
    
    currentChapter = null;
    currentSongIndex = -1;
    isPlaylistMode = false;
}

// ========== THEME & BG MUSIC ==========
function initTheme() {
    const savedTheme = localStorage.getItem('elfeki_theme');
    const dark = savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
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

function initBgMusic() {
    const pref = JSON.parse(localStorage.getItem('elfeki_bg_music_pref') || '{"enabled":true,"volume":0.3}');
    bgMusicEnabled = pref.enabled;
    if (bgMusicEnabled) {
        if (!bgMusic) {
            bgMusic = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
            bgMusic.loop = true;
            bgMusic.volume = pref.volume;
        }
        bgMusic.play().catch(e => console.log("BG Music autoplay blocked:", e));
    } else if (bgMusic) {
        bgMusic.pause();
    }
}

function toggleBgMusic() {
    bgMusicEnabled = !bgMusicEnabled;
    localStorage.setItem('elfeki_bg_music_pref', JSON.stringify({ enabled: bgMusicEnabled, volume: 0.3 }));
    if (bgMusicEnabled && bgMusic) {
        bgMusic.play().catch(e => console.log("BG Music play failed:", e));
    } else if (bgMusic) {
        bgMusic.pause();
    }
    showToast(bgMusicEnabled ? 'Background music on' : 'Background music off', 'info');
}

// ========== MAIN INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App initializing with COMPLETE features...");
    
    // Get DOM elements
    playPauseBtn = document.getElementById('np-play-pause');
    prevBtn = document.getElementById('np-prev');
    nextBtn = document.getElementById('np-next');
    playlistBtn = document.getElementById('np-playlist-btn');
    bgMusicBtn = document.getElementById('np-bg-music-btn');
    themeToggle = document.getElementById('themeToggle');
    npTitle = document.getElementById('npTitle');
    npSub = document.getElementById('npSub');
    npProgress = document.getElementById('np-progress');
    npCurrentTime = document.getElementById('np-current-time');
    npDuration = document.getElementById('np-duration');
    backBtn = document.getElementById('songs-back-btn');
    
    // Add event listeners
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    if (playlistBtn) playlistBtn.addEventListener('click', togglePlaylistPanel);
    if (bgMusicBtn) bgMusicBtn.addEventListener('click', toggleBgMusic);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (backBtn) backBtn.addEventListener('click', goBackToCourses);
    
    // Audio events
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => nextTrack());
    
    // Progress bar seeking
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
    
    // Load playlist from storage
    loadPlaylist();
    
    // Initialize theme
    initTheme();
    
    // Load data from localStorage FIRST (admin saves here)
    let loaded = false;
    try {
        const localRaw = localStorage.getItem('elfeki_chapters');
        if (localRaw) {
            const localData = JSON.parse(localRaw);
            if (localData.chapters && localData.chapters.length > 0) {
                chapters = localData.chapters;
                loaded = true;
                console.log("Data loaded from localStorage");
            }
        }
    } catch (e) {
        console.warn("Error reading localStorage", e);
    }
    
    // Fallback to data.json
    if (!loaded) {
        try {
            const resp = await fetch('data.json?t=' + Date.now());
            if (resp.ok) {
                const serverData = await resp.json();
                if (serverData.chapters && serverData.chapters.length > 0) {
                    chapters = serverData.chapters;
                    loaded = true;
                    console.log("Data loaded from data.json");
                    localStorage.setItem('elfeki_chapters', JSON.stringify({ chapters: chapters }));
                }
            }
        } catch (e) {
            console.warn("Could not load data.json", e);
        }
    }
    
    // Final fallback: default data
    if (!loaded || chapters.length === 0) {
        chapters = [{
            id: 1,
            name: "Introduction to Human Development",
            icon: "🌟",
            songs: [{
                id: 1,
                title: "Welcome Episode",
                audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                image: ""
            }]
        }];
        console.log("Using default demo data");
    }
    
    // Render UI
    renderChapters();
    
    // Update stats
    const totalCourses = chapters.length;
    const totalEpisodes = chapters.reduce((sum, ch) => sum + (ch.songs ? ch.songs.length : 0), 0);
    const chCountSpan = document.getElementById('chCount');
    const epCountSpan = document.getElementById('epCount');
    if (chCountSpan) chCountSpan.textContent = totalCourses;
    if (epCountSpan) epCountSpan.textContent = totalEpisodes;
    
    // Initialize background music
    initBgMusic();
    
    console.log("App initialized successfully with all features!");
});
