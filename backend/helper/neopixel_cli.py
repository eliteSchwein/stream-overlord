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
        r = int(s[0:2], 16)
        g = int(s[2:4], 16)
        b = int(s[4:6], 16)
        return (r, g, b)

    if len(s) == 3 and all(c in "0123456789abcdef" for c in s):
        r = int(s[0] * 2, 16)
        g = int(s[1] * 2, 16)
        b = int(s[2] * 2, 16)
        return (r, g, b)

    raise ValueError(f'Invalid color "{s}" (use name like "red" or hex like "#ff00aa")')


def gpio_to_board_pin(gpio: int):
    # board.D17 etc.
    attr = f"D{gpio}"
    if not hasattr(board, attr):
        raise ValueError(f"board has no attribute {attr} (gpio={gpio})")
    return getattr(board, attr)


def main():
    ap = argparse.ArgumentParser(description="Set NeoPixel/WS2812 colors on a Raspberry Pi GPIO.")
    ap.add_argument("--gpio", type=int, required=True, help="GPIO number (e.g. 17)")
    ap.add_argument("--count", type=int, required=True, help="Number of LEDs on the strip (e.g. 2)")
    ap.add_argument("--color", type=str, required=True, help='Color name or hex, e.g. "red" or "#00ff00"')
    ap.add_argument("--index", type=int, default=None, help="Optional LED index (0-based). If omitted, set all LEDs.")
    ap.add_argument("--brightness", type=float, default=0.3, help="0.0..1.0 (default 0.3)")
    ap.add_argument("--order", type=str, default="GRB", choices=["GRB", "RGB", "BRG", "RBG", "GBR", "BGR"],
                    help="Pixel color order (default GRB)")
    ap.add_argument("--hold-ms", type=int, default=0,
                    help="Optional: keep process alive for N ms before exit (default 0)")
    args = ap.parse_args()

    if args.count <= 0:
        raise SystemExit("--count must be > 0")
    if not (0.0 <= args.brightness <= 1.0):
        raise SystemExit("--brightness must be between 0.0 and 1.0")

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
        pixels.deinit()


if __name__ == "__main__":
    main()
