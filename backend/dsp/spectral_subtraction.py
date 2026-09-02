"""
dsp/spectral_subtraction.py
Colab-matched Spectral Subtraction.
"""

import numpy as np
import scipy.signal as signal

def spectral_subtract(
    audio: np.ndarray,
    sr: int,
    n_fft: int = 1024,
    hop_length: int = 256,
    alpha: float = 2.2,
    beta: float = 0.008,
    noise_duration: float = 0.2,
) -> np.ndarray:
    audio = audio.astype(np.float32)

    # Frame-based noise segment count matching Colab
    noise_frames = max(1, int(noise_duration * sr) // hop_length)

    # STFT
    _, _, Zxx = signal.stft(
        audio,
        fs=sr,
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary=None,
    )

    magnitude = np.abs(Zxx)
    phase = np.angle(Zxx)

    # Noise spectrum estimation
    noise_mag = np.mean(magnitude[:, :noise_frames], axis=1, keepdims=True)

    # Over-subtraction with spectral floor
    denoised_mag = np.maximum(
        magnitude - alpha * noise_mag,
        beta * magnitude,
    )

    # ISTFT
    denoised_Zxx = denoised_mag * np.exp(1j * phase)
    _, enhanced = signal.istft(
        denoised_Zxx,
        fs=sr,
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
    )

    return enhanced[:len(audio)].astype(np.float32)