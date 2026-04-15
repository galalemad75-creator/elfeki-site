/* ═══════════════════════════════════════════════════════
   Dr. El-Feki Podcast — Spotify-Style App
   ═══════════════════════════════════════════════════════ */

let CHAPTERS = [];
let liked = JSON.parse(localStorage.getItem('ef_liked') || '[]');
let playlists = JSON.parse(localStorage.getItem('ef_playlists') || '[]');
let recentlyPlayed = JSON.parse(localStorage.getItem('ef_recent') || '[]');
let currentChapterId = null;
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;
let currentPlaylistId = null;

const COURSE_COLORS = ['#1DB954','#e91e63','#ff9800','#9c27b0','#ffc107','#03a9f4','#4caf50','#f44336'];

function parseDuration(s){if(!s)return 0;const p=s.split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:(p[0]||0)*60+(p[1]||0);}
function formatTime(sec){if(!sec||isNaN(sec))return'0:00';const m=Math.floor(sec/60),s=Math.floor(sec%60);return m+':'+String(s).padStart(2,'0');}
function toast(msg){const c=document.getElementById('toast-container');const t=document.createElement('div');t.className='toast';t.textContent=msg;c.appendChild(t);setTimeout(()=>{t.classList.add('removing');setTimeout(()=>t.remove(),300);},2500);}
function getGreeting(){const h=new Date().getHours();if(h<12)return'Good morning';if(h<18)return'Good afternoon';return'Good evening';}

// ── Views ──
function showView(viewId){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const view=document.getElementById('view-'+viewId);
  if(view)view.classList.add('active');
  const nav=document.querySelector(`[data-view="${viewId}"]`);
  if(nav)nav.classList.add('active');
  document.getElementById('search-box').style.display=viewId==='search'?'flex':'none';
  if(viewId==='library')renderLibrary();
  if(viewId==='search')renderBrowse();
  if(viewId==='liked')renderLiked();
}

// ── Render Home ──
function renderHome(){
  document.getElementById('greeting-text').textContent=getGreeting();
  const qc=document.getElementById('quick-cards');
  qc.innerHTML=CHAPTERS.slice(0,6).map((c,i)=>`
    <div class="quick-card" onclick="showCourse(${c.id})">
      <div class="quick-card-img">${c.icon||'📚'}</div>
      <span class="quick-card-name">${c.name}</span>
      <button class="quick-card-play" onclick="event.stopPropagation();playCourse(${c.id},0)">▶</button>
    </div>`).join('');

  renderCardGrid('courses-grid',CHAPTERS.filter(c=>c.songs&&c.songs.length>0).map((c,i)=>({
    id:c.id,icon:c.icon||'📚',title:c.name,subtitle:`${c.songs.length} episodes`,
    color:COURSE_COLORS[i%COURSE_COLORS.length],
    onclick:`showCourse(${c.id})`,playBtn:`event.stopPropagation();playCourse(${c.id},0)`
  })));

  // Popular
  const allEp=[];
  CHAPTERS.forEach((c,ci)=>c.songs&&c.songs.forEach((s,si)=>allEp.push({...s,chapter:c,chapterId:c.id,songIndex:si,color:COURSE_COLORS[ci%COURSE_COLORS.length]})));
  renderCardGrid('popular-grid',allEp.slice(0,6).map(e=>({
    id:e.id,icon:e.chapter.icon||'📚',title:e.title,subtitle:e.chapter.name,
    color:e.color,onclick:`playCourse(${e.chapterId},${e.songIndex})`,playBtn:`event.stopPropagation();playCourse(${e.chapterId},${e.songIndex})`
  })));

  // Recent
  const rg=document.getElementById('recent-grid');
  if(recentlyPlayed.length>0){
    renderCardGrid('recent-grid',recentlyPlayed.slice(0,6).map(r=>{
      const ch=CHAPTERS.find(c=>c.id==r.chapterId);if(!ch||!ch.songs[r.songIndex])return null;
      const ci=CHAPTERS.indexOf(ch);
      return{id:ch.songs[r.songIndex].id,icon:ch.icon||'📚',title:ch.songs[r.songIndex].title,subtitle:ch.name,color:COURSE_COLORS[ci%COURSE_COLORS.length],
        onclick:`playCourse(${ch.id},${r.songIndex})`,playBtn:`event.stopPropagation();playCourse(${ch.id},${r.songIndex})`
      };
    }).filter(Boolean));
  }else{rg.innerHTML='<p style="color:var(--text-subdued);font-size:0.9rem;">Start listening to see your recent plays here.</p>';}
}

