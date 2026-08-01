"""
verify_sprint7_part2.py - ad-hoc verifier for Sprint 7 Part 2
(AI Provider Layer / Ollama provider).

In-tree copy lives at D:/MSME/UrsAi/scripts/verify_sprint7_part2.py.

Checks
------
  1.  File-existence: every spec-named file under
      backend/app/services/ai/providers/ is on disk.
  2.  Settings: AI_PROVIDER / OLLAMA_BASE_URL / OLLAMA_MODEL /
      AI_REQUEST_TIMEOUT_SECONDS are exposed on Settings and
      AI_API_KEY is still present (no regression).
  3.  Layer importable: a single import line pulls in every
      public symbol the verifier uses.
  4.  Fallback path: with ai_provider='placeholder' (or
      'ollama' pointed at an unreachable host), the
      service.generate() returns an AssistantResponse whose
      model='deterministic-fallback' and fallback_used=True.
  5.  Two-call determinism (fallback path): calling
      AssistantProviderService.generate() twice with the
      same fixtures produces byte-identical responses
      (sans generated_at).
  6.  Ollama happy path (with a stubbed httpx): when the
      configured Ollama host returns a valid JSON body,
      the provider uses it (model='ollama:<name>',
      fallback_used=False, body non-empty).
  7.  Ollama unreachable path: a stubbed httpx that
      raises ConnectError -> AssistantProviderService
      drops down to the fallback (graceful degradation).
  8.  Ollama timeout path: a stubbed httpx that raises
      ReadTimeout -> AssistantProviderService drops down
      to the fallback.
  9.  Ollama HTTP 500 path: a stubbed httpx that returns
      500 -> Provider raises AIProviderError (NOT a
      silent fallback; callers should see the error).
 10.  No existing-API change: the existing AI engine
      service, the Copilot service, the AIDecisionService
      payloads, and the Sprint 7 Part 1 frontend builder
      are byte-unchanged on disk (mtime before the
      milestone boundary, no .py edits after sentinel).
 11.  Out-of-scope absence: no OpenAI / Anthropic /
      Gemini / Azure / streaming imports anywhere in the
      new package; the public symbols do not leak any
      of those names.
 12.  Frontend untouched: no files under frontend/ have
      been modified after the assistant page sentinel.

Ad-hoc verification, not suite green. Re-run any time.
"""
from __future__ import annotations

import importlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"D:\MSME\UrsAi")
BACKEND = ROOT / "backend"
PROVIDERS = BACKEND / "app" / "services" / "ai" / "providers"
FRONTEND = ROOT / "frontend"
ASSISTANT_PAGE = FRONTEND / "app" / "(app)" / "assistant" / "page.tsx"
VENV_PY = BACKEND / ".venv" / "Scripts" / "python.exe"

ok = True


def chk(label, cond, detail=""):
    global ok
    tag = "PASS" if cond else "FAIL"
    suffix = " - " + detail if detail else ""
    print(f"[{tag}] {label}{suffix}", flush=True)
    if not cond:
        ok = False


# --------------------------------------------------------------------------- #
# 1. File existence
# --------------------------------------------------------------------------- #

print("\n=== 1. File-existence check ===")
required = {
    "Package init": PROVIDERS / "__init__.py",
    "Provider protocol + dataclasses": PROVIDERS / "base.py",
    "Assistant context builder": PROVIDERS / "context_builder.py",
    "Assistant prompt builder": PROVIDERS / "prompt_builder.py",
    "Ollama provider": PROVIDERS / "ollama.py",
    "Provider factory": PROVIDERS / "factory.py",
    "Assistant provider service": PROVIDERS / "service.py",
}
for n, p in required.items():
    chk(f"file:{n}", p.exists(), str(p.relative_to(ROOT)))


# --------------------------------------------------------------------------- #
# 2. Settings
# --------------------------------------------------------------------------- #

