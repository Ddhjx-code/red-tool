"""Build a side-by-side contact sheet of the yuegong style drafts for eyeball review.

Pairs each AI draft with the matching procedural screenshot from release/yuegong/images
so the style sign-off (docs/research/yuegong-prompts.md section 五, 8 items) can be done
in one look. Item 7 (一眼可读为中秋) is the hard gate.
"""

import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRAFTS = os.path.join(ROOT, "docs", "research", "yuegong-drafts")
RELEASE = os.path.join(ROOT, "release", "yuegong", "images")
OUT = os.path.join(DRAFTS, "contact_sheet.png")

PAIRS = [
    ("bridge", "scene_bridge.png", "03-bridge.png"),
    ("gate", "scene_gate.png", "04-gate.png"),
    ("court", "scene_court.png", "05-court.png"),
]

THUMB_W = 360
THUMB_H = 640
PAD = 24
LABEL_H = 34
COLS_PER_SCENE = 2

GATE_OUT = os.path.join(DRAFTS, "gate_variants.png")
GATE_VARIANTS = [
    ("scene_gate.png", "首版 · 月轮被云/屋檐遮挡", "不合格"),
    ("scene_gate_b.png", "重出 b", "待眼验"),
    ("scene_gate_c.png", "重出 c", "待眼验"),
]

STYLE_OUT = os.path.join(DRAFTS, "style_compare.png")
STYLE_PAIR = [
    ("scene_court.png", "CG / 数字插画", "现状 · 原提示词"),
    ("scene_court_gongbi.png", "工笔 · 绢本设色", "候选 · 剥离体积光"),
]


