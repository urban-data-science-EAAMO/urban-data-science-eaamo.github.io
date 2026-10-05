"""Serve built HTML locally; no Node runtime is needed after building."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", type=int, default=4321)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / "dist"
if not (root / "index.html").exists():
    parser.error("dist/index.html is missing. Run pnpm build first.")
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
print(f"Preview: http://localhost:{args.port} (Ctrl+C to stop)", flush=True)
try:
    ThreadingHTTPServer(("127.0.0.1", args.port), handler).serve_forever()
except KeyboardInterrupt:
    pass