print("\n=== 2. Settings check ===")
# Bootstrap minimal pydantic-settings for the import.
sys.path.insert(0, str(BACKEND))
try:
    # Clear any cached module to avoid stale settings.
    for mod in list(sys.modules):
        if mod.startswith("app.config"):
            del sys.modules[mod]
    settings_mod = importlib.import_module("app.config.settings")
    settings_cls = settings_mod.Settings
    # Build with all env vars overridden so .env does not
    # leak real values.
    import os
    env_backup = os.environ.copy()
    try:
        os.environ["AI_PROVIDER"] = "placeholder"
        os.environ["OLLAMA_BASE_URL"] = "http://localhost:11434"
        os.environ["OLLAMA_MODEL"] = "llama3.1"
        os.environ["AI_REQUEST_TIMEOUT_SECONDS"] = "60"
        os.environ["AI_API_KEY"] = ""
        s = settings_cls()
    finally:
        os.environ.clear()
        os.environ.update(env_backup)
    chk("Settings.ai_provider present", hasattr(s, "ai_provider"), repr(s.ai_provider))
    chk("Settings.ollama_base_url present", hasattr(s, "ollama_base_url"), repr(s.ollama_base_url))
    chk("Settings.ollama_model present", hasattr(s, "ollama_model"), repr(s.ollama_model))
    chk("Settings.ai_request_timeout_seconds present", hasattr(s, "ai_request_timeout_seconds"), repr(s.ai_request_timeout_seconds))
    chk("Settings.ai_api_key preserved", hasattr(s, "ai_api_key"), repr(s.ai_api_key))
finally:
    sys.path.pop(0)


# --------------------------------------------------------------------------- #
# 3. Layer importable
# --------------------------------------------------------------------------- #

print("\n=== 3. Public symbol import ===")
sys.path.insert(0, str(BACKEND))
try:
    layer_mod = importlib.import_module("app.services.ai.providers")
    public_names = [
        "AIProviderError",
        "AssistantContext",
        "AssistantContextBuilder",
        "AssistantPromptBuilder",
        "AssistantProviderService",
        "AssistantRequest",
        "AssistantResponse",
        "AssistantTurn",
        "DeterministicFallbackProvider",
        "OllamaProvider",
        "Provider",
        "ProviderFactory",
        "ProviderTimeoutError",
        "ProviderUnavailableError",
    ]
    missing = [n for n in public_names if not hasattr(layer_mod, n)]
    chk(f"all {len(public_names)} public symbols exported", not missing,
        f"missing: {missing}" if missing else "")
finally:
    sys.path.pop(0)


# --------------------------------------------------------------------------- #
# Build a tiny "fixtures" backend so the verifier doesn't need a real DB.
# --------------------------------------------------------------------------- #

