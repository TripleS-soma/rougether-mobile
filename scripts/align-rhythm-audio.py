"""Reproduce the Small Steps chart from the downloaded Suno source.

Run from the mobile repository: python3 scripts/align-rhythm-audio.py
Requires ffmpeg, numpy and scipy. This is an audio-specific arrangement, not a
general automatic chart importer. Inspect a new song before changing the fit.
"""
import base64
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy import ndimage, optimize, signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/audio/rhythm/small-steps-source.m4a"
AUDIO = ROOT / "assets/audio/rhythm/small-steps.mp3"
REPORT = ROOT / "analysis/rhythm/alignment-report.json"

with tempfile.TemporaryDirectory(prefix="rougether-rhythm-") as temporary:
    wav = Path(temporary) / "source.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(SOURCE), "-ac", "1", "-ar", "22050", str(wav)], check=True)
    sr, samples = wavfile.read(wav)

samples = samples.astype(float) / 32768
frequencies, times, spectrum = signal.stft(samples, fs=sr, nperseg=256, noverlap=212, boundary=None)
log_spectrum = np.log1p(abs(spectrum) * 100)
flux = np.maximum(0, np.diff(log_spectrum, axis=1, prepend=log_spectrum[:, 0:1]))
envelope = ndimage.gaussian_filter1d(flux[(frequencies > 70) & (frequencies < 7500)].sum(axis=0), 1)
envelope /= np.quantile(envelope, .98)

def objective(value):
    period, phase = value
    beats = phase + np.arange(250) * period
    beats = beats[(beats > 40) & (beats < 110)]
    return -np.mean(np.interp(beats, times, envelope))

# Initial pulse candidate measured with cross-band autocorrelation and phase search.
fit = optimize.minimize(objective, [.5167436458184116, .23330578156154536], method="Nelder-Mead")
period, phase = fit.x
assert .50 < period < .53, "Unexpected tempo: review the source instead of guessing."
peaks, _ = signal.find_peaks(envelope, distance=int(.16 / (44 / sr)), prominence=.09)
grid = phase + np.arange(250) * period
grid = grid[(grid > 40) & (grid < 111)]
evidence = []
for beat in grid:
    candidates = peaks[abs(times[peaks] - beat) < .035]
    if len(candidates):
        peak = candidates[np.argmin(abs(times[candidates] - beat))]
        actual = float(times[peak] - .005)
        strength = float(envelope[peak])
        delta = float((actual - beat) * 1000)
    else:
        actual, strength, delta = float(beat - .005), 0, None
    evidence.append({"sourceTime": actual, "energy": strength, "deltaMs": delta, "measured": bool(len(candidates))})

clip_start = round((evidence[0]["sourceTime"] - .1) * sr) / sr
beats = [round(item["sourceTime"] - clip_start, 6) for item in evidence]
def at(index):
    left = int(np.floor(index))
    part = index - left
    return round(beats[left] * (1-part) + beats[left+1] * part, 6)

notes = []
targets = []
for cycle in range(16):
    base = 3 + cycle * 8
    level = cycle // 4 + 1
    phrases = 1 if level <= 2 else 2 if level == 3 else 4
    step = 1 if level <= 2 else .5 if level == 3 else .25
    for phrase in range(phrases):
        index = base + (6 if level <= 2 else 2 + phrase * 4 if level == 3 else phrase * 2)
        times = [at(index - (6-i)*step) for i in range(7)]
        held = cycle == 5 or level == 3 and cycle == 10 and phrase == 1 or level == 4 and phrase == 3
        release_steps = .5 if level == 4 else 1
        end = at(index + (release_steps if held else step))
        kind = 'hold' if held else 'rush' if level >= 3 and phrase == 1 and cycle % 2 == 1 else 'tap'
        hidden = [] if level == 1 else [3] if level == 2 else [2,4] if level == 3 else [1,3,4]
        notes.append({'id':len(notes),'start':times[0],'target':times[6],'hold':round(end-times[6],6) if held else 0,'kind':kind,'hidden':hidden,'beats':times+[end],'level':level,'speed':1/step,'perfectWindow':.08 if level==1 else .07 if level==2 else .06 if level==3 else .05})
        targets.append(evidence[index])
assert len(notes)==32
# Missing instrument attacks retain the established meter; only measured attacks are claimed as evidence.
duration = round(beats[132] + 2, 6)
chart = {"bpm": round(60 / period, 3), "beat": float(period), "duration": duration, "notes": notes}
(ROOT / "src/features/minigame/rhythm-chart.json").write_text(json.dumps(chart, indent=2) + "\n")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(SOURCE), "-af", f"atrim=start={clip_start}:duration={duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.06,afade=t=out:st={duration - 1}:d=1", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", str(AUDIO)], check=True)
(ROOT / "src/features/minigame/rhythm-music.ts").write_text("/** Generated from the user-authorized Suno track; see assets/audio/rhythm/README.md. */\nexport const RHYTHM_MUSIC_BASE64 =\n  '" + base64.b64encode(AUDIO.read_bytes()).decode() + "';\n")
report = {"sunoSong": "https://suno.com/song/8b361e0f-97f5-49c2-9249-9037e5e0a3da", "requestedBpm": 120, "measuredBpm": 60 / period, "sourceDuration": len(samples) / sr, "clipSourceStart": clip_start, "clipDuration": duration, "sampleRate": sr, "playableFirstBeatOffset": 3, "targetGridResidualMaxMs": max(abs(item["deltaMs"]) for item in targets if item["deltaMs"] is not None), "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "clipSha256": hashlib.sha256(AUDIO.read_bytes()).hexdigest(), "method": "Fit quarter-note comb in stable40–110s; snap nearest transient within35ms, subtract5ms STFT attack lag; 32 escalating targets; retain fitted meter where no clear attack exists. Stronger syncopated offbeats are not selected.", "evidence": evidence, "targets": targets, "note": "Signal-aligned pulse, not certified bar/downbeat transcription or human playtest."}
REPORT.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: value for key, value in report.items() if key not in ["evidence", "targets"]}, indent=2))
