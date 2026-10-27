#!/usr/bin/env python3
"""Visual-first cut. Real capture pixels + explicitly illustrative motion graphics.

Objects retain identity across transformations: graph -> source -> brief -> chat.
Use --no-captions to review the visual story without editorial text or sound.
The chat, capacity meter and widget pictograms are illustrations, not product UI.
"""
from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from render import Design, soundtrack, ROOT, HERE, W, H, FPS, DURATION, run
from render_motion import Motion, smooth, lerp

BG = '#101c1b'
WHITE = '#f5f3eb'
MINT = '#aee6cc'
GOLD = '#f1c16e'
RED = '#ef826e'
BLUE = '#79c9f4'


def clamp(x):
    return max(0., min(1., x))


def mix(a, b, p):
    return a+(b-a)*p


def bezier(a, b, c, d, p):
    q=1-p
    return (q*q*q*a[0]+3*q*q*p*b[0]+3*q*p*p*c[0]+p*p*p*d[0],
            q*q*q*a[1]+3*q*q*p*b[1]+3*q*p*p*c[1]+p*p*p*d[1])


class Visual(Motion):
    def __init__(self, font_dir, captions=True):
        super().__init__(font_dir)
        self.captions=captions
        self.paper=self.make_paper(False)
        self.brief=self.make_paper(True)
        self.graph_tile=self.shots['graph-entry'].crop((25,100,1830,1120))
        self.nodes=[self.shots['graph-ui-chain'].crop(r) for r in
                    [(876,496,1156,630),(1197,512,1332,579),(1372,480,1523,587)]]
        self.chain=self.shots['graph-ui-chain'].crop((850,465,1550,650))
        self.backdrop=Image.new('RGB',(W,H),BG)
        d=ImageDraw.Draw(self.backdrop)
        for x in range(0,W,48): d.line((x,0,x,H),fill='#1b2a27')
        for y in range(0,H,48): d.line((0,y,W,y),fill='#1b2a27')
        # Real reader's compact brief, including its actual formatting.
        self.actual_brief=self.shots['reader-brief'].crop((463,487,1233,719))

    def make_paper(self, brief):
        im=Image.new('RGBA',(360,450))
        d=ImageDraw.Draw(im)
        fill='#e7f4eb' if brief else '#273c35'
        edge=MINT if brief else GOLD
        d.rounded_rectangle((2,2,357,447),18,fill=fill,outline=edge,width=3)
        d.polygon([(292,3),(292,60),(356,60)],fill='#bfdacb' if brief else '#526858')
        if brief:
            # Compact structured page with a tiny connected graph as a visual signature.
            for x in (48,142,236):
                d.rounded_rectangle((x,38,x+58,77),8,fill='#2d6056')
            d.line((105,57,142,57),fill='#2d6056',width=3)
            d.line((199,57,236,57),fill='#2d6056',width=3)
            for i,(width,y) in enumerate([(230,118),(278,146),(200,174),(260,238),(245,266),(180,294)]):
                d.rounded_rectangle((35,y,35+width,y+9),4,fill='#456e5b' if i in (0,3) else '#8eafa0')
            d.ellipse((35,345,60,370),outline='#bd9453',width=3)
            d.line((47,351,47,360),fill='#bd9453',width=3)
            d.ellipse((46,363,48,365),fill='#bd9453')
            d.line((75,357,258,357),fill='#8eafa0',width=8)
        else:
            for i in range(22):
                line=self.raw[i%len(self.raw)][:43]
                d.text((22,35+i*17),line,font=self.font(10,'mono'),fill=GOLD if i%4==0 else '#a7c2b1')
        return im

    def tile(self, im, source, rect, alpha=1, border=None, radius=14):
        x,y,w,h=[round(v) for v in rect]
        if w<2 or h<2 or alpha<=0: return
        tile=source.resize((w,h),Image.Resampling.BICUBIC).convert('RGBA')
        mask=Image.new('L',(w,h)); md=ImageDraw.Draw(mask)
        md.rounded_rectangle((0,0,w-1,h-1),min(radius,w//4,h//4),fill=round(255*clamp(alpha)))
        im.paste(tile,(x,y),mask)
        if border:
            ImageDraw.Draw(im).rounded_rectangle((x,y,x+w,y+h),radius,outline=border,width=3)

    def card(self,im,kind,center,width=180,angle=0,alpha=1):
        src=self.brief if kind=='brief' else self.paper
        tile=src.resize((max(2,round(width)),max(2,round(width*1.25))),Image.Resampling.BICUBIC)
        if angle: tile=tile.rotate(angle,Image.Resampling.BICUBIC,expand=True)
        if alpha<1: tile.putalpha(tile.getchannel('A').point(lambda x:round(x*clamp(alpha))))
        im.paste(tile,(round(center[0]-tile.width/2),round(center[1]-tile.height/2)),tile)

    def cap(self,im,main,sub='',top=''):
        if not self.captions: return
        d=ImageDraw.Draw(im)
        d.rectangle((0,925,W,H),fill=BG)
        self.text(im,(74,950),main,42,WHITE,'bold')
        if sub: self.text(im,(77,1010),sub,23,MINT)
        if top:
            d.rounded_rectangle((55,28,55+int(d.textlength(top,font=self.font(19)))+28,67),9,fill=BG)
            self.text(im,(69,39),top,19,'#b0c6ba')

    def chat(self,im,rect,fill=0,warning=False,accepted=False):
        x,y,w,h=rect; d=ImageDraw.Draw(im)
        col=RED if warning else MINT
        d.rounded_rectangle((x,y,x+w,y+h-40),30,fill='#20332e',outline=col,width=4)
        d.polygon([(x+65,y+h-42),(x+65,y+h+9),(x+127,y+h-42)],fill='#20332e')
        d.line((x+65,y+h-42,x+65,y+h+9,x+127,y+h-42),fill=col,width=4)
        # Person/avatar plus three neutral message marks; no imitation brand UI.
        d.ellipse((x+29,y+28,x+75,y+74),outline=col,width=3)
        d.line((x+96,y+41,x+w-45,y+41),fill='#597767',width=8)
        d.line((x+96,y+63,x+w-110,y+63),fill='#597767',width=6)
        by=y+h-94
        d.rounded_rectangle((x+30,by,x+w-30,by+23),9,fill='#0e1d19',outline='#597767',width=2)
        if fill>0:
            d.rounded_rectangle((x+33,by+3,x+33+(w-66)*clamp(fill),by+20),7,fill=col)
        if warning:
            cx=x+w/2; cy=y+h/2-20
            d.polygon([(cx,cy-52),(cx-57,cy+42),(cx+57,cy+42)],fill=RED)
            d.line((cx,cy-21,cx,cy+7),fill=BG,width=7)
            d.ellipse((cx-4,cy+20,cx+4,cy+28),fill=BG)
        if accepted:
            cx=x+w-67; cy=y+65
            d.ellipse((cx-29,cy-29,cx+29,cy+29),fill=MINT)
            d.line((cx-13,cy,cx-3,cy+10,cx+15,cy-12),fill=BG,width=6)

    def arrow_path(self,im,start,end,p=1,color=MINT):
        if p<=0:return
        d=ImageDraw.Draw(im)
        x,y=lerp(start,end,clamp(p))
        d.line((*start,x,y),fill=color,width=4)
        angle=math.atan2(end[1]-start[1],end[0]-start[0])
        pts=[(x,y),(x-17*math.cos(angle-.5),y-17*math.sin(angle-.5)),
             (x-17*math.cos(angle+.5),y-17*math.sin(angle+.5))]
        d.polygon(pts,fill=color)

    def folder(self,im,x,y,w=160):
        d=ImageDraw.Draw(im);h=w*.68
        d.rounded_rectangle((x,y,x+w*.48,y+h*.35),8,fill='#50735e')
        d.rounded_rectangle((x,y+h*.18,x+w,y+h),10,fill='#345843',outline=MINT,width=3)
        d.line((x+w*.40,y+h*.60,x+w*.49,y+h*.72,x+w*.68,y+h*.43),fill=MINT,width=5)

    def window(self,im,rect,alpha=1):
        x,y,w,h=rect
        if alpha<=0:return
        layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer)
        d.rounded_rectangle((x,y,x+w,y+h),16,fill='#d7eee0',outline=MINT,width=3)
        d.rounded_rectangle((x,y,x+w,y+38),14,fill='#39745e')
        for ix in range(3):d.ellipse((x+15+ix*19,y+13,x+23+ix*19,y+21),fill=MINT)
        d.rounded_rectangle((x+25,y+66,x+w-25,y+83),5,fill='#91b4a1')
        d.rounded_rectangle((x+25,y+103,x+w*.65,y+119),5,fill='#91b4a1')
        d.rounded_rectangle((x+25,y+h-55,x+w*.50,y+h-26),7,fill='#39745e')
        if alpha<1:layer.putalpha(layer.getchannel('A').point(lambda v:round(v*alpha)))
        im.paste(layer,(0,0),layer)

    def overload(self,t):
        im=self.backdrop.copy()
        # Match-cut: full real graph draws back into one persistent source card.
        p=smooth((t-.6)/1.5)
        rect=lerp((0,-40,W,1085),(95,220,710,440),p)
        self.tile(im,self.graph_tile,rect,border=MINT if p>.99 else None)
        arrival=smooth((t-1.3)/.8)
        shake=5*math.sin(t*42)*smooth((t-6.3)/.4) if t<7.7 else 0
        self.chat(im,(mix(2030,1230,arrival)+shake,220,570,500),clamp((t-3)/3.5),t>6.2)
        # The exported text flows from the SAME graph, then overwhelms chat capacity.
        for i in range(17):
            q=(t-2.0-i*.19)/1.65
            if 0<=q<=1:
                xy=bezier((690,420),(900,90+i%3*90),(1130,630),(1450,450),smooth(q))
                self.card(im,'source',xy,180,angle=12*math.sin(q*5+i))
            elif q>1 and t<8.2:
                pos=(1360+(i%4)*74,335+(i//4)*55)
                self.card(im,'source',pos,112,angle=(i%3-1)*7,alpha=.85)
        # Warning renders over the pile. Same layout returns later with a tiny brief.
        if t>6.2:
            d=ImageDraw.Draw(im);x=1690;y=560
            d.ellipse((x-63,y-63,x+63,y+63),fill=RED)
            d.line((x-22,y-22,x+22,y+22),fill=BG,width=10)
            d.line((x-22,y+22,x+22,y-22),fill=BG,width=10)
        self.cap(im,'I accidentally broke Claude.' if t<4.7 else 'Too much raw Blueprint code.',
                 'So I built a way to read it first.' if t>6.6 else '',
                 'Origin-story illustration · real public Blueprint example')
        return im

    def intake(self,t):
        u=t-8
        im=self.backdrop.copy()
        # Genuine app capture expands in place, cursor and typed characters are evidence.
        p=smooth(u/.75)
        if u<3.9:
            shot=self.input[min(len(self.input)-1,int(clamp((u-.5)/2.4)*(len(self.input)-1)))]
        else:
            shot=self.loading[min(len(self.loading)-1,int((u-3.9)/1.45*len(self.loading)))]
        box=(0,50,1280,710)
        crop=shot.crop(box)
        rect=lerp((720,370,480,248),(115,116,1690,871),p)
        self.tile(im,crop,rect,border=MINT)
        if 2.8<u<4.7:
            cp=smooth((u-2.8)/.9)
            loc=lerp((530,337),(460,875),cp)
            self.cursor(im,loc,max(0,1-abs(u-3.9)/.2))
        # Deliberate push to the result, not arbitrary drifting camera.
        if u>5:
            zoom=smooth((u-5)/2)
            crop=shot.transform((W,H),Image.Transform.EXTENT,
                               lerp((-87,-38,1367,780),(415,40,1270,521),zoom),Image.Resampling.BICUBIC)
            im=crop
        self.cap(im,'One link. Read the Blueprint.','blueprintue.com/blueprint/6v52d8no/',
                 'Actual browser captures · timing edited')
        return im

    def distill(self,t):
        u=t-15
        im=self.backdrop.copy()
        # Two paths make the omitted detail explicit visually: full source kept,
        # small derived brief travels onward. No shredding / lossless implication.
        self.tile(im,self.graph_tile,(90,110,610,350),border=MINT)
        for i in range(6): self.card(im,'source',(280+i*19,625+i*10),205,angle=0)
        self.folder(im,90,754,165)
        if u<3:
            for i in range(8):
                p=clamp((u-.15*i)/1.7)
                if 0<p<1:
                    xy=bezier((495,640),(740,650),(840,350),(1020,470),p)
                    self.card(im,'source',xy,mix(120,48,p),angle=mix(-6,0,p))
        # Reader aperture: graph-like pins stay connected as layers settle together.
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((825,285,1095,645),28,fill='#244738',outline=MINT,width=4)
        for y in (355,465,575):
            d.ellipse((845,y-11,867,y+11),fill=GOLD)
            d.line((869,y,933,465,1065,465),fill=MINT,width=3)
        d.ellipse((1053,453,1077,477),fill=MINT)
        scan=clamp(u/2.7)
        d.line((842,310+310*scan,1077,310+310*scan),fill=WHITE,width=4)
        self.arrow_path(im,(1120,465),(1295,465),smooth((u-1.5)/1.1))
        # Brief grows from the real output location; code excerpt is never swapped for
        # a fabricated app answer. The paper pictogram leads into the real brief crop.
        p=smooth((u-2)/1.4)
        self.card(im,'brief',(1450,475),mix(16,270,p),alpha=p)
        if u>3.4:
            q=smooth((u-3.4)/.6)
            self.tile(im,self.actual_brief,(1205,650,590,178),alpha=q,border=None)
        if self.captions:
            self.text(im,(847,225),'READER',32,MINT,'bold')
            self.text(im,(280,847),'Full source retained',26,'#99b4a5')
            self.text(im,(1285,847),'Compact brief',26,MINT)
        self.cap(im,'Keep the source. Share the brief.','81,358 source bytes → 1,336 brief bytes · summary omits detail',
                 'Visual explanation · real brief below · parsing runs locally')
        return im

    def copy_brief(self,t):
        u=t-19
        im=self.backdrop.copy()
        shot=self.shots['reader-copied' if u>1 else 'reader-brief']
        tile=shot.crop((440,320,1245,719))
        p=smooth((u-1.8)/.7)
        rect=lerp((310,150,1300,645),(830,407,180,225),p)
        self.tile(im,tile,rect,alpha=1-p,border=MINT if p==0 else None)
        self.card(im,'brief',(920,520),mix(270,245,p),alpha=p)
        if u<1.65:
            self.cursor(im,(400,300),max(0,1-abs(u-1)/.2))
        self.cap(im,'Copy the brief.','The real output, ready for your conversation.',
                 'Actual brief and Copied state · editorial transition')
        return im

    def handoff(self,t):
        u=t-21.5
        im=self.backdrop.copy()
        self.tile(im,self.graph_tile,(90,180,610,350),border=MINT)
        self.folder(im,140,600,175)
        self.chat(im,(1230,220,570,500),.13,u<0,accepted=u>1.9)
        p=smooth((u-.25)/1.45)
        xy=bezier((920,520),(1030,260),(1450,270),(1450,480),p)
        self.card(im,'brief',xy,mix(245,125,p))
        if u<1.8: self.cursor(im,(xy[0]+55,xy[1]+100),0)
        # Compared with the earlier identical chat, a small page leaves plenty of room.
        self.cap(im,'A useful starting point for Codex or Claude.','Copy the brief into your own conversation.',
                 'Illustrative handoff · the reader makes no AI calls')
        return im

    def explain(self,t):
        u=t-24
        im=self.backdrop.copy()
        # Actual connected node strip stays in frame while the pictorial explanation
        # progresses above it; the same mini-window survives create/store/display.
        self.tile(im,self.chain,(190,550,1540,407),radius=10)
        stages=[smooth((u-.3)/1.2),smooth((u-3.2)/1.3),smooth((u-6.2)/1.4)]
        active=0 if u<3.2 else 1 if u<6.2 else 2
        node_x=[550,1105,1510]
        # A magnifier (inspection), never traveling execution pulses on the wires.
        mx=mix(550,1105,smooth((u-2.6)/1.0)) if u<6 else mix(1105,1510,smooth((u-6)/1))
        # Magnify the actual pixels under the inspection lens.
        lens=im.crop((round(mx-64),681,round(mx+64),809)).resize((180,180),Image.Resampling.BICUBIC)
        mask=Image.new('L',(180,180));ImageDraw.Draw(mask).ellipse((0,0,179,179),fill=255)
        im.paste(lens,(round(mx-90),655),mask)
        d=ImageDraw.Draw(im)
        d.ellipse((mx-90,655,mx+90,835),outline=GOLD,width=5)
        d.line((mx+64,809,mx+114,861),fill=GOLD,width=12)
        # Window creates itself panel-by-panel.
        p=stages[0]
        self.window(im,(270,150,300,245),p)
        if p>.01:
            d.line((420,425,420,555),fill=MINT,width=2)
        # Store pictogram: same panel moves down into an open tray/variable box.
        d.line((780,403,1020,403,1020,485,780,485,780,403),fill='#789b89',width=5)
        if stages[1]>0:
            sp=stages[1]
            xy=bezier((420,260),(550,60),(900,70),(900,391),sp)
            self.window(im,(xy[0]-90,xy[1]-72,180,145),sp)
            d=ImageDraw.Draw(im)
            d.rounded_rectangle((780,419,1020,485),9,fill='#345843',outline=MINT,width=3)
            d.rounded_rectangle((869,439,931,454),5,fill=MINT)
        # Display pictogram: one screen receives the SAME stored panel.
        d.rounded_rectangle((1270,115,1730,425),18,outline='#789b89',width=5)
        d.line((1500,425,1500,485,1380,485,1620,485),fill='#789b89',width=6)
        if stages[2]>0:
            sp=stages[2]
            xy=bezier((900,390),(1050,130),(1320,120),(1500,270),sp)
            self.window(im,(xy[0]-mix(90,166,sp),xy[1]-mix(72,115,sp),mix(180,332,sp),mix(145,230,sp)),1)
        # Visual links connect explanatory icons to their actual source nodes.
        for i,p in enumerate(stages):
            if p>0:
                d.line((node_x[i],568,node_x[i],535),fill=MINT,width=3)
        if self.captions:
            for x,label in [(340,'Create'),(850,'Store'),(1440,'Display')]:
                self.text(im,(x,62),label,32,MINT,'bold')
        self.cap(im,'Follow the connection. Understand the intent.',
                 'Create UI_HIRED → Hired → AddToViewport',
                 'Static wiring · conceptual widget illustration, not gameplay')
        return im

    def inspect(self,t):
        u=t-34
        im=self.backdrop.copy()
        self.tile(im,self.graph_tile,(80,180,760,440),border=MINT)
        self.folder(im,150,690,155)
        self.chat(im,(1260,180,560,570),.24,accepted=True)
        self.card(im,'brief',(1400,340),135)
        p=smooth((u-.4)/2.0)
        xy=bezier((530,430),(720,200),(1190,220),(1515,560),p)
        ww=mix(420,400,p)
        self.tile(im,self.chain,(xy[0]-ww/2,xy[1]-ww*.264/2,ww,ww*.264),border=GOLD)
        if u<2.5:
            d=ImageDraw.Draw(im)
            d.ellipse((xy[0]-110,xy[1]-110,xy[0]+110,xy[1]+110),outline=GOLD,width=4)
            d.line((xy[0]+77,xy[1]+77,xy[0]+135,xy[1]+135),fill=GOLD,width=11)
        self.cap(im,'Go deeper with just the nodes you need.','The original graph stays available.',
                 'Illustrative follow-up · source pixels from the real graph')
        return im

    def outro(self,t):
        u=t-38
        im=self.backdrop.copy()
        # Story recap remains visual: source -> reader -> small brief, all present.
        self.tile(im,self.graph_tile,(135,220,640,365),border=MINT)
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((905,260,1075,545),26,fill='#244738',outline=MINT,width=3)
        for y in (325,405,485):
            d.ellipse((928,y-8,944,y+8),fill=GOLD)
            d.line((946,y,990,405,1050,405),fill=MINT,width=3)
        self.arrow_path(im,(790,405),(880,405))
        self.arrow_path(im,(1100,405),(1285,405))
        self.card(im,'brief',(1450,400),250)
        # Soft repeating packet follows one direction, with an intentional rest.
        p=(u%2.7)/2.7
        if p<.8:
            self.card(im,'source' if p<.5 else 'brief',(mix(790,1315,p),405),mix(50,35,p))
        self.folder(im,150,640,135)
        if self.captions:
            self.text(im,(130,64),'Blueprint Reader.',88,WHITE,'serif')
            self.text(im,(400,747),'ibrews.github.io/ue5-mcp/',58,MINT,'bold')
            self.text(im,(600,842),'Free · MIT · In your browser',34,WHITE)
            self.text(im,(740,991),'ALEX COULOMBE PRESENTS',23,'#99b4a5','bold')
        return im

    def frame(self,t):
        scenes=[(0,self.overload),(8,self.intake),(15,self.distill),(19,self.copy_brief),(21.5,self.handoff),
                (24,self.explain),(34,self.inspect),(38,self.outro)]
        for i in range(len(scenes)-1,-1,-1):
            start,func=scenes[i]
            if t>=start:
                im=func(t)
                # Short visual overlap maintains object continuity at semantic edits.
                if i>0 and t-start<.24:
                    prev=scenes[i-1][1](start-.001)
                    im=Image.blend(prev,im,smooth((t-start)/.24))
                return im


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--font-dir',type=Path,default=Path('/System/Library/Fonts/Supplemental'))
    ap.add_argument('--work',type=Path,default=ROOT/'skills/blueprint-reader/work/trailer/visual')
    ap.add_argument('--preview-only',action='store_true')
    ap.add_argument('--no-captions',action='store_true')
    ap.add_argument('--review-fps',type=int,default=FPS)
    args=ap.parse_args();args.work.mkdir(parents=True,exist_ok=True)
    design=Visual(args.font_dir,not args.no_captions)
    times=[1,3.5,6.8,9.8,13.7,16.3,18.8,20.4,23.5,25.9,29,32.3,36.5,40]
    sheet=Image.new('RGB',(1440,405*7),BG)
    for i,t in enumerate(times):
        frame=design.frame(t);frame.save(args.work/f'frame-{t:g}.jpg',quality=94)
        sheet.paste(frame.resize((720,405)),((i%2)*720,(i//2)*405))
    sheet.save(args.work/'contact-sheet.jpg',quality=92)
    if args.preview_only:return
    soundtrack(args.work/'original-score.wav')
    video=args.work/'silent.mp4'
    fps=args.review_fps
    cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080',
         '-r',str(fps),'-i','-','-an','-c:v','libx264','-threads','2','-preset','fast',
         '-crf','21','-pix_fmt','yuv420p','-g',str(fps*2),'-video_track_timescale','30000',str(video)]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
        for i in range(DURATION*fps):
            proc.stdin.write(design.frame(i/fps).tobytes())
            if i%(5*fps)==0:print(f'Rendered {i/fps:g}/42s',flush=True)
        proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError('Video encoding failed')
    target=args.work/'visual-review.mp4' if args.no_captions or fps!=FPS else ROOT/'docs/assets/blueprint-reader-trailer.mp4'
    run(['ffmpeg','-y','-v','error','-i',str(video),'-i',str(args.work/'original-score.wav'),
         '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-ar','48000',
         '-af','loudnorm=I=-21:TP=-2:LRA=8','-t','42','-movflags','+faststart',
         '-metadata','title=Blueprint Reader — From overload to understanding',
         '-metadata','artist=Alex Coulombe Presents',str(target)])
    if not args.no_captions and fps==FPS:
        poster=design.outro(39)
        design.text(poster,(550,903),'▶  WATCH THE 42-SECOND TRAILER',28,WHITE,'bold')
        poster.save(ROOT/'docs/assets/blueprint-reader-trailer-poster.jpg',quality=94,subsampling=0)
    print(f'Visual cut complete: {target}',flush=True)


if __name__=='__main__':main()
