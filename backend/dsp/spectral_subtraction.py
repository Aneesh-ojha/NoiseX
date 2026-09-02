"""
dsp/spectral_subtraction.py
----------------------------
Classic over-subtraction spectral subtraction noise reduction.
"""

import numpy as np
import scipy.signal as signal


def spectral_subtract(
    audio: np.ndarray,
    sr: int,
    n_fft: int = 512,
    hop_length: int = 256,
    alpha: float = 2.0,
    beta: float = 0.005,
    noise_frames: int = 20,
) -> np.ndarray:
    """
    Reduce stationary noise via spectral subtraction.

    Algorithm
    ---------
    1. Compute STFT of the input signal.
    2. Estimate the noise power spectrum from the first *noise_frames* frames
       (assumed to contain noise only / predominantly noise).
    3. For each time frame, subtract alpha times the noise magnitude from the
       signal magnitude, floored at beta times the current magnitude to avoid
       musical-noise artefacts.
    4. Reconstruct with the original phase.
    5. Normalise output.

    Parameters
    ----------
    audio        : np.ndarray  -- mono float signal
    sr           : int         -- sample rate
    n_fft        : int         -- FFT window length (default 512)
    hop_length   : int         -- hop size (default 256)
    alpha        : float       -- over-subtraction factor (default 2.0)
    beta         : float       -- spectral floor factor (default 0.005)
    noise_frames : int         -- number of leading frames used as noise estimate

    Returns
    -------
    enhanced : np.ndarray  -- denoised float32 signal (same length as input)
    """
    # --- STFT ------------------------------------------------------------
    freqs, times, Zxx = signal.stft(
        audio,
        fs=sr,
        window="hann",
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary="zeros",
        padded=True,
    )

    magnitudes = np.abs(Zxx)
    phases = np.angle(Zxx)

    # --- noise estimation -----------------------------------------------
    n_noise = min(noise_frames, magnitudes.shape[1])
    noise_mag = np.mean(magnitudes[:, :n_noise], axis=1, keepdims=True)  # (F, 1)

    # --- spectral subtraction with spectral floor -----------------------
    # clean_mag = max(|X| - alpha * noise_mag, beta * |X|)
    clean_mag = np.maximum(
        magnitudes - alpha * noise_mag,
        beta * magnitudes,
    )

    # --- reconstruct ----------------------------------------------------
    Zxx_clean = clean_mag * np.exp(1j * phases)

    _, enhanced = signal.istft(
        Zxx_clean,
        window="hann",
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary=True,
    )

    enhanced = enhanced.astype(np.float32)

    # Trim / pad to match original length
    orig_len = len(audio)
    if len(enhanced) > orig_len:
        enhanced = enhanced[:orig_len]
    elif len(enhanced) < orig_len:
        enhanced = np.pad(enhanced, (0, orig_len - len(enhanced)))

    # Peak normalise
    peak = np.max(np.abs(enhanced))
    if peak > 0:
        enhanced = enhanced * (0.95 / peak)

    return enhanced
