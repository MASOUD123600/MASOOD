"""Pati - a cute cartoon nail-art short. Renders video frames with Cairo, captions with PIL (raqm), audio with numpy."""
import cairo, math, random, sys, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 30.0
HERE = sys.path[0]
FONT = HERE + "/fonts/Vazirmatn-Black.ttf"
PI = math.pi

# ---------------------------------------------------------------- helpers
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def prog(t, a, b): return clamp((t - a) / (b - a))
def ease(x): return x * x * (3 - 2 * x)
def back(x, s=1.9):
    x -= 1
    return x * x * ((s + 1) * x + s) + 1
def lerp(a, b, x): return a + (b - a) * x

OUT = (0.30, 0.13, 0.22)
SKIN = (1.0, 0.86, 0.77)
SKIN_D = (0.98, 0.70, 0.60)
DARK = (0.18, 0.08, 0.14)

def ellipse(ctx, x, y, rx, ry):
    ctx.save(); ctx.translate(x, y); ctx.scale(max(rx, 0.01), max(ry, 0.01))
    ctx.arc(0, 0, 1, 0, 2 * PI); ctx.restore()

def fs(ctx, fill, lw=7, stroke=OUT, a=1.0):
    ctx.set_source_rgba(*fill, a); ctx.fill_preserve()
    ctx.set_source_rgba(*stroke, a); ctx.set_line_width(lw); ctx.stroke()

def heart(ctx, x, y, s):
    ctx.move_to(x, y + s * 0.9)
    ctx.curve_to(x - s * 1.7, y - s * 0.1, x - s * 0.8, y - s * 1.4, x, y - s * 0.45)
    ctx.curve_to(x + s * 0.8, y - s * 1.4, x + s * 1.7, y - s * 0.1, x, y + s * 0.9)
    ctx.close_path()

def star(ctx, x, y, r, n=5, inner=0.45, rot=0.0):
    for i in range(n * 2):
        rr = r if i % 2 == 0 else r * inner
        a = rot - PI / 2 + i * PI / n
        (ctx.move_to if i == 0 else ctx.line_to)(x + rr * math.cos(a), y + rr * math.sin(a))
    ctx.close_path()

def sparkle(ctx, x, y, r, a=1.0, col=(1, 1, 1)):
    if r <= 0.5: return
    star(ctx, x, y, r, 4, 0.22)
    ctx.set_source_rgba(*col, a); ctx.fill()

def vgrad(ctx, c1, c2, y0=0, y1=H):
    g = cairo.LinearGradient(0, y0, 0, y1)
    g.add_color_stop_rgb(0, *c1); g.add_color_stop_rgb(1, *c2)
    ctx.rectangle(0, 0, W, H); ctx.set_source(g); ctx.fill()

def rrect(ctx, x, y, w, h, r):
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -PI / 2, 0); ctx.arc(x + w - r, y + h - r, r, 0, PI / 2)
    ctx.arc(x + r, y + h - r, r, PI / 2, PI); ctx.arc(x + r, y + r, r, PI, 1.5 * PI)
    ctx.close_path()

# ---------------------------------------------------------------- the foot "Pati"
def body_path(ctx):
    ctx.move_to(0, 270)
    ctx.curve_to(-150, 272, -188, 130, -180, -10)
    ctx.curve_to(-172, -130, -100, -175, 0, -170)
    ctx.curve_to(100, -168, 178, -120, 182, -10)
    ctx.curve_to(186, 130, 150, 268, 0, 270)
    ctx.close_path()

_s = cairo.ImageSurface(cairo.FORMAT_ARGB32, 4, 4); _c = cairo.Context(_s); body_path(_c)
_PTS = [p for typ, p in _c.copy_path_flat() if p]
def top_y(x):
    best = 1e9
    for (x1, y1), (x2, y2) in zip(_PTS, _PTS[1:]):
        if min(x1, x2) <= x <= max(x1, x2) and x1 != x2:
            best = min(best, y1 + (y2 - y1) * (x - x1) / (x2 - x1))
    return best

TOES = [(x, top_y(x) - r * 0.62, r) for x, r in [(-108, 62), (-22, 46), (48, 41), (106, 36), (150, 30)]]
DECO = ["heart", "star", "gem", "star", "heart"]

def toe_world(i, x, y, s):
    tx, ty, r = TOES[i]
    return x + tx * s, y + (ty - r * 0.38 - 270) * s

def eye_oval(ctx, x, y, blink, sc=1.0):
    ellipse(ctx, x, y, 22 * sc, 30 * sc * blink); ctx.set_source_rgb(*DARK); ctx.fill()
    if blink > 0.4:
        ellipse(ctx, x - 7 * sc, y - 11 * sc, 8 * sc, 10 * sc * blink); ctx.set_source_rgb(1, 1, 1); ctx.fill()
        ellipse(ctx, x + 7 * sc, y + 10 * sc, 3.5 * sc, 3.5 * sc * blink); ctx.fill()

def eye_arc(ctx, x, y):
    ctx.new_sub_path(); ctx.arc(x, y + 14, 22, PI * 1.12, PI * 1.88)
    ctx.set_source_rgb(*DARK); ctx.set_line_width(9); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()

def open_mouth(ctx, y, w, h):
    ctx.move_to(-w, y); ctx.curve_to(-w * 0.9, y + h, w * 0.9, y + h, w, y)
    ctx.curve_to(w * 0.4, y + 8, -w * 0.4, y + 8, -w, y); ctx.close_path()
    ctx.set_source_rgb(0.55, 0.1, 0.22); ctx.fill_preserve()
    ctx.save(); ctx.clip_preserve(); ctx.new_path()
    ellipse(ctx, 0, y + h * 0.78, w * 0.55, h * 0.35); ctx.set_source_rgb(1, 0.5, 0.6); ctx.fill()
    ctx.restore()
    ctx.set_source_rgb(*OUT); ctx.set_line_width(6); ctx.stroke()

