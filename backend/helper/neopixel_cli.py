#!/usr/bin/env python3
import argparse
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
        return (int(s[0:2],16), int(s[2:4],16), int(s[4:6],16))
    if len(s) == 3 and all(c in "0123456789abcdef" for c in s):
        return (int(s[0]*2,16), int(s[1]*2,16), int(s[2]*2,16))

    raise ValueError(f'Invalid color "{s}"')

def gpio_to_board_pin(gpio: int):
    attr = f"D{gpio}"
    if not hasattr(board, attr):
        raise ValueError(f"board has no attribute {attr} (gpio={gpio})")
    return getattr(board, attr)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpio", type=int, required=True)
    ap.add_argument("--count", type=int, required=True)
    ap.add_argument("--color", type=str, required=True)
    ap.add_argument("--index", type=int, default=None)
    ap.add_argument("--brightness", type=float, default=0.3)
    ap.add_argument("--order", type=str, default="GRB",
                    choices=["GRB","RGB","BRG","RBG","GBR","BGR"])
    ap.add_argument("--hold-ms", type=int, default=0)
    ap.add_argument("--deinit", action="store_true",
                    help="If set, call pixels.deinit() on exit (this often turns LEDs off).")
    args = ap.parse_args()

    rgb = parse_color(args.color)
    pin = gpio_to_board_pin(args.gpio)

    pixels = neopixel.NeoPixel(
        pin,
        args.count,
        brightness=args.brightness,
        auto_write=False,
        pixel_order=getattr(neopixel, args.order),
    )

    try:
        if args.index is None:
            for i in range(args.count):
                pixels[i] = rgb
        else:
            if args.index < 0 or args.index >= args.count:
                raise SystemExit(f"--index out of range (0..{args.count-1})")
            pixels[args.index] = rgb

        pixels.show()

        if args.hold_ms > 0:
            time.sleep(args.hold_ms / 1000.0)

    finally:
        # DEFAULT: do NOT deinit, so LEDs stay latched.
        if args.deinit:
            pixels.deinit()

if __name__ == "__main__":
    main()
