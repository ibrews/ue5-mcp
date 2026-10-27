#!/usr/bin/env python3
"""Revision 2: actual Blueprint nodes, recorded input states, continuous camera moves.

The visual graph is captured from BlueprintUE, not redrawn or generated.
Typing/import/copy states come from the real public reader. Timing is edited.
"""
from __future__ import annotations
import argparse
import math
import subprocess
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from render import Design, soundtrack, ROOT, HERE, W, H, FPS, DURATION, run

CAPTURES = HERE / 'captures-v2'
WHITE = '#f5f3eb'
MINT = '#b8e5ce'
GOLD = '#f1c16e'
DARK = '#15231f'


def lerp(a, b, p):
    return tuple(x + (y-x)*p for x,y in zip(a,b))


def smooth(x):
    x = max(0,min(1,x))
    return x*x*(3-2*x)


class Motion(Design):
    def __init__(self, font_dir):
        super().__init__(font_dir)
        self.shots = {p.stem: Image.open(p).convert('RGB') for p in CAPTURES.glob('*.png')}
        self.input = [Image.open(p).convert('RGB') for p in sorted((CAPTURES/'input').glob('*.png'))]
        self.loading = [Image.open(p).convert('RGB') for p in sorted((CAPTURES/'import').glob('*.png'))]
        self.raw = []
        for line in (CAPTURES/'source-excerpt.txt').read_text().splitlines():
            self.raw += textwrap.wrap(line, 94, replace_whitespace=False) or ['']
        self.code_layer = Image.new('RGBA',(W,2700),(15,24,23,225))
        cd = ImageDraw.Draw(self.code_layer)
        for row in range(72):
            cd.text((80,30+row*37),self.raw[row%len(self.raw)],font=self.font(28,'mono'),
                    fill=(175,221,196,205) if row%4 else (243,199,125,235))
        self.grad = Image.new('RGBA',(W,H))
        gd = ImageDraw.Draw(self.grad)
        for y in range(H):
            alpha = int(235*min(1,max(0,(y-795)/110)))
            if y < 95:
                alpha = max(alpha,225 if y<70 else int(225*(95-y)/25))
            gd.line((0,y,W,y),fill=(8,17,16,alpha))

    def camera(self, shot, start, end, p):
        box = lerp(start,end,max(0,min(1,p)))
        # Continuous subpixel camera over unaltered, actual captured pixels.
        return shot.transform((W,H),Image.Transform.EXTENT,box,Image.Resampling.BICUBIC),box

    def label_on(self, im, title='BLUEPRINT READER', right='REAL GRAPH · EDITED DEMO'):
        im.paste(self.grad,(0,0),self.grad)
        self.text(im,(56,30),title,22,WHITE,'bold')
        if right:
            f=self.font(20,'sans')
            length=ImageDraw.Draw(im).textlength(right,font=f)
            self.text(im,(W-56-length,32),right,20,WHITE)

    def caption(self, im, main, sub=None):
        self.text(im,(72,902 if sub else 948),main,50,WHITE,'bold')
        if sub:
            self.text(im,(75,975),sub,27,MINT)

    def point(self, box, xy):
        return ((xy[0]-box[0])*W/(box[2]-box[0]),(xy[1]-box[1])*H/(box[3]-box[1]))

    def cursor(self, im, xy, click=0):
        x,y=xy
        if click:
            radius=20+34*click
            d=ImageDraw.Draw(im)
            d.ellipse((x-radius,y-radius,x+radius,y+radius),outline=GOLD,width=4)
        ImageDraw.Draw(im).polygon([(x,y),(x+9,y+39),(x+18,y+29),(x+32,y+27)],fill='white',outline=DARK,width=3)

    def highlight(self, im, box, rect, opacity=1):
        a=self.point(box,rect[:2]); b=self.point(box,rect[2:])
        layer=Image.new('RGBA',im.size)
        ImageDraw.Draw(layer).rounded_rectangle((*a,*b),radius=15,outline=(241,193,110,int(255*opacity)),width=5)
        im.paste(layer,(0,0),layer)

    def graph(self, name, a, b, p):
        return self.camera(self.shots[name],a,b,p)

    def frame(self,t):
        if t < 4.5:
            im,box=self.graph('graph-entry',(0,140,1840,1175),(280,280,1560,1000),smooth(t/4.5))
            self.label_on(im,'BLUEPRINTUE · EXTENDED DIALOGUE SYSTEM','Public example by Nicola')
            self.caption(im,'I accidentally broke Claude.' if t<2.5 else 'Too much raw Blueprint code.')
        elif t < 8.5:
            u=t-4.5
            im,box=self.graph('graph-branches',(0,70,1920,1150),(200,120,1800,1020),u/4)
            overlay=self.code_layer.crop((0,int(u*290),W,int(u*290)+H))
            fade=min(1,u/.45,(4-u)/.5)
            overlay.putalpha(overlay.getchannel('A').point(lambda v:int(v*max(0,fade)*.83)))
            im.paste(overlay,(0,0),overlay)
            self.label_on(im,'RAW BLUEPRINT EXPORT · EXCERPT','Graph and source from the same public Blueprint')
            self.caption(im,'A whole graph. Plus its macros.','So I built a way to read it first.')
        elif t < 13.5:
            u=t-8.5
            # Actual character-by-character browser screenshots, edited to 3 seconds.
            shot=self.input[min(len(self.input)-1,int(max(0,u-.3)/3*len(self.input)))]
            p=smooth(max(0,u-2.8)/2.2)
            im,box=self.camera(shot,(15,90,815,540),(0,0,1280,720),p)
            self.label_on(im,'BLUEPRINT READER','Live browser interface · edited timing')
            self.caption(im,'Paste the BlueprintUE link.','blueprintue.com/blueprint/6v52d8no/')
            # Editorial pointer follows the real field → real Read Blueprint action.
            pos=lerp((300,217),(260,630),smooth(max(0,u-3.4)/1.2))
            self.cursor(im,self.point(box,pos),max(0,1-abs(u-4.8)/.18))
        elif t < 17.5:
            u=t-13.5
            shot=self.loading[min(len(self.loading)-1,int(u/1.6*len(self.loading)))]
            im,box=self.camera(shot,(0,0,1280,720),(420,0,1272,479.25),smooth(u/4))
            self.label_on(im,'THE SAME LINK. THE ACTUAL RESULT.','URL fetched by helper · parsing stays local')
            self.caption(im,'Read the graph. Find the missing context.','30 nodes · 107 pins · 1 missing macro body')
        elif t < 24:
            u=t-17.5
            key='reader-copied' if u>2.2 else 'reader-brief'
            im,box=self.camera(self.shots[key],(432,180,1272,652.5),(440,250,1258,710.125),smooth(u/6.5))
            self.label_on(im,'COPY A COMPACT BRIEF','Use it with Codex or Claude')
            self.caption(im,'81,358 source bytes → 1,336 brief bytes.','A summary. Keep the full source for follow-up.')
            if 1.2 < u < 3.2:
                self.cursor(im,self.point(box,(510,410)),max(0,1-abs(u-2.2)/.2))
        elif t < 34:
            u=t-24
            im,box=self.graph('graph-ui-chain',(400,265,1540,906.25),(770,265,1910,906.25),smooth(u/10))
            self.label_on(im,'FOLLOW THE ACTUAL CONNECTIONS','Static wiring · same Blueprint')
            if u<3.4:
                self.highlight(im,box,(874,493,1157,632),.8+.2*math.sin(u*4))
                self.caption(im,'Create the UI_HIRED widget.','K2Node_CreateWidget_1')
            elif u<6.5:
                self.highlight(im,box,(1194,509,1334,582),.8+.2*math.sin(u*4))
                self.caption(im,'Store that widget in Hired.','ReturnValue → Hired · exact pin evidence')
            else:
                self.highlight(im,box,(1370,477,1525,590),.8+.2*math.sin(u*4))
                self.caption(im,'Add it to the viewport.','A specific connection. A better follow-up question.')
        elif t < 38:
            u=t-34
            im,box=self.graph('graph-wide',(420,285,1400,836.25),(150,140,1700,1011.875),smooth(u/4))
            self.label_on(im,'START SMALL. KEEP THE GRAPH.','Extended dialogue system · Nicola / BlueprintUE')
            self.caption(im,'Bring the brief to Codex or Claude.','Save the full session. Inspect the nodes that matter.')
        else:
            u=t-38
            im,box=self.graph('graph-branches',(50,100,1800,1084.375),(180,135,1680,978.75),u/4)
            shade=Image.new('RGBA',(W,H),(7,20,16,165))
            im.paste(shade,(0,0),shade)
            self.text(im,(88,105),'Blueprint Reader.',100,WHITE,'serif')
            self.text(im,(94,260),'Understand the graph. Keep the context small.',43,MINT)
            self.pill(im,(90,735,1235,842),'ibrews.github.io/ue5-mcp/',54,'#d2ebd9',DARK)
            self.text(im,(96,885),'Free · MIT licensed · Try it in your browser',34,WHITE)
            self.text(im,(98,1010),'ALEX COULOMBE PRESENTS',23,MINT,'bold')
        # A minimal progress bar, not slide furniture.
        ImageDraw.Draw(im).rectangle((0,H-5,W*t/DURATION,H),fill=GOLD)
        return im


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--font-dir',type=Path,default=Path('/System/Library/Fonts/Supplemental'))
    ap.add_argument('--work',type=Path,default=ROOT/'skills/blueprint-reader/work/trailer/motion')
    ap.add_argument('--preview-only',action='store_true')
    args=ap.parse_args(); args.work.mkdir(parents=True,exist_ok=True)
    design=Motion(args.font_dir)
    times=[1,6,10,14.5,20.5,25.5,29,32,36,40]
    sheet=Image.new('RGB',(1920,540*5))
    for i,t in enumerate(times):
        frame=design.frame(t)
        frame.save(args.work/f'frame-{t:g}.jpg',quality=94)
        sheet.paste(frame.resize((960,540)),((i%2)*960,(i//2)*540))
    sheet.save(args.work/'contact-sheet.jpg',quality=92)
    assets=ROOT/'docs/assets'
    poster,box=design.graph('graph-ui-chain',(390,230,1910,1085),(390,230,1910,1085),0)
    shade=Image.new('RGBA',(W,H),(7,20,16,75)); poster.paste(shade,(0,0),shade)
    design.text(poster,(72,70),'Blueprint Reader.',104,WHITE,'serif')
    design.text(poster,(80,760),'From real Blueprint nodes to a compact brief.',42,MINT)
    design.pill(poster,(80,880,810,982),'     WATCH THE 42-SECOND DEMO',29,'#d2ebd9',DARK)
    ImageDraw.Draw(poster).polygon([(112,906),(112,950),(144,928)],fill=DARK)
    design.text(poster,(1120,945),'Alex Coulombe Presents',28,WHITE)
    poster.save(assets/'blueprint-reader-trailer-poster.jpg',quality=94,subsampling=0)
    if args.preview_only: return
    soundtrack(args.work/'original-score.wav')
    video=args.work/'silent.mp4'
    cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080',
         '-r',str(FPS),'-i','-','-an','-c:v','libx264','-threads','2','-preset','fast',
         '-crf','21','-pix_fmt','yuv420p','-g','60','-video_track_timescale','30000',str(video)]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
        for i in range(DURATION*FPS):
            proc.stdin.write(design.frame(i/FPS).tobytes())
            if i%(5*FPS)==0: print(f'Rendered {i/FPS:g}/42s',flush=True)
        proc.stdin.close()
        if proc.wait()!=0: raise RuntimeError('Video encoding failed')
    run(['ffmpeg','-y','-v','error','-i',str(video),'-i',str(args.work/'original-score.wav'),
         '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-ar','48000',
         '-af','loudnorm=I=-21:TP=-2:LRA=8','-t','42','-movflags','+faststart',
         '-metadata','title=Blueprint Reader — Real graph demo',
         '-metadata','artist=Alex Coulombe Presents',str(assets/'blueprint-reader-trailer.mp4')])
    print('Motion cut complete',flush=True)


if __name__=='__main__': main()
