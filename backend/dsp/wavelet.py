"""
dsp/wavelet.py
--------------
Wavelet-domain denoising using PyWavelets (pywt).
"""

import numpy as np
import pywt


def wavelet_denoise(
    audio: np.ndarray,
    wavelet: str = "db4",
    level: int = 3,
    threshold_mode: str = "soft",
) -> np.ndarray:
    """
    Denoise an audio signal using multi-level Discrete Wavelet Transform (DWT).

    Algorithm  (VisuShrink / universal threshold)
    ---------
    1. Decompose the signal with *level* levels of DWT using *wavelet*.
    2. Estimate noise sigma from the finest-scale detail coefficients:
           sigma = median(|d_finest|) / 0.6745
    3. Compute VisuShrink threshold:
           threshold = sigma * sqrt(2 * log(N))
    4. Apply soft (or hard) thresholding to **all** detail coefficient arrays.
    5. Reconstruct with waverec and normalise.

    Parameters
    ----------
    audio          : np.ndarray  -- mono float signal
    wavelet        : str         -- PyWavelets wavelet name (default 'db4')
    level          : int         -- decomposition levels (default 3)
    threshold_mode : str         -- 'soft' or 'hard' (default 'soft')

    Returns
    -------
    denoised : np.ndarray  -- denoised float32 signal (same length as input)
    """
    N = len(audio)

    # --- DWT decomposition -----------------------------------------------
    coeffs = pywt.wavedec(audio, wavelet=wavelet, level=level)
    # coeffs = [cA_n, cD_n, cD_{n-1}, ..., cD_1]

    # --- noise estimation from finest detail (last element) --------------
    finest_detail = coeffs[-1]
    sigma = np.median(np.abs(finest_detail)) / 0.6745
    threshold = sigma * np.sqrt(2 * np.log(max(N, 1)))

    # --- thresholding ---------------------------------------------------
    denoised_coeffs = [coeffs[0]]  # keep approximation coefficients unchanged
    for detail in coeffs[1:]:
        denoised_detail = pywt.threshold(detail, value=threshold, mode=threshold_mode)
        denoised_coeffs.append(denoised_detail)

    # --- reconstruction --------------------------------------------------
    denoised = pywt.waverec(denoised_coeffs, wavelet=wavelet)
    denoised = denoised.astype(np.float32)

    # Trim / pad to original length (waverec may add a sample)
    if len(denoised) > N:
        denoised = denoised[:N]
    elif len(denoised) < N:
        denoised = np.pad(denoised, (0, N - len(denoised)))

    # --- normalise -------------------------------------------------------
    peak = np.max(np.abs(denoised))
    if peak > 0:
        denoised = denoised * (0.95 / peak)

    return denoised