FIXTURES_PY = r'''
"""In-test fixtures for the Sprint 7 Part 2 verifier.

Five tiny provider callables that return canned upstream
payloads. The verifier wires them into an
:class:`AssistantContextBuilder` and exercises the service.
"""
from typing import Any


_TWIN = {
    "generated_at": "2026-01-01T00:00:00Z",
    "current_health": {"overall_business_score": 58},
    "dna": {
        "dna": {
            "archetype": {
                "key": "scaling_operator",
                "title": "Scaling Operator",
                "match_score": 72,
            },
        },
    },
    "health_summary": {
        "overall_health": {"score": 58, "level": "Established"},
        "scores": [
            {"key": "export", "title": "Export Readiness", "score": 30, "level": "Low"},
            {"key": "digital", "title": "Digital Maturity", "score": 65, "level": "Medium"},
            {"key": "compliance", "title": "Compliance", "score": 80, "level": "High"},
            {"key": "growth", "title": "Growth", "score": 55, "level": "Medium"},
            {"key": "innovation", "title": "Innovation", "score": 40, "level": "Medium"},
        ],
    },
}

_RECS = {
    "generated_at": "2026-01-01T00:00:00Z",
    "recommendations": [
        {"id": "R-1", "title": "Improve digital presence",
         "category": "export_readiness_actions", "priority": "High",
         "estimated_score_gain": 8, "estimated_roi": 4000,
         "estimated_timeline": "3 weeks"},
        {"id": "R-2", "title": "Open an export channel",
         "category": "export_readiness_actions", "priority": "Critical",
         "estimated_score_gain": 12, "estimated_roi": 9000,
         "estimated_timeline": "6 weeks"},
        {"id": "R-3", "title": "Comply with GDPR for EU buyers",
         "category": "compliance_actions", "priority": "Medium",
         "estimated_score_gain": 5, "estimated_roi": 1500,
         "estimated_timeline": "4 weeks"},
    ],
}

_ROADMAP = {
    "generated_at": "2026-01-01T00:00:00Z",
    "items": [
        {"id": "ri-1", "title": "Improve digital presence",
         "phase": "Immediate", "priority": "High",
         "estimated_start_order": 1, "completion_percentage": 0,
         "expected_score_improvement": 8},
        {"id": "ri-2", "title": "Open an export channel",
         "phase": "Short-Term", "priority": "Critical",
         "estimated_start_order": 2, "completion_percentage": 0,
         "expected_score_improvement": 12},
    ],
}

_RULES = {
    "generated_at": "2026-01-01T00:00:00Z",
    "categories": {
        "export_readiness_actions": {
            "firings": [
                {"id": "rule.export.no_iec",
                 "title": "No IEC certificate on file",
                 "priority": "Critical",
                 "estimated_impact": 7,
                 "reason": "Export intent declared but no IEC number captured."},
            ],
        },
        "digital_transformation_actions": {
            "firings": [
                {"id": "rule.digital.no_site",
                 "title": "No business website",
                 "priority": "High",
                 "estimated_impact": 4,
                 "reason": "Digital presence is below 60/100."},
            ],
        },
    },
}

_DECISION = {
    "generated_at": "2026-01-01T00:00:00Z",
    "decision": {
        "summary": "Scaling profile with one Critical export gap.",
        "insights": [
            {"id": "insight.export", "title": "Push to export readiness",
             "priority": "Critical", "confidence": 78},
            {"id": "insight.digital", "title": "Build digital presence",
             "priority": "High", "confidence": 70},
        ],
    },
}


def twin_provider(_owner_id: int) -> dict[str, Any]:
    return _TWIN


def recs_provider(_owner_id: int) -> dict[str, Any]:
    return _RECS


def roadmap_provider(_owner_id: int) -> dict[str, Any]:
    return _ROADMAP


def rules_provider(_owner_id: int) -> dict[str, Any]:
    return _RULES


def decision_provider(_owner_id: int) -> dict[str, Any]:
    return _DECISION
'''


def _run_module(label, code):
    """Run a chunk of code in the venv with the backend on sys.path."""
    full = (
        "import sys\n"
        "sys.path.insert(0, r'" + str(BACKEND).replace("\\", "\\\\") + "')\n"
        + code
    )
    r = subprocess.run(
        [str(VENV_PY), "-c", full],
        cwd=str(BACKEND),
        capture_output=True,
        text=True,
        timeout=60,
    )
    print(f"--- {label} stdout ---", flush=True)
    print(r.stdout, flush=True)
    if r.stderr:
        print(f"--- {label} stderr ---", flush=True)
        print(r.stderr, flush=True)
    print(f"--- {label} exit={r.returncode} ---", flush=True)
    return r


# --------------------------------------------------------------------------- #
# 4 + 5. Fallback path + two-call determinism
# --------------------------------------------------------------------------- #

