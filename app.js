/* ============================================================
   DualPlay — App Script
   ============================================================ */

/* ---------- State ---------- */
const state = {
  videoA: null,    // HTMLVideoElement
  videoB: null,
  loadedA: false,
  loadedB: false,
  playing: false,
  audioMode: 'A', // 'A' | 'B' | 'both'
};

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  state.videoA = document.getElementById('videoA');
  state.videoB = document.getElementById('videoB');

  bindVideoEvents('A');
  bindVideoEvents('B');

  setAudio('A', false); // default: A priority
  updateControlPanel();
});

/* ============================================================
   UPLOAD / FILE HANDLING
   ============================================================ */
function triggerUpload(side) {
  document.getElementById(`fileInput${side}`).click();
}

function handleFileSelect(event, side) {
  const file = event.target.files[0];
  if (file) loadVideo(side, file);
  // reset input so same file can be selected again
  event.target.value = '';
}

function onDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function onDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function onDrop(event, side) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith('video/')) {
    loadVideo(side, file);
  } else {
    showToast('動画ファイルをドロップしてください');
  }
}

function loadVideo(side, file) {
  const video   = side === 'A' ? state.videoA : state.videoB;
  const wrapper = document.getElementById(`videoWrapper${side}`);
  const zone    = document.getElementById(`uploadZone${side}`);

  // Revoke previous object URL
  if (video.src) URL.revokeObjectURL(video.src);

  const url = URL.createObjectURL(file);
  video.src = url;
  video.load();

  // Show wrapper
  wrapper.style.display = 'flex';
  zone.style.display    = 'none';

  if (side === 'A') state.loadedA = true;
  else              state.loadedB = true;

  updateControlPanel();
  applyAudioMode();
  showToast(`動画 ${side} を読み込みました`);
}

function resetSlot(side) {
  const video   = side === 'A' ? state.videoA : state.videoB;
  const wrapper = document.getElementById(`videoWrapper${side}`);
  const zone    = document.getElementById(`uploadZone${side}`);

  video.pause();
  if (video.src) URL.revokeObjectURL(video.src);
  video.removeAttribute('src');
  video.load();

  wrapper.style.display = 'none';
  zone.style.display    = 'flex';

  if (side === 'A') state.loadedA = false;
  else              state.loadedB = false;

  if (state.playing) {
    state.playing = false;
    updateMasterPlayBtn();
  }

  resetSeek(side);
  updateControlPanel();
  showToast(`動画 ${side} を削除しました`);
}

/* ============================================================
   VIDEO EVENTS
   ============================================================ */
function bindVideoEvents(side) {
  const video   = side === 'A' ? state.videoA : state.videoB;
  const overlay = document.getElementById(`overlay${side}`);
  const playBtn = document.getElementById(`playBtn${side}`);

  video.addEventListener('timeupdate', () => updateSeekUI(side));
  video.addEventListener('ended', () => {
    if (getOtherVideo(side).ended || !isLoaded(getOtherSide(side))) {
      state.playing = false;
      updateMasterPlayBtn();
    }
  });

  // Click on overlay toggles play
  overlay.addEventListener('click', masterPlayPause);
}

function getOtherSide(side) { return side === 'A' ? 'B' : 'A'; }
function getOtherVideo(side) { return side === 'A' ? state.videoB : state.videoA; }
function isLoaded(side) { return side === 'A' ? state.loadedA : state.loadedB; }

/* ============================================================
   MASTER PLAY / PAUSE
   ============================================================ */
function masterPlayPause() {
  if (!state.loadedA && !state.loadedB) {
    showToast('動画をアップロードしてください');
    return;
  }

  if (state.playing) {
    pauseBoth();
  } else {
    playBoth();
  }
}

function playBoth() {
  const promises = [];
  if (state.loadedA) promises.push(state.videoA.play().catch(() => {}));
  if (state.loadedB) promises.push(state.videoB.play().catch(() => {}));
  Promise.all(promises).then(() => {
    state.playing = true;
    updateMasterPlayBtn();
    updateOverlayIcons();
  });
}

function pauseBoth() {
  if (state.loadedA) state.videoA.pause();
  if (state.loadedB) state.videoB.pause();
  state.playing = false;
  updateMasterPlayBtn();
  updateOverlayIcons();
}

function togglePlay(side) {
  // Individual toggle from overlay — just mirrors master
  masterPlayPause();
}

