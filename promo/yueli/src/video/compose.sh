#!/bin/zsh
# 帧序列 -> mp4。无音轨：发布时从小红书曲库选，站内音乐不会掉音量。
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
FRAMES="$HERE/../build/frames"
OUT="$HERE/../build/yueli-17s.mp4"

n=$(ls "$FRAMES"/f*.png 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -lt 426 ] && { echo "帧不全（$n/426），先跑 python3 render_frames.py"; exit 1; }

ffmpeg -v error -y -framerate 25 -i "$FRAMES/f%04d.png" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 20 -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT"
echo "-> $OUT"
