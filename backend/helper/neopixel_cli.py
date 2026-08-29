#!/usr/bin/env python3
import argparse
import grp
import json
import os
import signal
import socket
import sys
import time

import board
import neopixel

DEFAULT_SOCKET = "/run/stream-overlord-neopixel/neopixel.sock"

NAMED = {
    "black": "#000000",
    "red": "#ff0000",
    "green": "#00ff00",
    "blue": "#0000ff",
    "white": "#ffffff",
    "yellow": "#ffff00",
    "cyan": "#00ffff",
    "magenta": "#ff00ff",
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
        return (int(s[0] * 2, 16), int(s[1] * 2, 16), int(s[2] * 2, 16))

    raise ValueError(f'Invalid color "{s}"')


def gpio_to_board_pin(gpio: int):
    attr = f"D{gpio}"
    if not hasattr(board, attr):
        raise ValueError(f"board has no attribute {attr} (gpio={gpio})")
    return getattr(board, attr)


class NeoPixelDaemon:
    def __init__(self):
        self.strips = {}
        self.running = True

    def _get_strip(self, gpio: int, count: int, brightness: float, order: str):
        current = self.strips.get(gpio)
        config = (count, brightness, order)

        if current is not None and current["config"] == config:
            return current

        if current is not None:
            try:
                current["pixels"].deinit()
            except Exception:
                pass

        pixels = neopixel.NeoPixel(
            gpio_to_board_pin(gpio),
            count,
            brightness=brightness,
            auto_write=False,
            pixel_order=getattr(neopixel, order),
        )

        strip = {
            "config": config,
            "pixels": pixels,
            "state": [(0, 0, 0)] * count,
        }
        self.strips[gpio] = strip
        return strip

    def set_color(self, command):
        gpio = int(command["gpio"])
        count = int(command.get("count", 1))
        color = str(command["color"])
        index = command.get("index")
        brightness = float(command.get("brightness", 0.3))
        order = str(command.get("order", "GRB")).upper()

        if count <= 0:
            raise ValueError("count must be > 0")
        if not 0.0 <= brightness <= 1.0:
            raise ValueError("brightness must be between 0.0 and 1.0")
        if order not in {"GRB", "RGB", "BRG", "RBG", "GBR", "BGR"}:
            raise ValueError(f"invalid pixel order: {order}")

        rgb = parse_color(color)
        strip = self._get_strip(gpio, count, brightness, order)
        state = strip["state"]

        if index is None:
            for i in range(count):
                state[i] = rgb
        else:
            index = int(index)
            if index < 0 or index >= count:
                raise ValueError(f"index out of range (0..{count - 1})")

            # Preserve the existing semantics: color index -> end.
            for i in range(index, count):
                state[i] = rgb

        pixels = strip["pixels"]
        for i in range(count):
            pixels[i] = state[i]
        pixels.show()

    def handle_command(self, command):
        if not isinstance(command, dict):
            raise ValueError("command must be a JSON object")

        if command.get("command") != "set":
            raise ValueError(f'unknown command: {command.get("command")}')

        self.set_color(command)
        return {"ok": True}

    def shutdown(self):
        self.running = False
        for strip in self.strips.values():
            try:
                strip["pixels"].deinit()
            except Exception:
                pass


def send_json(conn, payload):
    conn.sendall((json.dumps(payload, separators=(",", ":")) + "\n").encode("utf-8"))


def run_daemon(socket_path: str, socket_group: str | None):
    daemon = NeoPixelDaemon()
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)

    socket_dir = os.path.dirname(socket_path)
    os.makedirs(socket_dir, exist_ok=True)

    try:
        os.unlink(socket_path)
    except FileNotFoundError:
        pass

    server.bind(socket_path)
    os.chmod(socket_path, 0o660)

    if socket_group:
        gid = grp.getgrnam(socket_group).gr_gid
        os.chown(socket_path, 0, gid)

    server.listen(16)
    server.settimeout(1.0)

    def request_shutdown(_signum, _frame):
        daemon.running = False

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    print(f"NeoPixel daemon listening on {socket_path}", flush=True)

    try:
        while daemon.running:
            try:
                conn, _ = server.accept()
            except socket.timeout:
                continue

            with conn:
                try:
                    data = b""
                    while b"\n" not in data:
                        chunk = conn.recv(4096)
                        if not chunk:
                            break
                        data += chunk
                        if len(data) > 65536:
                            raise ValueError("command too large")

                    line = data.split(b"\n", 1)[0].decode("utf-8").strip()
                    if not line:
                        raise ValueError("empty command")

                    response = daemon.handle_command(json.loads(line))
                    send_json(conn, response)
                except Exception as exc:
                    send_json(conn, {"ok": False, "error": str(exc)})
    finally:
        daemon.shutdown()
        server.close()
        try:
            os.unlink(socket_path)
        except FileNotFoundError:
            pass


