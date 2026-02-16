#!/usr/bin/env python3
import argparse
import json
import os
import time

import board
import neopixel

NAMED = {
    "black":  "#000000",
    "red":    "#ff0000",
    "green":  "#00ff00",
    "blue":   "#0000ff",
    "white":  "#ffffff",
    "yellow": "#ffff00",
    "cyan":   "#00ffff",
    "magenta":"#ff00ff",
    "orange": "#ffa500",
    "purple": "#800080",
}

def parse_color(s: str):
    s = s.strip().lower()
    s = NAMED.get(s, s)
    if s.startswith("#"):
        s = s[1:]

    if len(s) == 6 and all(c in "0123456789abcdef" for c in s):
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))

    if len(s) == 3 and all(c in "0123456789abcdef" for c in s):
        return (int(s[0]*2, 16), int(s[1]*2, 16), int(s[2]*2, 16))

    raise ValueError(f'Invalid color "{s}"')

def gpio_to_board_pin(gpio: int):
    attr = f"D{gpio}"
    if not hasattr(board, attr):
        raise ValueError(f"board has no attribute {attr} (gpio={gpio})")
    return getattr(board, attr)

def state_path(state_dir: str, gpio: int, count: int) -> str:
    return os.path.join(state_dir, f"gpio{gpio}_count{count}.json")

def load_state(state_dir: str, gpio: int, count: int):
    p = state_path(state_dir, gpio, count)
    try:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list) and len(data) == count:
            out = []
            for item in data:
                if isinstance(item, list) and len(item) == 3 and all(isinstance(x, int) for x in item):
                    out.append((item[0], item[1], item[2]))
                else:
                    return [(0,0,0)] * count
            return out
    except FileNotFoundError:
        pass
    except Exception:
        pass
    return [(0,0,0)] * count

def save_state(state_dir: str, gpio: int, count: int, state):
    os.makedirs(state_dir, exist_ok=True)
    p = state_path(state_dir, gpio, count)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump([[r,g,b] for (r,g,b) in state], f)
    os.replace(tmp, p)

def main():
    ap = argparse.ArgumentParser(description="NeoPixel CLI (index colors from index->end)")
    ap.add_argument("--gpio", type=int, required=True, help="GPIO number, e.g. 17")
    ap.add_argument("--count", type=int, default=1, help="LED amount / strip length (default 1)")
    ap.add_argument("--color", type=str, required=True, help='Color name or hex, e.g. "red" or "#00ff00"')
    ap.add_argument("--index", type=int, default=None, help="Start index (0-based). If omitted, color all LEDs.")
    ap.add_argument("--brightness", type=float, default=0.3, help="0.0..1.0 (default 0.3)")
    ap.add_argument("--order", type=str, default="GRB",
                    choices=["GRB","RGB","BRG","RBG","GBR","BGR"])
    ap.add_argument("--hold-ms", type=int, default=0)
    ap.add_argument("--state-dir", type=str, default="/run/stream-overlord-neopixel")
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("--deinit", action="store_true",
                    help="If set, call pixels.deinit() on exit (often turns LEDs off)")

    args = ap.parse_args()

    if args.count <= 0:
        raise SystemExit("--count must be > 0")
    if not (0.0 <= args.brightness <= 1.0):
        raise SystemExit("--brightness must be between 0.0 and 1.0")

    rgb = parse_color(args.color)
    pin = gpio_to_board_pin(args.gpio)

    # Load previous state so we don't wipe LEDs before index
    state = load_state(args.state_dir, args.gpio, args.count)

    # Apply update:
    if args.index is None:
        # color all LEDs
        for i in range(args.count):
            state[i] = rgb
    else:
        if args.index < 0 or args.index >= args.count:
            raise SystemExit(f"--index out of range (0..{args.count-1})")
        # color from index -> end
        for i in range(args.index, args.count):
            state[i] = rgb

    pixels = neopixel.NeoPixel(
        pin,
        args.count,
        brightness=args.brightness,
        auto_write=False,
        pixel_order=getattr(neopixel, args.order),
    )

    try:
        # Always write the full frame
        for i in range(args.count):
            pixels[i] = state[i]
        pixels.show()

        if not args.no_save:
            save_state(args.state_dir, args.gpio, args.count, state)

        if args.hold_ms > 0:
            time.sleep(args.hold_ms / 1000.0)
    finally:
        if args.deinit:
            pixels.deinit()

if __name__ == "__main__":
    main()
