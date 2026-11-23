#!/usr/bin/env python3
"""A one-off sound-master builder. Real CC0 hot-air balloon burner recording,
plus original non-melodic, procedurally varied fairy-dust accents.
No network operations: source MP3 provided by the GitHub build step.
"""
import argparse
from array import array
from pathlib import Path
import math
import random
import struct
import subprocess
import sys
import wave

RATE=22050
LENGTH=30.0
N=int(RATE*LENGTH)
RNG=random.Random(1907)


def decode(filename):
    result=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(filename),
                           '-vn','-ac','1','-ar',str(RATE),'-f','s16le','-'],capture_output=True,check=True)
    pcm=array('h'); pcm.frombytes(result.stdout)
    if sys.byteorder=='big':pcm.byteswap()
    if len(pcm)<RATE*2:raise RuntimeError('Grabación de quemador demasiado corta.')
    return pcm


def best_windows(samples,seconds=1.75):
    period=int(seconds*RATE)
    results=[]
    for start in range(0,len(samples)-period,max(RATE//2,1)):
        block=samples[start:start+period:40]
        rms=math.sqrt(sum(x*x for x in block)/max(1,len(block)))
        results.append((rms,start))
    results.sort(reverse=True)
    chosen=[]
    for rms,pos in results:
        if all(abs(pos-other)>RATE*2.3 for other in chosen):chosen.append(pos)
        if len(chosen)>=4:break
    if not chosen:chosen=[0]
    return chosen


def mix_audio(pcm):
    # Master at -20-ish LUFS, deliberately soft to suit a sleeping bedroom.
    left=array('f',[0.0])*N
    right=array('f',[0.0])*N
    max_source=max(1,max(abs(v) for v in pcm))
    source_scale=0.28*32767/max_source
    windows=best_windows(pcm)
    # Genuine short propane-burner pulses, irregular timing and lengths.
    schedule=[(1.2,1.6), (5.2,1.9), (10.6,1.5), (15.4,1.8), (20.6,1.5), (26.0,1.9)]
    for index,(time,length) in enumerate(schedule):
        start_target=int(time*RATE)
        start_source=windows[index%len(windows)]
        count=min(int(RATE*length),N-start_target,len(pcm)-start_source)
        gain=source_scale*(.88+RNG.random()*.22)/32767
        for i in range(count):
            t=i/RATE
            ramp_in=min(1,t/.12)
            ramp_out=min(1,(count/RATE-t)/.32)
            env=max(0,min(ramp_in,ramp_out))**.65
            v=pcm[start_source+i]*gain*env
            left[start_target+i]+=v*.92
            right[start_target+i]+=v*.92
    # Magical glints: inharmonic partials + tiny breath of air. No musical notes.
    # Each event is unique in pitch, attack, decay, stereo position and cluster.
    for j in range(64):
        when=.38+j*(28.9/64)+RNG.uniform(-.20,.20)
        if when<0 or when>=LENGTH-.8:continue
        dur=RNG.uniform(.085,.29)
        freq=RNG.uniform(850,2250)
        detune=RNG.uniform(1.27,1.71)
        amp=RNG.uniform(.004,.013) * (1.3 if j%12 in (0,1,2) else .8)
        pan=RNG.uniform(-.73,.73)
        li=math.sqrt((1-pan)/2);ri=math.sqrt((1+pan)/2)
        offset=int(when*RATE)
        for i in range(min(int(dur*RATE),N-offset)):
            t=i/RATE
            envelope=(1-math.exp(-t*210))*math.exp(-t/RNG.uniform(.04,.055) if i==0 else -t/.065)
            s=(math.sin(2*math.pi*freq*t)+.34*math.sin(2*math.pi*freq*detune*t)+.17*math.sin(2*math.pi*freq*2.63*t))*.6
            v=amp*s*envelope
            left[offset+i]+=v*li;right[offset+i]+=v*ri
    # Almost inaudible, changing air texture (not a repeated sample).
    low=0.0
    for i in range(N):
        n=(RNG.random()*2-1)
        low=low*.992+n*.008
        gust=.004*(.48+.52*math.sin(i/RATE*.36+.5)**2)
        w=low*gust
        left[i]+=w;right[i]+=w*.82
    # Prevent overload if source is highly dynamic, and fade at both ends.
    peak=max(max(abs(x) for x in left),max(abs(x) for x in right))
    scale=min(1.0,.81/max(peak,1e-6))
    return left,right,peak,scale


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('source');parser.add_argument('out')
    a=parser.parse_args();Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    raw=decode(a.source)
    l,r,peak,scale=mix_audio(raw)
    wav=str(Path(a.out).with_suffix('.wav'))
    with wave.open(wav,'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE)
        out=bytearray(4*N)
        for i in range(N):
            struct.pack_into('<hh',out,4*i,int(max(-1,min(1,l[i]*scale))*32767),int(max(-1,min(1,r[i]*scale))*32767))
        f.writeframes(out)
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',wav,
                    '-c:a','libmp3lame','-b:a','112k','-ar','22050',a.out],check=True)
    Path(wav).unlink(missing_ok=True)
    print('Built field-recording based sound design: duration',LENGTH,'peak',round(peak,4),'scale',round(scale,3),'size',Path(a.out).stat().st_size)

if __name__=='__main__':main()