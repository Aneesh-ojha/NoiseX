/**
 * NoiseX — Browser DSP Engine
 *
 * Real spectral subtraction + multi-scale wavelet-style denoising.
 * No random values — all processing uses actual signal math.
 *
 * Pipeline:
 *   1. Resample to mono 16 kHz
 *   2. Estimate noise floor from first 20 STFT frames
 *   3. Spectral subtraction — FFT, subtract, IFFT, overlap-add
 *   4. Multi-scale soft thresholding
 *   5. Return enhanced AudioBuffer + computed metrics
 */
export class DSPEngine {
  constructor(audioContext) {
    this.ctx = audioContext;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    return w;
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

  _ifft(re, im) {
    const n = re.length;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    this._fft(re, im);
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] = -im[i] / n; }
  }

  _resample(src, srcSr, tgtSr) {
    if (srcSr === tgtSr) return src.slice();
    const ratio  = srcSr / tgtSr;
    const outLen = Math.floor(src.length / ratio);
    const out    = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const i0  = Math.floor(pos);
      const i1  = Math.min(i0 + 1, src.length - 1);
      out[i] = src[i0] * (1 - (pos - i0)) + src[i1] * (pos - i0);
    }
    return out;
  }

  _toMono(buffer) {
    const nc = buffer.numberOfChannels, len = buffer.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < nc; c++) { const ch = buffer.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += ch[i]; }
    for (let i = 0; i < len; i++) mono[i] /= nc;
    return mono;
  }

  _normalize(data) {
    let peak = 0;
    for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i]);
    if (peak < 1e-6) return;
    const scale = 0.95 / peak;
    for (let i = 0; i < data.length; i++) data[i] *= scale;
  }

  async processAudioBuffer(inputBuffer, onProgress) {
    const TARGET_SR    = 16000;
    const FFT_SIZE     = 512;
    const HOP_SIZE     = FFT_SIZE >> 1;
    const NOISE_FRAMES = 20;
    const alpha        = 2.0;
    const beta         = 0.005;

    if (onProgress) onProgress(5, 'Converting to mono…');
    await this._sleep(20);
    const rawMono = this._toMono(inputBuffer);

    if (onProgress) onProgress(15, 'Resampling to 16 kHz…');
    await this._sleep(20);
    const monoData = this._resample(rawMono, inputBuffer.sampleRate, TARGET_SR);
    this._normalize(monoData);

    if (onProgress) onProgress(25, 'Estimating noise floor…');
    await this._sleep(20);

    const hann     = this._hann(FFT_SIZE);
    const re       = new Float32Array(FFT_SIZE);
    const im       = new Float32Array(FFT_SIZE);
    const noisePow = new Float32Array(FFT_SIZE >> 1);
    let   nFrames  = 0;

    for (let start = 0; start + FFT_SIZE <= monoData.length && nFrames < NOISE_FRAMES; start += HOP_SIZE, nFrames++) {
      for (let k = 0; k < FFT_SIZE; k++) { re[k] = monoData[start + k] * hann[k]; im[k] = 0; }
      this._fft(re, im);
      for (let k = 0; k < FFT_SIZE >> 1; k++) noisePow[k] += re[k]*re[k] + im[k]*im[k];
    }
    if (nFrames > 0) for (let k = 0; k < FFT_SIZE >> 1; k++) noisePow[k] /= nFrames;

    if (onProgress) onProgress(40, 'Applying spectral subtraction…');
    await this._sleep(30);

    const outLen  = monoData.length;
    const outData = new Float32Array(outLen);
    const winSum  = new Float32Array(outLen);
    const reO     = new Float32Array(FFT_SIZE);
    const imO     = new Float32Array(FFT_SIZE);

    for (let start = 0; start + FFT_SIZE <= outLen; start += HOP_SIZE) {
      for (let k = 0; k < FFT_SIZE; k++) { re[k] = monoData[start + k] * hann[k]; im[k] = 0; }
      this._fft(re, im);

      for (let k = 0; k < FFT_SIZE >> 1; k++) {
        const mag    = Math.sqrt(re[k]*re[k] + im[k]*im[k]);
        const noise  = Math.sqrt(noisePow[k]);
        const cleanM = Math.max(mag - alpha * noise, beta * mag);
        const angle  = Math.atan2(im[k], re[k]);
        reO[k] = cleanM * Math.cos(angle);
        imO[k] = cleanM * Math.sin(angle);
        if (k > 0 && k < FFT_SIZE >> 1) { reO[FFT_SIZE - k] = reO[k]; imO[FFT_SIZE - k] = -imO[k]; }
      }
      reO[FFT_SIZE >> 1] = Math.max(0, re[FFT_SIZE >> 1]); imO[FFT_SIZE >> 1] = 0;

      this._ifft(reO, imO);

      for (let k = 0; k < FFT_SIZE && start + k < outLen; k++) {
        outData[start + k] += reO[k] * hann[k];
        winSum[start + k]  += hann[k] * hann[k];
      }
    }

    for (let i = 0; i < outLen; i++) if (winSum[i] > 1e-6) outData[i] /= winSum[i];

    if (onProgress) onProgress(65, 'Applying wavelet denoising…');
    await this._sleep(30);

    this._waveletDenoise(outData);

    if (onProgress) onProgress(85, 'Reconstructing…');
    await this._sleep(20);

    this._normalize(outData);

    const metrics  = this._calcMetrics(monoData, outData);

    if (onProgress) onProgress(100, 'Done.');

    const finalData = this._resample(outData, TARGET_SR, inputBuffer.sampleRate);
    const outBuffer = this.ctx.createBuffer(1, finalData.length, inputBuffer.sampleRate);
    outBuffer.getChannelData(0).set(finalData);

    return { buffer: outBuffer, metrics };
  }

  _waveletDenoise(data) {
    const scales = [8, 32, 128];
    for (const W of scales) {
      let sumSq = 0;
      const N = Math.min(W, data.length);
      for (let i = 0; i < N; i++) sumSq += data[i] * data[i];
      const sigma = Math.sqrt(sumSq / N);
      const thr   = sigma * 1.5 * 0.4;
      for (let i = 0; i < data.length; i++) {
        const ax = Math.abs(data[i]);
        data[i] = ax <= thr ? 0 : Math.sign(data[i]) * (ax - thr);
      }
    }
  }

  _calcMetrics(original, enhanced) {
    const N = Math.min(original.length, enhanced.length);
    let sumSqO = 0, sumSqE = 0, peak = 0;
    for (let i = 0; i < N; i++) {
      sumSqO += original[i] * original[i];
      sumSqE += enhanced[i] * enhanced[i];
      if (Math.abs(enhanced[i]) > peak) peak = Math.abs(enhanced[i]);
    }
    const rmsO = Math.sqrt(sumSqO / N);
    const rmsE = Math.sqrt(sumSqE / N);
    let sumSqD = 0;
    for (let i = 0; i < N; i++) { const d = original[i] - enhanced[i]; sumSqD += d*d; }
    const rmsD = Math.sqrt(sumSqD / N);
    return {
      snrImprovement: 20 * Math.log10((rmsE + 1e-10) / (rmsD + 1e-10)),
      rmsReduction:   20 * Math.log10((rmsO + 1e-10) / (rmsE + 1e-10)),
      crestFactor:    peak / (rmsE + 1e-10)
    };
  }

  bufferToWavBlob(buffer) {
    const nc = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
    const ab = new ArrayBuffer(len * nc * 2 + 44);
    const v  = new DataView(ab);
    let p = 0;
    const s = (str) => { for (let i = 0; i < str.length; i++) v.setUint8(p++, str.charCodeAt(i)); };
    const u16 = (n) => { v.setUint16(p, n, true); p += 2; };
    const u32 = (n) => { v.setUint32(p, n, true); p += 4; };
    s('RIFF'); u32(ab.byteLength - 8); s('WAVE'); s('fmt '); u32(16);
    u16(1); u16(nc); u32(sr); u32(sr * nc * 2); u16(nc * 2); u16(16);
    s('data'); u32(len * nc * 2);
    const chs = [];
    for (let c = 0; c < nc; c++) chs.push(buffer.getChannelData(c));
    for (let i = 0; i < len; i++) for (let c = 0; c < nc; c++) {
      const s2 = Math.max(-1, Math.min(1, chs[c][i]));
      v.setInt16(p, (s2 < 0 ? s2 * 32768 : s2 * 32767) | 0, true); p += 2;
    }
    return new Blob([ab], { type: 'audio/wav' });
  }
}
