import numpy as np
import pywt

def wavelet_denoise(
    audio: np.ndarray,
    wavelet: str = 'db4',
    level: int = 9,
    threshold_method: str = 'universal',
    mode: str = 'soft'
) -> np.ndarray:
    audio = audio.astype(np.float32)
    orig_len = len(audio)

    # Limit decomposition level to what signal length allows
    max_level = pywt.dwt_max_level(orig_len, pywt.Wavelet(wavelet).dec_len)
    actual_level = min(level, max(1, max_level))

    # Perform Discrete Wavelet Transform
    coeffs = pywt.wavedec(audio, wavelet, level=actual_level)

    # Noise standard deviation from finest detail coefficients
    sigma = np.median(np.abs(coeffs[-1])) / 0.6745

    # If the band is silent, avoid division/zeroing errors
    if sigma < 1e-9:
        return audio

    # Preserve approximation coefficients
    thresholded_coeffs = [coeffs[0]]

    # Universal thresholding on detail coefficients
    for i in range(1, len(coeffs)):
        threshold = sigma * np.sqrt(2 * np.log(orig_len))
        thresholded_coeffs.append(pywt.threshold(coeffs[i], value=threshold, mode=mode))

    # Perform IDWT
    denoised_audio = pywt.waverec(thresholded_coeffs, wavelet)

    # Match length
    if len(denoised_audio) >= orig_len:
        return denoised_audio[:orig_len].astype(np.float32)
    else:
        return np.pad(denoised_audio, (0, orig_len - len(denoised_audio)), 'constant').astype(np.float32)