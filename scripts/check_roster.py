#!/usr/bin/env python3
"""名册完整性核对（**视图级**）：按团筛选看到的成员 vs 各团 Wikipedia 表。

为什么是视图级而不是数据级：转籍者按「一人多团」只留一份记录（最近归属），
按团筛选靠成员上的 `groups` 补全 —— 数据级比对会把补全的那几个人误报成缺失
（2026-10-04 实测：数据级红 6 人，视图级绿）。

用法（网络组合见 docs/agents/data-pipeline.md）：
  AKB_PROXY=http://127.0.0.1:7890 no_proxy=48pedia.org,www.48pedia.org \
    python3 scripts/check_roster.py

退出码：0 = 全部团一致；1 = 有缺口（列出人名）；2 = 工具失败。
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import fetch_members  # noqa: E402
import morningmusume_members as mm  # noqa: E402
from wiki import get  # noqa: E402

DUMP_JS = """
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = process.argv[1];
const core = require(path.join(root, "core.js"));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "members.js"), "utf8"), sandbox);
const sections = sandbox.window.AKB_GROUPS.filter((s) => s.series === "morning");
const out = {};
for (const s of sections) {
  const view = core.rosterView(sections, { group: s.group });
  out[s.group] = [
    ...new Set(
      view.nodes.flatMap((n) =>
        n.sections.flatMap((sec) => sec.members.map((m) => m.name))
      )
    ),
  ];
}
process.stdout.write(JSON.stringify(out));
"""


def site_view():
    """走真实的 core.rosterView 拿「按团筛选」的成员（与页面同一条路径）。"""
    r = subprocess.run(
        ["node", "-e", DUMP_JS, ROOT], capture_output=True, text=True, timeout=120
    )
    if r.returncode != 0:
        print("node 侧失败：", r.stderr.strip()[:300], file=sys.stderr)
        sys.exit(2)
    return json.loads(r.stdout)


def main():
    site = site_view()
    fetch = lambda u: fetch_members.decode_page(get(u))  # noqa: E731
    bad = 0
    for group, cfg in mm.GROUPS.items():
        try:
            text = mm.ja_wiki.wiki_wikitext(cfg["page"], fetch)
            parsed = mm.parse_wiki_members(text, group)
        except Exception as e:  # 抓取失败与「缺人」要分开报
            print("  ? {}: 上游抓取/解析失败（{}）".format(group, e))
            continue
        wiki = [m["name"] for m in parsed]
        got = set(site.get(group, []))
        missing = [n for n in wiki if n not in got]
        extra = [n for n in got if n not in wiki]
        if missing or extra:
            bad += 1
            print(
                "  ✗ {}: wiki {} / 视图 {}{}{}".format(
                    group,
                    len(wiki),
                    len(got),
                    "；缺: " + "、".join(missing) if missing else "",
                    "；多: " + "、".join(extra) if extra else "",
                )
            )
        else:
            print("  ✓ {}: {} 人".format(group, len(wiki)))
    print("\n结论:", "仍有缺口" if bad else "无缺口（视图与上游一致）")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