def draw_nail(ctx, i, tx, ty, r, p, deco, t):
    nx, ny, nrx, nry = tx, ty - r * 0.38, r * 0.56, r * 0.5
    ellipse(ctx, nx, ny, nrx, nry); fs(ctx, (0.93, 0.86, 0.80), 4.5)
    if p > 0:
        ctx.save(); ellipse(ctx, nx, ny, nrx, nry); ctx.clip()
        top = ny + nry - p * 2 * nry
        g = cairo.LinearGradient(0, ny - nry, 0, ny + nry)
        g.add_color_stop_rgb(0, 1, 0.45, 0.70); g.add_color_stop_rgb(1, 0.90, 0.16, 0.48)
        ctx.rectangle(nx - nrx, top, 2 * nrx, ny + nry - top + 1); ctx.set_source(g); ctx.fill()
        ctx.restore()
        ellipse(ctx, nx, ny, nrx, nry); ctx.set_source_rgb(*OUT); ctx.set_line_width(4.5); ctx.stroke()
        if p >= 1:
            ellipse(ctx, nx - nrx * 0.38, ny - nry * 0.32, nrx * 0.17, nry * 0.32)
            ctx.set_source_rgba(1, 1, 1, 0.85); ctx.fill()
    dp = back(prog(deco, i * 0.13, i * 0.13 + 0.35)) if deco > 0 else 0
    if dp > 0:
        k = DECO[i]; ds = r * 0.2 * dp; dx, dy = nx + nrx * 0.15, ny + nry * 0.15
        if k == "heart":
            heart(ctx, dx, dy, ds); fs(ctx, (1, 1, 1), 2.5)
        elif k == "star":
            star(ctx, dx, dy, ds * 1.5, 5, 0.45, math.sin(t * 3 + i) * 0.3); fs(ctx, (1, 0.85, 0.2), 2.5)
        else:
            ctx.move_to(dx, dy - ds * 1.4); ctx.line_to(dx + ds, dy); ctx.line_to(dx, dy + ds * 1.4); ctx.line_to(dx - ds, dy)
            ctx.close_path(); fs(ctx, (0.45, 0.92, 1.0), 2.5)
        tw = 0.5 + 0.5 * math.sin(t * 9 + i * 2)
        sparkle(ctx, dx + r * 0.45, dy - r * 0.55, r * 0.22 * tw * dp)

def draw_foot(ctx, x, y, s, t, mood="happy", nails=None, deco=0.0, squash=0.0, rot=0.0, wiggle=1.0, look=0.0):
    nails = nails or [0] * 5
    if s < 0.02: return
    ctx.save(); ctx.translate(x, y)
    ctx.save(); ctx.scale(s, s); ellipse(ctx, 0, 6, 200 * (1 + squash * 0.4), 30)
    ctx.set_source_rgba(0.25, 0.0, 0.2, 0.18); ctx.fill(); ctx.restore()
    ctx.rotate(rot)
    ctx.scale(s * (1 + squash * 0.16), s * (1 - squash * 0.16))
    ctx.translate(0, -270)
    happyish = mood != "sad"
    for i in reversed(range(5)):
        tx, ty, r = TOES[i]
        ty += math.sin(t * 7 + i * 1.3) * 4 * wiggle
        ellipse(ctx, tx, ty, r, r * 1.08); fs(ctx, SKIN, 7)
        draw_nail(ctx, i, tx, ty, r, nails[i], deco, t)
        ex, ey = r * 0.24, ty + r * 0.14
        for sx in (-1, 1):
            ellipse(ctx, tx + sx * ex, ey, r * 0.07 + 1.5, r * 0.09 + 1.5); ctx.set_source_rgb(*DARK); ctx.fill()
        ctx.new_sub_path()
        if happyish and (nails[i] >= 1 or mood in ("joy", "star", "wink")):
            ctx.arc(tx, ey + r * 0.05, r * 0.16, 0.15 * PI, 0.85 * PI)
        elif happyish:
            ctx.move_to(tx - r * 0.1, ey + r * 0.22); ctx.line_to(tx + r * 0.1, ey + r * 0.22)
        else:
            ctx.arc(tx, ey + r * 0.36, r * 0.13, 1.2 * PI, 1.8 * PI)
        ctx.set_source_rgb(*DARK); ctx.set_line_width(3); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
    # body
    body_path(ctx)
    g = cairo.RadialGradient(-50, -10, 30, 0, 40, 330)
    g.add_color_stop_rgb(0, 1, 0.91, 0.84); g.add_color_stop_rgb(1, *SKIN_D)
    ctx.set_source(g); ctx.fill_preserve(); ctx.set_source_rgb(*OUT); ctx.set_line_width(8); ctx.stroke()
    # face
    ph = (t + 0.37) % 3.1
    blink = max(0.08, abs(ph - 0.07) / 0.07) if ph < 0.14 else 1.0
    lx = look * 12; ex, ey = 68, 30
    for sx in (-1, 1):
        ellipse(ctx, sx * 118, 92, 34, 20)
        ctx.set_source_rgba(1, 0.45, 0.55, 0.55 if happyish else 0.3); ctx.fill()
    if mood == "sad":
        for sx in (-1, 1):
            eye_oval(ctx, sx * ex + lx, ey + 14, blink, 0.85)
            ctx.move_to(sx * (ex + 30) + lx, ey - 22); ctx.line_to(sx * (ex - 18) + lx, ey - 42)
            ctx.set_source_rgb(*DARK); ctx.set_line_width(8); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
        ctx.new_sub_path(); ctx.arc(0, 140, 26, PI * 1.18, PI * 1.82)
        ctx.set_source_rgb(*DARK); ctx.set_line_width(8); ctx.stroke()
        ty_ = ey + 45 + (t * 90) % 110
        a = 1 - ((t * 90) % 110) / 110
        ctx.move_to(-ex - 14, ty_ - 22); ctx.curve_to(-ex - 4, ty_ - 6, -ex + 2, ty_ + 10, -ex - 14, ty_ + 10)
        ctx.curve_to(-ex - 30, ty_ + 10, -ex - 24, ty_ - 6, -ex - 14, ty_ - 22)
        ctx.set_source_rgba(0.45, 0.75, 1, 0.9 * a); ctx.fill()
    else:
        for sx in (-1, 1):
            exx = sx * ex + lx
            if mood == "joy" or (mood == "wink" and sx == 1):
                eye_arc(ctx, exx, ey)
            elif mood == "star":
                star(ctx, exx, ey, 34, 5, 0.5, math.sin(t * 5) * 0.25); fs(ctx, (1, 0.84, 0.2), 5)
                sparkle(ctx, exx + 14, ey - 10, 9)
            else:
                eye_oval(ctx, exx, ey, blink)
        big = mood in ("joy", "star")
        open_mouth(ctx, 92, 44 if big else 36, 62 if big else 48)
    ctx.restore()

