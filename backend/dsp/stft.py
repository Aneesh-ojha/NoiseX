"""
dsp/stft.py
-----------
Short-Time Fourier Transform helpers built on scipy.signal.
"""

import numpy as np
import scipy.signal as signal


def compute_stft(
    audio: np.ndarray,
    sr: int,
    n_fft: int = 512,
    hop_length: int = 256,
    window: str = "hann",
):
    """
    Compute the STFT of a mono audio signal.

    Parameters
    ----------
    audio      : np.ndarray  -- mono float signal
    sr         : int         -- sample rate (used to compute frequency axis)
    n_fft      : int         -- FFT window length
    hop_length : int         -- hop size between successive frames
    window     : str         -- window function name (passed to scipy)

    Returns
    -------
    magnitudes : np.ndarray, shape (n_fft//2+1, n_frames)
    phases     : np.ndarray, shape (n_fft//2+1, n_frames)  -- complex unit phasors
    freqs      : np.ndarray, shape (n_fft//2+1,)            -- frequency bins in Hz
    times      : np.ndarray, shape (n_frames,)               -- frame centres in seconds
    """
    freqs, times, Zxx = signal.stft(
        audio,
        fs=sr,
        window=window,
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary="zeros",
        padded=True,
    )

    magnitudes = np.abs(Zxx)
    # Unit-magnitude complex phasors (avoid division by zero)
    phases = np.exp(1j * np.angle(Zxx))

    return magnitudes, phases, freqs, times


def istft(
    magnitudes: np.ndarray,
    phases: np.ndarray,
    hop_length: int = 256,
    window: str = "hann",
) -> np.ndarray:
    """
    Reconstruct a time-domain signal from magnitude and phase arrays.

    Parameters
    ----------
    magnitudes : np.ndarray  -- non-negative magnitude spectrogram
    phases     : np.ndarray  -- complex unit phasors (same shape as magnitudes)
    hop_length : int         -- hop size used during analysis
    window     : str         -- window function name

    Returns
    -------
    audio : np.ndarray  -- reconstructed float32 audio
    """
    n_fft = (magnitudes.shape[0] - 1) * 2
    Zxx = magnitudes * phases

    _, audio = signal.istft(
        Zxx,
        window=window,
        nperseg=n_fft,
        noverlap=n_fft - hop_length,
        boundary=True,
    )

    return audio.astype(np.float32)