print("\n=== 4+5. Fallback path + determinism ===")
prog = (
    "import json, sys\n"
    "sys.path.insert(0, r'" + str(BACKEND).replace("\\", "\\\\") + "')\n"
    "from app.services.ai.providers import (\n"
    "    AssistantContextBuilder, AssistantProviderService, ProviderFactory,\n"
    "    DeterministicFallbackProvider, AIProviderError,\n"
    "    ProviderUnavailableError, ProviderTimeoutError,\n"
    ")\n"
    + FIXTURES_PY + "\n"
    "builder = AssistantContextBuilder(\n"
    "    twin_provider=twin_provider, recommendations_provider=recs_provider,\n"
    "    roadmap_provider=roadmap_provider, rules_provider=rules_provider,\n"
    "    insights_provider=decision_provider,\n"
    ")\n"
    "class _StubSettings:\n"
    "    ai_provider = 'placeholder'\n"
    "    ollama_base_url = ''\n"
    "    ollama_model = ''\n"
    "    ai_request_timeout_seconds = 60.0\n"
    "factory = ProviderFactory(_StubSettings())\n"
    "service = AssistantProviderService(context_builder=builder, provider_factory=factory)\n"
    "r1 = service.generate(owner_id=1, user_prompt='What should I do first?')\n"
    "r2 = service.generate(owner_id=1, user_prompt='What should I do first?')\n"
    "print('PROVIDER_USED_1', r1.provider_used)\n"
    "print('FALLBACK_USED_1', r1.fallback_used)\n"
    "print('MODEL_1', r1.model)\n"
    "print('BODY_LEN_1', len(r1.body))\n"
    "out1 = json.dumps({'body': r1.body, 'model': r1.model, 'fallback_used': r1.fallback_used,\n"
    "                   'provider_used': r1.provider_used,\n"
    "                   'twin_generated_at': r1.twin_generated_at}, sort_keys=True)\n"
    "out2 = json.dumps({'body': r2.body, 'model': r2.model, 'fallback_used': r2.fallback_used,\n"
    "                   'provider_used': r2.provider_used,\n"
    "                   'twin_generated_at': r2.twin_generated_at}, sort_keys=True)\n"
    "print('DETERMINISTIC', out1 == out2)\n"
    "print('HAS_OVERALL', '58/100' in r1.body)\n"
    "print('HAS_DNA', 'Scaling Operator' in r1.body)\n"
    "print('HAS_RECS', 'Improve digital presence' in r1.body)\n"
    "print('HAS_ROADMAP_FIRST', 'Improve digital presence' in r1.body)\n"
)
r = _run_module("fallback", prog)
def get_marker(name, text):
    for line in text.splitlines():
        if line.startswith(name + " "):
            return line[len(name) + 1:].strip()
    return None
out = r.stdout
chk("fallback: provider_used == 'deterministic-fallback'",
    get_marker("PROVIDER_USED_1", out) == "deterministic-fallback",
    repr(get_marker("PROVIDER_USED_1", out)))
chk("fallback: fallback_used is True",
    get_marker("FALLBACK_USED_1", out) == "True",
    repr(get_marker("FALLBACK_USED_1", out)))
chk("fallback: model == 'deterministic-fallback'",
    get_marker("MODEL_1", out) == "deterministic-fallback",
    repr(get_marker("MODEL_1", out)))
chk("fallback: body non-empty",
    (get_marker("BODY_LEN_1", out) or "0") != "0",
    repr(get_marker("BODY_LEN_1", out)))
chk("fallback: body mentions overall score",
    get_marker("HAS_OVERALL", out) == "True")
chk("fallback: body mentions DNA archetype",
    get_marker("HAS_DNA", out) == "True")
chk("fallback: body mentions top recommendation",
    get_marker("HAS_RECS", out) == "True")
chk("fallback: two-call deterministic",
    get_marker("DETERMINISTIC", out) == "True",
    repr(get_marker("DETERMINISTIC", out)))


# --------------------------------------------------------------------------- #
# 6. Ollama happy path - stubbed httpx
# --------------------------------------------------------------------------- #

