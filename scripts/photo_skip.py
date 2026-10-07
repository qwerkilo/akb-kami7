"""增量跑：谁的照片可以跳过（ADR-0023）——名单的**键**与**判定**各只有一处。

跳过名单此前是「一个函数 + 挂在它上面的隐藏属性 `skip.skipped`」：调用方要
`getattr(..., "skipped", set())` 才能取回名单（属性名一改，警告静默消失），
而 `(团, 名)` 这个键在 producer / 两个 loader / 复核警告四处各派生一次。

现在名单就是**一组键**（`(团, 名)`），判定与键派生共用这里的两个函数。
为什么键是身份而不是 id：上一轮的 id 可能与这一轮不同（同名新人出现时
`assign_ids` 会给旧成员换 id），按 id 记会跳错人。
"""


def key(member):
    """跳过名单的键：`(团, 名)` —— **键的唯一出处**。"""
    return (member.get("group"), member.get("name"))


def skips(skipped, member):
    """这个人要不要跳过照片解析。

    `skipped` 为 None（`--refresh-photos`）或名单里没有这个人 → False。
    """
    return bool(skipped) and key(member) in skipped