function renderCardGrid(containerId,items){
  const container=document.getElementById(containerId);if(!container)return;
  container.innerHTML=items.map(item=>`
    <div class="card" onclick="${item.onclick}">
      <div class="card-img" style="background:linear-gradient(135deg,${item.color}22,${item.color}44);">${item.icon}
        <button class="card-play" onclick="${item.playBtn}">▶</button>
      </div>
      <div class="card-title">${item.title}</div>
      <div class="card-subtitle">${item.subtitle}</div>
    </div>`).join('');
}

// ── Course Detail ──
function showCourse(chapterId){
  const ch=CHAPTERS.find(c=>c.id==chapterId);if(!ch)return;
  currentChapterId=chapterId;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-course').classList.add('active');
  const ci=CHAPTERS.indexOf(ch);
  document.getElementById('course-hero').innerHTML=`
    <div class="course-hero-img" style="background:linear-gradient(135deg,${COURSE_COLORS[ci%COURSE_COLORS.length]}33,${COURSE_COLORS[ci%COURSE_COLORS.length]}66);">${ch.icon||'📚'}</div>
    <div class="course-hero-info"><div class="course-hero-type">Course</div>
    <h1 class="course-hero-title">${ch.name}</h1>
    <div class="course-hero-meta"><strong>Dr. Ibrahim El-Feki</strong> · ${(ch.songs||[]).length} episodes</div></div>`;
  renderTrackList('course-track-list',ch.songs||[],chapterId);
}

function renderTrackList(containerId,songs,chapterId){
  const container=document.getElementById(containerId);if(!container)return;
  container.innerHTML=`
    <div class="track-row" style="opacity:0.5;pointer-events:none;">
      <div class="track-num" style="font-size:0.75rem;font-weight:700;color:var(--text-subdued);">#</div>
      <div style="font-size:0.75rem;font-weight:700;color:var(--text-subdued);text-transform:uppercase;">Title</div>
      <div class="track-duration" style="font-size:0.75rem;font-weight:700;color:var(--text-subdued);">Date</div>
      <div></div>
    </div>
    ${songs.map((s,i)=>{
      const isLiked=liked.includes(String(s.id));
      const isCurrent=currentChapterId==chapterId&&currentSongIndex===i;
      return`<div class="track-row ${isCurrent?'playing':''}" data-ep-id="${s.id}" onclick="playCourse(${chapterId},${i})">
        <div class="track-num"><span class="num-text">${isCurrent&&isPlaying?'🔊':i+1}</span><span class="play-icon">▶</span></div>
        <div class="track-info"><div class="track-title">${s.title}</div><div class="track-subtitle">Dr. El-Feki</div></div>
        <div class="track-duration">${s.created||''}</div>
        <div class="track-actions">
          <button class="track-action-btn ${isLiked?'liked':''}" onclick="event.stopPropagation();toggleLike('${s.id}')" title="Like">${isLiked?'♥':'♡'}</button>
          <button class="track-action-btn" onclick="event.stopPropagation();addToQueuePrompt(${chapterId},${i})" title="Add to playlist">+</button>
        </div></div>`;
    }).join('')}`;
}

