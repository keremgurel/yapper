#!/bin/zsh
# Puts a backdrop behind a cutaway card in a talking-head video, outside Yapper.
#
#   backdrop.sh --speaker talk.mp4 --start 6.5 --end 27.1 --look frosted \
#               [--card card.mov] --out result.mp4
#
# --look is frosted or a preset name (navyGlow, aurora, lightRays, grainient,
# shapeGrid). --card is the overlay to lay on top for that stretch: a
# full-frame transparent ProRes 4444 .mov (what the Remotion overlays render)
# or a full-frame PNG with alpha. Without --card only the backdrop is laid in.
# --focus X,Y moves a preset's glow to the card's centre, in 0..1 of the frame.
set -euo pipefail
here=${0:A:h}

speaker= card= start= end= look= out= focus="0.5,0.42"
while (( $# )); do
  case $1 in
    --speaker) speaker=$2; shift 2 ;;
    --card) card=$2; shift 2 ;;
    --start) start=$2; shift 2 ;;
    --end) end=$2; shift 2 ;;
    --look) look=$2; shift 2 ;;
    --focus) focus=$2; shift 2 ;;
    --out) out=$2; shift 2 ;;
    *) print -u2 "unknown option $1"; exit 2 ;;
  esac
done
[[ -n $speaker && -n ${start} && -n ${end} && -n $look && -n $out ]] || { print -u2 "need --speaker --start --end --look --out"; exit 2; }

IFS=, read W H <<< "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$speaker")"
duration=$(( end - start + 0.0 ))
fade=0.35
(( duration < 0.7 )) && fade=$(( duration / 2 ))

# The same numbers as Yapper's FrostedBackdrop: 1.5x zoom, blur 2.5% of the
# frame width, brightness -0.07, saturation 0.9.
sigma=$(( W * 0.025 ))

inputs=(-i "$speaker")
if [[ $look == frosted ]]; then
  backdrop="[src]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,scale=iw*1.5:-2,gblur=sigma=${sigma},crop=$W:$H,eq=brightness=-0.07:saturation=0.9"
else
  plate=$(mktemp -t backdrop).png
  swift "$here/render-preset.swift" "$look" "$W" "$H" "$plate" ${(s:,:)focus} >/dev/null
  inputs+=(-loop 1 -t "$duration" -i "$plate")
  backdrop="[1:v]scale=$W:$H,setpts=PTS-STARTPTS"
fi
cardIndex=${#${(M)inputs:#-i}}  # inputs so far, counted by their -i flags
[[ -n $card ]] && inputs+=(-i "$card")

[[ $look == frosted ]] && graph="[0:v]split=2[base][src];" || graph="[0:v]null[base];"
graph+="$backdrop,format=yuva420p,fade=t=in:st=0:d=${fade}:alpha=1,setpts=PTS+${start}/TB[bd];"
graph+="[base][bd]overlay=eof_action=pass:enable='between(t,${start},${end})'[withbd]"
if [[ -n $card ]]; then
  graph+=";[$cardIndex:v]setpts=PTS-STARTPTS+${start}/TB,format=yuva420p[card];"
  graph+="[withbd][card]overlay=eof_action=pass:enable='between(t,${start},${end})'[out]"
  last="[out]"
else
  last="[withbd]"
fi

ffmpeg -hide_banner -loglevel error -y "${inputs[@]}" -filter_complex "$graph" \
  -map "$last" -map '0:a?' -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium -c:a copy "$out"
print -r -- "$out"
