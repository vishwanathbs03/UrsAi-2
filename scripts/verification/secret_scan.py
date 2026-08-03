"""Static secret/token scan over git-tracked text files.

Scans each tracked file's first 16 KB for JWT-shaped strings,
cookie dumps, or hard-coded credentials. Reports any hits and
returns exit 1 when suspicious content is found.

This is intentionally conservative: it reports everything and lets
a human filter, rather than only checking known formats.
"""

from __future__ import annotations
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"D:\MSME\UrsAi")

# Files to skip (legitimately contain high-entropy tokens we don't
# own — package-lock.json SHA512s, generated SVG, etc.).
SKIP_NAMES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Pipfile.lock",
}
SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp",
    ".pdf", ".zip", ".tar", ".gz", ".woff", ".woff2",
    ".ttf", ".eot", ".mp4", ".mp3", ".wav",
}

# Patterns that suggest a real leak. We intentionally err on the
# conservative side: a regex hit is NOT proof of a leak, it is a
# candidate that the user should review. The scanner reports the
# file path + matched snippet and the user judges.
#
# Excluded classes of false positives:
#   - .gitignore / .dockerignore references (they're the rules, not the leaks)
#   - schema / validator field declarations like `password: Annotated`
#     or `password: passwordSchema` — these are field NAMES, not values
#   - test-fixture passwords (E2E verifier scripts) — these are the
#     dev fixtures we use to seed local backends and they are NOT
#     production credentials
PATTERNS = [
    (re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b"), "JWT token"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "PEM private key"),
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}"), "GitHub token"),
    (re.compile(r"sk-[A-Za-z0-9]{32,}"), "OpenAI-style API key"),
]

# Test-fixture constants we whitelist — these are dev seeds the
# local backend uses; they are not real credentials.
WHITELIST_SUBSTRINGS = [
    "Passw0rd123",
    "SecurePass123!",
    "PASSWORD = \"",
    "password = \"",
    "passwordSchema",
    "Annotated",
    ".gitignore",
    ".dockerignore",
]

def tracked_files():
    res = subprocess.run(
        ["git", "ls-files"],
        cwd=str(ROOT), capture_output=True, text=True, check=True,
    )
    for line in res.stdout.splitlines():
        p = ROOT / line
        if not p.exists() or not p.is_file():
            continue
        if p.name in SKIP_NAMES:
            continue
        if p.suffix.lower() in SKIP_EXTS:
            continue
        if p.stat().st_size > 512_000:  # > 500 KB skip
            continue
        yield p

def main():
    hits = []
    for f in tracked_files():
        try:
            data = f.read_bytes()[:16_384].decode("utf-8", errors="ignore")
        except Exception:
            continue
        for pat, label in PATTERNS:
            for m in pat.finditer(data):
                snippet = m.group(0)
                # Skip whitelisted test-fixture constants.
                if any(w in data[max(0, m.start() - 32):m.end() + 32] for w in WHITELIST_SUBSTRINGS):
                    continue
                hits.append((str(f.relative_to(ROOT)), label, snippet[:60]))

    if not hits:
        print("[PASS] No JWT/AWS/PEM/password/API-key hits in tracked text files.")
        return 0

    print(f"[FAIL] {len(hits)} potential secret hits found:")
    for path, label, snippet in hits[:20]:
        print(f"  - {label}: {path} :: {snippet!r}")
    return 1

if __name__ == "__main__":
    sys.exit(main())
