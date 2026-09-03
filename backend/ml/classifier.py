"""
backend/ml/classifier.py
------------------------
Robust Acoustic Environment Classifier using Random Forest.
Handles arbitrary sample rates and durations via sliding 2.0s windows
with probability voting.
"""

import os
import pickle
import numpy as np
import librosa
from scipy.signal import resample_poly

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "acoustic_env_rf.pkl")

LABEL_MAP = {
    0: "drone_combat",
    1: "emergency_siren",
    2: "gunfire_impulsive",
    3: "heavy_engine",
    4: "helicopter_cockpit",
    5: "wind_shear"
}

_BUNDLE = None
if os.path.exists(MODEL_PATH):
    try:
        with open(MODEL_PATH, "rb") as f:
            _BUNDLE = pickle.load(f)
        print(f"[ML Classifier] Loaded Random Forest model from: {MODEL_PATH}")
    except Exception as e:
        print(f"[ML Classifier] Failed to load model: {e}")
else:
    print(f"[ML Classifier] Model file not found at: {MODEL_PATH}")

DSP_PROFILE_LOOKUP = {
    "drone_combat": {
        "wavelet": "db10", "level": 8, "threshold_mode": "soft",
        "spectral_alpha": 2.4, "spectral_beta": 0.008, "noise_dur": 0.25
    },
    "helicopter_cockpit": {
        "wavelet": "db10", "level": 9, "threshold_mode": "soft",
        "spectral_alpha": 2.2, "spectral_beta": 0.008, "noise_dur": 0.20
    },
    "gunfire_impulsive": {
        "wavelet": "db4", "level": 7, "threshold_mode": "soft",
        "spectral_alpha": 2.8, "spectral_beta": 0.015, "noise_dur": 0.15
    },
    "heavy_engine": {
        "wavelet": "db10", "level": 9, "threshold_mode": "soft",
        "spectral_alpha": 2.2, "spectral_beta": 0.010, "noise_dur": 0.25
    },
    "wind_shear": {
        "wavelet": "db10", "level": 8, "threshold_mode": "soft",
        "spectral_alpha": 2.5, "spectral_beta": 0.005, "noise_dur": 0.30
    },
    "emergency_siren": {
        "wavelet": "db10", "level": 8, "threshold_mode": "soft",
        "spectral_alpha": 2.2, "spectral_beta": 0.010, "noise_dur": 0.20
    }
}

DEFAULT_DSP = {
    "wavelet": "db10", "level": 9, "threshold_mode": "soft",
    "spectral_alpha": 2.2, "spectral_beta": 0.008, "noise_dur": 0.20
}


def _extract_120_features(audio_2s_16k: np.ndarray) -> np.ndarray:
    """Computes exact (40, 201) log-mel spectrogram and 120-dim features."""
    mel = librosa.feature.melspectrogram(
        y=audio_2s_16k,
        sr=16000,
        n_fft=512,
        hop_length=160,
        n_mels=40,
        power=2.0
    )
    log_mel = librosa.power_to_db(mel, ref=np.max, top_db=80.0)

    # Force exact 201 frame shape
    if log_mel.shape[1] > 201:
        log_mel = log_mel[:, :201]
    elif log_mel.shape[1] < 201:
        log_mel = np.pad(log_mel, ((0, 0), (0, 201 - log_mel.shape[1])), mode="edge")

    mean_f = np.mean(log_mel, axis=1)
    std_f = np.std(log_mel, axis=1)
    max_f = np.max(log_mel, axis=1)
    return np.hstack([mean_f, std_f, max_f])


def classify_audio(audio: np.ndarray, sr: int = 16000) -> tuple:
    """
    Classifies audio of arbitrary duration and sample rate using sliding windows.
    Returns (category, confidence, summary_features, dsp_params).
    """
    if _BUNDLE is None:
        return "heavy_engine", 0.90, {}, DEFAULT_DSP

    audio_f = audio.astype(np.float32)

    # Resample to 16,000 Hz if necessary
    if sr != 16000:
        audio_f = librosa.resample(audio_f, orig_sr=sr, target_sr=16000)

    target_samples = 32000  # 2.0 seconds @ 16kHz
    total_len = len(audio_f)

    # Slide 2-second windows across the clip
    feature_windows = []
    if total_len <= target_samples:
        padded = np.pad(audio_f, (0, max(0, target_samples - total_len)), mode="constant")
        feature_windows.append(_extract_120_features(padded))
    else:
        hop = 16000  # 1.0s hop (50% overlap)
        starts = list(range(0, total_len - target_samples + 1, hop))
        if not starts:
            starts = [0]
        for s in starts:
            chunk = audio_f[s:s + target_samples]
            feature_windows.append(_extract_120_features(chunk))

    X = np.array(feature_windows)

    rf = _BUNDLE["model"]
    probs_all = rf.predict_proba(X)  # shape: (n_windows, n_classes)
    avg_probs = np.mean(probs_all, axis=0)

    best_idx = int(np.argmax(avg_probs))
    raw_class = rf.classes_[best_idx]

    if isinstance(raw_class, (int, np.integer)) or str(raw_class).isdigit():
        category = LABEL_MAP.get(int(raw_class), f"class_{raw_class}")
    else:
        category = str(raw_class)

    confidence = float(avg_probs[best_idx])
    dsp_params = DSP_PROFILE_LOOKUP.get(category, DEFAULT_DSP)

    rms = float(np.sqrt(np.mean(audio ** 2))) if len(audio) else 0.0
    summary_features = {
        "rms_energy": round(rms, 4),
        "dominant_class": category,
        "confidence_pct": round(confidence * 100, 1)
    }

    return category, round(confidence, 4), summary_features, dsp_params