// ── Play ──
function playCourse(chapterId,songIndex){
  const ch=CHAPTERS.find(c=>c.id==chapterId);if(!ch||!ch.songs[songIndex])return;
  currentChapterId=chapterId;currentSongIndex=songIndex;
  const ep=ch.songs[songIndex];
  recentlyPlayed=recentlyPlayed.filter(r=>!(r.chapterId==chapterId&&r.songIndex===songIndex));
  recentlyPlayed.unshift({chapterId,songIndex});if(recentlyPlayed.length>20)recentlyPlayed=recentlyPlayed.slice(0,20);
  localStorage.setItem('ef_recent',JSON.stringify(recentlyPlayed));
  document.getElementById('player-title').textContent=ep.title;
  document.getElementById('player-artist').textContent='Dr. Ibrahim El-Feki · '+ch.name;
  document.getElementById('player-thumb').textContent=ch.icon||'📚';
  updatePlayerHeart(String(ep.id));
  isPlaying=true;document.getElementById('play-pause-btn').textContent='⏸';
  document.querySelectorAll('.track-row').forEach(r=>r.classList.remove('playing'));
  document.querySelectorAll(`[data-ep-id="${ep.id}"]`).forEach(r=>r.classList.add('playing'));
  simulatePlayback(2700); // simulate ~45 min
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
}
function playCourseFromStart(){if(currentChapterId!=null)playCourse(currentChapterId,0);}
function playNext(){
  if(currentChapterId==null)return;const ch=CHAPTERS.find(c=>c.id==currentChapterId);if(!ch)return;
  if(repeatMode===2){playCourse(currentChapterId,currentSongIndex);return;}
  if(isShuffle){playCourse(currentChapterId,Math.floor(Math.random()*ch.songs.length));return;}
  let next=currentSongIndex+1;
  if(next>=ch.songs.length){if(repeatMode===1)next=0;else{isPlaying=false;document.getElementById('play-pause-btn').textContent='▶';return;}}
  playCourse(currentChapterId,next);
}
function playPrev(){
  if(currentChapterId==null)return;if(simTime>3){simTime=0;return;}
  const ch=CHAPTERS.find(c=>c.id==currentChapterId);if(!ch)return;
  let prev=currentSongIndex-1;if(prev<0)prev=ch.songs.length-1;
  playCourse(currentChapterId,prev);
}
function togglePlayPause(){isPlaying=!isPlaying;document.getElementById('play-pause-btn').textContent=isPlaying?'⏸':'▶';}
function toggleShuffle(){isShuffle=!isShuffle;document.getElementById('shuffle-btn').classList.toggle('active',isShuffle);toast(isShuffle?'Shuffle on':'Shuffle off');}
function toggleRepeat(){repeatMode=(repeatMode+1)%3;const b=document.getElementById('repeat-btn');b.classList.toggle('active',repeatMode>0);b.textContent=repeatMode===2?'🔂':'🔁';toast(['Repeat off','Repeat all','Repeat one'][repeatMode]);}
function shuffleCourse(){isShuffle=true;document.getElementById('shuffle-btn').classList.add('active');playCourseFromStart();toast('Shuffle on');}

let simTime=0,simTotal=0,simInterval=null;
function simulatePlayback(totalSec){clearInterval(simInterval);simTime=0;simTotal=totalSec;updateProgressUI();simInterval=setInterval(()=>{if(!isPlaying)return;simTime++;updateProgressUI();if(simTime>=simTotal){clearInterval(simInterval);playNext();}},1000);}
function updateProgressUI(){document.getElementById('time-current').textContent=formatTime(simTime);document.getElementById('time-total').textContent=formatTime(simTotal);const pct=simTotal>0?(simTime/simTotal*100):0;document.getElementById('progress-fill').style.width=pct+'%';}
function seekTo(e){const bar=document.getElementById('progress-bar');const rect=bar.getBoundingClientRect();simTime=Math.floor(Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*simTotal);updateProgressUI();}
function setVolume(val){document.getElementById('vol-icon').textContent=val==0?'🔇':val<50?'🔉':'🔊';}
function toggleMute(){const s=document.getElementById('volume-slider');if(s.value>0){s.dataset.prev=s.value;s.value=0;}else{s.value=s.dataset.prev||70;}setVolume(s.value);}