# ---------------------------------------------------------------- props
def cloud(ctx, x, y, s, col=(0.62, 0.66, 0.76)):
    circles = [(-150, 20, 80), (-60, -30, 105), (60, -40, 115), (160, 15, 85), (0, 40, 95)]
    for cx, cy, r in circles:
        ctx.new_sub_path(); ctx.arc(x + cx * s, y + cy * s, r * s, 0, 2 * PI)
    ctx.set_source_rgb(*OUT); ctx.set_line_width(16); ctx.stroke()
    for cx, cy, r in circles:
        ctx.new_sub_path(); ctx.arc(x + cx * s, y + cy * s, r * s, 0, 2 * PI)
    ctx.set_source_rgb(*col); ctx.fill()

def draw_blob(ctx, x, y, r, col, t, love, look):
    ctx.save(); ctx.translate(x, y)
    for sx in (-1, 1):
        ellipse(ctx, sx * r * 0.42, r * 1.0, r * 0.26, r * 0.13); fs(ctx, col, 6)
    ellipse(ctx, 0, 0, r, r * 1.05); fs(ctx, col, 7)
    ellipse(ctx, -r * 0.35, -r * 0.5, r * 0.22, r * 0.12); ctx.set_source_rgba(1, 1, 1, 0.5); ctx.fill()
    lx = look * r * 0.1
    if love:
        hs = r * 0.19 * (1 + 0.18 * math.sin(t * 14))
        for sx in (-1, 1):
            heart(ctx, sx * r * 0.33 + lx, -r * 0.1, hs); fs(ctx, (1, 0.2, 0.42), 4)
            ellipse(ctx, sx * r * 0.58, r * 0.22, r * 0.16, r * 0.09); ctx.set_source_rgba(1, 0.4, 0.55, 0.6); ctx.fill()
        ellipse(ctx, lx, r * 0.38, r * 0.15, r * 0.2); fs(ctx, (0.55, 0.1, 0.22), 5)
    else:
        for sx in (-1, 1):
            ellipse(ctx, sx * r * 0.3 + lx, -r * 0.12, r * 0.08, r * 0.11); ctx.set_source_rgb(*DARK); ctx.fill()
        ctx.new_sub_path(); ctx.arc(lx, r * 0.18, r * 0.16, 0.2 * PI, 0.8 * PI)
        ctx.set_source_rgb(*DARK); ctx.set_line_width(5); ctx.stroke()
    ctx.restore()

def bottle(ctx, x, y):
    rrect(ctx, x - 70, y - 120, 140, 150, 40); fs(ctx, (1, 0.35, 0.62), 8)
    rrect(ctx, x - 48, y - 105, 22, 90, 11); ctx.set_source_rgba(1, 1, 1, 0.55); ctx.fill()
    rrect(ctx, x - 32, y - 290, 64, 175, 16); fs(ctx, (0.25, 0.12, 0.2), 8)

def brush(ctx, x, y):
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.55)
    rrect(ctx, -14, -330, 28, 300, 12); fs(ctx, (0.25, 0.12, 0.2), 6)
    ctx.move_to(-14, -40); ctx.line_to(14, -40); ctx.line_to(8, 6); ctx.curve_to(4, 14, -4, 14, -8, 6); ctx.close_path()
    fs(ctx, (1, 0.3, 0.6), 5)
    ctx.restore()

# ---------------------------------------------------------------- scenes
RNG = random.Random(7)
RAIN = [(RNG.uniform(260, 820), RNG.uniform(0, 900)) for _ in range(40)]

def scene1(ctx, t):
    vgrad(ctx, (0.60, 0.66, 0.80), (0.40, 0.44, 0.60))
    ctx.rectangle(0, 1500, W, 420); ctx.set_source_rgb(0.33, 0.36, 0.5); ctx.fill()
    for i in range(6):
        ellipse(ctx, 140 + i * 170, 1640 + (i % 2) * 120, 90, 16); ctx.set_source_rgba(0.55, 0.7, 0.9, 0.35); ctx.fill()
    for rx, ry in RAIN:
        yy = 700 + (ry + t * 1100) % 800
        ctx.move_to(rx, yy); ctx.line_to(rx - 8, yy + 45)
        ctx.set_source_rgba(0.75, 0.88, 1, 0.8); ctx.set_line_width(6); ctx.set_line_cap(cairo.LINE_CAP_ROUND); ctx.stroke()
    droop = 0.12 * ease(prog(t, 2.4, 3.6))
    draw_foot(ctx, 540, 1520, 1.25, t, "sad", squash=droop + 0.03 * math.sin(t * 3), rot=0.04 * math.sin(t * 1.7), wiggle=0.4, look=-0.4)
    cloud(ctx, 540 + 20 * math.sin(t * 1.3), 640, 1.15)

