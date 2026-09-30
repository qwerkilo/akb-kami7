#!/usr/bin/env python3
"""恰好命中一次的文件替换。

一次性补丁脚本反复失败在同一个地方：锚点命中两次 / 一次都没中 / 已被 Prettier 重排。
本脚本把这三种情况都变成**显式失败**，并强制锚点恰好命中一次。

用法：
    python3 scripts/patch_file.py <文件> <旧文本> <新文本> [--count N] [--dry-run]

旧文本/新文本用字面量多行字符串传入（bash 里用 $'...' 或 heredoc）。
命中 0 次或多次 → 退出 2 并说明命中了几次（不会静默改坏文件）。
"""
import argparse
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("old")
    ap.add_argument("new")
    ap.add_argument("--count", type=int, default=1, help="期望命中的次数（默认 1）")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.file, encoding="utf-8") as fh:
        src = fh.read()
    hits = src.count(args.old)
    if hits != args.count:
        print(
            f"✗ 锚点在 {args.file} 里命中 {hits} 次（期望 {args.count}）—— 拒绝修改",
            file=sys.stderr,
        )
        return 2
    out = src.replace(args.old, args.new, args.count)
    if out == src:
        print("✗ 替换后内容与原来相同（新旧文本一样？）", file=sys.stderr)
        return 2
    if args.dry_run:
        print(f"· 命中 {hits} 次，--dry-run 未写入")
        return 0
    with open(args.file, "w", encoding="utf-8") as fh:
        fh.write(out)
    print(f"✓ 已替换 {hits} 处：{args.file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
