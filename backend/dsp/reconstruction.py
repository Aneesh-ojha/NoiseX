"""
dsp/reconstruction.py
---------------------
Blend two denoised audio signals into a final output.
"""

import numpy as np


def reconstruct(
    spectral_audio: np.ndarray,
    wavelet_audio: np.ndarray,
    blend: float = 0.5,
) -> np.ndarray:
    """
    Linearly blend a spectrally-subtracted signal and a wavelet-denoised signal.

    Parameters
    ----------
    spectral_audio : np.ndarray  -- output of spectral subtraction
    wavelet_audio  : np.ndarray  -- output of wavelet denoising
    blend          : float       -- weight for spectral_audio (0 to 1).
                                    (1 - blend) is applied to wavelet_audio.

    Returns
    -------
    final : np.ndarray  -- blended, normalised float32 signal
    """
    blend = float(np.clip(blend, 0.0, 1.0))

    # --- align lengths --------------------------------------------------
    target_len = min(len(spectral_audio), len(wavelet_audio))
    s = spectral_audio[:target_len]
    w = wavelet_audio[:target_len]

    # --- blend ----------------------------------------------------------
    final = blend * s + (1.0 - blend) * w
    final = final.astype(np.float32)

    # --- normalise -------------------------------------------------------
    peak = np.max(np.abs(final))
    if peak > 0:
        final = final * (0.95 / peak)

    return final