def scene2(ctx, t):
    vgrad(ctx, (0.62, 0.86, 1.0), (1.0, 0.86, 0.88), 0, 1500)
    # sun
    ctx.save(); ctx.translate(170, 330); ctx.rotate(t * 0.6)
    for i in range(10):
        ctx.save(); ctx.rotate(i * PI / 5); rrect(ctx, 105, -14, 70, 28, 14); fs(ctx, (1, 0.8, 0.25), 6); ctx.restore()
    ctx.restore()
    ellipse(ctx, 170, 330, 90, 90); fs(ctx, (1, 0.88, 0.3), 8)
    # building
    ctx.rectangle(110, 660, 860, 920); fs(ctx, (1, 0.80, 0.87), 10)
    rrect(ctx, 210, 700, 660, 150, 40); fs(ctx, (1, 1, 1), 10)
    for i in range(14):
        a = t * 4 + i
        sparkle(ctx, 230 + i * 48, 700 + (i % 2) * 150, 14 + 8 * math.sin(a), 0.9, (1, 0.5, 0.75))
    # awning
    for i in range(12):
        x0 = 110 + i * (860 / 12)
        ctx.rectangle(x0, 890, 860 / 12, 100)
        ctx.set_source_rgb(*((1, 0.4, 0.65) if i % 2 == 0 else (1, 1, 1))); ctx.fill()
        ctx.new_sub_path(); ctx.arc(x0 + 860 / 24, 990, 860 / 24, 0, PI)
        ctx.set_source_rgb(*((1, 0.4, 0.65) if i % 2 == 0 else (1, 1, 1))); ctx.fill()
    ctx.rectangle(110, 890, 860, 100); ctx.set_source_rgb(*OUT); ctx.set_line_width(8); ctx.stroke()
    # window
    ctx.rectangle(170, 1080, 360, 360); fs(ctx, (0.75, 0.92, 1.0), 10)
    cols = [(1, 0.35, 0.6), (0.7, 0.5, 1), (1, 0.7, 0.3), (0.4, 0.85, 0.75), (1, 0.45, 0.45)]
    for i, c in enumerate(cols):
        bx = 210 + i * 66
        rrect(ctx, bx, 1320, 44, 70, 12); fs(ctx, c, 5); rrect(ctx, bx + 12, 1270, 20, 52, 6); fs(ctx, (0.25, 0.12, 0.2), 5)
    ctx.move_to(200, 1200); ctx.line_to(300, 1100); ctx.set_source_rgba(1, 1, 1, 0.7); ctx.set_line_width(14); ctx.stroke()
    # door
    op = prog(t, 7.3, 7.7)
    ctx.move_to(620, 1580); ctx.line_to(620, 1180); ctx.arc(750, 1180, 130, PI, 2 * PI); ctx.line_to(880, 1580); ctx.close_path()
    if op > 0:
        g = cairo.RadialGradient(750, 1400, 20, 750, 1400, 260)
        g.add_color_stop_rgb(0, 1, 0.97, 0.7); g.add_color_stop_rgb(1, 1, 0.75, 0.4)
        ctx.set_source(g); ctx.fill_preserve(); ctx.set_source_rgb(*OUT); ctx.set_line_width(10); ctx.stroke()
        ctx.move_to(620, 1580); ctx.line_to(620, 1180); ctx.line_to(620 + 260 * (1 - op), 1180 + 60 * op); ctx.line_to(620 + 260 * (1 - op), 1580 + 30 * op); ctx.close_path()
        fs(ctx, (0.62, 0.32, 0.55), 8)
    else:
        fs(ctx, (0.62, 0.32, 0.55), 10)
        heart(ctx, 750, 1250, 40); fs(ctx, (1, 0.5, 0.72), 6)
        ellipse(ctx, 840, 1400, 14, 14); fs(ctx, (1, 0.85, 0.3), 5)
    # sidewalk
    ctx.rectangle(0, 1580, W, 340); fs(ctx, (0.93, 0.85, 0.82), 8)
    for i in range(6):
        ctx.move_to(i * 220 - 40, 1580); ctx.line_to(i * 220 - 140, 1920); ctx.set_source_rgba(*OUT, 0.25); ctx.set_line_width(5); ctx.stroke()
    # pati hops in
    if t < 7.6:
        p = prog(t, 5.0, 7.4)
        x = lerp(-180, 750, ease(p) if p < 1 else 1)
        hp = ((t - 5.0) / 0.4) % 1 if p < 1 else 0
        hop = -math.sin(PI * hp) * 110 if p < 1 else 0
        sq = 0.35 * (1 - min(hp, 1 - hp) / 0.12) if (p < 1 and min(hp, 1 - hp) < 0.12) else 0
        draw_foot(ctx, x, 1760 + hop, 0.62, t, "happy", squash=sq, rot=0.15 * math.sin(t * 7.85), look=0.6)
    else:
        p = ease(prog(t, 7.6, 8.4))
        draw_foot(ctx, 750, lerp(1760, 1585, p) - math.sin(PI * p) * 160, lerp(0.62, 0.0, p), t, "joy", rot=p * 0.6)

BUBBLES = [(RNG.uniform(120, 960), RNG.uniform(0, 1), RNG.uniform(16, 46), RNG.uniform(0, 6)) for _ in range(30)]
FOAM = [(RNG.uniform(60, 1020), RNG.uniform(1440, 1700), RNG.uniform(60, 120), RNG.uniform(0, 6)) for _ in range(26)]
SPARKS = [(RNG.uniform(-1, 1), RNG.uniform(-1, 1), RNG.uniform(0, 6)) for _ in range(18)]
S3X, S3Y, S3S = 520, 1640, 1.9
BRUSH_REST = (880, 1330)
PAINT0, PSTEP = 11.0, 0.6

def nails_at(t):
    return [prog(t, PAINT0 + i * PSTEP + 0.15, PAINT0 + i * PSTEP + 0.55) for i in range(5)]

