"""
dsp/wavelet.py
Colab-matched Wavelet Denoising.
"""

import numpy as np
import pywt

def wavelet_denoise(
    audio: np.ndarray,
    wavelet: str = "db10",
    level: int = 9,
    threshold_mode: str = "soft",
) -> np.ndarray:
    audio = audio.astype(np.float32)
    coeffs = pywt.wavedec(audio, wavelet, level=level)

    # Noise estimation from finest detail coefficients
    sigma = np.median(np.abs(coeffs[-1])) / 0.6745
    threshold = sigma * np.sqrt(2 * np.log(len(audio)))

    # Soft thresholding on detail coefficients
    thresholded_coeffs = [coeffs[0]]
    for i in range(1, len(coeffs)):
        thresholded_coeffs.append(
            pywt.threshold(coeffs[i], value=threshold, mode=threshold_mode)
        )

    # IDWT reconstruction
    denoised = pywt.waverec(thresholded_coeffs, wavelet)

    if len(denoised) > len(audio):
        denoised = denoised[:len(audio)]
    elif len(denoised) < len(audio):
        denoised = np.pad(denoised, (0, len(audio) - len(denoised)), "constant")

    return denoised.astype(np.float32)