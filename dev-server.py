#!/usr/bin/env python3
"""Tiny local dev server for dubuntu.org.

Serves the static site with the same "clean URL" behaviour Vercel uses
(vercel.json -> cleanUrls), so /download serves download.html.

    python3 dev-server.py [port]
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class CleanURLHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        candidate = super().translate_path(path)
        if not os.path.exists(candidate):
            if os.path.exists(candidate + ".html"):
                return candidate + ".html"
            index = os.path.join(candidate, "index.html")
            if os.path.isdir(candidate) and os.path.exists(index):
                return index
        return candidate

    def do_GET(self):
        if self.path in ("/get", "/home"):
            self.send_response(308)
            self.send_header("Location", "/download" if self.path == "/get" else "/")
            self.end_headers()
            return
        super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReusableServer(("0.0.0.0", PORT), CleanURLHandler) as httpd:
        print(f"Dubuntu dev server: http://0.0.0.0:{PORT}", flush=True)
        httpd.serve_forever()
