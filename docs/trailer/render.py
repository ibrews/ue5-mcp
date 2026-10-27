#!/usr/bin/env python3
"""Render the 42-second captioned trailer from actual browser captures.

Dependencies: requirements.txt, ffmpeg/ffprobe, and Georgia/Arial fonts (macOS).
No browser automation, AI API, external media, or network requests are used.
"""
from __future__ import annotations

import argparse
import math
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
W, H, FPS, DURATION = 1920, 1080, 30, 42
CREAM = '#f5f3eb'
INK = '#213733'
GREEN = '#2d6056'
MUTED = '#64746b'
SAGE = '#dfe8df'
GOLD = '#d5af6c'
SCENES = [(0, 5), (5, 9), (9, 15), (15, 20), (20, 27), (27, 32), (32, 36), (36, 42)]


def run(args, **kwargs):
    subprocess.run(args, check=True, **kwargs)


def ease(x):
    x = max(0, min(1, x))
    return 1 - (1 - x) ** 3


class Design:
    def __init__(self, font_dir):
        self.font_dir = font_dir
        self.fonts = {}
        self.photos = {}
        for p in (HERE / 'captures').glob('*.png'):
            self.photos[p.stem] = Image.open(p).convert('RGB')
        self.cards = {}
        # Synthetic source owned by this project; it is decorative, not the demo input.
        self.code = subprocess.check_output([
            'node', '--input-type=module', '-e',
            "import {example} from './skills/blueprint-reader/web/example.mjs'; console.log(example);",
        ], cwd=ROOT, text=True).splitlines()

    def font(self, size, kind='sans'):
        names = {'sans': 'Arial.ttf', 'bold': 'Arial Bold.ttf',
                 'serif': 'Georgia.ttf', 'italic': 'Georgia Italic.ttf',
                 'mono': 'Courier New.ttf'}
        key = (size, kind)
        if key not in self.fonts:
            self.fonts[key] = ImageFont.truetype(str(self.font_dir / names[kind]), size)
        return self.fonts[key]

    def text(self, im, xy, text, size=36, color=INK, kind='sans', spacing=14):
        ImageDraw.Draw(im).multiline_text(xy, text, font=self.font(size, kind),
                                        fill=color, spacing=spacing, anchor='la')

    def label(self, im, text, y=70, color=MUTED):
        self.text(im, (100, y), text, 23, color, 'bold')

    def base(self, dark=False):
        im = Image.new('RGB', (W, H), INK if dark else CREAM)
        d = ImageDraw.Draw(im)
        d.line((100, 1012, 1820, 1012), fill='#456056' if dark else '#d2d8cc', width=1)
        self.text(im, (100, 1030), 'BLUEPRINT READER', 20, SAGE if dark else MUTED, 'bold')
        self.text(im, (1470, 1030), 'Alex Coulombe Presents', 20, SAGE if dark else MUTED)
        return im

    def photo(self, im, key, box, width, xy):
        cache_key = (key, box, width)
        if cache_key not in self.cards:
            p = self.photos[key].crop(box)
            h = round(p.height * width / p.width)
            p = p.resize((width, h), Image.Resampling.LANCZOS)
            mask = Image.new('L', p.size)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, width-1, h-1), 20, fill=255)
            card = Image.new('RGBA', (width+60, h+60))
            shadow = Image.new('RGBA', card.size)
            ImageDraw.Draw(shadow).rounded_rectangle((30, 40, width+30, h+40), 22, fill=(15,35,29,45))
            card.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(13)))
            card.paste(p, (30, 20), mask)
            self.cards[cache_key] = card
        card = self.cards[cache_key]
        im.paste(card, (int(xy[0])-30, int(xy[1])-20), card)

    def pill(self, im, box, text, size=28, fill=SAGE, color=INK):
        ImageDraw.Draw(im).rounded_rectangle(box, radius=18, fill=fill)
        self.text(im, (box[0]+24, box[1]+18), text, size, color, 'bold')

    def arrow(self, im, start, end, color=GREEN, width=5):
        d = ImageDraw.Draw(im)
        d.line((*start, *end), fill=color, width=width)
        x, y = end
        d.line((x-16, y-13, x, y, x-16, y+13), fill=color, width=width)

    def frame(self, t):
        index = next(i for i, (a,b) in enumerate(SCENES) if a <= t < b)
        a, b = SCENES[index]
        u = t-a
        shift = int(26 * (1-ease(u/0.7)))
        im = self.base(index in (0, 6))
        if index == 0:
            # Decorative code ribbon moves behind the story. No simulated Claude UI.
            ribbon = Image.new('RGBA', (900, 830))
            dr = ImageDraw.Draw(ribbon)
            for row in range(33):
                line = self.code[row % len(self.code)]
                dr.text((0, row*36-int(u*24)%36), line, font=self.font(20,'mono'), fill=(126,167,141,46))
            im.paste(ribbon, (1070,120), ribbon)
            self.label(im, 'THE ORIGIN STORY', color=GOLD)
            self.text(im, (100,225+shift), 'I accidentally\nbroke Claude.', 112, CREAM, 'serif', 26)
            self.text(im, (107,580+shift), 'With too much raw Blueprint code.', 43, SAGE)
            self.pill(im, (105,750,635,820), 'A whole graph. Plus its macros.', 26, '#38554a', CREAM)
        elif index == 1:
            self.label(im, 'SO I BUILT A WAY TO READ IT FIRST')
            self.text(im, (100,250+shift), 'Blueprint Reader.', 128, INK, 'serif')
            self.text(im, (108,455+shift), 'A graph first.\nA smaller prompt next.', 67, GREEN, 'serif', 18)
            self.pill(im, (110,740,570,820), 'RAW TEXT OR BLUEPRINTUE', 24)
            self.arrow(im, (605,780), (810,780))
            self.pill(im, (850,740,1250,820), 'A COMPACT BRIEF', 27, GREEN, CREAM)
        elif index == 2:
            self.label(im, '01  /  BRING THE GRAPH')
            self.text(im, (100,126+shift), 'Paste a real BlueprintUE link.', 66, INK, 'serif')
            key = '02-link' if u < 4.4 else '03-reading'
            self.photo(im, key, (28,8,1253,670), 1280, (540,245+shift))
            self.text(im, (100,300), 'One link.\nNo installation.', 43, GREEN, 'serif', 18)
            self.text(im, (100,468), 'The helper fetches\nthe export. Your\nbrowser parses it.', 30, MUTED, spacing=12)
            self.pill(im, (100,829,500,901), 'READ BLUEPRINT  →', 24, GREEN, CREAM)
            # Editorial callout: the actual input is visible in the captured UI.
            self.text(im, (100,950), 'blueprintue.com/blueprint/6v52d8no/', 28, GREEN, 'bold')
        elif index == 3:
            self.label(im, '02  /  UNDERSTAND THE GRAPH')
            self.text(im, (100,126+shift), 'An overview. The gaps, too.', 72, INK, 'serif')
            self.photo(im, '04-overview', (435,8,1253,367), 1560, (180,280+shift))
        elif index == 4:
            self.label(im, '03  /  SHARE THE SIGNAL')
            self.text(im, (100,126+shift), 'Copy a compact brief.', 77, INK, 'serif')
            self.text(im, (105,350), '81,358', 104, MUTED, 'serif')
            self.text(im, (110,475), 'source bytes', 31, MUTED)
            self.arrow(im, (120,560), (600,560))
            self.text(im, (105,595), '1,336', 136, GREEN, 'serif')
            self.text(im, (115,765), 'brief bytes', 35, GREEN)
            self.photo(im, '05-brief', (450,377,1236,720), 1080, (740,355+shift))
            self.text(im, (105,900), 'A summary, not lossless compression. Save the full session for follow-up.', 28, MUTED)
        elif index == 5:
            self.label(im, '04  /  KEEP THE EVIDENCE')
            self.text(im, (100,240+shift), 'Go deeper\nwhen you\nneed to.', 72, INK, 'serif', 20)
            self.text(im, (105,620), 'Trace an entry.\nInspect exact nodes.\nKeep the original source.', 32, MUTED, spacing=16)
            self.photo(im, '08-trace', (460,230,1228,716), 1080, (740,250+shift))
        elif index == 6:
            self.label(im, 'READY FOR YOUR ASSISTANT', color=GOLD)
            self.text(im, (100,235+shift), 'Bring the brief to\nCodex or Claude.', 105, CREAM, 'serif', 25)
            self.text(im, (108,580), 'Start small. Ask better follow-up questions.', 43, SAGE)
            self.pill(im, (110,745,1110,825), 'LOCAL PARSING  ·  NO AI API KEY IN THE READER', 28, '#38554a', CREAM)
        else:
            self.label(im, 'ALEX COULOMBE PRESENTS')
            self.text(im, (100,220+shift), 'Blueprint Reader.', 124, INK, 'serif')
            self.text(im, (108,420), 'Understand the graph.\nKeep the context small.', 68, GREEN, 'serif', 16)
            self.pill(im, (110,680,1090,775), 'ibrews.github.io/ue5-mcp/', 48, GREEN, CREAM)
            self.text(im, (112,835), 'Free. MIT licensed. Try it in your browser.', 36, MUTED)
        if 2 <= index <= 5:
            self.text(im, (100,989), 'Actual browser demo · edited for pace · “Extended dialogue system” by Nicola', 18, MUTED)
        # Quiet progress rule; short dip-to-background at edits makes the cuts intentional.
        d = ImageDraw.Draw(im)
        d.line((100,1012,100+1720*t/DURATION,1012), fill=GOLD if index in (0,6) else GREEN, width=4)
        opacity = min(1, u/0.18, (b-t)/0.12)
        if opacity < 1:
            bg = self.base(index in (0,6))
            im = Image.blend(bg, im, max(0, opacity))
        return im


