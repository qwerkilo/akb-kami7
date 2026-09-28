"""名册装配契约：48pedia（fetch_members）与等爱（love_members）共用的组内排序、
成员投影与分段形状。分组逻辑（按团体/期生/系列）各自保留，只有这三件事在此定义。
"""

BASE_KEYS = ("id", "name", "kana", "nick", "status", "end", "img")


def ymd(y, mo=None, d=None):
    """站点统一日期格式 YYYY.MM.DD（缺月日时只给年份，如毕业年）。"""
    if mo in (None, ""):
        return str(y)
    return "{}.{}.{}".format(y, str(mo).zfill(2), str(d).zfill(2))


def sort_members(members):
    """现役优先，其次按假名（空则用姓名）。原地排序并返回同一列表。"""
    members.sort(key=lambda m: (m["status"] != "current", m["kana"] or m["name"]))
    return members


def project(member, optional=("bio",)):
    """成员投影：基础字段恒在（缺值为 None），可选字段仅在真值时带上。"""
    out = {k: member.get(k) for k in BASE_KEYS}
    for key in optional:
        if member.get(key):
            out[key] = member[key]
    return out


def section(group, series, label, members, optional=("bio",)):
    """一个分段：{group, series, label, members}，成员按契约排序后投影。"""
    return {
        "group": group,
        "series": series,
        "label": label,
        "members": [project(m, optional) for m in sort_members(list(members))],
    }