def scene3(ctx, t):
    vgrad(ctx, (0.80, 0.96, 0.92), (1.0, 0.82, 0.90))
    for i in range(1, 9):
        ctx.move_to(0, i * 220 - 60); ctx.line_to(W, i * 220 - 60)
        ctx.move_to(i * 135, 0); ctx.line_to(i * 135, H)
    ctx.set_source_rgba(1, 1, 1, 0.45); ctx.set_line_width(6); ctx.stroke()
    mood = "joy" if t < 11.0 else ("star" if t > 15.9 else "happy")
    look = 0.0
    if PAINT0 <= t < 14.2: look = 0.7
    nails = nails_at(t)
    deco = prog(t, 14.3, 15.4)
    shake = 0.05 * math.sin(t * 25) if t < 10.8 else 0
    pop = back(prog(t, 15.9, 16.3)) if t > 15.9 else 0
    draw_foot(ctx, S3X, S3Y, S3S * (1 + 0.06 * pop * math.sin(PI * prog(t, 15.9, 16.5))), t, mood, nails, deco, rot=shake, look=look,
              wiggle=1.5 if t > 15.9 else 0.8)
    # foam and bubbles
    fo = ease(prog(t, 10.5, 11.2))
    if fo < 1:
        for x, y, r, ph in FOAM:
            ellipse(ctx, x + 10 * math.sin(t * 3 + ph), y + fo * 600, r, r * 0.85); ctx.set_source_rgb(*OUT); ctx.fill()
        for x, y, r, ph in FOAM:
            ellipse(ctx, x + 10 * math.sin(t * 3 + ph), y + fo * 600, r - 7, r * 0.85 - 7); ctx.set_source_rgb(1, 1, 1); ctx.fill()
    if 8.75 <= t < 11.6:
        for x, y0, r, ph in BUBBLES:
            age = (t - 8.75 + y0 * 2) % 2.0
            yy = 1550 - age * 650
            a = clamp(1 - age / 2.0) * (1 - prog(t, 11.0, 11.6))
            ellipse(ctx, x + 25 * math.sin(age * 4 + ph), yy, r, r)
            ctx.set_source_rgba(0.6, 0.85, 1, 0.25 * a); ctx.fill_preserve()
            ctx.set_source_rgba(0.35, 0.6, 0.9, 0.8 * a); ctx.set_line_width(4); ctx.stroke()
            ellipse(ctx, x + 25 * math.sin(age * 4 + ph) - r * 0.35, yy - r * 0.35, r * 0.2, r * 0.2)
            ctx.set_source_rgba(1, 1, 1, a); ctx.fill()
    # polish bottle + brush
    bin_ = ease(prog(t, 10.6, 11.0)) * (1 - ease(prog(t, 14.6, 15.0)))
    if bin_ > 0:
        by = lerp(2100, 1720, bin_)
        bottle(ctx, 900, by)
        if PAINT0 - 0.1 <= t < 14.3:
            i = min(4, int(max(0, t - PAINT0) / PSTEP))
            local = max(0, t - PAINT0) - i * PSTEP
            tgt = toe_world(i, S3X, S3Y, S3S)
            prev = toe_world(i - 1, S3X, S3Y, S3S) if i > 0 else (900, by - 300)
            m = ease(prog(local, 0, 0.15))
            bx, by2 = lerp(prev[0], tgt[0], m), lerp(prev[1], tgt[1], m)
            if 0.15 < local < 0.55:
                by2 += math.sin(local * 45) * TOES[i][2] * S3S * 0.25
            if t > 13.95:
                q = ease(prog(t, 13.95, 14.3)); bx, by2 = lerp(bx, 900, q), lerp(by2, by - 300, q)
            brush(ctx, bx + 6, by2 + 4)
    # sparkles
    if t > 14.3:
        amp = 1.6 if t > 15.9 else 1.0
        for sx, sy, ph in SPARKS:
            tw = max(0, math.sin(t * 6 + ph))
            sparkle(ctx, S3X + sx * 420, 900 + sy * 330, 34 * tw * amp, 0.95, (1, 1, 1) if ph < 3 else (1, 0.9, 0.4))

CROWD = [(150, 1080, 80, (0.6, 0.9, 0.8)), (930, 1080, 80, (1, 0.9, 0.5)), (240, 1360, 95, (0.6, 0.8, 1)),
         (840, 1360, 95, (0.85, 0.72, 1)), (125, 1680, 112, (1, 0.75, 0.55)), (955, 1680, 112, (0.75, 0.92, 0.6))]
LOVE0 = 19.4
FLASHES = sorted((RNG.uniform(19.0, 24.8), RNG.randrange(6)) for _ in range(14))

