/**
 * NoiseX — Real STFT Spectrogram Renderer
 *
 * Computes actual Short-Time Fourier Transform from AudioBuffer data
 * and renders a proper time × frequency spectrogram in dB magnitude.
 * No random values — every pixel corresponds to measured audio energy.
 */
export class SpectrogramRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d', { alpha: false });
  }

  _fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wR = Math.cos(ang), wI = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let uR = 1, uI = 0;
        const half = len >> 1;
        for (let j = 0; j < half; j++) {
          const tR = re[i+j+half]*uR - im[i+j+half]*uI;
          const tI = re[i+j+half]*uI + im[i+j+half]*uR;
          re[i+j+half] = re[i+j] - tR; im[i+j+half] = im[i+j] - tI;
          re[i+j] += tR; im[i+j] += tI;
          const nR = uR*wR - uI*wI; uI = uR*wI + uI*wR; uR = nR;
        }
      }
    }
  }

  _hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    return w;
  }

  _computeSTFT(data, fftSize, hopSize) {
    const hann    = this._hann(fftSize);
    const numFreq = (fftSize >> 1) + 1;
    const frames  = [];
    const re      = new Float32Array(fftSize);
    const im      = new Float32Array(fftSize);

    for (let start = 0; start + fftSize <= data.length; start += hopSize) {
      for (let k = 0; k < fftSize; k++) { re[k] = data[start + k] * hann[k]; im[k] = 0; }
      this._fft(re, im);
      const mag = new Float32Array(numFreq);
      for (let k = 0; k < numFreq; k++) mag[k] = 10 * Math.log10(re[k]*re[k] + im[k]*im[k] + 1e-10);
      frames.push(mag);
    }
    return frames;
  }

  _colormap(v) {
    v = Math.max(0, Math.min(1, v));
    let r, g, b;
    if (v < 0.25)      { const t = v/0.25;        r = 10+t*90|0;  g = t*10|0;       b = 40+t*80|0; }
    else if (v < 0.5)  { const t = (v-0.25)/0.25; r = 100+t*120|0; g = 10+t*20|0;  b = 120-t*80|0; }
    else if (v < 0.75) { const t = (v-0.5)/0.25;  r = 220+t*35|0; g = 30+t*100|0;  b = 40-t*30|0; }
    else               { const t = (v-0.75)/0.25;  r = 255;        g = 130+t*125|0; b = 10+t*30|0; }
    return [r, g, b];
  }

  render(buffer, _isEnhanced = false) {
    const W = this.canvas.width  = this.canvas.offsetWidth  || 400;
    const H = this.canvas.height = this.canvas.offsetHeight || 80;

    this.ctx.fillStyle = '#090B10';
    this.ctx.fillRect(0, 0, W, H);

    const data = buffer.getChannelData(0);
    if (!data || data.length === 0) return;

    const fftSize = 512;
    const hopSize = Math.max(1, Math.floor(data.length / W));
    const frames  = this._computeSTFT(data, fftSize, hopSize);
    if (!frames.length) return;

    const numFrames = frames.length;
    const numFreq   = frames[0].length;

    let gMax = -Infinity, gMin = Infinity;
    for (let f = 0; f < numFrames; f++) for (let k = 0; k < numFreq; k++) {
      if (frames[f][k] > gMax) gMax = frames[f][k];
      if (frames[f][k] < gMin) gMin = frames[f][k];
    }
    const floor  = gMax - 80;
    const range  = gMax - Math.max(gMin, floor);

    const imgData = this.ctx.createImageData(W, H);
    const pix     = imgData.data;

    for (let x = 0; x < W; x++) {
      const fi  = Math.min(numFrames - 1, (x / W * numFrames) | 0);
      const mag = frames[fi];
      for (let y = 0; y < H; y++) {
        const logFreq = Math.pow(1 - y / H, 1.4);
        const ki      = Math.min(numFreq - 1, (logFreq * numFreq) | 0);
        const norm    = range > 0 ? (mag[ki] - Math.max(gMin, floor)) / range : 0;
        const [r, g, b] = this._colormap(norm);
        const idx = (y * W + x) * 4;
        pix[idx] = r; pix[idx+1] = g; pix[idx+2] = b; pix[idx+3] = 255;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);

    // Axis labels
    const maxFreq = buffer.sampleRate / 2;
    this.ctx.font = '8px JetBrains Mono, monospace';
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${(maxFreq/1000).toFixed(0)}k`, 3, 10);
    this.ctx.fillText(`${(maxFreq/2000).toFixed(0)}k`, 3, H/2 + 4);
    this.ctx.fillText('0', 3, H - 2);
    this.ctx.textAlign = 'right';
    if (buffer.duration) this.ctx.fillText(`${buffer.duration.toFixed(1)}s`, W - 2, H - 2);
  }
}