print("\n=== 6. Ollama happy path (stubbed httpx) ===")
prog = (
    "import json, sys\n"
    "sys.path.insert(0, r'" + str(BACKEND).replace("\\", "\\\\") + "')\n"
    "from app.services.ai.providers import (\n"
    "    AssistantContextBuilder, AssistantProviderService, OllamaProvider,\n"
    ")\n"
    + FIXTURES_PY + "\n"
    "class StubResponse:\n"
    "    def __init__(self, status, body): self.status_code = status; self._body = body\n"
    "    def json(self): return self._body\n"
    "    @property\n"
    "    def text(self): return json.dumps(self._body)\n"
    "class StubClient:\n"
    "    def __init__(self):\n"
    "        self.calls = []\n"
    "        self.pings = 0\n"
    "    def get(self, url, **kw):\n"
    "        self.calls.append(('GET', url)); self.pings += 1\n"
    "        return StubResponse(200, {'models': [{'name': 'llama3.1'}]})\n"
    "    def post(self, url, **kw):\n"
    "        self.calls.append(('POST', url, kw.get('json')))\n"
    "        return StubResponse(200, {'response': 'I recommend improving digital presence first.'})\n"
    "stub = StubClient()\n"
    "prov = OllamaProvider(base_url='http://localhost:11434', model='llama3.1', timeout=10, http_client=stub)\n"
    "ok = prov.ping()\n"
    "print('PING_OK', ok)\n"
    "print('IS_AVAIL', prov.is_available)\n"
    "builder = AssistantContextBuilder(\n"
    "    twin_provider=twin_provider, recommendations_provider=recs_provider,\n"
    "    roadmap_provider=roadmap_provider, rules_provider=rules_provider,\n"
    "    insights_provider=decision_provider,\n"
    ")\n"
    "service = AssistantProviderService(context_builder=builder, provider_factory=type('F',(),{'configured_provider_name': lambda s: 'ollama', 'build': lambda s: prov})())\n"
    "r = service.generate(owner_id=1, user_prompt='What should I do first?')\n"
    "print('MODEL', r.model)\n"
    "print('FALLBACK_USED', r.fallback_used)\n"
    "print('BODY_HEAD', r.body[:80])\n"
    "print('CALLED_GENERATE', any(c[0]=='POST' for c in stub.calls))\n"
    "print('CALLED_PING', stub.pings >= 1)\n"
)
r = _run_module("ollama-ok", prog)
out = r.stdout
chk("ollama ping succeeds with stub",
    get_marker("PING_OK", out) == "True")
chk("ollama is_available True after ping",
    get_marker("IS_AVAIL", out) == "True")
chk("ollama happy path: model starts with 'ollama:'",
    (get_marker("MODEL", out) or "").startswith("ollama:"))
chk("ollama happy path: fallback_used False",
    get_marker("FALLBACK_USED", out) == "False")
chk("ollama happy path: body non-empty",
    len(get_marker("BODY_HEAD", out) or "") > 0)
chk("ollama happy path: POST /api/generate was hit",
    get_marker("CALLED_GENERATE", out) == "True")
chk("ollama happy path: GET /api/tags ping was hit",
    get_marker("CALLED_PING", out) == "True")


# --------------------------------------------------------------------------- #
# 7. Ollama unreachable -> fallback
# --------------------------------------------------------------------------- #

