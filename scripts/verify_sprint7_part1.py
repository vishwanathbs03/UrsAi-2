"""
Ad-hoc verifier for Sprint 7 Part 1 — AI Business Assistant UI.
Atlas AI at D:/MSME/UrsAi

The slice is "frontend only, no LLM, deterministic, no memory, no
backend changes." Per the multi-milestone skill, this verifier
exercises the already-built slice against the spec via:

  1. File-existence check on every spec bullet.
  2. npx tsc --noEmit (already ran, re-asserts).
  3. Bundle-grep every spec-named literal in the compiled
     .next bundle (the ProtectedRoute SSR loading-state trap
     means we cannot rely on the SSR HTML).
  4. Out-of-scope absence check: for every "Do NOT" item,
     confirm no import / call to an LLM SDK exists in the new
     code, and that the assistant bundle does not import any
     of openai / anthropic / ollama / streaming libs.
  5. Determinism check on buildAssistantResponse: call twice,
     diff.  Must be byte-equal.
  6. Sentinel-mtime check: backend mtime must be older than
     the assistant sentinel so the "frontend only" contract
     holds.
"""
from __future__ import annotations

import datetime
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(r"D:\MSME\UrsAi")
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
BUNDLE_GLOB = sorted(
    (FRONTEND / ".next" / "static" / "chunks" / "app" / "(app)" / "assistant").glob("page*.js")
)
ASSISTANT_DIR = FRONTEND / "features" / "assistant"
PAGE = FRONTEND / "app" / "(app)" / "assistant" / "page.tsx"

ok = True
def check(label, cond, detail=""):
    global ok
    print(f"[{'PASS' if cond else 'FAIL'}] {label}{(' — ' + detail) if detail else ''}")
    if not cond:
        ok = False


# --------------------------------------------------------------------------- //
# 1. File existence
# --------------------------------------------------------------------------- //

print("\n=== 1. File-existence check ===")

required = {
    "Route (protected)": PAGE,
    "Chat layout composition": ASSISTANT_DIR / "AssistantView.tsx",
    "Conversation thread": ASSISTANT_DIR / "ConversationList.tsx",
    "Message bubble": ASSISTANT_DIR / "MessageBubble.tsx",
    "Prompt input": ASSISTANT_DIR / "PromptInput.tsx",
    "Suggested questions": ASSISTANT_DIR / "SuggestedQuestions.tsx",
    "Suggested-questions data": ASSISTANT_DIR / "suggested-questions.ts",
    "Context panel": ASSISTANT_DIR / "ContextPanel.tsx",
    "Assistant header (clear)": ASSISTANT_DIR / "AssistantHeader.tsx",
    "Data hook (5 endpoints)": ASSISTANT_DIR / "use-assistant-data.ts",
    "Deterministic builder": ASSISTANT_DIR / "builder.ts",
    "Query classifier": ASSISTANT_DIR / "classify-query.ts",
    "Public types": ASSISTANT_DIR / "types.ts",
    "Barrel export": ASSISTANT_DIR / "index.ts",
}
for label, p in required.items():
    check(label, p.exists(), str(p.relative_to(ROOT)))


# --------------------------------------------------------------------------- //
# 2. TypeScript
# --------------------------------------------------------------------------- //

print("\n=== 2. TypeScript type check ===")
res = subprocess.run(
    ["npx", "tsc", "--noEmit"],
    cwd=str(FRONTEND),
    capture_output=True,
    text=True,
    timeout=240,
    shell=True,
)
tsc_clean = res.returncode == 0
check("npx tsc --noEmit", tsc_clean, (res.stdout or res.stderr)[-200:] if not tsc_clean else "")


# --------------------------------------------------------------------------- //
# 3. Bundle-grep
# --------------------------------------------------------------------------- //

print("\n=== 3. Bundle-grep spec literals ===")
check("assistant bundle(s) exist", bool(BUNDLE_GLOB),
      ", ".join(b.name for b in BUNDLE_GLOB) if BUNDLE_GLOB else "no chunks matched")

if BUNDLE_GLOB:
    # Concatenate every chunk for the route so the check survives
    # content-hash changes between builds and dev/prod parity shifts.
    bundle = "\n".join(
        b.read_text(encoding="utf-8", errors="ignore") for b in BUNDLE_GLOB
    )
    spec_literals = [
        "How can I improve my business?",
        "Why is my score low?",
        "What should I do first?",
        "Show export opportunities.",
        "Explain my Business DNA.",
        "Explain roadmap.",
        "Explain recommendations.",
        "Current Business Score",
        "Business DNA",
        "Recommendations",
        "Roadmap Progress",
        "AI Business Assistant",
        "Composing answer",
        "Clear Chat",
        "Refresh",
        "No LLM",
        "Deterministic",
    ]
    missing = [s for s in spec_literals if s not in bundle]
    check(
        f"all {len(spec_literals)} spec literals present in bundle",
        not missing,
        f"missing: {missing}" if missing else "",
    )