def scene4(ctx, t):
    vgrad(ctx, (0.55, 0.42, 0.85), (1.0, 0.65, 0.82))
    for i, x in enumerate((200, 540, 880)):
        sw = math.sin(t * 1.5 + i * 2) * 120
        ctx.move_to(x - 30, 0); ctx.line_to(x + 30, 0); ctx.line_to(x + 260 + sw, 1300); ctx.line_to(x - 260 + sw, 1300); ctx.close_path()
        g = cairo.LinearGradient(0, 0, 0, 1300); g.add_color_stop_rgba(0, 1, 1, 0.85, 0.45); g.add_color_stop_rgba(1, 1, 1, 0.85, 0)
        ctx.set_source(g); ctx.fill()
    ctx.move_to(450, 760); ctx.line_to(630, 760); ctx.line_to(1000, H); ctx.line_to(80, H); ctx.close_path()
    fs(ctx, (1, 0.42, 0.62), 8)
    for k in range(10):
        f = k / 10
        yy = lerp(760, H, f * f + 0.05)
        for side in (-1, 1):
            xx = 540 + side * lerp(90, 460, (yy - 760) / (H - 760))
            on = (int(t * 6) + k) % 2 == 0
            ellipse(ctx, xx, yy, 8 + 14 * f, 8 + 14 * f); ctx.set_source_rgb(*((1, 0.95, 0.5) if on else (1, 0.8, 0.9))); ctx.fill()
    p = ease(prog(t, 17.25, 24.8))
    s = lerp(0.5, 1.15, p); gy = lerp(1120, 1780, p)
    hp = ((t - 17.25) / 0.5) % 1
    hop = -math.sin(PI * hp) * 45 * s
    sq = 0.25 * (1 - min(hp, 1 - hp) / 0.1) if min(hp, 1 - hp) < 0.1 else 0
    for idx, (x, y, r, col) in enumerate(CROWD):
        lt = LOVE0 + idx * 0.22
        love = t >= lt
        jy = -abs(math.sin((t - lt) * 7)) * 40 if love else 0
        pr = back(prog(t, lt, lt + 0.3)) if love else 1
        draw_blob(ctx, x, y + jy, r * (0.85 + 0.15 * pr), col, t, love, 1 if x < 540 else -1)
        if love:
            for k in range(12):
                age = t - (lt + k * 0.4)
                if 0 < age < 2.2:
                    hx = x + math.sin(age * 4 + k) * 35 + (1 if x < 540 else -1) * age * 30
                    heart(ctx, hx, y - r - age * 330, 20 + 8 * math.sin(k))
                    fs(ctx, (1, 0.25, 0.45), 4, a=clamp(1.6 - age / 1.4))
    mood = "wink" if (t > 21.0 and int(t * 2) % 4 == 0) else "happy"
    draw_foot(ctx, 540 + 25 * math.sin(t * PI * 2), gy + hop, s, t, mood, [1] * 5, 1.0, squash=sq,
              rot=0.12 * math.sin(t * PI * 2), wiggle=1.2)
    for ft, idx in FLASHES:
        a = 1 - prog(t, ft, ft + 0.18)
        if ft <= t and a > 0:
            x, y, r, _ = CROWD[idx]
            g = cairo.RadialGradient(x, y - r * 1.2, 0, x, y - r * 1.2, 220)
            g.add_color_stop_rgba(0, 1, 1, 1, 0.9 * a); g.add_color_stop_rgba(1, 1, 1, 1, 0)
            ctx.rectangle(0, 0, W, H); ctx.set_source(g); ctx.fill()
            sparkle(ctx, x, y - r * 1.2, 110 * a, a)

CONF = [(RNG.uniform(0, W), RNG.uniform(0, 1), RNG.uniform(14, 30), RNG.uniform(0, 6),
         RNG.choice([(1, 0.25, 0.45), (1, 1, 1), (1, 0.85, 0.3), (0.7, 0.5, 1)])) for _ in range(45)]

def scene5(ctx, t):
    ctx.rectangle(0, 0, W, H); ctx.set_source_rgb(1, 0.62, 0.78); ctx.fill()
    ctx.save(); ctx.translate(540, 1150); ctx.rotate(t * 0.35)
    for i in range(18):
        ctx.move_to(0, 0); ctx.arc(0, 0, 2400, i * 2 * PI / 18, (i + 0.5) * 2 * PI / 18); ctx.close_path()
    ctx.set_source_rgb(1, 0.74, 0.86); ctx.fill(); ctx.restore()
    g = cairo.RadialGradient(540, 1150, 50, 540, 1150, 700)
    g.add_color_stop_rgba(0, 1, 1, 1, 0.7); g.add_color_stop_rgba(1, 1, 1, 1, 0)
    ctx.rectangle(0, 0, W, H); ctx.set_source(g); ctx.fill()
    hp = ((t - 25.25) / 0.5) % 1
    hop = -math.sin(PI * hp) * 30
    pin = back(prog(t, 25.25, 25.75))
    mood = "wink" if 26.5 < t < 28.5 else "happy"
    draw_foot(ctx, 540, 1560 + hop, 1.3 * pin, t, mood, [1] * 5, 1.0, squash=0.1 * math.sin(PI * hp), wiggle=1.5)
    for k in range(6):
        a = t * 1.2 + k * PI / 3
        heart(ctx, 540 + math.cos(a) * 470, 1150 + math.sin(a) * 300, 34 + 6 * math.sin(t * 6 + k))
        fs(ctx, (1, 0.25, 0.45), 5)
    for x, y0, sz, ph, col in CONF:
        yy = ((y0 * 2300 + (t - 25.25) * 420) % 2300) - 200
        heart(ctx, x + 40 * math.sin(t * 2 + ph), yy, sz); fs(ctx, col, 3)

SCENES = [(0, scene1), (4.75, scene2), (8.75, scene3), (17.25, scene4), (25.25, scene5)]
TRANS = [4.75, 8.75, 17.25, 25.25]

def iris(ctx, t):
    for T in TRANS:
        if T - 0.25 <= t < T + 0.25:
            r = 1300 * ease(abs(t - T) / 0.25)
            ctx.rectangle(0, 0, W, H); ctx.new_sub_path(); ctx.arc(540, 1100, max(r, 0.1), 0, 2 * PI)
            ctx.set_fill_rule(cairo.FILL_RULE_EVEN_ODD); ctx.set_source_rgb(0.25, 0.08, 0.22); ctx.fill()
            ctx.set_fill_rule(cairo.FILL_RULE_WINDING)

# ---------------------------------------------------------------- captions
CAPS = [
    ("این پاتیه!", 0.25, 2.3, 260, 120),
    ("ناخن‌هاش بی‌رنگ و بی‌حالن...", 2.3, 4.5, 260, 76),
    ("وقتشه یه تغییر اساسی!", 5.1, 8.5, 540, 84, "sign"),
    ("اول یه حموم کف‌آلود", 9.0, 10.9, 250, 92),
    ("بعدش... صورتی جیغ!", 11.0, 14.2, 250, 100),
    ("یه عالمه برق و نگین", 14.3, 15.85, 250, 92),
    ("وااای! چه ناز شدم!", 15.9, 17.0, 250, 108),
    ("پاتی رفت تو خیابون...", 17.5, 19.4, 240, 88),
    ("همه عاشقش شدن!", 19.4, 25.0, 240, 116),
    ("پاهای تو هم", 25.6, 30.1, 250, 112),
    ("لایق این همه عشقن!", 25.9, 30.1, 395, 98),
    ("همین امروز نوبت بگیر", 27.2, 30.1, 1730, 78, "cta"),
    ("@mahsa.mosavi.nail", 27.6, 30.1, 1835, 58, "cta2"),
]
STATIC = [("سالن مهسا موسوی", 5.0, 8.5, 775, 80)]
_fonts, _cache = {}, {}

