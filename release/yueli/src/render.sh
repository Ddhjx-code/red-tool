#!/bin/zsh
# 渲染宣传卡：1080x1440（3:4），deviceScaleFactor 1（尺寸即最终尺寸）。
# 用法：./render.sh p1 p2 ...   不传参数则渲全部
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../build/cards"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$OUT"

pages=("$@")
[ ${#pages[@]} -eq 0 ] && pages=(p1 p2 p3 p4 p5 p6)

for page in "${pages[@]}"; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1440 \
    --default-background-color=00000000 \
    --screenshot="$OUT/$page.png" "file://$HERE/cards/$page.html" >/dev/null 2>&1
  printf "%-6s " "$page"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT/$page.png"
done
echo "-> $OUT"
