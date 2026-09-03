"""
dsp/metrics.py
Standardized evaluation metrics for PESQ, STOI, and SNR with cross-correlation alignment.
"""

import numpy as np
import scipy.signal as signal
import librosa
from pesq import pesq
from pystoi import stoi

def align_signals(ref: np.ndarray, deg: np.ndarray):
    """Align degraded signal to clean reference using cross-correlation."""
    corr = signal.correlate(deg, ref, mode="full")
    lags = signal.correlation_lags(len(deg), len(ref), mode="full")
    best_lag = lags[np.argmax(corr)]
    
    if best_lag > 0:
        deg_a, ref_a = deg[best_lag:], ref[:len(deg) - best_lag]
    elif best_lag < 0:
        ref_a, deg_a = ref[-best_lag:], deg[:len(ref) + best_lag]
    else:
        deg_a, ref_a = deg, ref
        
    m = min(len(ref_a), len(deg_a))
    return ref_a[:m], deg_a[:m]

def calculate_snr(clean: np.ndarray, proc: np.ndarray) -> float:
    noise = clean - proc
    p_signal = np.mean(clean ** 2)
    p_noise = np.mean(noise ** 2)
    if p_noise == 0:
        return float("inf")
    return float(10 * np.log10(p_signal / (p_noise + 1e-12)))

def score_pipeline(ref: np.ndarray, proc: np.ndarray, fs: int):
    # Align first
    r_aligned, p_aligned = align_signals(ref, proc)

    # Normalize amplitude
    r = r_aligned / (np.max(np.abs(r_aligned)) + 1e-12)
    p = p_aligned / (np.max(np.abs(p_aligned)) + 1e-12)

    val_snr = calculate_snr(r, p)
    val_stoi = stoi(r, p, fs, extended=False)

    # PESQ evaluation
    try:
        if fs not in [8000, 16000]:
            r_16 = librosa.resample(r, orig_sr=fs, target_sr=16000)
            p_16 = librosa.resample(p, orig_sr=fs, target_sr=16000)
            val_pesq = pesq(16000, r_16, p_16, 'wb')
        else:
            mode = 'wb' if fs == 16000 else 'nb'
            val_pesq = pesq(fs, r, p, mode)
    except Exception:
        val_pesq = 0.0

    corr = float(np.corrcoef(r, p)[0, 1])
    return {
        "snr": round(val_snr, 2),
        "stoi": round(val_stoi, 3),
        "pesq": round(val_pesq, 2),
        "correlation": round(corr, 3)
    }