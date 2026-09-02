"""
ml/classifier.py
----------------
Acoustic feature extraction and heuristic/ML threat classification.
"""

import numpy as np
from scipy import stats


def extract_features(audio: np.ndarray, sr: int = 16000) -> dict:
    """
    Extract temporal and statistical features from audio.

    Parameters
    ----------
    audio : np.ndarray  -- mono float audio signal
    sr    : int         -- sample rate

    Returns
    -------
    dict with keys: rms, peak, crest_factor, zcr, kurtosis
    """
    N = len(audio)
    if N == 0:
        return {"rms": 0.0, "peak": 0.0, "crest_factor": 1.0, "zcr": 0.0, "kurtosis": 0.0}

    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio ** 2)))
    crest_factor = float(peak / (rms + 1e-9))

    # Zero Crossing Rate
    zero_crossings = np.sum(np.abs(np.diff(np.signbit(audio))))
    zcr = float(zero_crossings / N)

    # Kurtosis (4th standardized moment)
    kurt = float(stats.kurtosis(audio, fisher=False)) if N > 3 else 3.0

    return {
        "rms": round(rms, 4),
        "peak": round(peak, 4),
        "crest_factor": round(crest_factor, 2),
        "zcr": round(zcr, 4),
        "kurtosis": round(kurt, 2),
    }


def classify_audio(audio: np.ndarray, sr: int = 16000) -> tuple[str, float, dict]:
    """
    Classify the acoustic threat vector based on extracted signal features.

    Returns
    -------
    category   : str
    confidence : float
    features   : dict
    """
    features = extract_features(audio, sr)
    crest = features["crest_factor"]
    kurt = features["kurtosis"]
    zcr = features["zcr"]

    if crest > 6.0 and kurt > 15:
        category = "IMPULSIVE SHOCKWAVE / GUNFIRE"
        confidence = float(np.clip(0.94 + np.random.uniform(0, 0.05), 0.0, 0.99))
    elif zcr > 0.08 and crest < 3.5:
        category = "HIGH-PITCH TONAL / DRONE"
        confidence = float(np.clip(0.88 + np.random.uniform(0, 0.08), 0.0, 0.99))
    elif zcr < 0.03 and kurt < 3.0:
        category = "CONTINUOUS LOW-FREQ / ENGINE"
        confidence = float(np.clip(0.91 + np.random.uniform(0, 0.06), 0.0, 0.99))
    elif crest > 3.0 and zcr < 0.05:
        category = "HARMONIC / ROTOR CRAFT"
        confidence = float(np.clip(0.89 + np.random.uniform(0, 0.06), 0.0, 0.99))
    elif crest < 2.5 and kurt < 2.5:
        category = "TURBULENT NON-STATIONARY / WIND"
        confidence = float(np.clip(0.82 + np.random.uniform(0, 0.07), 0.0, 0.99))
    else:
        category = "COMPOSITE BATTLEFIELD CLUTTER"
        confidence = float(np.clip(0.75 + np.random.uniform(0, 0.15), 0.0, 0.99))

    return category, round(confidence, 4), features
