"""Edit 3 realistic clips (from Google Flow / Veo) into a finished 9:16 promo for Mahsa Mosavi Nail Salon.

Usage:
    python3 assemble.py clip1.mp4 clip2.mp4 clip3.mp4 [--music music.mp3] [--out final.mp4]

Each clip: crop/scale to 1080x1920, 30fps, Persian caption, 0.4s crossfade between clips,
then a branded end card. Clip audio is kept (lowered when music is given).
"""
import argparse, json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "..", "pati-video", "fonts", "Vazirmatn-Black.ttf")
W, H, FPS, XF = 1080, 1920, 30, 0.4
END_DUR = 2.6

CAPTIONS = [
    "یه لحظه فقط برای خودت...",
    "ظرافت تو جزئیات",
    "همه نگاه‌ها به توئه",
]
SALON = "سالن مهسا موسوی"
HANDLE = "@mahsa.mosavi.nail"
CTA = "همین امروز نوبت بگیر"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed:\n" + " ".join(cmd) + "\n" + r.stderr[-2000:])
    return r.stdout


def probe(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", path])
    j = json.loads(out)
    return float(j["format"]["duration"]), any(s["codec_type"] == "audio" for s in j["streams"])


def text_img(text, size, fill=(255, 255, 255, 255), stroke=(60, 10, 45, 255), sw=None, shadow=True):
    f = ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.RAQM)
    rtl = any("؀" <= c <= "ۿ" for c in text)
    kw = dict(direction="rtl", language="fa") if rtl else {}
    sw = sw if sw is not None else max(5, size // 9)
    bb = ImageDraw.Draw(Image.new("RGBA", (4, 4))).textbbox((0, 0), text, font=f, stroke_width=sw, **kw)
    pad = 24
    img = Image.new("RGBA", (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    o = (pad - bb[0], pad - bb[1])
    if shadow:
        d.text((o[0], o[1] + 7), text, font=f, fill=(0, 0, 0, 110), stroke_width=sw, stroke_fill=(0, 0, 0, 110), **kw)
    d.text(o, text, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke, **kw)
    return img


def caption_png(text, path):
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    t = text_img(text, 84)
    canvas.alpha_composite(t, ((W - t.width) // 2, 230))
    canvas.save(path)


def end_card(path):
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):  # soft pink vertical gradient
        k = y / H
        c = (int(255 - 20 * k), int(214 - 70 * k), int(228 - 50 * k))
        for x in range(W):
            px[x, y] = c
    img = img.convert("RGBA")
    for text, size, y, fill in [(SALON, 104, 700, (255, 255, 255, 255)), (CTA, 76, 900, (255, 236, 120, 255)),
                                (HANDLE, 64, 1060, (255, 255, 255, 255))]:
        t = text_img(text, size, fill=fill, stroke=(150, 30, 90, 255))
        img.alpha_composite(t, ((W - t.width) // 2, y))
    img.convert("RGB").save(path)


def normalize(src, dst, dur=None, cap=None):
    """Scale/crop to 1080x1920@30, guarantee a stereo audio track, burn in an optional caption with fades."""
    d, has_a = probe(src) if dur is None else (dur, False)
    is_img = src.lower().endswith(".png")
    cmd = ["ffmpeg", "-y", "-v", "error"]
    cmd += (["-loop", "1", "-t", str(dur), "-i", src] if is_img else ["-i", src])
    cmd += ["-f", "lavfi", "-t", str(d), "-i", "anullsrc=r=48000:cl=stereo"]
    vf = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1,format=yuv420p")
    if cap:
        cmd += ["-loop", "1", "-t", str(d), "-i", cap]
        vf += (f"[base];[2:v]format=rgba,fade=t=in:st=0.35:d=0.35:alpha=1,"
               f"fade=t=out:st={max(0.8, d - 0.8)}:d=0.35:alpha=1[c];[base][c]overlay=0:0:format=auto,format=yuv420p")
    vf += "[v]"
    a = "[0:a]" if has_a else "[1:a]"
    af = f"{a}aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:{d}[a]"
    cmd += ["-filter_complex", vf + ";" + af, "-map", "[v]", "-map", "[a]", "-t", str(d),
            "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-c:a", "aac", "-b:a", "192k", dst]
    run(cmd)
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clips", nargs="+")
    ap.add_argument("--music")
    ap.add_argument("--out", default=os.path.join(HERE, "final.mp4"))
    a = ap.parse_args()
    tmp = tempfile.mkdtemp()
    parts, durs = [], []
    for i, c in enumerate(a.clips):
        cap = os.path.join(tmp, f"cap{i}.png")
        caption_png(CAPTIONS[i % len(CAPTIONS)], cap)
        p = os.path.join(tmp, f"p{i}.mp4")
        durs.append(normalize(c, p, cap=cap)); parts.append(p)
    ec = os.path.join(tmp, "end.png"); end_card(ec)
    p = os.path.join(tmp, "end.mp4")
    durs.append(normalize(ec, p, dur=END_DUR)); parts.append(p)

    cmd = ["ffmpeg", "-y", "-v", "error"]
    for p in parts: cmd += ["-i", p]
    fc, vlast, alast, off = [], "[0:v]", "[0:a]", 0.0
    for i in range(1, len(parts)):
        off += durs[i - 1] - XF
        fc.append(f"{vlast}[{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[v{i}]")
        fc.append(f"{alast}[{i}:a]acrossfade=d={XF}[a{i}]")
        vlast, alast = f"[v{i}]", f"[a{i}]"
    total = sum(durs) - XF * (len(parts) - 1)
    if a.music:
        cmd += ["-i", a.music]
        m = len(parts)
        fc.append(f"{alast}volume=0.55[ca];[{m}:a]volume=0.8,atrim=0:{total},afade=t=out:st={total - 1.5}:d=1.5[ma];"
                  f"[ca][ma]amix=inputs=2:duration=first:normalize=0[af]")
        alast = "[af]"
    cmd += ["-filter_complex", ";".join(fc), "-map", vlast, "-map", alast, "-c:v", "libx264", "-crf", "18",
            "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", a.out]
    run(cmd)
    print(f"done: {a.out}  ({total:.1f}s)")


if __name__ == "__main__":
    main()