function updateMasterPlayBtn() {
  const icon = document.getElementById('masterPlayIcon');
  const btn  = document.getElementById('masterPlayBtn');
  if (state.playing) {
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    btn.classList.add('playing');
  } else {
    icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    btn.classList.remove('playing');
  }
}

function updateOverlayIcons() {
  ['A','B'].forEach(side => {
    const btn = document.getElementById(`playBtn${side}`);
    if (!btn) return;
    if (state.playing) {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      btn.classList.add('overlay-btn--pause');
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
      btn.classList.remove('overlay-btn--pause');
    }
  });
}

/* ============================================================
   REWIND / SYNC
   ============================================================ */
function rewindBoth() {
  if (state.loadedA) { state.videoA.currentTime = 0; }
  if (state.loadedB) { state.videoB.currentTime = 0; }
  if (state.playing) {
    pauseBoth();
  }
  updateSeekUI('A');
  updateSeekUI('B');
  showToast('最初に戻しました');
}

function syncVideos() {
  if (!state.loadedA || !state.loadedB) return;
  const t = Math.min(state.videoA.currentTime, state.videoB.currentTime);
  state.videoA.currentTime = t;
  state.videoB.currentTime = t;
  showToast('再生位置を同期しました');
}

/* ============================================================
   SEEK
   ============================================================ */
function onSeek(event, side) {
  const video = side === 'A' ? state.videoA : state.videoB;
  if (!isLoaded(side) || !video.duration) return;
  const pct = parseFloat(event.target.value);
  video.currentTime = (pct / 100) * video.duration;
  updateSeekUI(side);
}

function updateSeekUI(side) {
  const video  = side === 'A' ? state.videoA : state.videoB;
  const fill   = document.getElementById(`seekFill${side}`);
  const input  = document.getElementById(`seek${side}`);
  const timeEl = document.getElementById(`time${side}`);

  if (!video.duration) return;
  const pct = (video.currentTime / video.duration) * 100;
  fill.style.width  = pct + '%';
  input.value       = pct;
  timeEl.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
}

function resetSeek(side) {
  const fill   = document.getElementById(`seekFill${side}`);
  const input  = document.getElementById(`seek${side}`);
  const timeEl = document.getElementById(`time${side}`);
  fill.style.width   = '0%';
  input.value        = '0';
  timeEl.textContent = '0:00';
}

/* ============================================================
   VOLUME
   ============================================================ */
function onVolume(event, side) {
  const video  = side === 'A' ? state.videoA : state.videoB;
  const val    = parseFloat(event.target.value);
  video.volume = val;
  updateVolUI(side, val);
}

function updateVolUI(side, val) {
  const fill  = document.getElementById(`volFill${side}`);
  const label = document.getElementById(`volLabel${side}`);
  fill.style.width     = (val * 100) + '%';
  label.textContent    = Math.round(val * 100) + '%';
}

function setVolumeSlider(side, val) {
  const input = document.getElementById(`vol${side}`);
  const video = side === 'A' ? state.videoA : state.videoB;
  input.value  = val;
  video.volume = val;
  updateVolUI(side, val);
}

/* ============================================================
   AUDIO MODE
   ============================================================ */
function setAudio(mode, notify = true) {
  state.audioMode = mode;

  // Update tab UI
  document.querySelectorAll('.audio-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.audio === mode);
  });

  applyAudioMode();

  if (notify) {
    const msgs = {
      A:    '動画 A の音声を優先します',
      B:    '動画 B の音声を優先します',
      both: '両方の音声を同時再生します',
    };
    showToast(msgs[mode]);
  }
}

function applyAudioMode() {
  switch (state.audioMode) {
    case 'A':
      setVolumeSlider('A', 1.0);
      setVolumeSlider('B', 0.0);
      break;
    case 'B':
      setVolumeSlider('A', 0.0);
      setVolumeSlider('B', 1.0);
      break;
    case 'both':
      setVolumeSlider('A', 0.8);
      setVolumeSlider('B', 0.8);
      break;
  }
}

/* ============================================================
   CONTROL PANEL — enable/disable
   ============================================================ */
function updateControlPanel() {
  const panel = document.getElementById('controlPanel');
  const ready = state.loadedA || state.loadedB;
  panel.classList.toggle('disabled', !ready);
}

/* ============================================================
   UTILITIES
   ============================================================ */
function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