def font(size):
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def thumb(path, width, height):
    if not os.path.exists(path):
        return None
    img = Image.open(path).convert("RGB")
    img.thumbnail((width, height), Image.LANCZOS)
    canvas = Image.new("RGB", (width, height), (18, 22, 30))
    canvas.paste(img, ((width - img.width) // 2, (height - img.height) // 2))
    return canvas


def build_gate_sheet():
    items = [
        (f, note, status, thumb(os.path.join(DRAFTS, f), THUMB_W, THUMB_H))
        for f, note, status in GATE_VARIANTS
    ]

    label_h = 58
    sheet_w = PAD * 2 + len(items) * (THUMB_W + PAD)
    sheet_h = PAD * 2 + label_h + THUMB_H + 44

    sheet = Image.new("RGB", (sheet_w, sheet_h), (240, 238, 232))
    draw = ImageDraw.Draw(sheet)
    f_title = font(22)
    f_sub = font(15)

    draw.text((PAD, PAD), "月宫宫门 · 月轮遮挡重出对比 (§五 第6条)", font=f_title, fill=(26, 58, 95))
    draw.text((PAD, PAD + 28),
              "验收判据 = 月轮完整无云遮挡。首版因云层与屋檐双重遮挡被否，b/c 为重出候选。",
              font=f_sub, fill=(90, 96, 106))

    y = PAD + 60
    for idx, (fname, note, status, t) in enumerate(items):
        x = PAD + idx * (THUMB_W + PAD)
        short = fname.replace("scene_gate", "gate").replace(".png", "")
        draw.text((x, y), "%s · %s" % (short, note), font=f_sub, fill=(46, 93, 140))
        draw.text((x, y + 20), status, font=f_sub,
                  fill=(180, 70, 40) if status == "不合格" else (90, 96, 106))

        ty = y + label_h
        if t is not None:
            sheet.paste(t, (x, ty))
        else:
            draw.rectangle([x, ty, x + THUMB_W, ty + THUMB_H], fill=(200, 198, 192))
            draw.text((x + 10, ty + THUMB_H // 2), "missing", font=f_sub, fill=(120, 116, 110))

    draw.text((PAD, sheet_h - PAD - 24),
              "月轮遮挡只能眼验：程序化测量已验证不可靠，且本 agent 无图像输入能力。",
              font=f_sub, fill=(90, 96, 106))

    sheet.save(GATE_OUT, quality=92)
    print("saved = %s" % GATE_OUT)
    print("size  = %dx%d  (%.0f KB)" % (sheet.width, sheet.height,
                                        os.path.getsize(GATE_OUT) / 1024))
    for fname, note, status, t in items:
        print("  %-20s %-24s %-8s thumb=%s" % (
            fname, note, status, "ok" if t is not None else "MISSING"))


def build_style_sheet():
    style_w, style_h = 420, 747
    items = [
        (f, name, note, thumb(os.path.join(DRAFTS, f), style_w, style_h))
        for f, name, note in STYLE_PAIR
    ]

    label_h = 58
    sheet_w = PAD * 2 + len(items) * (style_w + PAD)
    sheet_h = PAD * 2 + label_h + style_h + 44

    sheet = Image.new("RGB", (sheet_w, sheet_h), (240, 238, 232))
    draw = ImageDraw.Draw(sheet)
    f_title = font(22)
    f_sub = font(15)

    draw.text((PAD, PAD), "画风对比 · court 场景 · CG vs 工笔绢本设色", font=f_title, fill=(26, 58, 95))
    draw.text((PAD, PAD + 28),
              "同一场景同一构图，只改画风权重与体积光词汇。选定后决定全 6 张的提示词走向。",
              font=f_sub, fill=(90, 96, 106))

    y = PAD + 60
    for idx, (fname, name, note, t) in enumerate(items):
        x = PAD + idx * (style_w + PAD)
        draw.text((x, y), name, font=f_title, fill=(46, 93, 140))
        draw.text((x, y + 24), "%s · %s" % (fname, note), font=f_sub, fill=(90, 96, 106))

        ty = y + label_h
        if t is not None:
            sheet.paste(t, (x, ty))
        else:
            draw.rectangle([x, ty, x + style_w, ty + style_h], fill=(200, 198, 192))
            draw.text((x + 10, ty + style_h // 2), "missing", font=f_sub, fill=(120, 116, 110))

    draw.text((PAD, sheet_h - PAD - 24),
              "判据 = 是否有铁线描勾勒与绢本平涂质感，而非体积光与发光特效。只能眼验。",
              font=f_sub, fill=(90, 96, 106))

    sheet.save(STYLE_OUT, quality=92)
    print("saved = %s" % STYLE_OUT)
    print("size  = %dx%d  (%.0f KB)" % (sheet.width, sheet.height,
                                       os.path.getsize(STYLE_OUT) / 1024))
    for fname, name, note, t in items:
        print("  %-26s %-18s thumb=%s" % (fname, name, "ok" if t is not None else "MISSING"))


def main():
    scenes = []
    for name, draft_file, release_file in PAIRS:
        scenes.append({
            "name": name,
            "draft": thumb(os.path.join(DRAFTS, draft_file), THUMB_W, THUMB_H),
            "proc": thumb(os.path.join(RELEASE, release_file), THUMB_W, THUMB_H),
        })

    sheet_w = PAD * 2 + len(scenes) * (THUMB_W * COLS_PER_SCENE + PAD)
    sheet_h = PAD * 2 + LABEL_H + THUMB_H + LABEL_H + 44

    sheet = Image.new("RGB", (sheet_w, sheet_h), (240, 238, 232))
    draw = ImageDraw.Draw(sheet)
    f_title = font(22)
    f_sub = font(15)

    draw.text((PAD, PAD), "月宫一夜 · 风格试稿对位预览", font=f_title, fill=(26, 58, 95))
    draw.text((PAD, PAD + 28),
              "左=AI 试稿 (wan2.7-image-pro 720x1280)  右=程序化渲染实机截图  验收见 yuegong-prompts.md §五",
              font=f_sub, fill=(90, 96, 106))

    y = PAD + 60

    for idx, scene in enumerate(scenes):
        x = PAD + idx * (THUMB_W * COLS_PER_SCENE + PAD)

        draw.text((x, y), scene["name"].upper(), font=f_title, fill=(46, 93, 140))
        draw.text((x + 120, y + 5), "AI 试稿", font=f_sub, fill=(90, 96, 106))
        draw.text((x + THUMB_W + 12, y + 5), "实机截图", font=f_sub, fill=(90, 96, 106))

        ty = y + LABEL_H
        if scene["draft"] is not None:
            sheet.paste(scene["draft"], (x, ty))
        else:
            draw.rectangle([x, ty, x + THUMB_W, ty + THUMB_H], fill=(200, 198, 192))
            draw.text((x + 10, ty + THUMB_H // 2), "missing", font=f_sub, fill=(120, 116, 110))

        px = x + THUMB_W + 12
        if scene["proc"] is not None:
            sheet.paste(scene["proc"], (px, ty))
        else:
            draw.rectangle([px, ty, px + THUMB_W, ty + THUMB_H], fill=(200, 198, 192))
            draw.text((px + 10, ty + THUMB_H // 2), "missing", font=f_sub, fill=(120, 116, 110))

    foot_y = sheet_h - PAD - 30
    draw.text((PAD, foot_y),
              "硬门槛 = §五 第7条「一眼可读为中秋」(满月 + 桂树 + 月宫可辨)。bobing 首版即因未过此条被否。",
              font=f_sub, fill=(180, 70, 40))

    sheet.save(OUT, quality=92)
    print("saved = %s" % OUT)
    print("size  = %dx%d  (%.0f KB)" % (sheet.width, sheet.height,
                                        os.path.getsize(OUT) / 1024))
    for scene in scenes:
        print("  %-8s draft=%s  proc=%s" % (
            scene["name"],
            "ok" if scene["draft"] is not None else "MISSING",
            "ok" if scene["proc"] is not None else "MISSING",
        ))

    print()
    build_gate_sheet()

    print()
    build_style_sheet()


if __name__ == "__main__":
    main()
