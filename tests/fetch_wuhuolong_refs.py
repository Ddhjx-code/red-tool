"""下载大坑舞火龍的真实实拍，作为**设计参考**（不做发布素材，不进 zip）。

来源：Wikimedia Commons（许可明确）。参考用途 = 让视觉模型拆解真实形制：
龙头的结构、香火的排布、夜间的明度层次、人群与街道的关系。
"""
import io
import json
import os
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "research" / "wuhuolong-refs"

FILES = [
    "File:Tai Hang Fire Dragon Dance 2024 01.jpg",
    "File:Tai Hang Fire Dragon Dance 2024 02.jpg",
    "File:Head of Tai Hang Fire Dragon during the Mid-Autumn Festival in Hong Kong, Sep 2024.jpg",
    "File:Tai Hang Fire Dragon Dance during the Mid-Autumn Festival in Hong Kong, Sep 2024.jpg",
    "File:大坑舞火龍之起龍頭.JPG",
    "File:大坑舞火龍之換香.JPG",
    "File:大坑舞火龍之搖龍尾.JPG",
    "File:Tai Hang Fire Dragon 1.jpg",
]
THUMB_W = 1400
UA = "red-tool-ref-research/1.0 (local study use)"


def api(titles):
    q = {
        "action": "query",
        "format": "json",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|size",
        "iiurlwidth": str(THUMB_W),
        "titles": "|".join(titles),
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = api(FILES)
    pages = data.get("query", {}).get("pages", {})
    got = 0
    for pid, page in pages.items():
        title = page.get("title", "?")
        info = (page.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl")
        if not thumb:
            print("  SKIP (no thumb):", title)
            continue
        meta = info.get("extmetadata", {})
        lic = meta.get("LicenseShortName", {}).get("value", "?")
        art = meta.get("Artist", {}).get("value", "?")
        art = art.replace("<", " <")[:90]
        name = title.replace("File:", "").replace(" ", "_")
        if not name.lower().endswith((".jpg", ".jpeg", ".png", ".gif")):
            name += ".jpg"
        dest = OUT / name
        req = urllib.request.Request(thumb, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            dest.write_bytes(r.read())
        got += 1
        print("  %-62s %6.0f KiB  lic=%s" % (name[:62], dest.stat().st_size / 1024, lic))
        print("      by %s" % art)
    print("downloaded %d reference images to %s" % (got, OUT))


if __name__ == "__main__":
    main()
