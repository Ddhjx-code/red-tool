#!/bin/zsh
# 出界面截图：iframe 固定 390x844 逻辑尺寸，2x 采样后裁成 780x1688。
# headless Chrome 会把窗口宽度钳到 500px，直接 --window-size=390 会拍出假溢出。
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/../build/shots"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
mkdir -p "$OUT"

python3 "$HERE/make-preview.py" setup main pred sheet

shoot() {
  local name="$1"
  cat > "$TMP/frame.html" <<HTML
<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#faf7f2;overflow:hidden}
iframe{position:absolute;left:0;top:0;width:390px;height:844px;border:0;display:block}</style>
</head><body><iframe src="file://$HERE/../build/shells/$name.html"></iframe></body></html>
HTML
  # virtual-time-budget 必须给够：弹层是 setTimeout 里点开的，预算太小会拍到没弹的状态
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=800,1750 \
    --default-background-color=00000000 --virtual-time-budget=4000 \
    --screenshot="$TMP/$name.png" "file://$TMP/frame.html" >/dev/null 2>&1
  ffmpeg -v error -y -i "$TMP/$name.png" -vf "crop=780:1688:0:0" "$OUT/$name@2x.png"
  printf "%-8s " "$name"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT/$name@2x.png"
}

for n in setup main pred sheet; do shoot "$n"; done
rm -rf "$TMP"
echo "-> $OUT"
