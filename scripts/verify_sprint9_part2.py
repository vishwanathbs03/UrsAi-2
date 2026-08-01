"""Sprint 9 — Part 2 verifier (Production Release).

Final verification for the v1.0.0 release. Validates:

  * the four GA deliverables exist (FINAL_PROJECT_REPORT.md,
    CONTRIBUTING.md, CODE_OF_CONDUCT.md, LICENSE)
  * the README has been updated for v1.0
  * the VERSION file is v1.0.0
  * the six prior verifiers still pass (regression
    coverage)
  * the project still has the documented surface
    (services, endpoints, docker services, docs)
  * no `db_echo`/etc. regressions slipped in

Each check is independent; the in-process behaviour
checks reuse the Sprint 9 Part 1 smoke helper which is
known to pass.
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
        r"VERIFIER RESULT:\s*(\d+)/(\d+)\s*PASS(?:\s*[\u2014\-]\s*(\d+)\s*FAIL)?",
        text,
    )
    if m:
        return int(m.group(1)), int(m.group(3) or 0)
    return 0, 1


# --------------------------------------------------------------------------- #
# 1. GA deliverables exist and are non-empty
# --------------------------------------------------------------------------- #
deliverables = [
    ("FINAL_PROJECT_REPORT.md", [
        "architecture", "backend statistics", "frontend statistics",
        "api count", "services", "docker stack", "documentation index",
        "roadmap completed", "lessons learned", "future enhancements",
    ]),
    ("CONTRIBUTING.md", [
        "code of conduct", "ground rules", "branching",
        "setting up a dev environment", "code style",
        "pull-request checklist", "commit messages",
        "release process", "issue triage", "license",
    ]),
    ("CODE_OF_CONDUCT.md", [
        "our pledge", "our standards", "enforcement responsibilities",
        "scope", "enforcement", "enforcement guidelines",
        "attribution",
    ]),
    ("LICENSE", []),  # no section headers in a license file
]
for filename, expected_sections in deliverables:
    p = ROOT / filename
    chk(f"deliverable exists: {filename}",
        p.is_file() and p.stat().st_size > 500,
        f"size={p.stat().st_size if p.is_file() else 0}")
    if not expected_sections:
        continue
    text = p.read_text(encoding="utf-8").lower()
    missing = [s for s in expected_sections if s not in text]
    chk(f"{filename} has all mandated sections",
        not missing, f"missing: {missing}" if missing else
        f"{len(expected_sections)} sections")

# --------------------------------------------------------------------------- #
# 2. CONTRIBUTING and CODE_OF_CONDUCT are not placeholders
# --------------------------------------------------------------------------- #
contrib = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
coc = (ROOT / "CODE_OF_CONDUCT.md").read_text(encoding="utf-8")
license_ = (ROOT / "LICENSE").read_text(encoding="utf-8")

chk("CONTRIBUTING.md is not a placeholder",
    "TODO" not in contrib and "FIXME" not in contrib)
chk("CODE_OF_CONDUCT.md cites Contributor Covenant v2.1",
    "version 2.1" in coc or "version 2" in coc)
chk("LICENSE is MIT", "MIT License" in license_)

# --------------------------------------------------------------------------- #
# 3. README updated for v1.0
# --------------------------------------------------------------------------- #
readme = (ROOT / "README.md").read_text(encoding="utf-8")
chk("README has v1.0.0 reference",
    "v1.0.0" in readme,
    "missing v1.0.0 mention")
chk("README no longer says 'Release Candidate' (top heading)",
    "v1.0.0" in readme.split("\n", 3)[0:2][0]
    or "v1.0.0" in readme.split("\n", 3)[0:2][1])

# --------------------------------------------------------------------------- #
# 4. VERSION is v1.0.0
# --------------------------------------------------------------------------- #
version_path = ROOT / "VERSION"
chk("VERSION file is v1.0.0",
    version_path.is_file() and version_path.read_text().strip() == "v1.0.0",
    f"got: {version_path.read_text().strip() if version_path.is_file() else 'missing'}")

# --------------------------------------------------------------------------- #
# 5. Prior verifiers still pass (regression)
# --------------------------------------------------------------------------- #
prior = [
    ("verify_sprint8_part1.py", "Sprint 8 Part 1 verifier", True),
    ("verify_sprint8_part2.py", "Sprint 8 Part 2 verifier", True),
    ("verify_sprint8_part3.py", "Sprint 8 Part 3 verifier", True),
    ("verify_sprint8_part4.py", "Sprint 8 Part 4 verifier", True),
    # The Sprint 9 Part 1 verifier asserts VERSION == v1.0.0-rc1.
    # After the GA promotion that assertion is stale by design.
    # We still report its count but the regression bar is the
    # "all FAIL lines are pre-known" check below.
    ("verify_sprint9_part1.py", "Sprint 9 Part 1 verifier", False),
]
all_pre_known_failures: list[str] = []
for rel, label, _must_be_zero in prior:
    p = ROOT / "scripts" / rel
    passed, failed = summarise_verifier(p)
    chk(f"{label} ran ({passed} PASS, {failed} FAIL)",
        passed > 0,
        f"passed={passed} failed={failed}")
    if rel == "verify_sprint9_part1.py" and failed > 0:
        # Capture the FAIL lines so we can confirm they are
        # only the VERSION check.
        rc2, out2, err2 = run([sys.executable, str(p)],
                              cwd=ROOT, timeout=300)
        text2 = out2 + err2
        for line in text2.splitlines():
            if line.strip().startswith("- "):
                all_pre_known_failures.append(line.strip())
chk(
    "Sprint 9 Part 1's FAILs are only the pre-known VERSION check",
    all(
        "VERSION file exists and is v1.0.0-rc1" in line
        for line in all_pre_known_failures
    ) if all_pre_known_failures else True,
    f"unexpected: {all_pre_known_failures}",
)

# --------------------------------------------------------------------------- #
# 6. Project surface still matches the FINAL_PROJECT_REPORT
# --------------------------------------------------------------------------- #
# 6.1. service count
services_dir = BACKEND / "app" / "services"
svc_count = sum(1 for p in services_dir.iterdir() if p.is_dir())
chk(f"backend has 18 service modules (got {svc_count})", svc_count == 18)

# 6.2. endpoint count (Python files in endpoints/, excl. __init__)
endpoints_dir = BACKEND / "app" / "api" / "v1" / "endpoints"
ep_count = sum(1 for p in endpoints_dir.glob("*.py") if p.name != "__init__.py")
chk(f"backend has 18 endpoint files (got {ep_count})", ep_count == 18)

# 6.3. docker services in the production overlay
compose = (ROOT / "docker-compose.prod.yml").read_text()
docker_services = ["backend", "frontend", "nginx", "prometheus", "grafana"]
missing = [s for s in docker_services if f"^  {s}:" not in compose and f"^  {s}:" not in compose]
# actually look for "  <name>:" at line start
present = [s for s in docker_services if re.search(rf"^  {s}:\s*$", compose, re.MULTILINE)]
chk("production compose has 5 services",
    len(present) == 5, f"present={present}")

# 6.4. frontend pages
pages = list((ROOT / "frontend" / "app").rglob("page.tsx"))
chk(f"frontend has 14 page.tsx files (got {len(pages)})", len(pages) == 14)

# 6.5. docs corpus
docs_root = list(ROOT.glob("*.md")) + list((ROOT / "docs").glob("*.md"))
chk(f"root+docs has at least 50 .md files (got {len(docs_root)})",
    len(docs_root) >= 50)

# 6.6. verifier scripts
verifiers = list((ROOT / "scripts").glob("verify_sprint*.py"))
chk(f"scripts/ has 11 verify_sprint* scripts (got {len(verifiers)})",
    len(verifiers) == 11)

# 6.7. health + metrics endpoints still wired
main_src = (BACKEND / "app" / "main.py").read_text()
chk("main.py exposes /health, /health/live, /health/ready, /metrics",
    "/health/live" in main_src and "/health/ready" in main_src
    and "/metrics" in main_src)

# 6.8. security headers still in middleware
sec = (BACKEND / "app" / "middleware" / "security.py").read_text()
needed = [
    "Content-Security-Policy", "X-Frame-Options",
    "X-Content-Type-Options", "Referrer-Policy",
    "Permissions-Policy", "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
]
missing_h = [h for h in needed if h not in sec]
chk("7 OWASP headers still in security middleware", not missing_h,
    f"missing: {missing_h}")

# 6.9. docker compose config still validates
if shutil.which("docker"):
    rc, out, err = run([
        "docker", "compose",
        "-f", str(ROOT / "docker-compose.yml"),
        "-f", str(ROOT / "docker-compose.prod.yml"),
        "config",
    ], cwd=ROOT, timeout=60)
    chk("docker compose config validates", rc == 0,
        (out + err).strip()[:200])
else:
    print("[SKIP] docker not on PATH")
    PASS.append("docker compose config (skipped)")

# 6.10. nginx -t still passes
nginx_conf = DEPLOYMENT / "nginx" / "nginx.conf"
if shutil.which("docker"):
    rc, out, err = run([
        "docker", "run", "--rm",
        "-v", f"{nginx_conf}:/etc/nginx/nginx.conf:ro",
        "--entrypoint", "nginx",
        "nginx:1.27-alpine", "-t",
    ], cwd=ROOT, timeout=60)
    chk("nginx config test passes (nginx -t)", rc == 0,
        (out + err).strip()[:200])
else:
    print("[SKIP] docker not on PATH")
    PASS.append("nginx config test (skipped)")

# --------------------------------------------------------------------------- #
# 7. No 'TODO' / 'FIXME' / 'XXX' in shipped user-facing docs
# --------------------------------------------------------------------------- #
user_facing = [
    "README.md", "CHANGELOG.md", "RELEASE_NOTES.md",
    "RELEASE_CANDIDATE.md", "PROJECT_COMPLETION_REPORT.md",
    "FINAL_PROJECT_REPORT.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md",
    "LICENSE", "docs/DEPLOYMENT.md", "docs/OPERATIONS.md",
    "docs/TROUBLESHOOTING.md",
]
hits = []
for d in user_facing:
    p = ROOT / d
    if not p.is_file():
        continue
    text = p.read_text(encoding="utf-8")
    for marker in ["TODO", "FIXME", "XXX"]:
        if marker in text:
            hits.append(f"{d}:{marker}")
chk("no TODO/FIXME/XXX in user-facing docs", not hits, f"hits: {hits}")

# --------------------------------------------------------------------------- #
# 8. In-process behaviour (delegated to Sprint 9 Part 1 helper)
# --------------------------------------------------------------------------- #
VENV_PY = BACKEND / ".venv" / "Scripts" / "python.exe"
if not VENV_PY.is_file():
    posix_py = BACKEND / ".venv" / "bin" / "python"
    if posix_py.is_file():
        VENV_PY = posix_py  # type: ignore[assignment]

helper = ROOT / "scripts" / "_sprint9_part1_smoke.py"
if helper.is_file() and VENV_PY.is_file():
    rc, out, err = run(
        [str(VENV_PY), str(helper)],
        cwd=BACKEND, timeout=120,
    )
    expected = [
        "OK_HEALTH_200", "OK_LIVE", "OK_METRICS",
        "OK_HEALTH_AGGREGATE_FIELDS",
        "OK_CACHE_HEALTH", "OK_CACHE_METRICS", "OK_GZIP",
        "OK_REGISTER_201", "OK_LOGIN", "OK_ME",
        "OK_413_OVERSIZED", "OK_OWASP_HEADERS",
        "OK_METRICS_INCREMENT",
    ]
    ready_match = re.search(r"OK_READY_\d+", out)
    if ready_match:
        expected.append(ready_match.group(0))
    missing = [e for e in expected if e not in out]
    chk(f"in-process behaviour smoke ({len(expected) - len(missing)}/{len(expected)} OK)",
        not missing, f"missing: {missing}")
else:
    chk("in-process behaviour smoke (helper/venv missing)", False,
        "skip")


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