def is_rtl(s): return any("؀" <= ch <= "ۿ" for ch in s)

def cap_img(text, size, kind=None):
    key = (text, size, kind)
    if key in _cache: return _cache[key]
    f = _fonts.setdefault(size, ImageFont.truetype(FONT, size, layout_engine=ImageFont.Layout.RAQM))
    kw = dict(direction="rtl", language="fa") if is_rtl(text) else {}
    fill, stroke, sw = (255, 255, 255, 255), (78, 25, 70, 255), max(6, size // 8)
    if kind == "cta": fill = (255, 232, 90, 255)
    if kind == "sign": fill, stroke = (255, 255, 255, 255), (230, 60, 130, 255)
    if kind == "static": fill, stroke, sw = (230, 50, 125, 255), (255, 255, 255, 255), 6
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bb = d.textbbox((0, 0), text, font=f, stroke_width=sw, **kw)
    pad = 30
    img = Image.new("RGBA", (bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2 + 10), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    o = (pad - bb[0], pad - bb[1])
    if kind != "static":
        dr.text((o[0], o[1] + 10), text, font=f, fill=(60, 10, 50, 150), stroke_width=sw, stroke_fill=(60, 10, 50, 150), **kw)
    dr.text(o, text, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke, **kw)
    _cache[key] = img
    return img

def paste(frame, img, cx, cy, scale, alpha):
    if scale <= 0.02 or alpha <= 0.01: return
    if abs(scale - 1) > 0.01:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BILINEAR)
    if alpha < 1:
        a = np.asarray(img).copy(); a[..., 3] = (a[..., 3] * alpha).astype(np.uint8); img = Image.fromarray(a)
    x, y = int(cx - img.width / 2), int(cy - img.height / 2)
    l, tp = max(0, -x), max(0, -y)
    r, b = min(img.width, W - x), min(img.height, H - y)
    if r <= l or b <= tp: return
    frame.alpha_composite(img.crop((l, tp, r, b)), (x + l, y + tp))

def draw_captions(frame, t):
    for text, t0, t1, y, size in STATIC:
        if t0 <= t < t1: paste(frame, cap_img(text, size, "static"), 540, y, 1, 1)
    for c in CAPS:
        text, t0, t1, y, size = c[:5]; kind = c[5] if len(c) > 5 else None
        if t0 <= t < t1:
            sc = back(prog(t, t0, t0 + 0.35)) * (1 + 0.03 * math.sin(t * 6))
            al = 1 - prog(t, t1 - 0.15, t1)
            paste(frame, cap_img(text, size, kind), 540, y + 6 * math.sin(t * 3), sc, al)

def render_frame(t):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    fn = [f for s, f in SCENES if t >= s][-1]
    fn(ctx, t)
    iris(ctx, t)
    surf.flush()
    arr = np.ndarray((H, W, 4), np.uint8, surf.get_data())[..., [2, 1, 0, 3]].copy()
    arr[..., 3] = 255
    frame = Image.fromarray(arr, "RGBA")
    if not any(T - 0.25 <= t < T + 0.25 for T in TRANS):
        draw_captions(frame, t)
    return frame.convert("RGB")

# ---------------------------------------------------------------- audio
SR = 44100
N = int(SR * DUR)
mix = np.zeros(N)
nrng = np.random.default_rng(3)

def add(sig, t0, gain=1.0):
    i = int(t0 * SR)
    if i >= N: return
    j = min(N, i + len(sig)); mix[i:j] += sig[: j - i] * gain

def tt(d): return np.arange(int(d * SR)) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)

def pluck(m, d=0.6, dec=0.22):
    x = tt(d); f = hz(m)
    s = sum((0.55 ** k) * np.sin(2 * PI * f * (k + 1) * x) * np.exp(-x / (dec / (1 + k * 0.8))) for k in range(5))
    return s * np.minimum(1, x / 0.004)

def bell(m, d=0.8, dec=0.3):
    x = tt(d); f = hz(m)
    return (np.sin(2 * PI * f * x) * np.exp(-x / dec) + 0.3 * np.sin(2 * PI * f * 4.01 * x) * np.exp(-x / (dec / 5))) * np.minimum(1, x / 0.002)

def bass(m, d=0.45):
    x = tt(d); f = hz(m)
    return (np.sin(2 * PI * f * x) + 0.35 * np.sin(4 * PI * f * x)) * np.exp(-x / 0.25) * np.minimum(1, x / 0.005)

def kick():
    x = tt(0.3); f = 42 + 110 * np.exp(-x / 0.035)
    return np.sin(2 * PI * np.cumsum(f) / SR) * np.exp(-x / 0.13)

def noise(d): return nrng.standard_normal(int(d * SR))

def hp(s): return np.diff(s, prepend=0)

def lp(s, k): return np.convolve(s, np.ones(k) / k, mode="same")

def snare():
    x = tt(0.22)
    return hp(noise(0.22)) * 0.45 * np.exp(-x / 0.06) + 0.4 * np.sin(2 * PI * 190 * x) * np.exp(-x / 0.04)

def hat():
    x = tt(0.06); return hp(hp(noise(0.06))) * 0.18 * np.exp(-x / 0.012)

def sweep(f0, f1, d, dec=None):
    x = tt(d); f = f0 * (f1 / f0) ** (x / d)
    e = np.exp(-x / dec) if dec else np.sin(PI * x / d)
    return np.sin(2 * PI * np.cumsum(f) / SR) * e

