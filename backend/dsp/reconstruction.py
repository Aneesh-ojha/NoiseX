"""
dsp/reconstruction.py
Final output reconstruction and safe normalization.
"""

import numpy as np


def reconstruct(
    spectral_audio: np.ndarray,
    wavelet_audio: np.ndarray,
    blend: float = 0.0,  # 0.0 means 100% wavelet_audio (sequential mode like Colab)
) -> np.ndarray:
    """
    Reconstruct the final signal.
    If blend == 0.0, it outputs pure wavelet_audio (Colab sequential output).
    If blend > 0.0, it blends spectral and wavelet.
    """
    # Clean any NaN or Inf artifacts
    s = np.nan_to_num(spectral_audio).astype(np.float32)
    w = np.nan_to_num(wavelet_audio).astype(np.float32)

    target_len = min(len(s), len(w))
    s = s[:target_len]
    w = w[:target_len]

    # If blend is 0 (Colab sequential behavior), use the wavelet output directly
    if blend <= 0.001:
        final = w
    elif blend >= 0.999:
        final = s
    else:
        blend = float(np.clip(blend, 0.0, 1.0))
        final = blend * s + (1.0 - blend) * w

    # Safe normalization: only scale down if clipping, do NOT boost noise
    peak = np.max(np.abs(final))
    if peak > 1.0:
        final = final / peak * 0.95

    return final.astype(np.float32)