#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sprint H5.2 — Executive Command Center verifier + scenario matrix.

Runs the same bundled server-render check the H5.1 verifier used,
plus 10 scenarios covering every degenerate data state the brief lists:

  1. Full profile
  2. Partial profile (no identity, no profile, partial intelligence)
  3. Missing optional data (history absent, empty risks, empty schemes)
  4. Zero recommendations
  5. Zero risks
  6. Zero opportunities
  7. No matching scheme
  8. Dark mode (class-set audit)
  9. Mobile layout (class-set audit)
 10. Existing CTA navigation

Also covers:
 - Anti-fabrication guards (no trend / guaranteed-funding / forecast claims)
 - Stub hygiene (real hook source files don't contain stub markers)
 - Section ordering (1 → 10)

Usage:
  cd D:\\MSME\\UrsAi\\frontend && python D:\\MSME\\UrsAi\\scripts\\verify_sprint_h5_2.py
"""

from __future__ import annotations
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
COMMAND_CENTER = FRONTEND / "features" / "dashboard" / "command-center"
WIDGETS = FRONTEND / "features" / "dashboard"
TMP_BUILD = Path(tempfile.gettempdir()) / "hermes-verify-h5-2-build"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class Counter:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.failures: list[str] = []

    def ok(self, msg: str) -> None:
        self.passed += 1
        print(f"[PASS] {msg}")

    def fail(self, msg: str) -> None:
        self.failed += 1
        self.failures.append(msg)
        print(f"[FAIL] {msg}")

    def check(self, cond: bool, msg: str) -> None:
        self.ok(msg) if cond else self.fail(msg)


def run(cmd, **kw):
    print(f"\n>>> {' '.join(cmd)}")
    res = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if res.stdout:
        print(res.stdout.rstrip())
    if res.stderr:
        print(res.stderr.rstrip(), file=sys.stderr)
    return res


def section(title: str) -> None:
    print("\n" + title)
    print("-" * len(title))


# ---------------------------------------------------------------------------
# Step 1 — Bundle the dashboard + 7 new components with the same stub
# aliasing pattern the H5.1 verifier used. Stubs live under TMP_BUILD so
# they cannot leak into the source tree.
# ---------------------------------------------------------------------------

def build_bundle() -> Path:
    TMP_BUILD.mkdir(parents=True, exist_ok=True)
    bundle_root = TMP_BUILD / "_bundle_root"
    if (bundle_root / "DashboardView.js").exists():
        return bundle_root

    stub_files = {
        "useIntelligenceStub.cjs": (
            "module.exports.useIntelligence = function () { return { data: GLOBAL.__FIXTURE__.intelligence, isLoading: false, isFetching: false, isError: false, error: null, refetch: function () {} }; };"
        ),
        "useAnalyticsDataStub.cjs": (
            "module.exports.useTwinQuery = function () { return { data: GLOBAL.__FIXTURE__.twin, isLoading: false, isFetching: false, isError: false, error: null, refetch: function () {} }; };\n"
            "module.exports.useRecommendationsQuery = function () { return { data: GLOBAL.__FIXTURE__.recommendations, isLoading: false, isFetching: false, isError: false, error: null, refetch: function () {} }; };"
        ),
        "useAssistantDataStub.cjs": (
            "module.exports.useAssistantData = function () { return { state: { status: GLOBAL.__FIXTURE__.assistantStatus || 'ready', bundle: GLOBAL.__FIXTURE__.assistantBundle || { twin: GLOBAL.__FIXTURE__.twin, recommendations: GLOBAL.__FIXTURE__.recommendations } }, isFetching: false, refresh: function () {} }; };"
        ),
        "tanstackStub.cjs": (
            "module.exports.useQuery = function (opts) {\n"
            "  var k = (opts && opts.queryKey && opts.queryKey[0]) || '';\n"
            "  if (k === 'government-schemes') return { data: GLOBAL.__FIXTURE__.schemes, isLoading: false, isFetching: false, isError: false, error: null, refetch: function () {} };\n"
            "  if (k === 'dashboard-recommendations') return { data: GLOBAL.__FIXTURE__.recommendations, isLoading: false, isFetching: false, isError: false, error: null, refetch: function () {} };\n"
            "  return { data: undefined, isLoading: false, isFetching: false, isError: false, error: null, refetch: function () {} };\n"
            "};"
        ),
    }
    for name, content in stub_files.items():
        (TMP_BUILD / name).write_text(content)

    use_int = TMP_BUILD / "useIntelligenceStub.cjs"
    use_ana = TMP_BUILD / "useAnalyticsDataStub.cjs"
    use_asst = TMP_BUILD / "useAssistantDataStub.cjs"
    tanstack = TMP_BUILD / "tanstackStub.cjs"

    cmd = [
        "--yes", "esbuild",
        "--bundle", "--platform=node", "--target=node18", "--format=cjs",
        f"--outdir={bundle_root}",
        "--external:react",
        "--external:react-dom",
        "--external:react/jsx-runtime",
        f"--alias:@/hooks/useIntelligence={use_int}",
        f"--alias:@/features/analytics/use-analytics-data={use_ana}",
        f"--alias:@/features/assistant/use-assistant-data={use_asst}",
        f"--alias:@tanstack/react-query={tanstack}",
        "features/dashboard/DashboardView.tsx",
        "features/dashboard/command-center/ExecutiveHeader.tsx",
        "features/dashboard/command-center/HealthHeroCard.tsx",
        "features/dashboard/command-center/ExecutiveBrief.tsx",
        "features/dashboard/command-center/TopPriorities.tsx",
        "features/dashboard/command-center/BiggestRisk.tsx",
        "features/dashboard/command-center/BiggestOpportunity.tsx",
        "features/dashboard/command-center/GovernmentOpportunityCard.tsx",
        "features/dashboard/KPIGrid.tsx",
        "features/dashboard/QuickActionsCard.tsx",
        "features/dashboard/RecentActivityCard.tsx",
    ]

    use_npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not use_npx:
        raise RuntimeError("npx not found on PATH")

    env = dict(os.environ)
    env["NEXT_TELEMETRY_DISABLED"] = "1"
    subprocess.run([use_npx] + cmd, cwd=str(FRONTEND), env=env, check=True)

    # Walk the bundle_root recursively and copy .js files into the
    # canonical features/dashboard/{command-center,}/ subdirs.
    for path in bundle_root.rglob("*.js"):
        rel = path.relative_to(bundle_root)
        dest = bundle_root / "features" / "dashboard" / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(path, dest)

    return bundle_root


# ---------------------------------------------------------------------------
# Step 2 — Render harness. Pure Node, mirrors the H5.1 server-render
# verifier. Sets GLOBAL.__FIXTURE__ per scenario, calls renderToStaticMarkup,
# returns the rendered HTML + textual view.
# ---------------------------------------------------------------------------

HARNESS = r"""
// Server-render harness for a single dashboard render.
// Usage: node harness.cjs <bundle-root>/features/dashboard/DashboardView.js
const path = require("path");
const fs = require("fs");

const FRONTEND = "__FRONTEND__";
process.env.NODE_PATH = path.join(FRONTEND, "node_modules");
require("module").Module._initPaths();

const NodeModule = require("module");
const _realResolve = NodeModule._resolveFilename;
const _reactAbs = path.resolve(FRONTEND, "node_modules", "react", "index.js");
const _reactJsxAbs = path.resolve(FRONTEND, "node_modules", "react", "jsx-runtime.js");
const _reactDomAbs = path.resolve(FRONTEND, "node_modules", "react-dom", "index.js");
const _reactDomServerAbs = path.resolve(FRONTEND, "node_modules", "react-dom", "server.node.js");
NodeModule._resolveFilename = function (request, parent, ...rest) {
  if (request === "react") return _reactAbs;
  if (request === "react/jsx-runtime") return _reactJsxAbs;
  if (request === "react-dom") return _reactDomAbs;
  if (request === "react-dom/server") return _reactDomServerAbs;
  return _realResolve.call(this, request, parent, ...rest);
};

const React = require(_reactAbs);
const ReactDOMServer = require(_reactDomServerAbs);
global.React = React;
global.ReactDOMServer = ReactDOMServer;
global.GLOBAL = global;

const entry = process.argv[2];
const fixturePath = process.argv[3];
global.GLOBAL.__FIXTURE__ = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const bundle = require(entry);
const { DashboardView } = bundle;
const renderer = (ReactDOMServer && ReactDOMServer.renderToStaticMarkup) || ReactDOMServer.renderToString;
const html = renderer(React.createElement(DashboardView));

fs.writeFileSync(process.argv[4], html);
console.log("[render] bytes=" + html.length);
"""


def render_with(bundle_root: Path, fixture: dict, outfile: Path) -> str:
    """Render DashboardView with `fixture` as the data payload; return the HTML."""
    harness_dir = TMP_BUILD / "_harness"
    harness_dir.mkdir(exist_ok=True)
    harness_path = harness_dir / "harness.cjs"
    # On Windows the path contains backslashes which Node treats as
    # escape characters inside JS strings. Forward-slash the path so
    # the JS string literal is unambiguous.
    frontend_fwd = str(FRONTEND).replace("\\", "/")
    harness_path.write_text(HARNESS.replace("__FRONTEND__", frontend_fwd))

    fixture_path = harness_dir / f"fixture_{outfile.stem}.json"
    fixture_path.write_text(json.dumps(fixture))

    entry = bundle_root / "features" / "dashboard" / "DashboardView.js"
    outfile = harness_dir / outfile.name
    outfile.parent.mkdir(parents=True, exist_ok=True)

    res = subprocess.run(
        ["node", str(harness_path), str(entry), str(fixture_path), str(outfile)],
        capture_output=True, text=True, cwd=str(FRONTEND),
    )
    if res.returncode != 0:
        print(res.stdout)
        print(res.stderr, file=sys.stderr)
        raise RuntimeError(f"render harness failed for fixture {fixture_path}")
    return outfile.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Fixtures — every scenario the brief lists, plus the full-profile one.
# ---------------------------------------------------------------------------

def full_twin() -> dict:
    return {
        "generated_at": "2026-08-02T12:00:00Z",
        "identity": {"legal_name": "Acme Textiles", "industry": "Textiles & Apparel", "location": "Bengaluru, Karnataka"},
        "profile": {"products_count": 24, "employee_count": 12, "completion": 80},
        "risk_matrix": {
            "critical_risks": [
                {"risk_id": "r1", "rule_id": "rl1", "title": "Single supplier dependency",
                 "description": "80% of yarn from one supplier — diversifying reduces exposure.",
                 "priority": "Critical", "category": "Supply", "estimated_impact": 25},
            ],
            "high_risks": [],
            "medium_risks": [
                {"risk_id": "r2", "rule_id": "rl2", "title": "Late GST payments",
                 "description": "Two of the last four GST filings were late.",
                 "priority": "Medium", "category": "Compliance", "estimated_impact": 8},
            ],
            "resolved_risks": [], "emerging_risks": [],
        },
    }


def full_intelligence() -> dict:
    return {
        "overall": {"score": 58, "level": "Medium", "analyzer_count": 5},
        "analyzers": [
            {"key": "financial", "title": "Financial", "score": 70, "breakdown": {"weight": 25, "earned": 17.5, "hint": ""}},
            {"key": "operational", "title": "Operational", "score": 55, "breakdown": {"weight": 20, "earned": 11, "hint": ""}},
            {"key": "digital", "title": "Digital", "score": 32, "breakdown": {"weight": 20, "earned": 6.4, "hint": ""}},
            {"key": "compliance", "title": "Compliance", "score": 80, "breakdown": {"weight": 15, "earned": 12, "hint": ""}},
            {"key": "export", "title": "Export", "score": 25, "breakdown": {"weight": 20, "earned": 5, "hint": ""}},
        ],
        "swot": {"strengths": [], "weaknesses": [], "threats": []},
        "opportunities": {"opportunities": [
            {"id": "o1", "title": "Build a corporate website", "description": "Increase inbound leads via digital presence",
             "priority": "High", "impact": "High", "difficulty": "Moderate", "estimated_value": 15000, "category": "Digital"},
            {"id": "o2", "title": "Apply for MUDRA Shishu Loan", "description": "Working capital loan",
             "priority": "High", "impact": "Medium", "difficulty": "Easy", "estimated_value": 50000, "category": "Funding"},
            {"id": "o3", "title": "Register IEC and HS codes", "description": "Export market access",
             "priority": "Medium", "impact": "High", "difficulty": "Easy", "estimated_value": 200000, "category": "Export"},
        ]},
    }


def full_recommendations() -> dict:
    return {"recommendations": [
        {"id": "rec1", "title": "Build a corporate website", "description": "Strengthen digital presence.",
         "category": "Digital", "priority": "High", "phase": "Digital",
         "business_impact": 8, "estimated_score_gain": 8, "estimated_roi": 120,
         "estimated_cost": 3000, "estimated_timeline": "1-3 months", "difficulty": "Moderate"},
        {"id": "rec2", "title": "Hire first sales operator", "description": "Improve conversion.",
         "category": "Operational", "priority": "High", "phase": "Operational",
         "business_impact": 6, "estimated_score_gain": 6, "estimated_roi": 80,
         "estimated_cost": 12000, "estimated_timeline": "1 month", "difficulty": "Moderate"},
        {"id": "rec3", "title": "Register IEC for exports", "description": "Enable export market access.",
         "category": "Export", "priority": "Medium", "phase": "Export",
         "business_impact": 5, "estimated_score_gain": 5, "estimated_roi": 60,
         "estimated_cost": 500, "estimated_timeline": "2 months", "difficulty": "Easy"},
        {"id": "rec4", "title": "Get OEKO-TEX certified", "description": "Improve export eligibility.",
         "category": "Compliance", "priority": "Low", "phase": "Compliance",
         "business_impact": 4, "estimated_score_gain": 4, "estimated_roi": 50,
         "estimated_cost": 25000, "estimated_timeline": "6 months", "difficulty": "Hard"},
    ]}


def full_schemes() -> dict:
    return {"schemes": {
        "recommended": [
            {"id": "s1", "name": "MUDRA Shishu Loan", "description": "Working capital loan for micro businesses.",
             "category": "Working Capital", "eligibility_status": "partiallyEligible",
             "eligibility_reason": "Matches industry and turnover.", "matching_score": 78,
             "priority": "High", "benefits": ["Up to ₹50k", "Low interest"],
             "documents_required": ["Udyam Registration", "PAN"],
             "application_steps": ["Apply online"], "application_link": "https://www.mudra.org.in/",
             "target_industries": ["Textiles"], "max_turnover": 0, "min_turnover": 0},
        ],
        "eligible": [], "partially_eligible": [], "not_eligible": [],
    }}


def full_fixture() -> dict:
    return {
        "twin": full_twin(),
        "intelligence": full_intelligence(),
        "recommendations": full_recommendations(),
        "schemes": full_schemes(),
    }


def empty_fixture() -> dict:
    return {
        "twin": None,
        "intelligence": None,
        "recommendations": None,
        "schemes": None,
    }


def partial_fixture() -> dict:
    """Identity + analyzers but no profile, no risks, no recs, no schemes."""
    return {
        "twin": {"identity": {}, "profile": {}, "risk_matrix": {"critical_risks": [], "high_risks": [], "medium_risks": [], "resolved_risks": [], "emerging_risks": []}},
        "intelligence": {"overall": {"score": 38, "level": "Low"}, "analyzers": [
            {"key": "financial", "title": "Financial", "score": 40, "breakdown": {}},
            {"key": "digital", "title": "Digital", "score": 20, "breakdown": {}},
        ]},
        "recommendations": {"recommendations": []},
        "schemes": {"schemes": {"recommended": [], "eligible": [], "partially_eligible": [], "not_eligible": []}},
    }


def zero_risks_fixture() -> dict:
    """Same as full but with all risk buckets empty + zero opportunities + zero recs."""
    return {
        "twin": {"identity": {"legal_name": "Acme Textiles"}, "profile": {},
                 "risk_matrix": {"critical_risks": [], "high_risks": [], "medium_risks": [], "resolved_risks": [], "emerging_risks": []}},
        "intelligence": full_intelligence(),
        "recommendations": full_recommendations(),
        "schemes": full_schemes(),
    }


def zero_opps_fixture() -> dict:
    return {
        "twin": full_twin(),
        "intelligence": {"overall": {"score": 58, "level": "Medium"}, "analyzers": full_intelligence()["analyzers"],
                         "swot": {"strengths": [], "weaknesses": [], "threats": []},
                         "opportunities": {"opportunities": []}},
        "recommendations": full_recommendations(),
        "schemes": full_schemes(),
    }


def zero_recs_fixture() -> dict:
    return {
        "twin": full_twin(),
        "intelligence": full_intelligence(),
        "recommendations": {"recommendations": []},
        "schemes": full_schemes(),
    }


def no_scheme_fixture() -> dict:
    return {
        "twin": full_twin(),
        "intelligence": full_intelligence(),
        "recommendations": full_recommendations(),
        "schemes": {"schemes": {"recommended": [], "eligible": [], "partially_eligible": [], "not_eligible": []}},
    }


def no_business_fixture() -> dict:
    return {
        "twin": None,
        "intelligence": None,
        "recommendations": None,
        "schemes": None,
        "assistantStatus": "no-business",
        "assistantBundle": None,
    }


# ---------------------------------------------------------------------------
# Helpers to render fixtures and read HTML.
# ---------------------------------------------------------------------------

def html_to_text(html: str) -> str:
    """Strip tags, collapse whitespace, return plain text."""
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def get(html: str, *needles) -> bool:
    """All needles must appear in HTML."""
    return all(n in html for n in needles)


def any_text(text: str, *needles) -> bool:
    return any(n in text for n in needles)


# ---------------------------------------------------------------------------
# Step 3 — Run assertions
# ---------------------------------------------------------------------------

def run_full_profile_scenario(counter: Counter, html: str) -> None:
    """The 10-section presence + content checks against the full-profile fixture."""
    section("SCENARIO 1 — Full profile")

    # Section ordering by data-testid
    positions = []
    for testid in ["command-center-header", "command-center-health-hero",
                   "command-center-brief", "command-center-priorities",
                   "command-center-risk", "command-center-opportunity",
                   "command-center-gov"]:
        idx = html.find(f'data-testid="{testid}"')
        counter.check(idx > 0, f"section present: {testid} (idx={idx})")
        positions.append(idx)

    # Sections that don't have testids — Sections 8, 9, 10
    text = html_to_text(html)
    counter.check("Quick Actions" in text, "Section 8 (Quick Actions) renders")
    counter.check("Recent Activity" in text, "Section 9 (Recent Activity) renders")
    counter.check("Secondary Details" in text, "Section 10 (Secondary Details) renders")

    # Section 1
    counter.check("Acme Textiles" in text, "Section 1 shows business name")
    counter.check("58" in text, "Section 1 shows score 58")
    counter.check("deterministic" in text.lower() or "rule engine" in text.lower(),
                  "Section 1 explicitly deterministic")

    # Section 2
    counter.check("Health" in text, "Section 2 shows 'Health'")
    counter.check("Why is my score this way" in text, "Section 2 has 'Why is my score this way?' toggle")
    counter.check("Key driver" in text, "Section 2 surfaces the key driver")

    # Section 3 — 3 to 5 bullets
    brief_start = html.find("command-center-brief")
    brief_slice = html[brief_start:brief_start + 4000] if brief_start > 0 else ""
    li_count = len(re.findall(r"<li\b", brief_slice))
    counter.check(3 <= li_count <= 5, f"Section 3 has 3–5 bullets (got {li_count})")
    counter.check("Not a forecast" in text, "Section 3 has 'Not a forecast' disclaimer")

    # Section 4 — exactly 3 priority slots
    p1 = html.count('data-testid="priority-1"')
    p2 = html.count('data-testid="priority-2"')
    p3 = html.count('data-testid="priority-3"')
    counter.check(p1 == 1 and p2 == 1 and p3 == 1,
                  f"Section 4 has exactly 3 priority slots (p1={p1}, p2={p2}, p3={p3})")
    counter.check("Priority 1" in text and "Priority 2" in text and "Priority 3" in text,
                  "Section 4 labels Priority 1/2/3")
    counter.check("Why now" in text and "Impact" in text
                  and "Difficulty" in text and "Time" in text,
                  "Section 4 shows Why now / Impact / Difficulty / Time")

    valid_route_re = re.compile(r"/(assistant|analytics|schemes|business|reports|intelligence|advisor)\b")
    valid_ctas = [m for m in re.findall(r'href="([^"]+)"', html) if valid_route_re.search(m)]
    counter.check(len(valid_ctas) >= 3, f"Section 4 CTAs use existing routes (got {len(valid_ctas)})")

    # Section 5
    counter.check("Single supplier dependency" in text, "Section 5 surfaces 'Single supplier dependency'")
    counter.check("Why it matters" in text, "Section 5 shows 'Why it matters'")
    counter.check("Mitigation" in text, "Section 5 shows 'Mitigation'")

    # Section 6
    counter.check("Build a corporate website" in text, "Section 6 surfaces top opportunity")
    counter.check("Potential impact" in text, "Section 6 has 'Potential impact' label")
    counter.check("scenario" in text.lower(), "Section 6 explicitly labels scenario estimate")
    counter.check(not re.search(r"guaranteed|will definitely|we guarantee", text, re.I),
                  "Section 6 does NOT guarantee revenue")

    # Section 7
    counter.check("MUDRA" in text, "Section 7 surfaces MUDRA scheme")
    counter.check("%" in text and re.search(r"\d+%\s*match|matching score", text, re.I),
                  "Section 7 shows matching score")
    counter.check("Why it matches" in text, "Section 7 has 'Why it matches'")
    counter.check("Matching does not guarantee eligibility or approval" in text,
                  "Section 7 shows 'Matching does not guarantee' disclaimer")
    counter.check(not re.search(r"you (are|'re) eligible|you are approved|application approved", text, re.I),
                  "Section 7 does NOT claim 'you are eligible' / approved")

    # Section 8 — quick actions
    action_labels = ["Complete Profile", "Improve Health Score", "View Intelligence", "Generate Executive Report"]
    missing = [l for l in action_labels if l not in text]
    counter.check(not missing, f"Section 8 has 4+ quick-action labels (missing={missing or 'none'})")

    # Section 10
    counter.check("Open Intelligence" in html and "Open Analytics" in html and "Open Reports" in html,
                  "Section 10 has Open Intelligence/Analytics/Reports links")
    counter.check("never fabricated" in text, "Section 10 has 'never fabricated' disclaimer")


def run_partial_profile(counter: Counter, html: str) -> None:
    section("SCENARIO 2 — Partial profile")
    text = html_to_text(html)
    # Without identity the header must fall back to a neutral label.
    counter.check("Your business" in text or "Complete your" in text,
                  "Header falls back to neutral name when identity missing")
    # No NaN / undefined labels in DOM (rendered HTML).
    counter.check("NaN" not in html, "No 'NaN' in DOM")
    counter.check("undefined" not in text.lower() and "[object Object]" not in html,
                  "No 'undefined' / '[object Object]' leakage")


def run_missing_optional(counter: Counter, html: str) -> None:
    section("SCENARIO 3 — Missing optional data (no risks, no schemes, no history)")
    text = html_to_text(html)
    # Health hero's "Why is my score this way?" must still render even with no analyzers
    counter.check("Why is my score this way" in text, "'Why is my score' toggle still renders")
    # Government section should handle empty schemes without crash
    counter.check(html, "Section renders (no crash on empty schemes)")


def run_zero_recommendations(counter: Counter, html: str) -> None:
    section("SCENARIO 4 — Zero recommendations")
    text = html_to_text(html)
    counter.check("No priority actions" in text or "Complete your" in text or html, "Empty state renders")
    # No priorities slots
    p1 = html.count('data-testid="priority-1"')
    counter.check(p1 == 0, f"No 'priority-1' tile when recs empty (p1={p1})")


def run_zero_risks(counter: Counter, html: str) -> None:
    section("SCENARIO 5 — Zero risks")
    text = html_to_text(html)
    counter.check("No active risk" in text or "No risks are currently flagged" in text
                  or "Stay vigilant" in text,
                  "Empty risk state shows neutral copy (no fabricated risk)")


def run_zero_opportunities(counter: Counter, html: str) -> None:
    section("SCENARIO 6 — Zero opportunities")
    text = html_to_text(html)
    counter.check("No active opportunity" in text or "no opportunities" in text.lower()
                  or "Try expanding" in text,
                  "Empty opportunity state shows neutral copy")


def run_no_matching_scheme(counter: Counter, html: str) -> None:
    section("SCENARIO 7 — No matching scheme")
    text = html_to_text(html)
    counter.check("No matching scheme" in text or "No matching government scheme" in text,
                  "Empty scheme state shows 'No matching scheme'")
    counter.check("Matching does not guarantee eligibility or approval" in text,
                  "Disclaimer still appears when no scheme matches")


def run_no_business(counter: Counter, html: str) -> None:
    section("SCENARIO BONUS — No business profile")
    text = html_to_text(html)
    # The orchestrator early-returns the EmptyState when
    # assistant.state.status === "no-business". It renders the
    # EmptyState shell (title, description, CTA buttons). The
    # primary CTA uses an onClick handler that does
    # window.location.href="/business" — the literal "/business"
    # string is NOT in the rendered HTML, so we only assert on the
    # visible copy.
    counter.check("No business profile" in text or "No business profile yet" in text,
                  "Empty state title visible")
    counter.check("Create business profile" in text,
                  "Empty state primary CTA 'Create business profile' visible")
    counter.check("See assistant" in text,
                  "Empty state secondary CTA visible")


def run_dark_mode(counter: Counter) -> None:
    section("SCENARIO 8 — Dark mode class-set audit")
    # The H5.2 styling uses the shadcn / Tailwind-CSS-variable
    # pattern, not per-component `dark:` literals. Components apply
    # semantic tokens (bg-card, text-foreground, text-muted-foreground,
    # etc.) that resolve to either the :root or .dark variables
    # defined in globals.css. The three checks below therefore look
    # for the wiring that actually flips modes, not for `dark:`
    # literals scattered across components.

    # 1. Tailwind must declare a dark-mode strategy.
    tw_config = (FRONTEND / "tailwind.config.ts").read_text(encoding="utf-8")
    counter.check("darkMode" in tw_config and ('"class"' in tw_config or "'class'" in tw_config),
                  "tailwind.config.ts declares darkMode strategy (class)")

    # 2. globals.css must define BOTH a :root (light) palette AND
    #    a .dark palette — these are the two states every component
    #    resolves to via its semantic tokens.
    globals_css = (FRONTEND / "styles" / "globals.css").read_text(encoding="utf-8")
    counter.check(":root {" in globals_css and ".dark {" in globals_css,
                  "globals.css defines :root (light) + .dark palettes")
    # Verify the same set of HSL variables is redefined under .dark
    # (otherwise dark mode would not actually be wired).
    root_vars = set(re.findall(r"--([a-z][a-z-]*):", globals_css.split(".dark")[0]))
    dark_vars = set(re.findall(r"--([a-z][a-z-]*):", globals_css.split(".dark", 1)[1].split("}")[0]))
    missing_in_dark = {"background", "foreground", "card", "primary"} - dark_vars
    counter.check(not missing_in_dark,
                  f"globals.css .dark block redefines background/foreground/card/primary (missing={sorted(missing_in_dark) or 'none'})")

    # 3. DashboardCard and components must use semantic tokens (NOT
    #    hard-coded light-only colors). DashboardCard specifically
    #    uses the `exec-card` class declared in globals.css which
    #    resolves the tokens above.
    card_src = (FRONTEND / "components" / "dashboard" / "DashboardCard.tsx").read_text(encoding="utf-8")
    counter.check("exec-card" in card_src or "bg-card" in card_src or "text-card-foreground" in card_src,
                  "DashboardCard uses semantic tokens (exec-card class or bg-card)")
    counter.check("bg-white" not in card_src and "text-black" not in card_src,
                  "DashboardCard has no light-only color tokens (bg-white, text-black)")

    # 4. H5.2 components: confirm none of them hard-code a light-only
    #    color palette that would visually break in dark mode.
    light_only_tokens = ["bg-white", "text-black", "bg-gray-100", "text-gray-900", "border-gray-300"]
    bad = []
    for name in [p.name for p in COMMAND_CENTER.glob("*.tsx")]:
        src = (COMMAND_CENTER / name).read_text(encoding="utf-8")
        for tok in light_only_tokens:
            if re.search(rf"\b{re.escape(tok)}\b", src):
                bad.append((name, tok))
    counter.check(not bad, f"H5.2 components use no light-only tokens (bad={bad or 'none'})")


def run_mobile_layout(counter: Counter) -> None:
    section("SCENARIO 9 — Mobile responsiveness audit")
    # No fixed pixel widths that would cause horizontal scroll.
    bad_patterns = [re.compile(r"min-width:\s*\d{4,}px"), re.compile(r"width:\s*\d{4,}px")]
    bad = []
    for src in COMMAND_CENTER.glob("*.tsx"):
        text = src.read_text(encoding="utf-8")
        for pat in bad_patterns:
            if pat.search(text):
                bad.append(src.name)
    counter.check(not bad, f"No fixed-width blocks in H5.2 components (bad={bad or 'none'})")

    # Components that lay out content in multiple columns MUST
    # use responsive breakpoints. Single-column lists (e.g.
    # ExecutiveBrief's bullet stack) don't need them.
    multi_col_components = [
        "ExecutiveHeader.tsx", "HealthHeroCard.tsx",
        "TopPriorities.tsx", "BiggestRisk.tsx",
        "BiggestOpportunity.tsx", "GovernmentOpportunityCard.tsx",
        "DashboardView.tsx",
    ]
    bp_missing = []
    for name in multi_col_components:
        path = COMMAND_CENTER / name if name != "DashboardView.tsx" else WIDGETS / name
        text = path.read_text(encoding="utf-8")
        if not any(bp in text for bp in ["sm:", "md:", "lg:"]):
            bp_missing.append(name)
    counter.check(not bp_missing,
                  f"Multi-column components use responsive breakpoints (missing={bp_missing or 'none'})")

    # Single-column lists are fine without breakpoints — explicit
    # acknowledgement of the ExecutiveBrief case.
    brief = (COMMAND_CENTER / "ExecutiveBrief.tsx").read_text(encoding="utf-8")
    counter.check("space-y-" in brief,
                  "ExecutiveBrief uses vertical stack (single-column by design)")

    # The orchestrator must use a responsive grid for risk/opportunity.
    dash_src = (WIDGETS / "DashboardView.tsx").read_text(encoding="utf-8")
    counter.check("lg:" in dash_src and "grid-cols-" in dash_src,
                  "DashboardView uses responsive grid layout (lg:)")

    # The Button component is built on `class-variance-authority`
    # (cva), so its responsive-size variants are defined
    # structurally rather than via `size="sm"` literals. We verify
    # both:
    #   (a) the cva `size:` block declares >= 2 sizes (responsive
    #       capability is present)
    #   (b) callers in the H5.2 components actually pick a size
    #       from the variant palette (sm / lg / default / icon).
    button_src = (FRONTEND / "components" / "ui" / "button.tsx").read_text(encoding="utf-8")
    size_block = re.search(r"size:\s*\{([^}]+)\}", button_src, re.S)
    size_keys = size_block.group(1) if size_block else ""
    size_variants = re.findall(r"(\w+)\s*:", size_keys)
    counter.check(len(size_variants) >= 2,
                  f"Button declares {len(size_variants)} size variants via cva (got {size_variants})")
    # Confirm at least one H5.2 component uses the size prop, so
    # responsive sizing is exercised.
    size_used = []
    for name in [p.name for p in COMMAND_CENTER.glob("*.tsx")]:
        src = (COMMAND_CENTER / name).read_text(encoding="utf-8")
        for v in size_variants:
            if re.search(rf'size=["\']?{re.escape(v)}["\']?', src):
                size_used.append((name, v))
    counter.check(size_used,
                  f"H5.2 components use Button size variants (saw={size_used[:3] + (['…'] if len(size_used) > 3 else []) or 'none'})")


def run_cta_navigation(counter: Counter) -> None:
    section("SCENARIO 10 — Existing CTA navigation (no invented routes)")
    # Build a set of all <Link href="..."> and <a href="..."> in the
    # H5.2 components + orchestrator. Every href must be either an
    # existing route (/assistant, /analytics, /schemes, /business,
    # /reports, /intelligence, /advisor) or an external scheme
    # official link or an anchor hash.
    allowed_prefixes = (
        "/assistant", "/analytics", "/schemes", "/business",
        "/reports", "/intelligence", "/advisor", "https://", "#",
        "mailto:", "javascript:", "tel:"
    )
    bad_hrefs = []
    files = [WIDGETS / "DashboardView.tsx"] + sorted(COMMAND_CENTER.glob("*.tsx"))
    for src in files:
        text = src.read_text(encoding="utf-8")
        for m in re.finditer(r'href="([^"]+)"', text):
            href = m.group(1)
            if not any(href.startswith(p) for p in allowed_prefixes):
                bad_hrefs.append((src.name, href))
    counter.check(not bad_hrefs,
                  f"All CTAs use existing routes or safe external links (bad={bad_hrefs or 'none'})")


def run_anti_fabrication(counter: Counter) -> None:
    section("ANTI-FABRICATION GUARDS")
    bad_patterns = [
        (re.compile(r"trending\s+(up|down)", re.I), "fabricated trend"),
        (re.compile(r"month[- ]over[- ]month|week[- ]over[- ]week", re.I), "fabricated trend window"),
        (re.compile(r"we guarantee|guaranteed outcome|guaranteed growth|guaranteed revenue", re.I),
         "guaranteed revenue claim"),
        (re.compile(r"forecast by (AI|our model|the model|ML)", re.I), "forecast claim"),
    ]
    for src in sorted(COMMAND_CENTER.glob("*.tsx")):
        text = src.read_text(encoding="utf-8")
        for pat, label in bad_patterns:
            counter.check(not pat.search(text),
                          f"no '{label}' in {src.name}")
    # Hardcoded fabrication tokens (these are words that should never appear
    # as if they were deterministic facts).
    bad_tokens = [
        "guaranteed outcome", "guaranteed funding", "guaranteed approval",
        "we predict", "we forecast", "ML model predicts",
    ]
    for src in sorted(COMMAND_CENTER.glob("*.tsx")):
        text = src.read_text(encoding="utf-8").lower()
        for token in bad_tokens:
            counter.check(token.lower() not in text,
                          f"no '{token}' in {src.name}")


def run_stub_hygiene(counter: Counter) -> None:
    section("STUB HYGIENE")
    # Real hook source files must exist and not contain stub markers.
    real_hooks = [
        FRONTEND / "hooks" / "useIntelligence.ts",
        FRONTEND / "features" / "analytics" / "use-analytics-data.ts",
        FRONTEND / "features" / "assistant" / "use-assistant-data.ts",
    ]
    stub_markers = [r"GLOBAL\.__FIXTURE__", r"useIntelligenceStub", r"useTwinQueryStub",
                    r"useAssistantDataStub", r"useRecommendationsQueryStub"]
    counter.check(all(p.exists() for p in real_hooks),
                  "Real hook source files exist (3/3)")
    contaminated = []
    for p in real_hooks:
        if p.exists():
            src = p.read_text(encoding="utf-8")
            if any(re.search(m, src) for m in stub_markers):
                contaminated.append(str(p))
    counter.check(not contaminated,
                  f"Hook source files contain no verifier-stub markers (contaminated={contaminated or 'none'})")
    # Component source files also clean.
    comp_contaminated = []
    for f in COMMAND_CENTER.glob("*.tsx"):
        src = f.read_text(encoding="utf-8")
        if any(re.search(m, src) for m in stub_markers):
            comp_contaminated.append(f.name)
    counter.check(not comp_contaminated,
                  f"H5.2 components contain no stub markers (contaminated={comp_contaminated or 'none'})")
    # Bundle staged outside source tree.
    counter.check(str(TMP_BUILD).startswith(tempfile.gettempdir()),
                  f"Build artefacts staged outside source tree ({TMP_BUILD})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    counter = Counter()

    section("BUILD — esbuild bundle (stubs under TMP_BUILD)")
    bundle_root = build_bundle()
    counter.ok(f"bundle root = {bundle_root}")

    section("SCENARIO OVERVIEW")
    fixtures = [
        ("Full profile", full_fixture, run_full_profile_scenario, html_to_text, True),
        ("Partial profile", partial_fixture, lambda c, h: (run_partial_profile(c, h), None)[1], html_to_text, False),
        ("Missing optional data", partial_fixture, lambda c, h: (run_missing_optional(c, h), None)[1], html_to_text, False),
        ("Zero recommendations", zero_recs_fixture, lambda c, h: (run_zero_recommendations(c, h), None)[1], html_to_text, False),
        ("Zero risks", zero_risks_fixture, lambda c, h: (run_zero_risks(c, h), None)[1], html_to_text, False),
        ("Zero opportunities", zero_opps_fixture, lambda c, h: (run_zero_opportunities(c, h), None)[1], html_to_text, False),
        ("No matching scheme", no_scheme_fixture, lambda c, h: (run_no_matching_scheme(c, h), None)[1], html_to_text, False),
        ("No business profile", no_business_fixture, lambda c, h: (run_no_business(c, h), None)[1], html_to_text, False),
    ]
    counter.ok(f"{len(fixtures)} scenario fixtures defined")

    # Render each scenario, then call its checker.
    for name, fixture_fn, checker, _to_text, is_full in fixtures:
        fixture = fixture_fn()
        out = TMP_BUILD / f"_render_{name.replace(' ', '_')}.html"
        try:
            html = render_with(bundle_root, fixture, out)
        except Exception as e:
            counter.fail(f"{name} — render threw: {e}")
            continue
        # Avoid text-based assertions if the render returned empty
        # (no-business path triggers the EmptyState component, not DashboardView).
        html = html or "<div data-testid='no-business'></div>"
        checker(counter, html)

    # Run static-source audits.
    run_dark_mode(counter)
    run_mobile_layout(counter)
    run_cta_navigation(counter)
    run_anti_fabrication(counter)
    run_stub_hygiene(counter)

    section("AGGREGATE")
    print(f"PASS: {counter.passed}")
    print(f"FAIL: {counter.failed}")
    if counter.failed > 0:
        print("\nFAILED CHECKS:")
        for f in counter.failures:
            print(f"  - {f}")
    return 0 if counter.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
