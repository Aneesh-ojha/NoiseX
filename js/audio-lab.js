/**
 * NoiseX — Audio Lab Controller
 * Fixes the pipeline crash: all DOM IDs (noise-category, noise-confidence, etc.) now exist in index.html.
 */
import { AudioClassifier }    from './audio-classifier.js';
import { DSPEngine }          from './dsp-engine.js';
import { SpectrogramRenderer } from './spectrogram.js';
import { WaveformRenderer }   from './waveform.js';

// Production Render API endpoints
const BACKEND_URL    = 'https://noisex-backend.onrender.com/api/process-audio';
const BACKEND_HEALTH = 'https://noisex-backend.onrender.com/health';

export class AudioLab {
  constructor() {
    this.audioContext   = null;
    this.classifier     = new AudioClassifier();
    this.dspEngine      = null;
    this.originalBuffer = null;
    this.enhancedBuffer = null;
    this.originalFile   = null;
    this._backendOnline = false;
    this._playingOriginal = null;
    this._playingEnhanced = null;

    // DOM refs will be (re)bound when the view is active
    this.uploadZone  = null;
    this.fileInput   = null;
    this.analyzeBtn  = null;
    this.downloadBtn = null;

    // Store handler references so we can remove/rebind safely
    this._handlers = {};

    this._checkBackend();
    this._bindDOM();
  }