# --------------------------------------------------------------------------- //
# 4. Out-of-scope absence
# --------------------------------------------------------------------------- //

print("\n=== 4. Out-of-scope absence check ===")
banned_patterns = [
    (re.compile(r"^\s*(?:from|import)\s+openai", re.MULTILINE | re.IGNORECASE), "import openai"),
    (re.compile(r"^\s*(?:from|import)\s+anthropic", re.MULTILINE | re.IGNORECASE), "import anthropic"),
    (re.compile(r"^\s*(?:from|import)\s+ollama", re.MULTILINE | re.IGNORECASE), "import ollama"),
    (re.compile(r"\bchat_completion", re.IGNORECASE), "chat_completion call"),
    (re.compile(r"\.completions\.create", re.IGNORECASE), ".completions.create call"),
    (re.compile(r"\.messages\.create", re.IGNORECASE), ".messages.create call"),
    (re.compile(r"\bReadableStream\b", re.IGNORECASE), "ReadableStream (streaming)"),
    (re.compile(r"\bEventSource\b", re.IGNORECASE), "EventSource (SSE streaming)"),
    (re.compile(r"\bgenerativelanguage|google\.generativeai|@google-ai", re.IGNORECASE), "Google AI SDK"),
    (re.compile(r"\bvercel-ai|@ai-sdk", re.IGNORECASE), "Vercel AI SDK"),
    (re.compile(r"\bLangChain|@langchain", re.IGNORECASE), "LangChain"),
    (re.compile(r"from\s+[\"']openai[\"']", re.IGNORECASE), "openai string import"),
    (re.compile(r"from\s+[\"']anthropic[\"']", re.IGNORECASE), "anthropic string import"),
]

assistant_files = list(ASSISTANT_DIR.rglob("*.ts")) + list(ASSISTANT_DIR.rglob("*.tsx"))
violations = []
for f in assistant_files:
    src = f.read_text(encoding="utf-8", errors="ignore")
    for pat, label in banned_patterns:
        if pat.search(src):
            violations.append((f, label))

check(
    f"no LLM provider code-constructs in {len(assistant_files)} assistant files",
    not violations,
    "; ".join(f"{p.name}:{l}" for p, l in violations[:5]) if violations else "",
)

pkg = (FRONTEND / "package.json").read_text(encoding="utf-8")
forbidden_pkgs = ["openai", "anthropic", "@anthropic-ai/sdk", "ollama", "ai", "@ai-sdk/openai",
                  "@ai-sdk/anthropic", "langchain", "google-generativeai"]
pkg_violations = [p for p in forbidden_pkgs if ('"' + p + '"' in pkg) or ("'" + p + "'" in pkg)]
check("no LLM packages in package.json", not pkg_violations,
      f"found: {pkg_violations}" if pkg_violations else "")

mem_patterns = [
    (re.compile(r"localStorage\.", re.IGNORECASE), "localStorage"),
    (re.compile(r"sessionStorage\.", re.IGNORECASE), "sessionStorage"),
    (re.compile(r"indexedDB\.", re.IGNORECASE), "indexedDB"),
]
mem_violations = []
for f in assistant_files:
    src = f.read_text(encoding="utf-8", errors="ignore")
    for pat, label in mem_patterns:
        if pat.search(src):
            mem_violations.append((f, label))
check(
    f"no memory/persistence in {len(assistant_files)} assistant files",
    not mem_violations,
    "; ".join(f"{p.name}:{l}" for p, l in mem_violations[:5]) if mem_violations else "",
)


# --------------------------------------------------------------------------- //
# 5. Determinism
# --------------------------------------------------------------------------- //