def trombone(m, d, vib=0.0, bend=0.0):
    x = tt(d); f = hz(m) * (1 + vib * np.sin(2 * PI * 6 * x) * np.minimum(1, x / 0.3)) * (1 - bend * x / d)
    ph = 2 * PI * np.cumsum(f) / SR
    s = sum(np.sin(ph * k) / k * np.exp(-k * 0.35) for k in range(1, 9))
    return s * np.minimum(1, x / 0.04) * np.minimum(1, (d - x) / 0.08)

# --- intro (sad, rainy)
add(lp(noise(4.8), 30) * np.minimum(1, (4.8 - tt(4.8)) / 0.3), 0, 0.5)
for i, m in enumerate([57, 60, 64, 60, 57, 55]):
    add(bell(m, 1.2, 0.5), 0.1 + i * 0.38, 0.22)
for i, (m, d) in enumerate([(62, 0.38), (61, 0.38), (60, 0.38), (59, 1.0)]):
    add(trombone(m, d, 0.035 if d > 0.5 else 0, 0.04 if d > 0.5 else 0), 2.45 + i * 0.4, 0.28)

# --- whooshes
for T in TRANS:
    w = lp(noise(0.55), 6) * np.sin(PI * tt(0.55) / 0.55) ** 2
    add(w, T - 0.3, 0.45)
    add(sweep(300, 1400, 0.5), T - 0.25, 0.08)

# --- main groove
CH = [(48, [64, 67, 72]), (43, [62, 67, 71]), (45, [64, 69, 72]), (41, [65, 69, 72])]
MEL = [[0, None, 1, 2, None, 1, 0, 2], [2, None, 1, None, 0, 1, 2, None]]
T0, BEAT = 5.0, 0.5
for b in range(12):
    bt = T0 + b * 2.0
    root, tones = CH[b % 4]
    soft = 1.0
    for k in range(4):
        st = bt + k * BEAT
        add(kick(), st, 0.75 if k in (0, 2) else 0.0)
        if k in (1, 3): add(snare(), st, 0.6)
        add(hat(), st + 0.25, 1.0); add(hat(), st, 0.5)
        for j, m in enumerate(tones):
            add(pluck(m, 0.4, 0.15), st + 0.25 + j * 0.012, 0.12)
    add(bass(root - 12 + 12), bt, 0.55); add(bass(root), bt + 0.75, 0.4); add(bass(root + 7), bt + 1.0, 0.45); add(bass(root), bt + 1.5, 0.4)
    if b >= 2:
        for k, ix in enumerate(MEL[b % 2]):
            if ix is not None:
                add(bell(tones[ix] + 12, 0.5, 0.18), bt + k * 0.25, 0.18)
# --- ending chord
for m in [60, 64, 67, 72, 76]:
    add(pluck(m, 1.2, 0.5), 29.0, 0.16)
add(kick(), 29.0, 0.8)
crash = hp(noise(2.0)) * np.exp(-tt(2.0) / 0.5) * 0.35
add(crash, 25.25, 1.0); add(crash, 17.25, 0.6)

# --- sfx
for m, dt in [(76, 0), (72, 0.35)]:  # door ding-dong
    add(bell(m, 1.0, 0.45), 7.35 + dt, 0.35)
for k in range(6):  # boing hops
    st = 5.0 + k * 0.4 + 0.38
    x = tt(0.25); f = 220 * (1 + 0.6 * x / 0.25) * (1 + 0.15 * np.sin(2 * PI * 18 * x))
    add(np.sin(2 * PI * np.cumsum(f) / SR) * np.exp(-x / 0.08), st, 0.2)
add(sweep(300, 1600, 0.6, 0.3), 7.65, 0.2)  # zip into door
r2 = random.Random(11)
for _ in range(26):  # bubbles
    add(sweep(r2.uniform(500, 900), r2.uniform(1300, 2200), 0.07, 0.03), r2.uniform(8.9, 10.9), 0.25)
for i in range(5):  # nail pops
    st = PAINT0 + i * PSTEP + 0.55
    add(sweep(1200, 250, 0.09, 0.03), st, 0.5)
    add(bell(79 + [0, 2, 4, 7, 9][i], 0.5, 0.2), st, 0.15)
for i, m in enumerate([84, 88, 91, 96, 100]):  # deco twinkles
    add(bell(m, 0.6, 0.2), 14.3 + i * 0.22, 0.22)
for i, m in enumerate([84, 88, 91, 96, 100, 103, 108]):  # wow chime
    add(bell(m, 0.8, 0.3), 15.9 + i * 0.05, 0.16)
for idx in range(6):  # love bloops
    add(sweep(400, 1500, 0.18, 0.1), LOVE0 + idx * 0.22, 0.3)
for ft, _ in FLASHES:  # camera shutters
    add(hp(noise(0.05)) * np.exp(-tt(0.05) / 0.01), ft, 0.5)
    add(hp(noise(0.05)) * np.exp(-tt(0.05) / 0.01), ft + 0.07, 0.35)

# ---------------------------------------------------------------- main
if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else HERE + "/pati.mp4"
    if len(sys.argv) > 2 and sys.argv[2] == "stills":
        for ts in [1.0, 3.5, 6.0, 7.9, 9.8, 12.2, 15.0, 16.4, 18.5, 21.5, 24.0, 26.0, 28.5]:
            render_frame(ts).save(f"{HERE}/still_{ts:05.2f}.png")
        sys.exit()
    m = mix / np.max(np.abs(mix)) * 0.95
    m = np.tanh(m * 1.2) / np.tanh(1.2)
    pcm = (m * 32000).astype(np.int16)
    with wave.open(HERE + "/audio.wav", "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(pcm.tobytes())
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                          "-r", str(FPS), "-i", "-", "-i", HERE + "/audio.wav", "-c:v", "libx264", "-preset", "medium",
                          "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest",
                          "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    nf = int(DUR * FPS)
    for i in range(nf):
        p.stdin.write(render_frame(i / FPS).tobytes())
        if i % 150 == 0: print(f"frame {i}/{nf}", flush=True)
    p.stdin.close(); p.wait()
    print("done", out)
