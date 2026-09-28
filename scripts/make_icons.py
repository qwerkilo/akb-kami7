#!/usr/bin/env python3
"""生成 PWA 图标（产物提交，脚本留档便于改色重生成）。

用法：python3 scripts/make_icons.py
标记：粉色圆角底 + 白色「7」+ 柠檬黄下划线。三系列共有的是「7」（神7 / 7福神 / 推し7），
所以图标与系列无关；小于 96px 时省掉黄杠（32px 上会糊成一团）。
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
PINK = (228, 0, 127, 255)
LEMON = (244, 194, 13, 255)
WHITE = (255, 255, 255, 255)


def _seven(draw, cx, cy, size, color=WHITE):
    """在 (cx, cy) 居中画一个粗体「7」，字高约 size。"""
    font = ImageFont.truetype(FONT, int(size))
    box = draw.textbbox((0, 0), "7", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text((cx - w / 2 - box[0], cy - h / 2 - box[1]), "7", font=font, fill=color)


def icon(size, rounded=True, mark_ratio=0.62, bar=True):
    """mark_ratio：标记占画布的比例（maskable 要留安全区，摊小一点）。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=PINK)
    else:
        draw.rectangle([0, 0, size - 1, size - 1], fill=PINK)
    mark = size * mark_ratio
    bar_h = max(2, int(size * 0.05))
    gap = size * 0.04
    total = mark * 0.74 + gap + bar_h
    top = size / 2 - total / 2
    _seven(draw, size / 2, top + mark * 0.37, mark)
    if bar:
        y = top + mark * 0.74 + gap
        half = mark * 0.42
        draw.rounded_rectangle(
            [size / 2 - half, y, size / 2 + half, y + bar_h], radius=bar_h // 2, fill=LEMON
        )
    return img


def main():
    out = [
        ("icons/icon-192.png", icon(192)),
        ("icons/icon-512.png", icon(512)),
        # maskable：系统会裁成圆形/水滴等形状，背景必须满幅、标记留在中心 80% 安全区内
        ("icons/icon-maskable-512.png", icon(512, rounded=False, mark_ratio=0.52)),
        # iOS 自己加圆角与遮罩：要满幅、不带 alpha
        ("icons/apple-touch-icon.png", icon(180, rounded=False, bar=True).convert("RGB")),
        # 32px：黄杠会糊成一条灰带，省掉
        ("favicon-32.png", icon(32, bar=False)),
    ]
    for name, img in out:
        p = os.path.join(ROOT, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img.save(p, "PNG", optimize=True)
        print("写出", name, img.size)


if __name__ == "__main__":
    main()
