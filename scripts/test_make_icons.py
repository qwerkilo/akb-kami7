"""图标产物不变量：脚本生成的字节必须与仓库里提交的一致。

make_icons.py 是人工跑的构建脚本（ADR-0016），本身几乎没有业务逻辑，
但它承诺「幂等且逐字节可复现」——那条承诺只有在这条测试里才被钉住：
改了绘制代码却忘了重新生成图标，这里就会红。
"""
import io
import os
import unittest

import make_icons

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 与 make_icons.main() 的产出清单一一对应
CASES = [
    ("icons/icon-192.png", lambda: make_icons.icon(192)),
    ("icons/icon-512.png", lambda: make_icons.icon(512)),
    (
        "icons/icon-maskable-512.png",
        lambda: make_icons.icon(512, rounded=False, mark_ratio=0.52),
    ),
    (
        "icons/apple-touch-icon.png",
        lambda: make_icons.icon(180, rounded=False, bar=True).convert("RGB"),
    ),
    ("favicon-32.png", lambda: make_icons.icon(32, bar=False)),
]


class IconArtifactTest(unittest.TestCase):
    def test_generated_matches_committed(self):
        for name, make in CASES:
            with self.subTest(name=name):
                committed = os.path.join(ROOT, name)
                self.assertTrue(os.path.exists(committed), f"缺图标 {name}")
                buf = io.BytesIO()
                make().save(buf, "PNG", optimize=True)
                with open(committed, "rb") as f:
                    self.assertEqual(
                        buf.getvalue(),
                        f.read(),
                        f"{name} 与脚本当前输出不一致：改了 make_icons.py 就要重新生成并提交",
                    )

    def test_sizes_match_manifest_declarations(self):
        import json

        with open(os.path.join(ROOT, "manifest.webmanifest"), encoding="utf-8") as f:
            manifest = json.load(f)
        for entry in manifest["icons"]:
            path = os.path.join(ROOT, entry["src"].lstrip("./"))
            declared = int(entry["sizes"].split("x")[0])
            with self.subTest(src=entry["src"]):
                with open(path, "rb") as f:
                    header = f.read(24)
                w = int.from_bytes(header[16:20], "big")
                h = int.from_bytes(header[20:24], "big")
                self.assertEqual([w, h], [declared, declared])


if __name__ == "__main__":
    unittest.main()