// ── Likes ──
function toggleLike(epId){
  const idx=liked.indexOf(epId);if(idx>=0){liked.splice(idx,1);toast('Removed from Liked');}
  else{liked.push(epId);toast('Added to Liked ♥');}
  localStorage.setItem('ef_liked',JSON.stringify(liked));refreshCurrentView();updatePlayerHeart(epId);
}
function updatePlayerHeart(epId){const b=document.getElementById('player-heart-btn');if(liked.includes(epId)){b.textContent='♥';b.classList.add('liked');}else{b.textContent='♡';b.classList.remove('liked');}}
function toggleCurrentLike(){if(currentChapterId==null)return;const ch=CHAPTERS.find(c=>c.id==currentChapterId);if(!ch)return;const ep=ch.songs[currentSongIndex];if(ep)toggleLike(String(ep.id));}

function renderLiked(){
  const allEp=[];
  CHAPTERS.forEach((c,ci)=>c.songs&&c.songs.forEach((s,si)=>{if(liked.includes(String(s.id)))allEp.push({...s,chapter:c,chapterId:c.id,songIndex:si,color:COURSE_COLORS[ci%COURSE_COLORS.length]});}));
  document.getElementById('liked-count').textContent=allEp.length+' episode'+(allEp.length!==1?'s':'');
  const container=document.getElementById('liked-track-list');
  if(allEp.length===0){container.innerHTML='<p style="color:var(--text-subdued);text-align:center;padding:3rem;">No liked episodes yet. Tap ♡ on any episode to save it here.</p>';return;}
  container.innerHTML=allEp.map((ep,i)=>`<div class="track-row" onclick="playCourse(${ep.chapterId},${ep.songIndex})">
    <div class="track-num"><span class="num-text">${i+1}</span><span class="play-icon">▶</span></div>
    <div class="track-info"><div class="track-title">${ep.title}</div><div class="track-subtitle">${ep.chapter.name}</div></div>
    <div class="track-duration">${ep.created||''}</div>
    <div class="track-actions"><button class="track-action-btn liked" onclick="event.stopPropagation();toggleLike('${ep.id}')">♥</button></div></div>`).join('');
}
function playLiked(){
  const allEp=[];CHAPTERS.forEach(c=>c.songs&&c.songs.forEach((s,si)=>{if(liked.includes(String(s.id)))allEp.push({chapterId:c.id,songIndex:si});}));
  if(allEp.length>0)playCourse(allEp[0].chapterId,allEp[0].songIndex);
}

// ── Library ──
function renderLibrary(){
  renderCardGrid('library-grid',CHAPTERS.filter(c=>c.songs&&c.songs.length>0).map((c,i)=>({
    id:c.id,icon:c.icon||'📚',title:c.name,subtitle:`${c.songs.length} episodes · Dr. El-Feki`,color:COURSE_COLORS[i%COURSE_COLORS.length],
    onclick:`showCourse(${c.id})`,playBtn:`event.stopPropagation();playCourse(${c.id},0)`
  })));
}
function filterLibrary(type,btn){
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));btn.classList.add('active');
  if(type==='all'||type==='courses'){renderLibrary();return;}
  if(type==='liked'){
    const allEp=[];CHAPTERS.forEach((c,ci)=>c.songs&&c.songs.forEach((s,si)=>{if(liked.includes(String(s.id)))allEp.push({id:s.id,icon:c.icon||'📚',title:s.title,subtitle:c.name,color:COURSE_COLORS[ci%COURSE_COLORS.length],onclick:`playCourse(${c.id},${si})`,playBtn:`event.stopPropagation();playCourse(${c.id},${si})`});}));
    renderCardGrid('library-grid',allEp);
  }
}

