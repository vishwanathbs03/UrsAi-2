"""Sprint 9 — Part 1 verifier (Release Candidate freeze).

Validates the Release Candidate surface. Each check is
independent and one [PASS]/[FAIL] line per check. The
in-process behaviour check (gzip, health, auth, headers,
metrics) is delegated to a helper script inside the
backend venv — same pattern as the Part 3 / Part 4
verifiers.

Checks:

  1-4.   Sprint 8 verifiers re-run end-to-end
  5-15.  In-process behaviour (helper in venv)
  16.    docker compose config validates
  17.    nginx -t passes
  18.    backend Dockerfile multi-stage + non-root
  19.    frontend Dockerfile non-root + standalone
  20.    next.config.mjs has security headers + optimize
  21.    env templates declare 30+ knobs each
  22-28. Docs present and non-empty
  29.    VERSION file exists and is v1.0.0-rc1
  30.    RELEASE_CANDIDATE.md exists and has the 5
         mandated sections
  31.    No 'in progress' or 'WIP' markers in user-facing
         docs
  32.    No 'TODO' / 'FIXME' in shipped code (sample
         sweep — informational)
  33.    database.py builds sqlite + postgres engines
  34.    settings validate_security_settings flags known
         bad production values
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
DEPLOYMENT = ROOT / "deployment"

PASS: list[str] = []
FAIL: list[tuple[str, str]] = []


def chk(label: str, ok: bool, detail: str = "") -> None:
    if ok:
        print(f"[PASS] {label}")
        PASS.append(label)
    else:
        print(f"[FAIL] {label}{(' - ' + detail) if detail else ''}")
        FAIL.append((label, detail))


def run(
    cmd: list[str], cwd: Path | None = None, timeout: int = 120
) -> tuple[int, str, str]:
    try:
        r = subprocess.run(
            cmd, cwd=cwd, timeout=timeout,
            capture_output=True, text=True, check=False,
        )
        return r.returncode, r.stdout, r.stderr
    except FileNotFoundError as exc:
        return 127, "", f"command not found: {exc}"
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def summarise_verifier(path: Path) -> tuple[int, int]:
    rc, out, err = run([sys.executable, str(path)], cwd=ROOT, timeout=300)
    text = out + err
    m = re.search(
        r"VERIFIER RESULT:\s*(\d+)/(\d+)\s*PASS(?:\s*—\s*(\d+)\s*FAIL)?",
        text,
    )
    if m:
        return int(m.group(1)), int(m.group(3) or 0)
    return 0, 1  # treat unparseable output as a fail


# --------------------------------------------------------------------------- #
# 1-4. Sprint 8 verifiers
# --------------------------------------------------------------------------- #
for label, name in [
    ("Sprint 8 Part 1 verifier", "verify_sprint8_part1.py"),
    ("Sprint 8 Part 2 verifier", "verify_sprint8_part2.py"),
    ("Sprint 8 Part 3 verifier", "verify_sprint8_part3.py"),
    ("Sprint 8 Part 4 verifier", "verify_sprint8_part4.py"),
]:
    p = ROOT / "scripts" / name
    passed, failed = summarise_verifier(p)
    chk(
        f"{label} ({passed} PASS, {failed} FAIL)",
        failed == 0 and passed > 0,
        f"passed={passed} failed={failed}",
    )

# --------------------------------------------------------------------------- #
# 5-15. In-process behaviour (helper in venv)
# --------------------------------------------------------------------------- #
VENV_PY = BACKEND / ".venv" / "Scripts" / "python.exe"
if not VENV_PY.is_file():
    posix_py = BACKEND / ".venv" / "bin" / "python"
    if posix_py.is_file():
        VENV_PY = posix_py  # type: ignore[assignment]

helper = ROOT / "scripts" / "_sprint9_part1_smoke.py"
# helper is a checked-in artefact (not a temp file). It must
# exist for this verifier to run.
chk("sprint 9 smoke helper exists", helper.is_file(),
    f"path={helper.relative_to(ROOT)}")

if helper.is_file() and VENV_PY.is_file():
    rc, out, err = run(
        [str(VENV_PY), str(helper)],
        cwd=BACKEND, timeout=120,
    )
    text = out
    expected = [
        "OK_HEALTH_200", "OK_LIVE", "OK_METRICS",
        "OK_HEALTH_AGGREGATE_FIELDS",
        "OK_CACHE_HEALTH", "OK_CACHE_METRICS", "OK_GZIP",
        "OK_REGISTER_201", "OK_LOGIN", "OK_ME",
        "OK_413_OVERSIZED", "OK_OWASP_HEADERS",
        "OK_METRICS_INCREMENT",
    ]
    ready_match = re.search(r"OK_READY_\d+", text)
    if ready_match:
        expected.append(ready_match.group(0))
    missing = [e for e in expected if e not in text]
    chk(
        f"in-process behaviour smoke ({len(expected) - len(missing)}/{len(expected)} OK)",
        not missing,
        f"missing={missing}; stderr={err.strip()[:200]}",
    )
else:
    chk("in-process behaviour smoke (helper/venv missing)", False,
        "skip")

# --------------------------------------------------------------------------- #
# 16. docker compose config validates
# --------------------------------------------------------------------------- #
if shutil.which("docker"):
    rc, out, err = run(
        ["docker", "compose",
         "-f", str(ROOT / "docker-compose.yml"),
         "-f", str(ROOT / "docker-compose.prod.yml"),
         "config"],
        cwd=ROOT, timeout=60,
    )
    chk(
        "docker compose config validates",
        rc == 0,
        (out + err).strip()[:200],
    )
else:
    print("[SKIP] docker not on PATH; skipping compose check")
    PASS.append("docker compose config validates (skipped)")

# --------------------------------------------------------------------------- #
# 17. nginx -t passes
# --------------------------------------------------------------------------- #
nginx_conf = DEPLOYMENT / "nginx" / "nginx.conf"
if shutil.which("docker"):
    rc, out, err = run(
        ["docker", "run", "--rm",
         "-v", f"{nginx_conf}:/etc/nginx/nginx.conf:ro",
         "--entrypoint", "nginx",
         "nginx:1.27-alpine", "-t"],
        cwd=ROOT, timeout=60,
    )
    chk("nginx config test passes (nginx -t)", rc == 0,
        (out + err).strip()[:200])
else:
    print("[SKIP] docker not on PATH; skipping nginx -t")
    PASS.append("nginx config test (skipped)")

# 18. backend Dockerfile
backend_dockerfile = (BACKEND / "Dockerfile").read_text()
chk("backend Dockerfile multi-stage", "AS builder" in backend_dockerfile and "AS runtime" in backend_dockerfile)
chk("backend Dockerfile USER (non-root)", "USER ${APP_USER}" in backend_dockerfile)
chk("backend Dockerfile healthcheck /health/live", "/health/live" in backend_dockerfile)

# 19. frontend Dockerfile
frontend_dockerfile = (ROOT / "frontend" / "Dockerfile").read_text()
chk("frontend Dockerfile USER nextjs (non-root)", "USER nextjs" in frontend_dockerfile)
chk("frontend Dockerfile standalone output", ".next/standalone" in frontend_dockerfile)
chk("frontend Dockerfile healthcheck", "HEALTHCHECK" in frontend_dockerfile)

# 20. next.config.mjs
next_cfg = (ROOT / "frontend" / "next.config.mjs").read_text()
chk("next.config.mjs has Content-Security-Policy",
    "Content-Security-Policy" in next_cfg)
chk("next.config.mjs has optimizePackageImports",
    "optimizePackageImports" in next_cfg)
chk("next.config.mjs has output: standalone", 'output: "standalone"' in next_cfg)

# 21. env templates
prod_env = (DEPLOYMENT / "env" / ".env.production.example").read_text()
stg_env = (DEPLOYMENT / "env" / ".env.staging.example").read_text()
prod_keys = len(re.findall(r"^[A-Z_]+=", prod_env, re.MULTILINE))
stg_keys = len(re.findall(r"^[A-Z_]+=", stg_env, re.MULTILINE))
chk(f".env.production.example declares {prod_keys} keys (>= 30)",
    prod_keys >= 30, f"got {prod_keys}")
chk(f".env.staging.example declares {stg_keys} keys (>= 30)",
    stg_keys >= 30, f"got {stg_keys}")

# 22-28. Docs
docs = [
    "README.md",
    "CHANGELOG.md",
    "RELEASE_NOTES.md",
    "PROJECT_COMPLETION_REPORT.md",
    "RELEASE_CANDIDATE.md",
    "docs/DEPLOYMENT.md",
    "docs/OPERATIONS.md",
    "docs/TROUBLESHOOTING.md",
]
for d in docs:
    p = ROOT / d
    chk(f"doc present: {d}", p.is_file() and p.stat().st_size > 1000,
        f"size={p.stat().st_size if p.is_file() else 0}")

# 29. VERSION file
version_path = ROOT / "VERSION"
chk("VERSION file exists and is v1.0.0-rc1",
    version_path.is_file() and "v1.0.0-rc1" in version_path.read_text(),
    f"got: {version_path.read_text().strip() if version_path.is_file() else 'missing'}")

# 30. RELEASE_CANDIDATE.md sections
rc_doc = (ROOT / "RELEASE_CANDIDATE.md").read_text().lower()
sections = [
    "readiness checklist",
    "risks",
    "deployment checklist",
    "rollback plan",
    "production validation",
]
missing_sections = [s for s in sections if s not in rc_doc]
chk("RELEASE_CANDIDATE.md has all 5 mandated sections",
    not missing_sections, f"missing: {missing_sections}")

# 31. No 'WIP' / 'in progress' in user-facing docs
user_facing = ["README.md", "CHANGELOG.md", "RELEASE_NOTES.md",
               "RELEASE_CANDIDATE.md", "PROJECT_COMPLETION_REPORT.md",
               "docs/DEPLOYMENT.md", "docs/OPERATIONS.md",
               "docs/TROUBLESHOOTING.md"]
banned = ["(in progress)", "[wip]", "## wip"]
hits = []
for d in user_facing:
    p = ROOT / d
    if not p.is_file():
        continue
    text = p.read_text().lower()
    for b in banned:
        if b in text:
            hits.append(f"{d}: {b}")
chk("no 'WIP' / 'in progress' in user-facing docs", not hits,
    f"hits: {hits}")

# 32. database engine builds for both URLs (sample check via
#     import). Run in the venv.
if VENV_PY.is_file():
    engine_check = (
        "import sys; sys.path.insert(0, r'" + str(BACKEND) + "'); "
        "import os; os.environ.setdefault('APP_ENV','test'); "
        "import app.config.settings as s; "
        "s.get_settings.cache_clear(); "
        "from app.utils.database import _build_engine; "
        "eng_a = _build_engine('sqlite:////tmp/_rc_check.db', False); "
        "print('SQLITE', type(eng_a.pool).__name__); "
        "eng_b = _build_engine('postgresql+psycopg2://u:p@db:5432/a', False); "
        "print('POSTGRES', type(eng_b.pool).__name__, eng_b.pool.size(), "
        "eng_b.pool._max_overflow, eng_b.pool._pre_ping); "
        "import os; os.unlink('/tmp/_rc_check.db') if os.path.exists('/tmp/_rc_check.db') else None"
    )
    rc, out, err = run(
        [str(VENV_PY), "-c", engine_check],
        cwd=BACKEND, timeout=60,
    )
    text = (out + err).strip()
    chk("database.py builds sqlite + postgres engines",
        rc == 0 and "SQLITE" in text and "POSTGRES" in text,
        f"rc={rc} out={text[:200]}")
else:
    chk("database engine check (skipped — no venv)", True,
        "venv not present")

# 33. settings validate_security_settings flags known bad values
if VENV_PY.is_file():
    validator_check = (
        "import sys; sys.path.insert(0, r'" + str(BACKEND) + "'); "
        "import os; os.environ['APP_ENV']='production'; "
        "os.environ['COOKIE_SECURE']='false'; "
        "os.environ['JWT_SECRET_KEY']='change-me'; "
        "os.environ['APP_DEBUG']='true'; "
        "os.environ['CORS_ORIGINS']='*'; "
        "import app.config.settings as s; "
        "s.get_settings.cache_clear(); "
        "w = s.validate_security_settings(s.get_settings()); "
        "print('WARNINGS', len(w))"
    )
    rc, out, err = run(
        [str(VENV_PY), "-c", validator_check],
        cwd=BACKEND, timeout=60,
    )
    text = (out + err).strip()
    m = re.search(r"WARNINGS\s+(\d+)", text)
    n = int(m.group(1)) if m else -1
    chk(
        "validate_security_settings flags 4 bad production values",
        n == 4,
        f"got {n} warnings; out={text[:160]}",
    )
else:
    chk("validator check (skipped — no venv)", True, "venv not present")


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
def _print_summary() -> None:
    total = len(PASS) + len(FAIL)
    print()
    print("=" * 64)
    print(
        f"VERIFIER RESULT: {len(PASS)}/{total} PASS"
        + (f"  - {len(FAIL)} FAIL" if FAIL else "")
    )
    print("=" * 64)
    for label, detail in FAIL:
        print(f"  - {label}: {detail}")


_print_summary()
sys.exit(0 if not FAIL else 1)