print("\n=== 7. Ollama unreachable (ConnectError) -> fallback ===")
prog = (
    "import sys\n"
    "sys.path.insert(0, r'" + str(BACKEND).replace("\\", "\\\\") + "')\n"
    "import httpx\n"
    "from app.services.ai.providers import (\n"
    "    AssistantContextBuilder, AssistantProviderService, OllamaProvider,\n"
    ")\n"
    + FIXTURES_PY + "\n"
    "class BoomClient:\n"
    "    def get(self, url, **kw): raise httpx.ConnectError('connection refused')\n"
    "    def post(self, url, **kw): raise httpx.ConnectError('connection refused')\n"
    "prov = OllamaProvider(base_url='http://localhost:11434', model='llama3.1', timeout=10, http_client=BoomClient())\n"
    "print('PING_RESULT', prov.ping())\n"
    "print('IS_AVAIL', prov.is_available)\n"
    "builder = AssistantContextBuilder(\n"
    "    twin_provider=twin_provider, recommendations_provider=recs_provider,\n"
    "    roadmap_provider=roadmap_provider, rules_provider=rules_provider,\n"
    "    insights_provider=decision_provider,\n"
    ")\n"
    "service = AssistantProviderService(context_builder=builder, provider_factory=type('F',(),{'configured_provider_name': lambda s: 'ollama', 'build': lambda s: prov})())\n"
    "r = service.generate(owner_id=1, user_prompt='hi')\n"
    "print('FALLBACK_USED', r.fallback_used)\n"
    "print('PROVIDER_USED', r.provider_used)\n"
)
r = _run_module("ollama-down", prog)
out = r.stdout
chk("unreachable: ping returns False",
    get_marker("PING_RESULT", out) == "False")
chk("unreachable: is_available False",
    get_marker("IS_AVAIL", out) == "False")
chk("unreachable: service drops to fallback",
    get_marker("FALLBACK_USED", out) == "True" and
    get_marker("PROVIDER_USED", out) == "deterministic-fallback")


# --------------------------------------------------------------------------- #
# 8. Ollama timeout -> fallback
# --------------------------------------------------------------------------- #

print("\n=== 8. Ollama timeout (ReadTimeout) -> fallback ===")
prog = (
    "import sys\n"
    "sys.path.insert(0, r'" + str(BACKEND).replace("\\", "\\\\") + "')\n"
    "import httpx\n"
    "from app.services.ai.providers import (\n"
    "    AssistantContextBuilder, AssistantProviderService, OllamaProvider,\n"
    ")\n"
    + FIXTURES_PY + "\n"
    "class StubResponse:\n"
    "    def __init__(self, status): self.status_code = status\n"
    "    def json(self): return {}\n"
    "class SlowClient:\n"
    "    def get(self, url, **kw): return StubResponse(200)  # ping succeeds\n"
    "    def post(self, url, **kw): raise httpx.ReadTimeout('read timeout')\n"
    "prov = OllamaProvider(base_url='http://localhost:11434', model='llama3.1', timeout=10, http_client=SlowClient())\n"
    "print('PING_RESULT', prov.ping())\n"
    "builder = AssistantContextBuilder(\n"
    "    twin_provider=twin_provider, recommendations_provider=recs_provider,\n"
    "    roadmap_provider=roadmap_provider, rules_provider=rules_provider,\n"
    "    insights_provider=decision_provider,\n"
    ")\n"
    "service = AssistantProviderService(context_builder=builder, provider_factory=type('F',(),{'configured_provider_name': lambda s: 'ollama', 'build': lambda s: prov})())\n"
    "r = service.generate(owner_id=1, user_prompt='hi')\n"
    "print('FALLBACK_USED', r.fallback_used)\n"
)
r = _run_module("ollama-timeout", prog)
out = r.stdout
chk("timeout: ping succeeds (server up)",
    get_marker("PING_RESULT", out) == "True")
chk("timeout: ReadTimeout -> service drops to fallback",
    get_marker("FALLBACK_USED", out) == "True")


# --------------------------------------------------------------------------- #
# 9. Ollama HTTP 500 -> AIProviderError (not silent fallback)
# --------------------------------------------------------------------------- #