// ── Search ──
function renderBrowse(){
  const categories=[
    {name:'Positive Thinking',color:'#1DB954',emoji:'☀️'},{name:'Time',color:'#e91e63',emoji:'⏳'},
    {name:'Self-Improvement',color:'#ff9800',emoji:'🚀'},{name:'Goals',color:'#9c27b0',emoji:'🎯'},
    {name:'Communication',color:'#03a9f4',emoji:'💬'},{name:'Motivation',color:'#f44336',emoji:'💪'},
    {name:'Mindfulness',color:'#4caf50',emoji:'🧘'},{name:'Leadership',color:'#ffc107',emoji:'👑'},
    {name:'Creativity',color:'#673ab7',emoji:'🎨'},{name:'Health',color:'#00bcd4',emoji:'❤️‍🩹'},
    {name:'Finance',color:'#607d8b',emoji:'💰'},{name:'Education',color:'#795548',emoji:'📚'}
  ];
  document.getElementById('browse-cards').innerHTML=categories.map(c=>`<div class="browse-card" style="background:${c.color};" onclick="searchCategory('${c.name}')">${c.name}<span class="cat-emoji">${c.emoji}</span></div>`).join('');
}
function handleSearch(query){
  const rs=document.getElementById('search-results'),bd=document.getElementById('browse-cards');
  if(!query.trim()){rs.style.display='none';bd.style.display='';return;}
  bd.style.display='none';rs.style.display='';
  const q=query.toLowerCase();const results=[];
  CHAPTERS.forEach(c=>{
    if(c.name.toLowerCase().includes(q))results.push({type:'chapter',chapter:c});
    (c.songs||[]).forEach((s,i)=>{if(s.title.toLowerCase().includes(q)||c.name.toLowerCase().includes(q))results.push({type:'song',song:s,chapter:c,songIndex:i});});
  });
  const list=document.getElementById('search-track-list');
  if(results.length===0){list.innerHTML='<p style="color:var(--text-subdued);text-align:center;padding:2rem;">No results for "'+query+'"</p>';return;}
  list.innerHTML=results.map((r,i)=>{
    if(r.type==='chapter')return`<div class="track-row" onclick="showCourse(${r.chapter.id})"><div class="track-num">${r.chapter.icon||'📚'}</div><div class="track-info"><div class="track-title">${r.chapter.name}</div><div class="track-subtitle">Course · ${(r.chapter.songs||[]).length} episodes</div></div><div></div><div></div></div>`;
    return`<div class="track-row" onclick="playCourse(${r.chapter.id},${r.songIndex})"><div class="track-num"><span class="num-text">${i+1}</span><span class="play-icon">▶</span></div><div class="track-info"><div class="track-title">${r.song.title}</div><div class="track-subtitle">${r.chapter.name}</div></div><div class="track-duration">${r.song.created||''}</div><div></div></div>`;
  }).join('');
}
function searchCategory(name){document.getElementById('search-input').value=name;handleSearch(name);}

// ── Playlists ──
function showCreatePlaylist(){document.getElementById('modal-overlay').classList.add('open');document.getElementById('new-pl-name').focus();}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}
function createPlaylist(){
  const name=document.getElementById('new-pl-name').value.trim();if(!name){toast('Enter a name');return;}
  playlists.push({id:'pl_'+Date.now(),name,episodes:[]});localStorage.setItem('ef_playlists',JSON.stringify(playlists));
  document.getElementById('new-pl-name').value='';closeModal();renderSidebarPlaylists();toast('Playlist created');
}
function renderSidebarPlaylists(){
  document.getElementById('playlist-list').innerHTML=playlists.map(pl=>`<a class="sidebar-playlist-item" href="#" onclick="showPlaylist('${pl.id}');return false;">${pl.name}</a>`).join('');
}
function showPlaylist(plId){
  const pl=playlists.find(p=>p.id===plId);if(!pl)return;currentPlaylistId=plId;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-playlist').classList.add('active');document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('pl-title').textContent=pl.name;
  document.getElementById('pl-count').textContent=pl.episodes.length+' episode'+(pl.episodes.length!==1?'s':'');
  const container=document.getElementById('pl-track-list');
  if(pl.episodes.length===0){container.innerHTML='<p style="color:var(--text-subdued);text-align:center;padding:3rem;">This playlist is empty. Click + on any episode to add it.</p>';return;}
  container.innerHTML=pl.episodes.map((item,i)=>{
    const ch=CHAPTERS.find(c=>c.id==item.chapterId);if(!ch||!ch.songs[item.songIndex])return'';
    const ep=ch.songs[item.songIndex];
    return`<div class="track-row" onclick="playCourse(${ch.id},${item.songIndex})"><div class="track-num"><span class="num-text">${i+1}</span><span class="play-icon">▶</span></div><div class="track-info"><div class="track-title">${ep.title}</div><div class="track-subtitle">${ch.name}</div></div><div class="track-duration">${ep.created||''}</div><div class="track-actions"><button class="track-action-btn" onclick="event.stopPropagation();removeFromPlaylist(${i})" style="opacity:1;color:#e74c3c;">✕</button></div></div>`;
  }).join('');
}
function playPlaylistFromStart(){if(!currentPlaylistId)return;const pl=playlists.find(p=>p.id===currentPlaylistId);if(pl&&pl.episodes.length>0)playCourse(pl.episodes[0].chapterId,pl.episodes[0].songIndex);}
function deleteCurrentPlaylist(){if(!currentPlaylistId||!confirm('Delete this playlist?'))return;playlists=playlists.filter(p=>p.id!==currentPlaylistId);localStorage.setItem('ef_playlists',JSON.stringify(playlists));renderSidebarPlaylists();showView('home');toast('Playlist deleted');}
function removeFromPlaylist(index){if(!currentPlaylistId)return;const pl=playlists.find(p=>p.id===currentPlaylistId);if(!pl)return;pl.episodes.splice(index,1);localStorage.setItem('ef_playlists',JSON.stringify(playlists));showPlaylist(currentPlaylistId);toast('Removed from playlist');}
function addToQueuePrompt(chapterId,songIndex){
  if(playlists.length===0){showCreatePlaylist();toast('Create a playlist first');return;}
  const pl=playlists[playlists.length-1];const key=`${chapterId}_${songIndex}`;
  if(pl.episodes.find(e=>`${e.chapterId}_${e.songIndex}`===key)){toast('Already in '+pl.name);return;}
  pl.episodes.push({chapterId,songIndex});localStorage.setItem('ef_playlists',JSON.stringify(playlists));toast('Added to '+pl.name);
}