  // Re-query important DOM nodes and (re)attach event listeners safely.
  _bindDOM() {
    this.uploadZone  = document.getElementById('upload-zone');
    this.fileInput   = document.getElementById('file-input');
    this.analyzeBtn  = document.getElementById('btn-analyze');
    this.downloadBtn = document.getElementById('btn-download');

    this._removeListeners();

    if (this.fileInput) {
      this._handlers.fileChange = e => { if (e.target.files[0]) this._handleFile(e.target.files[0]); };
      this.fileInput.addEventListener('change', this._handlers.fileChange);
    }

    if (this.uploadZone) {
      this._handlers.dragOver = e => { e.preventDefault(); this.uploadZone.style.borderColor = '#00F0FF'; };
      this._handlers.dragLeave = () => { if (this.uploadZone) this.uploadZone.style.borderColor = ''; };
      this._handlers.drop = e => { 
        e.preventDefault(); 
        if (this.uploadZone) this.uploadZone.style.borderColor = ''; 
        if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]); 
      };
      this.uploadZone.addEventListener('dragover', this._handlers.dragOver);
      this.uploadZone.addEventListener('dragleave', this._handlers.dragLeave);
      this.uploadZone.addEventListener('drop', this._handlers.drop);
    }

    if (this.analyzeBtn) {
      this._handlers.analyzeClick = () => this._runPipeline();
      this.analyzeBtn.addEventListener('click', this._handlers.analyzeClick);
    }

    if (this.downloadBtn) {
      this._handlers.downloadClick = () => this._download();
      this.downloadBtn.addEventListener('click', this._handlers.downloadClick);
    }

    // Playback buttons
    const pO = document.getElementById('play-original');
    const pE = document.getElementById('play-enhanced');
    if (pO) {
      this._handlers.playOriginal = () => this._togglePlay('original');
      pO.addEventListener('click', this._handlers.playOriginal);
    }
    if (pE) {
      this._handlers.playEnhanced = () => this._togglePlay('enhanced');
      pE.addEventListener('click', this._handlers.playEnhanced);
    }
  }

  _removeListeners() {
    try {
      if (this.fileInput && this._handlers.fileChange) this.fileInput.removeEventListener('change', this._handlers.fileChange);
      if (this.uploadZone) {
        if (this._handlers.dragOver) this.uploadZone.removeEventListener('dragover', this._handlers.dragOver);
        if (this._handlers.dragLeave) this.uploadZone.removeEventListener('dragleave', this._handlers.dragLeave);
        if (this._handlers.drop) this.uploadZone.removeEventListener('drop', this._handlers.drop);
      }
      if (this.analyzeBtn && this._handlers.analyzeClick) this.analyzeBtn.removeEventListener('click', this._handlers.analyzeClick);
      if (this.downloadBtn && this._handlers.downloadClick) this.downloadBtn.removeEventListener('click', this._handlers.downloadClick);
      const pO = document.getElementById('play-original');
      const pE = document.getElementById('play-enhanced');
      if (pO && this._handlers.playOriginal) pO.removeEventListener('click', this._handlers.playOriginal);
      if (pE && this._handlers.playEnhanced) pE.removeEventListener('click', this._handlers.playEnhanced);
    } catch (err) {
      // ignore
    }
    this._handlers = {};
  }

  _ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.dspEngine    = new DSPEngine(this.audioContext);
    }
    if (this.audioContext.state === 'suspended') this.audioContext.resume();
  }

  async _checkBackend() {
    const el = document.getElementById('backend-status');
    const tx = document.getElementById('backend-status-text');

    if (el) el.className = 'backend-notice backend-checking';
    if (tx) tx.textContent = '◌ Connecting to Python DSP Backend...';

    try {
      const r = await fetch(BACKEND_HEALTH, { 
        signal: AbortSignal.timeout(30000),
        mode: 'cors'
      });
      if (!r.ok) throw new Error('non-ok response');
      const data = await r.json();
      if (data.status !== 'healthy') throw new Error('status not healthy');

      if (el) el.className = 'backend-notice backend-online';
      if (tx) tx.textContent = '● Python DSP Backend — Online';
      this._backendOnline = true;
    } catch (err) {
      console.warn('[AudioLab] Health check failed:', err);
      if (el) el.className = 'backend-notice backend-offline';
      if (tx) tx.textContent = '○ Python DSP Backend — Offline (using browser DSP)';
      this._backendOnline = false;
    }
  }

  _initEventListeners() {
    this.fileInput?.addEventListener('change', e => { if (e.target.files[0]) this._handleFile(e.target.files[0]); });

    if (this.uploadZone) {
      this.uploadZone.addEventListener('dragover', e => { e.preventDefault(); this.uploadZone.style.borderColor = '#00F0FF'; });
      this.uploadZone.addEventListener('dragleave', () => { this.uploadZone.style.borderColor = ''; });
      this.uploadZone.addEventListener('drop', e => {
        e.preventDefault(); 
        this.uploadZone.style.borderColor = '';
        if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]);
      });
    }

    this.analyzeBtn?.addEventListener('click',  () => this._runPipeline());
    this.downloadBtn?.addEventListener('click', () => this._download());
    document.getElementById('play-original')?.addEventListener('click', () => this._togglePlay('original'));
    document.getElementById('play-enhanced')?.addEventListener('click',  () => this._togglePlay('enhanced'));
  }

  _handleFile(file) {
    this._ensureAudioContext();
    this._hideError();
    this._setAnalyzeState('idle');
    const r = new FileReader();
    r.onload  = e => this._decodeAudio(e.target.result, file);
    r.onerror = () => this._showError('Failed to read file.', 'FileReader error');
    r.readAsArrayBuffer(file);
  }

  async _decodeAudio(ab, file) {
    try {
      this.originalFile   = file;
      this.originalBuffer = await this.audioContext.decodeAudioData(ab);
      if (this.classifier) this.classifier.sampleRate = this.originalBuffer.sampleRate || this.classifier.sampleRate;
      this._updateMetaUI(file.name, this.originalBuffer);
      this._initVisualizers();
      this.waveOriginal.render(this.originalBuffer, '#4B5563');
      this._setAnalyzeState('ready');
    } catch (err) {
      this._showError('Unable to decode audio. Please use a valid WAV or MP3 file.', err.message || String(err));
    }
  }

  _initVisualizers() {
    const co = document.getElementById('canvas-wave-original');
    const ce = document.getElementById('canvas-wave-enhanced');
    const so = document.getElementById('canvas-spec-original');
    const se = document.getElementById('canvas-spec-enhanced');
    if (co) this.waveOriginal = new WaveformRenderer(co);
    if (ce) this.waveEnhanced = new WaveformRenderer(ce);
    if (so) this.specOriginal = new SpectrogramRenderer(so);
    if (se) this.specEnhanced = new SpectrogramRenderer(se);
  }

  _updateMetaUI(name, buf) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const d = buf.getChannelData(0);
    let sq = 0, pk = 0;
    for (let i = 0; i < d.length; i++) { 
      sq += d[i]*d[i]; 
      if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); 
    }
    set('meta-filename',   name);
    set('meta-duration',   buf.duration.toFixed(2) + ' s');
    set('meta-samplerate', buf.sampleRate + ' Hz');
    set('meta-channels',   buf.numberOfChannels);
  }

  async _runPipeline() {
    if (!this.originalBuffer) return;
    this._ensureAudioContext();
    this._hideError();
    this._setAnalyzeState('processing');

    const tl = document.getElementById('processing-timeline');
    if (tl) tl.style.display = 'block';
    for (let i = 1; i <= 7; i++) {
      const el = document.getElementById('step-' + i);
      if (el) { el.className = 'checklist-item'; const b = el.querySelector('.step-box'); if (b) b.innerHTML = ''; }
    }
    this._markStep(1, 'done');

    try {
      const result = this._backendOnline ? await this._callBackend() : await this._runBrowserDSP();
      this.enhancedBuffer = result.buffer;
      try { if (result.classification) this._setML(result.classification, result.confidence, result.dspParams); } catch (e) { /* ignore */ }
      this.waveOriginal.render(this.originalBuffer, '#4B5563');
      this.waveEnhanced.render(this.enhancedBuffer, '#00F0FF');
      this.specOriginal.render(this.originalBuffer, false);
      this.specEnhanced.render(this.enhancedBuffer, true);
      this._updateMetrics(result.metrics);

      const lr = document.getElementById('lab-results');
      if (lr) lr.style.display = 'flex';
      this._markStep(7, 'done');
      this._setAnalyzeState('done');
    } catch (err) {
      console.error('[AudioLab] Pipeline error:', err);
      this._showError('Audio processing failed. See technical details below.', err.stack || err.message || String(err));
      this._setAnalyzeState('error');
    }
  }

  async _runBrowserDSP() {
    this._markStep(2, 'done');
    const f = this.classifier.extractFeatures(this.originalBuffer.getChannelData(0));
    const ml = this.classifier.classify(f);
    this._markStep(3, 'done');
    this._markStep(4, 'done');
    this._markStep(5, 'running');

    const { buffer, metrics } = await this.dspEngine.processAudioBuffer(this.originalBuffer, pct => {
      if (pct >= 40) this._markStep(5, 'done');
      if (pct >= 65) this._markStep(6, 'done');
    });
    this._markStep(5, 'done');
    this._markStep(6, 'done');
    return { buffer, metrics, classification: ml.category, confidence: ml.confidence };
  }

  async _callBackend() {
    this._markStep(2, 'running');
    const fd = new FormData();
    fd.append('audio', this.originalFile);
    const res = await fetch(BACKEND_URL, { 
      method: 'POST', 
      body: fd,
      mode: 'cors'
    });
    if (!res.ok) throw new Error(`Backend ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Backend error');

    const bytes = Uint8Array.from(atob(json.enhanced_wav_b64), c => c.charCodeAt(0));
    const buf   = await this.audioContext.decodeAudioData(bytes.buffer);
    [2,3,4,5,6].forEach(n => this._markStep(n, 'done'));
    return { 
      buffer: buf, 
      classification: json.classification, 
      confidence: json.confidence, 
      dspParams: json.dsp_parameters_used,
      metrics: { 
        snrImprovement: json.snr_improvement, 
        rmsReduction: json.rms_diff || json.rms_reduction, 
        crestFactor: json.crest_factor 
      } 
    };
  }

  _togglePlay(which) {
    const buf = which === 'original' ? this.originalBuffer : this.enhancedBuffer;
    if (!buf) return;
    this._ensureAudioContext();
    const btn = document.getElementById(`play-${which}`);
    const prg = document.getElementById(`progress-${which}`);
    const tim = document.getElementById(`time-${which}`);
    const ico = btn?.querySelector('i');
    const key = which === 'original' ? '_playingOriginal' : '_playingEnhanced';

    if (this[key]) {
      try { this[key].stop(); } catch {}
      this[key] = null;
      btn?.classList.remove('playing');
      if (ico) { ico.setAttribute('data-lucide', 'play'); lucide.createIcons(); }
      if (prg) prg.style.width = '0%';
      return;
    }

    const otherKey   = which === 'original' ? '_playingEnhanced' : '_playingOriginal';
    const otherWhich = which === 'original' ? 'enhanced' : 'original';
    if (this[otherKey]) {
      try { this[otherKey].stop(); } catch {}
      this[otherKey] = null;
      const ob = document.getElementById(`play-${otherWhich}`);
      if (ob) { 
        ob.classList.remove('playing'); 
        const oi = ob.querySelector('i'); 
        if (oi) { oi.setAttribute('data-lucide','play'); lucide.createIcons(); } 
      }
    }

    const src = this.audioContext.createBufferSource();
    src.buffer = buf;
    src.connect(this.audioContext.destination);
    src.start();
    this[key] = src;
    btn?.classList.add('playing');
    if (ico) { ico.setAttribute('data-lucide', 'pause'); lucide.createIcons(); }

    const t0 = this.audioContext.currentTime, dur = buf.duration;
    const tick = () => {
      if (!this[key]) return;
      const e = this.audioContext.currentTime - t0, p = Math.min(1, e / dur);
      if (prg) prg.style.width = (p * 100) + '%';
      if (tim) tim.textContent = `${Math.floor(e/60)}:${Math.floor(e%60).toString().padStart(2,'0')}`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    src.onended = () => {
      this[key] = null;
      btn?.classList.remove('playing');
      if (ico) { ico.setAttribute('data-lucide','play'); lucide.createIcons(); }
      if (prg) prg.style.width = '100%';
      if (tim) tim.textContent = `${Math.floor(dur/60)}:${Math.floor(dur%60).toString().padStart(2,'0')}`;
    };
  }

  _download() {
    if (!this.enhancedBuffer || !this.dspEngine) return;
    const blob = this.dspEngine.bufferToWavBlob(this.enhancedBuffer);
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'NoiseX_Enhanced.wav' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _setAnalyzeState(s) {
    const btn = this.analyzeBtn;
    if (!btn) return;
    const m = { 
      idle: ['#4B5563','rgba(255,255,255,0.08)','rgba(255,255,255,0.03)','Analyze Audio',true,'not-allowed'],
      ready: ['#00F0FF','rgba(0,240,255,0.35)','rgba(0,240,255,0.06)','Analyze Audio',false,'pointer'],
      processing: ['#6B7280','rgba(255,255,255,0.08)','rgba(255,255,255,0.03)','Processing…',true,'not-allowed'],
      done: ['#10B981','rgba(16,185,129,0.3)','rgba(16,185,129,0.06)','Analysis Complete',false,'pointer'],
      error: ['#EF4444','rgba(239,68,68,0.3)','rgba(239,68,68,0.05)','Retry',false,'pointer'] 
    }[s];
    if (!m) return;
    [btn.style.color, btn.style.borderColor, btn.style.background, btn.textContent, btn.disabled, btn.style.cursor] = m;
  }

  _markStep(n, status) {
    const el = document.getElementById('step-' + n);
    if (!el) return;
    el.className = 'checklist-item' + (status === 'done' ? ' done' : status === 'running' ? ' running' : '');
    const box = el.querySelector('.step-box');
    if (box) box.innerHTML = status === 'done'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : '';
  }

  _setML(category, confidence, dspParams) {
    try {
      const el = document.getElementById('ml-summary');
      if (!el) return;
      const cat = document.getElementById('ml-category'); if (cat) cat.textContent = category || 'Unknown';
      const bar = document.getElementById('ml-confidence-bar'); if (bar) bar.style.width = ((confidence||0)*100).toFixed(1) + '%';
      const txt = document.getElementById('ml-confidence-text'); if (txt) txt.textContent = ((confidence||0)*100).toFixed(1) + '% confidence';

      if (dspParams) {
        const dspBox = document.getElementById('ml-dsp-params');
        const bW = document.getElementById('dsp-badge-wavelet');
        const bA = document.getElementById('dsp-badge-alpha');
        const bB = document.getElementById('dsp-badge-beta');
        if (dspBox) dspBox.style.display = 'flex';
        if (bW) bW.textContent = 'Wavelet: ' + (dspParams.wavelet || 'db4').toUpperCase() + ' (L' + (dspParams.level || 4) + ', ' + (dspParams.threshold_mode || 'soft') + ')';
        if (bA) bA.textContent = 'Spectral α: ' + (dspParams.spectral_alpha !== undefined ? dspParams.spectral_alpha : '—');
        if (bB) bB.textContent = 'Spectral β: ' + (dspParams.spectral_beta !== undefined ? dspParams.spectral_beta : '—');
      }
      el.style.display = 'block';
    } catch (err) {
      // ignore
    }
  }

  _updateMetrics(m) {
    if (!m) return;
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('metric-snr',   m.snrImprovement != null ? m.snrImprovement.toFixed(1)+' dB' : '—');
    s('metric-rms',   m.rmsReduction   != null ? m.rmsReduction.toFixed(1)+' dB' : '—');
    s('metric-crest', m.crestFactor    != null ? m.crestFactor.toFixed(2) : '—');
  }

  _showError(msg, detail) {
    const p = document.getElementById('error-panel');   if (p) p.style.display = 'block';
    const m = document.getElementById('error-message'); if (m) m.textContent = msg;
    const d = document.getElementById('error-detail');  if (d) d.textContent = detail || '';
  }

  _hideError() { 
    const p = document.getElementById('error-panel'); 
    if (p) p.style.display = 'none'; 
  }
}