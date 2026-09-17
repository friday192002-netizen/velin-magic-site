"""Local preview of public/ at http://localhost:4321

    python tools/serve.py [port]

Why not `python -m http.server`: on some Windows machines its HTTP/1.0
connection close resets the socket before the last bytes arrive, so pages
over ~64 KB load cut off (no stylesheet, no script). Keep-alive HTTP/1.1
avoids that. It also mirrors vercel.json's cleanUrls/404 behaviour.
"""
from __future__ import annotations

import functools
import http.server
import sys
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "public"


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):
        path = Path(self.translate_path(self.path))
        if not path.exists() and not self.path.split("?")[0].endswith("/") and (path.with_suffix(".html")).exists():
            self.path = self.path.split("?")[0] + ".html"
        elif not path.exists():
            body = (PUBLIC / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return _Bytes(body)
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class _Bytes:
    def __init__(self, data: bytes):
        self.data = data

    def read(self, *_):
        data, self.data = self.data, b""
        return data

    def close(self):
        pass


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=str(PUBLIC)))
    print(f"Preview: http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