// ── Queue ──
function toggleQueue(){document.getElementById('queue-panel').classList.toggle('open');renderQueue();}
function renderQueue(){
  const list=document.getElementById('queue-list');
  if(currentChapterId==null){list.innerHTML='<p style="color:var(--text-subdued);text-align:center;padding:2rem;">No active queue</p>';return;}
  const ch=CHAPTERS.find(c=>c.id==currentChapterId);if(!ch)return;
  list.innerHTML='<h4 style="padding:0.5rem;color:var(--text-subdued);font-size:0.8rem;text-transform:uppercase;">Now Playing</h4>'+
    (ch.songs||[]).map((s,i)=>{const isCurrent=i===currentSongIndex;return`<div class="track-row ${isCurrent?'playing':''}" onclick="playCourse(${ch.id},${i})"><div class="track-num">${isCurrent?'🔊':i+1}</div><div class="track-info"><div class="track-title">${s.title}</div></div><div></div><div></div></div>`;}).join('');
}

// ── Events ──
document.getElementById('mobile-menu-btn')?.addEventListener('click',()=>{document.getElementById('sidebar').classList.toggle('open');});
document.querySelector('.main-content')?.addEventListener('click',()=>{document.getElementById('sidebar').classList.remove('open');});
document.querySelectorAll('.nav-item').forEach(item=>{item.addEventListener('click',(e)=>{e.preventDefault();const view=item.dataset.view;if(view)showView(view);});});

function refreshCurrentView(){
  const active=document.querySelector('.view.active');if(!active)return;
  if(active.id==='view-home')renderHome();if(active.id==='view-library')renderLibrary();if(active.id==='view-liked')renderLiked();
  if(active.id==='view-course'&&currentChapterId!=null){const ch=CHAPTERS.find(c=>c.id==currentChapterId);if(ch)renderTrackList('course-track-list',ch.songs||[],currentChapterId);}
}

// ── Init ──
(async function(){
  try{
    const resp=await fetch('data.json');const data=await resp.json();
    CHAPTERS=data.chapters||[];
    document.getElementById('greeting-text').textContent=getGreeting();
    renderHome();renderSidebarPlaylists();
  }catch(e){console.warn('Failed to load data.json',e);}
  document.addEventListener('keydown',(e)=>{if(e.target.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();togglePlayPause();}if(e.code==='ArrowRight'&&e.shiftKey)playNext();if(e.code==='ArrowLeft'&&e.shiftKey)playPrev();});
})();
