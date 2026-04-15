// ============================================
// SOLUTION: FIXED app.js for GitHub Pages
// ============================================

let chapters = [];
let currentChapter = null;
let currentSongIndex = -1;
let audio = new Audio(); // Create audio element once
let isPlaying = false;
let playlist = [];
let playlistIndex = -1;
let bgMusic = null;
let bgMusicEnabled = true;

// --- Helper Functions ---
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function showSongsView(chapter) {
    if (!chapter) return;
    currentChapter = chapter;
    const songsView = document.getElementById('songs-view');
    const chaptersSection = document.getElementById('chapters');
    const songsGrid = document.getElementById('songs-grid');
    const songsChapterTitle = document.getElementById('songs-chapter-title');
    
    if (songsView) songsView.style.display = 'block';
    if (chaptersSection) chaptersSection.style.display = 'none';
    if (songsChapterTitle) songsChapterTitle.textContent = `${chapter.icon || '📚'} ${chapter.name}`;
    
    if (songsGrid) {
        if (!chapter.songs || chapter.songs.length === 0) {
            songsGrid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">No episodes in this course yet.</p>';
            return;
        }
        songsGrid.innerHTML = chapter.songs.map((song, idx) => `
            <div class="song-card" data-song-index="${idx}">
                <div class="song-art">
                    <img src="${song.image || 'https://via.placeholder.com/80?text=No+Image'}" alt="${escapeHtml(song.title)}" onerror="this.src='https://via.placeholder.com/80?text=Audio'">
                </div>
                <div class="song-info">
                    <h4>${escapeHtml(song.title)}</h4>
                    <p>${chapter.name}</p>
                </div>
                <div class="song-actions">
                    <button class="play-song-btn" data-song-index="${idx}" data-chapter-id="${chapter.id}">▶ Play</button>
                    <button class="add-to-playlist-btn" data-song-index="${idx}" data-chapter-id="${chapter.id}">+ Playlist</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to new buttons
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
                    showToast(`Added "${ch.songs[idx].title}" to playlist`, 'success');
                }
            });
        });
    }
}

function playSong(chapter, songIndex) {
    if (!chapter || !chapter.songs || !chapter.songs[songIndex]) return;
    const song = chapter.songs[songIndex];
    if (!song.audio) {
        showToast('Error: No audio URL found for this episode.', 'error');
        return;
    }
    
    currentChapter = chapter;
    currentSongIndex = songIndex;
    
    audio.src = song.audio;
    audio.load();
    audio.play().catch(e => console.error("Playback failed:", e));
    isPlaying = true;
    
    updateNowPlayingBar(song, chapter.name);
    document.getElementById('np-play-pause').textContent = '⏸';
}

function updateNowPlayingBar(song, chapterName) {
    const npTitle = document.getElementById('npTitle');
    const npSub = document.getElementById('npSub');
    if (npTitle) npTitle.textContent = song.title || 'Unknown Title';
    if (npSub) npSub.textContent = chapterName || 'Unknown Course';
    
    // Reset progress
    const npProgress = document.getElementById('np-progress');
    if (npProgress) npProgress.style.width = '0%';
    const npCurrentTime = document.getElementById('np-current-time');
    if (npCurrentTime) npCurrentTime.textContent = '0:00';
}

function togglePlayPause() {
    if (!audio.src) {
        // If nothing is playing, try to play first song from first chapter
        if (chapters.length > 0 && chapters[0].songs && chapters[0].songs.length > 0) {
            playSong(chapters[0], 0);
        } else {
            showToast('No episodes available to play.', 'error');
        }
        return;
    }
    if (isPlaying) {
        audio.pause();
        document.getElementById('np-play-pause').textContent = '▶';
    } else {
        audio.play().catch(e => console.error("Playback failed:", e));
        document.getElementById('np-play-pause').textContent = '⏸';
    }
    isPlaying = !isPlaying;
}

function nextTrack() {
    if (!currentChapter || !currentChapter.songs || currentChapter.songs.length === 0) return;
    let nextIndex = currentSongIndex + 1;
    if (nextIndex >= currentChapter.songs.length) nextIndex = 0;
    playSong(currentChapter, nextIndex);
}

function prevTrack() {
    if (!currentChapter || !currentChapter.songs || currentChapter.songs.length === 0) return;
    let prevIndex = currentSongIndex - 1;
    if (prevIndex < 0) prevIndex = currentChapter.songs.length - 1;
    playSong(currentChapter, prevIndex);
}

function addToPlaylist(song, chapterName, chapterId) {
    let currentPlaylist = JSON.parse(localStorage.getItem('elfeki_playlist') || '[]');
    const exists = currentPlaylist.some(item => item.audio === song.audio);
    if (!exists) {
        currentPlaylist.push({
            id: Date.now(),
            title: song.title,
            audio: song.audio,
            image: song.image || '',
            chapterName: chapterName,
            chapterId: chapterId
        });
        localStorage.setItem('elfeki_playlist', JSON.stringify(currentPlaylist));
        showToast(`Added "${song.title}" to playlist`, 'success');
    } else {
        showToast(`"${song.title}" is already in your playlist`, 'info');
    }
}

function showPlaylist() {
    const playlistSongs = JSON.parse(localStorage.getItem('elfeki_playlist') || '[]');
    if (playlistSongs.length === 0) {
        showToast('Your playlist is empty.', 'info');
        return;
    }
    // Simple playlist display using alert for now (can be enhanced)
    let message = "Your Playlist:\n";
    playlistSongs.forEach((song, idx) => {
        message += `${idx+1}. ${song.title} - ${song.chapterName}\n`;
    });
    message += "\nTo play, click on a song from the courses view and add to playlist. Playlist queue feature coming soon!";
    alert(message);
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

function initTheme() {
    const savedTheme = localStorage.getItem('elfeki_theme');
    const dark = savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.textContent = dark ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('elfeki_theme', newTheme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

// --- Back button handler ---
function goBackToCourses() {
    const songsView = document.getElementById('songs-view');
    const chaptersSection = document.getElementById('chapters');
    if (songsView) songsView.style.display = 'none';
    if (chaptersSection) chaptersSection.style.display = 'block';
    currentChapter = null;
    currentSongIndex = -1;
}

// --- Audio event listeners for progress and time ---
function setupAudioListeners() {
    audio.addEventListener('timeupdate', () => {
        if (audio.duration && !isNaN(audio.duration)) {
            const percent = (audio.currentTime / audio.duration) * 100;
            const progressBar = document.getElementById('np-progress');
            if (progressBar) progressBar.style.width = `${percent}%`;
            
            const currentTimeElem = document.getElementById('np-current-time');
            if (currentTimeElem) {
                const mins = Math.floor(audio.currentTime / 60);
                const secs = Math.floor(audio.currentTime % 60);
                currentTimeElem.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
            
            const durationElem = document.getElementById('np-duration');
            if (durationElem && audio.duration && !isNaN(audio.duration)) {
                const mins = Math.floor(audio.duration / 60);
                const secs = Math.floor(audio.duration % 60);
                durationElem.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
        }
    });
    
    audio.addEventListener('ended', () => {
        nextTrack();
    });
    
    // Progress bar click seeking
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
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App initializing...");
    
    // Setup basic UI listeners first
    const backBtn = document.getElementById('songs-back-btn');
    if (backBtn) backBtn.addEventListener('click', goBackToCourses);
    
    const playPauseBtn = document.getElementById('np-play-pause');
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    
    const nextBtn = document.getElementById('np-next');
    if (nextBtn) nextBtn.addEventListener('click', nextTrack);
    
    const prevBtn = document.getElementById('np-prev');
    if (prevBtn) prevBtn.addEventListener('click', prevTrack);
    
    const playlistBtn = document.getElementById('np-playlist-btn');
    if (playlistBtn) playlistBtn.addEventListener('click', showPlaylist);
    
    const bgMusicBtn = document.getElementById('np-bg-music-btn');
    if (bgMusicBtn) bgMusicBtn.addEventListener('click', toggleBgMusic);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    
    // Setup audio listeners
    setupAudioListeners();
    
    // Initialize theme
    initTheme();
    
    // --- CRITICAL FIX: Load data from localStorage FIRST (admin saves here) ---
    let loaded = false;
    try {
        const localRaw = localStorage.getItem('elfeki_chapters');
        if (localRaw) {
            const localData = JSON.parse(localRaw);
            if (localData.chapters && localData.chapters.length > 0) {
                chapters = localData.chapters;
                loaded = true;
                console.log("Data loaded from localStorage (admin uploads will appear)");
            }
        }
    } catch (e) {
        console.warn("Error reading localStorage", e);
    }
    
    // Fallback to data.json if localStorage is empty
    if (!loaded) {
        try {
            const resp = await fetch('data.json?t=' + Date.now());
            if (resp.ok) {
                const serverData = await resp.json();
                if (serverData.chapters && serverData.chapters.length > 0) {
                    chapters = serverData.chapters;
                    loaded = true;
                    console.log("Data loaded from data.json fallback");
                    // Save to localStorage for future
                    localStorage.setItem('elfeki_chapters', JSON.stringify({ chapters: chapters, nextId: { chapter: 7, song: 31 }, admin: {} }));
                }
            }
        } catch (e) {
            console.warn("Could not load data.json", e);
        }
    }
    
    // Final fallback: use PersistDB if available
    if (!loaded && window.PersistDB) {
        try {
            await PersistDB.init();
            chapters = PersistDB.getChapters() || [];
            loaded = chapters.length > 0;
            console.log("Data loaded from PersistDB");
        } catch(e) { console.warn(e); }
    }
    
    if (!loaded || chapters.length === 0) {
        // Create default data if absolutely nothing exists
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
    
    // Render the UI
    renderChapters();
    
    // Initialize background music
    initBgMusic();
    
    // Update counts
    const totalCourses = chapters.length;
    const totalEpisodes = chapters.reduce((sum, ch) => sum + (ch.songs ? ch.songs.length : 0), 0);
    const chCountSpan = document.getElementById('chCount');
    const epCountSpan = document.getElementById('epCount');
    if (chCountSpan) chCountSpan.textContent = totalCourses;
    if (epCountSpan) epCountSpan.textContent = totalEpisodes;
    
    // Show stars animation
    if (document.getElementById('starsContainer')) {
        // stars already rendered by inline script in index.html
    }
    
    console.log("App initialized successfully");
});