print("\n=== 9. Ollama HTTP 500 -> AIProviderError raised ===")
prog = (
    "import sys\n"
    "sys.path.insert(0, r'" + str(BACKEND).replace("\\", "\\\\") + "')\n"
    "from app.services.ai.providers import (\n"
    "    AssistantContextBuilder, AssistantProviderService, OllamaProvider,\n"
    "    AIProviderError,\n"
    ")\n"
    + FIXTURES_PY + "\n"
    "class StubResponse:\n"
    "    def __init__(self, status, body): self.status_code = status; self._body = body\n"
    "    def json(self): return self._body\n"
    "    @property\n"
    "    def text(self): return 'internal error'\n"
    "class ErrorClient:\n"
    "    def get(self, url, **kw): return StubResponse(200, {'models': []})\n"
    "    def post(self, url, **kw): return StubResponse(500, {})\n"
    "prov = OllamaProvider(base_url='http://localhost:11434', model='llama3.1', timeout=10, http_client=ErrorClient())\n"
    "prov.ping()\n"
    "builder = AssistantContextBuilder(\n"
    "    twin_provider=twin_provider, recommendations_provider=recs_provider,\n"
    "    roadmap_provider=roadmap_provider, rules_provider=rules_provider,\n"
    "    insights_provider=decision_provider,\n"
    ")\n"
    "service = AssistantProviderService(context_builder=builder, provider_factory=type('F',(),{'configured_provider_name': lambda s: 'ollama', 'build': lambda s: prov})())\n"
    "try:\n"
    "    r = service.generate(owner_id=1, user_prompt='hi')\n"
    "    print('RAISED', False)\n"
    "    print('GOT', r.model)\n"
    "except AIProviderError as exc:\n"
    "    print('RAISED', True)\n"
    "    print('ERR', str(exc)[:120])\n"
)
r = _run_module("ollama-500", prog)
out = r.stdout
chk("HTTP 500: AIProviderError is raised (not silently swallowed)",
    get_marker("RAISED", out) == "True")


# --------------------------------------------------------------------------- #
# 10 + 12. No existing-API change + no frontend change
# --------------------------------------------------------------------------- #

print("\n=== 10+12. Sentinel-mtime: no existing service / frontend touched ===")
# Sentinel = the newest file in the new package.
sentinel = PROVIDERS / "service.py"
if not sentinel.exists():
    chk("sentinel exists", False, str(sentinel))
else:
    smt = sentinel.stat().st_mtime
    cutoff = smt - 60
    # Existing AI engine + Copilot must NOT have been touched.
    protected = [
        BACKEND / "app" / "services" / "ai" / "service.py",
        BACKEND / "app" / "services" / "ai" / "base.py",
        BACKEND / "app" / "services" / "ai" / "context_builder.py",
        BACKEND / "app" / "services" / "ai" / "prompt_builder.py",
        BACKEND / "app" / "services" / "ai" / "mock_provider.py",
        BACKEND / "app" / "services" / "ai" / "response_parser.py",
        BACKEND / "app" / "services" / "copilot" / "service.py",
        BACKEND / "app" / "services" / "copilot" / "orchestrator.py",
    ]
    protected_violators = [
        str(p.relative_to(ROOT))
        for p in protected
        if p.exists() and p.stat().st_mtime > cutoff
    ]
    chk("no existing AI engine / Copilot file modified",
        not protected_violators,
        f"violators: {protected_violators}" if protected_violators else "")
    # Sentinel for frontend: the assistant page is the
    # canonical Part 1 file. Nothing under frontend/ should
    # be modified after this milestone started.
    frontend_files = [p for p in FRONTEND.rglob("*")
                      if p.is_file()
                      and "node_modules" not in p.parts
                      and ".next" not in p.parts]
    frontend_violators = [
        str(p.relative_to(ROOT))
        for p in frontend_files
        if p.stat().st_mtime > cutoff
    ]
    chk("no frontend file modified after this milestone",
        not frontend_violators,
        f"violators: {frontend_violators[:3]}" if frontend_violators else "")
    # No new migrations / no new tables / no DB schema
    # touched.
    migrations = BACKEND / "migrations" / "versions"
    if migrations.exists():
        new_mig = [p for p in migrations.rglob("*.py")
                   if p.stat().st_mtime > cutoff]
        chk("no new migrations added (backend-only, no DB changes)",
            not new_mig,
            f"violators: {new_mig[:3]}" if new_mig else "")


