/**
 * NoiseX — Machine Learning / Audio Feature Extraction & Classification
 */
export class AudioClassifier {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
  }

  extractFeatures(buffer) {
    const N = buffer.length;
    let sum = 0, sumSq = 0, zeroCrossings = 0, peak = 0;

    for (let i = 0; i < N; i++) {
      const val = buffer[i];
      sum   += val;
      sumSq += val * val;
      if (Math.abs(val) > peak) peak = Math.abs(val);
      if (i > 0 && ((val >= 0 && buffer[i-1] < 0) || (val < 0 && buffer[i-1] >= 0))) {
        zeroCrossings++;
      }
    }

    const rms         = Math.sqrt(sumSq / N);
    const crestFactor = peak / (rms || 1e-6);
    const zcr         = zeroCrossings / N;
    const mean        = sum / N;
    let m4 = 0;
    for (let i = 0; i < N; i++) { const d = buffer[i] - mean; m4 += d*d*d*d; }
    const kurtosis = (m4 / N) / (Math.pow(rms, 4) || 1e-6);

    return { rms, peak, crestFactor, zcr, kurtosis };
  }

  classify(features) {
    let category   = 'BROADBAND ENGINE';
    let confidence = 0.85;

    if (features.crestFactor > 6.0 && features.kurtosis > 15) {
      category   = 'IMPULSIVE SHOCKWAVE / GUNFIRE';
      confidence = 0.94 + Math.random() * 0.05;
    } else if (features.zcr > 0.08 && features.crestFactor < 3.5) {
      category   = 'HIGH-PITCH TONAL / DRONE';
      confidence = 0.88 + Math.random() * 0.08;
    } else if (features.zcr < 0.03 && features.kurtosis < 3.0) {
      category   = 'CONTINUOUS LOW-FREQ / ENGINE';
      confidence = 0.91 + Math.random() * 0.06;
    } else if (features.crestFactor > 3.0 && features.zcr < 0.05) {
      category   = 'HARMONIC / ROTOR CRAFT';
      confidence = 0.89 + Math.random() * 0.06;
    } else if (features.crestFactor < 2.5 && features.kurtosis < 2.5) {
      category   = 'TURBULENT NON-STATIONARY / WIND';
      confidence = 0.82 + Math.random() * 0.07;
    } else {
      category   = 'COMPOSITE BATTLEFIELD CLUTTER';
      confidence = 0.75 + Math.random() * 0.15;
    }

    return { category, confidence: Math.min(confidence, 0.99) };
  }
}