print("\n=== 5. Determinism check on builder ===")
determinism_script = r"""
const path = require("path");
const ts = require("typescript");
const fs = require("fs");

const frontendDir = String.raw`D:\MSME\UrsAi\frontend`;
process.chdir(frontendDir);

function transpile(file) {
  const src = fs.readFileSync(file, "utf8");
  return ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: file,
  }).outputText;
}

const typesSrc = transpile(path.join("features", "assistant", "types.ts"));
const builderSrc = transpile(path.join("features", "assistant", "builder.ts"));

const stubbedBuilder = builderSrc
  .replace(/require\(["']@\/types\/dashboard["']\)/g, "({})")
  .replace(/require\(["']@\/types\/analytics["']\)/g, "({})")
  .replace(/require\(["']\.\/types["']\)/g, "({})");

const builderMod = { exports: {} };
const builderFn = new Function("module", "exports", "require", stubbedBuilder);
builderFn(builderMod, builderMod.exports, function (m) {
  if (m === "./types") return {};
  return {};
});
const buildAssistantResponse = builderMod.exports.buildAssistantResponse;

const dummyRec = {
  id: "r1", title: "Improve digital presence", category: "export_readiness_actions",
  priority: "High", difficulty: "Medium", estimated_score_gain: 8, estimated_timeline: "3 weeks",
  estimated_roi: 5000,
};
const bundle = {
  twin: {
    generated_at: "2026-01-01T00:00:00Z",
    current_health: { overall_business_score: 42, business_dna_archetype: "Foundation Builder", business_dna_match: 67 },
    scores: { scores: [{ title: "Finance", score: 30 }, { title: "Marketing", score: 55 }] },
    opportunity_matrix: { export_opportunities: [{ title: "Improve digital presence" }] },
    last_analysis_at: "2026-01-01T00:00:00Z",
  },
  recommendations: {
    recommendations: [dummyRec, Object.assign({}, dummyRec, { id: "r2", priority: "Critical" })],
    summary: { critical_count: 1, high_count: 1, medium_count: 0, low_count: 0,
               total_estimated_score_gain: 16, total_estimated_cost: 12000 },
  },
  roadmap: {
    items: [{ id: "ri1", title: "Improve digital presence", phase: "Immediate", priority: "High",
              completion_percentage: 0, estimated_start_order: 1,
              recommendation_id: "r1", expected_score_improvement: 8, estimated_duration: "3 weeks" }],
    summary: {
      total_items: 1, total_estimated_duration: "3 weeks",
      projections: { projected_business_score: 60, projected_profile_completion: 80,
                      projected_business_dna_shift: 5, projected_export_readiness: 10,
                      projected_digital_readiness: 10, projected_growth_readiness: 5 },
    },
  },
  rules: {
    summary: { total_firings: 4, categories_with_firings: 2 },
    categories: {
      financial_health: { firings: [
        { id: "f1", title: "Cash flow thin", priority: "High", category: "financial_health",
          estimated_impact: 6, reason: "Liquidity < 30 days", source_keys: ["finance.liquidity"] },
      ] },
    },
  },
  decision: {
    generated_at: "2026-01-01T00:00:00Z",
    decision: {
      summary: "Solid base, build digital.",
      top_strengths: ["Strong local brand", "Loyal customers"],
      top_risks: ["Limited online presence"],
      insights: [{ title: "Push to export", priority: "High", confidence: 70 }],
      archetype_label: "Foundation Builder", overall_health: "Developing",
    },
  },
};

const kinds = ["improve_business","low_score","what_first","export_opportunities",
               "business_dna","explain_roadmap","explain_recommendations",
               "explain_insights","explain_rules","general_overview","fallback"];

const out = {};
for (const k of kinds) {
  const a = buildAssistantResponse(bundle, k);
  const b = buildAssistantResponse(bundle, k);
  out[k] = { equal: JSON.stringify(a) === JSON.stringify(b) };
}
console.log(JSON.stringify(out));
"""

proc = subprocess.run(
    ["node", "-e", determinism_script],
    cwd=str(FRONTEND),
    capture_output=True,
    text=True,
    timeout=60,
    shell=False,
)
if proc.returncode != 0:
    print(proc.stdout)
    print(proc.stderr, file=sys.stderr)
    check("determinism harness ran", False, proc.stderr[-200:])
else:
    try:
        out = json.loads(proc.stdout)
        all_equal = all(v["equal"] for v in out.values())
        check(
            f"buildAssistantResponse deterministic across {len(out)} kinds",
            all_equal,
            "" if all_equal else f"non-deterministic: {[k for k,v in out.items() if not v['equal']]}",
        )
    except Exception as e:
        check("determinism harness parsed", False, str(e))


# --------------------------------------------------------------------------- //
# 6. Sentinel-mtime
# --------------------------------------------------------------------------- //

print("\n=== 6. Frontend-only sentinel (backend untouched) ===")
sentinel = PAGE
if not sentinel.exists():
    check("sentinel page exists", False)
else:
    sentinel_mtime = sentinel.stat().st_mtime
    CUTOFF = sentinel_mtime - 60
    backend_py = list(BACKEND.rglob("*.py")) if BACKEND.exists() else []
    violators = [str(p) for p in backend_py if p.stat().st_mtime > CUTOFF]
    check(
        "no backend .py modified after assistant page (sentinel-mtime guard)",
        not violators,
        f"violators: {violators[:3]}" if violators else "",
    )


# --------------------------------------------------------------------------- //
# 7. Nav registration
# --------------------------------------------------------------------------- //

print("\n=== 7. Nav registration ===")
nav = (FRONTEND / "lib" / "navigation.ts").read_text(encoding="utf-8")
check("/assistant registered in mainNavLinks", "/assistant" in nav and "AI Assistant" in nav)


# --------------------------------------------------------------------------- //
print()
print("=" * 60)
print("VERIFIER RESULT:", "ALL CHECKS PASS" if ok else "FAILURES PRESENT")
print("=" * 60)
sys.exit(0 if ok else 1)