# --------------------------------------------------------------------------- #
# 11. Out-of-scope absence
# --------------------------------------------------------------------------- #

print("\n=== 11. Out-of-scope absence (no LLM SDK / streaming) ===")
banned_patterns = [
    (re.compile(r"^\s*(?:from|import)\s+openai", re.MULTILINE | re.IGNORECASE), "import openai"),
    (re.compile(r"^\s*(?:from|import)\s+anthropic", re.MULTILINE | re.IGNORECASE), "import anthropic"),
    (re.compile(r"^\s*(?:from|import)\s+google\.generativeai", re.MULTILINE | re.IGNORECASE), "import google.generativeai"),
    (re.compile(r"^\s*(?:from|import)\s+azure", re.MULTILINE | re.IGNORECASE), "import azure"),
    (re.compile(r"openai\.", re.IGNORECASE), "openai. call"),
    (re.compile(r"anthropic\.", re.IGNORECASE), "anthropic. call"),
    (re.compile(r"\bchat_completion\b", re.IGNORECASE), "chat_completion"),
    (re.compile(r"\.completions\.create", re.IGNORECASE), ".completions.create"),
    (re.compile(r"\.messages\.create", re.IGNORECASE), ".messages.create"),
    (re.compile(r"\bEventSource\b", re.IGNORECASE), "EventSource (streaming)"),
    (re.compile(r"\bReadableStream\b", re.IGNORECASE), "ReadableStream (streaming)"),
    (re.compile(r"stream=True", re.IGNORECASE), "stream=True"),
    (re.compile(r"text/event-stream", re.IGNORECASE), "text/event-stream"),
    (re.compile(r"text/plain;\s*charset=utf-8", re.IGNORECASE), "text/plain; charset=utf-8"),
]
files = list(PROVIDERS.rglob("*.py"))
# Exclude the package's __init__.py from the strict grep
# only because __init__.py mentions the names in docstring
# prose ("does NOT call any LLM", etc.).
provider_files = [p for p in files if p.name != "__init__.py"]
violations = []
for f in provider_files:
    src = f.read_text(encoding="utf-8", errors="ignore")
    for pat, label in banned_patterns:
        if pat.search(src):
            violations.append((f.name, label))
chk(f"no banned code-constructs in {len(provider_files)} provider files",
    not violations,
    "; ".join(f"{n}:{l}" for n, l in violations[:5]))

# requirements.txt must not pull in any LLM SDK.
req = (BACKEND / "requirements.txt").read_text(encoding="utf-8")
forbidden_pkgs = ["openai", "anthropic", "google-generativeai", "azure-openai",
                  "langchain", "llama-index"]
req_violations = [
    p for p in forbidden_pkgs
    if ('"' + p + '"' in req) or ("'" + p + "'" in req) or
       re.search(r"(^|\n)\s*" + re.escape(p) + r"\s*==", req) is not None
]
chk("no LLM packages in requirements.txt",
    not req_violations,
    f"found: {req_violations}" if req_violations else "")

# The package's docstrings are allowed to mention the
# names of out-of-scope SDKs in the *contract* sense ("does
# NOT call OpenAI"). They are NOT allowed to mention them
# as imports or calls. The code-construct check above
# catches imports. The docstring check is intentionally
# lenient — the brief is explicit that the layer is the
# seam where real SDKs could plug in later.


# --------------------------------------------------------------------------- #
print()
print("=" * 60)
print("VERIFIER RESULT:", "ALL CHECKS PASS" if ok else "FAILURES PRESENT")
print("=" * 60)
sys.exit(0 if ok else 1)