def run_client(args):
    if args.gpio is None:
        raise SystemExit("--gpio is required")
    if args.color is None:
        raise SystemExit("--color is required")

    command = {
        "command": "set",
        "gpio": args.gpio,
        "count": args.count,
        "color": args.color,
        "brightness": args.brightness,
        "order": args.order,
    }

    if args.index is not None:
        command["index"] = args.index

    client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        client.connect(args.socket)
        client.sendall((json.dumps(command, separators=(",", ":")) + "\n").encode("utf-8"))

        data = b""
        while b"\n" not in data:
            chunk = client.recv(4096)
            if not chunk:
                break
            data += chunk
    except FileNotFoundError:
        raise SystemExit(f"NeoPixel daemon socket not found: {args.socket}")
    except ConnectionRefusedError:
        raise SystemExit(f"NeoPixel daemon is not accepting connections: {args.socket}")
    finally:
        client.close()

    if not data:
        raise SystemExit("NeoPixel daemon returned no response")

    response = json.loads(data.split(b"\n", 1)[0].decode("utf-8"))
    if not response.get("ok"):
        raise SystemExit(response.get("error", "NeoPixel daemon returned an unknown error"))

    if args.hold_ms > 0:
        time.sleep(args.hold_ms / 1000.0)


def main():
    ap = argparse.ArgumentParser(description="NeoPixel daemon/client")
    ap.add_argument("--daemon", action="store_true", help="Run the privileged Unix socket daemon")
    ap.add_argument("--socket", default=DEFAULT_SOCKET, help=f"Unix socket path (default: {DEFAULT_SOCKET})")
    ap.add_argument("--socket-group", default=None, help="Group allowed to access the daemon socket")

    ap.add_argument("--gpio", type=int, default=None, help="GPIO number, e.g. 17")
    ap.add_argument("--count", type=int, default=1, help="LED amount / strip length (default 1)")
    ap.add_argument("--color", type=str, default=None, help='Color name or hex, e.g. "red" or "#00ff00"')
    ap.add_argument("--index", type=int, default=None, help="Start index (0-based). If omitted, color all LEDs.")
    ap.add_argument("--brightness", type=float, default=0.3, help="0.0..1.0 (default 0.3)")
    ap.add_argument("--order", type=str, default="GRB", choices=["GRB", "RGB", "BRG", "RBG", "GBR", "BGR"])
    ap.add_argument("--hold-ms", type=int, default=0)

    # Kept for backwards-compatible argument parsing. State is now held by the daemon.
    ap.add_argument("--state-dir", type=str, default=None, help=argparse.SUPPRESS)
    ap.add_argument("--no-save", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--deinit", action="store_true", help=argparse.SUPPRESS)

    args = ap.parse_args()

    if args.daemon:
        run_daemon(args.socket, args.socket_group)
    else:
        run_client(args)


if __name__ == "__main__":
    main()
