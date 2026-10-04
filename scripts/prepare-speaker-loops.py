from pathlib import Path
import subprocess, array, wave, sys
root=Path(__file__).resolve().parents[1] / 'assets/audio/speaker'
for name in ['fire','rain','forest','piano']:
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/f'{name}.mp3'),'-f','f32le','-ac','2','-ar','44100','-'])
 a=array.array('f');a.frombytes(raw); channels=2; n=len(a)//channels; overlap=88200; out=array.array('h')
 # Rotate to t=2s: body[2s..end-2s], then tail/head blend, then repeat at t=2s.
 for i in range(overlap,n-overlap):
  for c in range(channels):out.append(round(max(-1,min(1,a[i*channels+c]))*32767))
 for i in range(overlap):
  w=i/(overlap-1)
  for c in range(channels):
   x=a[(n-overlap+i)*channels+c]*(1-w)+a[i*channels+c]*w
   out.append(round(max(-1,min(1,x))*32767))
 with wave.open(str(root/f'{name}-loop.wav'),'wb') as f:
  f.setnchannels(2);f.setsampwidth(2);f.setframerate(44100);f.writeframes(out.tobytes())
 # 앱에는 AAC(m4a)로 담는다 (성능 장부 B1) — afconvert(macOS)가 gapless용 인코더 지연 정보를 쓴다.
 wav=root/f'{name}-loop.wav'; m4a=root/f'{name}-loop.m4a'
 subprocess.check_call(['afconvert','-f','m4af','-d','aac','-b','128000','-q','127','-s','3',str(wav),str(m4a)])
 wav.unlink()
 print(name,round(len(out)/2/44100,2),round(m4a.stat().st_size/1024/1024,2),'MiB')