def soundtrack(path):
    """Original soft A-minor arpeggios, warm pads, and cut accents."""
    sr = 48000
    mix = np.zeros((sr*DURATION, 2), dtype=np.float64)

    def note(start, duration, midi, amp, pan=0.5, pad=False):
        n = min(int(duration*sr), len(mix)-int(start*sr))
        if n <= 0:
            return
        x = np.arange(n)/sr
        frequency = 440 * 2 ** ((midi-69)/12)
        attack = 0.45 if pad else 0.018
        envelope = np.minimum(1,x/attack)*np.minimum(1,(duration-x)/0.35)
        if not pad:
            envelope *= np.exp(-x/0.9)
        signal = (np.sin(2*np.pi*frequency*x) + .18*np.sin(2*np.pi*frequency*2*x)) * envelope * amp
        offset = int(start*sr)
        mix[offset:offset+n,0] += signal*math.cos(pan*math.pi/2)
        mix[offset:offset+n,1] += signal*math.sin(pan*math.pi/2)

    chords = [(45,52,57,60), (41,48,53,57), (48,55,60,64), (43,50,55,59)]
    beat = 0.625  # 96 BPM
    for j in range(17):
        chord = chords[j%4]
        for m in chord:
            note(j*2.5, 3.3, m, .032, .45, True)
        for k in range(8):
            note(j*2.5+k*beat/2, 1.4, chord[k%4]+12, .044, .25+.5*(k%2))
    for start, _ in SCENES[1:]:
        note(start, 1.8, 81, .035, .6)
        note(start+.12, 1.7, 88, .022, .4)
    ramp = np.minimum(1,np.arange(len(mix))/sr/1.5)*np.minimum(1,(len(mix)-np.arange(len(mix)))/sr/2.4)
    mix *= ramp[:,None]
    mix *= .48 / max(.001,float(np.max(np.abs(mix))))
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((mix*32767).astype('<i2').tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--font-dir', type=Path, default=Path('/System/Library/Fonts/Supplemental'))
    ap.add_argument('--work', type=Path, default=ROOT/'skills/blueprint-reader/work/trailer/render')
    ap.add_argument('--preview-only', action='store_true')
    args = ap.parse_args()
    args.work.mkdir(parents=True, exist_ok=True)
    assets = ROOT/'docs/assets'
    assets.mkdir(exist_ok=True)
    design = Design(args.font_dir)
    times = [2.5,7,11,17,23,29,34,39]
    sheet = Image.new('RGB',(960*2,540*4),CREAM)
    for i,t in enumerate(times):
        frame = design.frame(t)
        frame.save(args.work/f'frame-{t:g}.jpg', quality=94)
        sheet.paste(frame.resize((960,540)), ((i%2)*960,(i//2)*540))
    sheet.save(args.work/'contact-sheet.jpg', quality=92)
    poster = design.frame(39)
    design.pill(poster,(1250,725,1805,810),'    WATCH · 42 SECONDS',30,GREEN,CREAM)
    ImageDraw.Draw(poster).polygon([(1278,752),(1278,782),(1300,767)], fill=CREAM)
    poster.save(assets/'blueprint-reader-trailer-poster.jpg', quality=94, subsampling=0)
    if args.preview_only:
        return
    soundtrack(args.work/'original-score.wav')
    video = args.work/'silent.mp4'
    cmd = ['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080',
           '-r',str(FPS),'-i','-','-an','-c:v','libx264','-threads','2','-preset','fast',
           '-crf','19','-pix_fmt','yuv420p','-g','60','-video_track_timescale','30000',str(video)]
    with subprocess.Popen(cmd, stdin=subprocess.PIPE) as proc:
        for i in range(DURATION*FPS):
            proc.stdin.write(design.frame(i/FPS).tobytes())
            if i % (FPS*5) == 0:
                print(f'Rendered {i/FPS:.0f}/{DURATION}s', flush=True)
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError('Video encoding failed')
    run(['ffmpeg','-y','-v','error','-i',str(video),'-i',str(args.work/'original-score.wav'),
         '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-ar','48000',
         '-af','loudnorm=I=-21:TP=-2:LRA=8','-t',str(DURATION),'-movflags','+faststart',
         '-metadata','title=Blueprint Reader — From a link to a compact brief',
         '-metadata','artist=Alex Coulombe Presents',
         str(assets/'blueprint-reader-trailer.mp4')])
    print('Trailer complete', flush=True)


if __name__ == '__main__':
    main()
