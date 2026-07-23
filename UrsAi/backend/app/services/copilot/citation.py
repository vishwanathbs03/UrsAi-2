"""CitationBuilder — collect every source the
Copilot response leaned on.

The spec says:

  "Every response must include references.
   Users should know why the answer was
   generated."

The builder reads the same :class:`CopilotContext`
the provider saw plus the ``highlights`` tags
the mock provider emitted. It produces a list of
:class:`Citation` records — one per source — with
kind, stable id, human-readable label, and a
one-sentence reason the citation is included.

A response must always include at least one
citation when the context has data. The
``UNKNOWN`` and ``GREETING`` intents may have
zero citations (the user is asking a question
the engine cannot answer with the data on
hand) — in that case the citations list is
empty and the response is self-evidently
high-level.

Citation kinds
--------------

The builder emits six kinds, matching the
:CITATION_KINDS` set:

  * ``recommendation``  — recommendation ids
  * ``rule``            — rule firing ids
  * ``article``         — knowledge article ids
  * ``roadmap``         — roadmap item ids
  * ``score``           — business score keys
  * ``dna``             — DNA archetype / trait
                          keys
  * ``intelligence``    — intelligence analyzer
                          keys (when the response
                          mentions a specific
                          lens)

The builder dedupes by ``(kind, id)`` so the
same source never appears twice.
"""

from __future__ import annotations

from app.services.copilot.base import (
    CITATION_KINDS,
    Citation,
    CopilotContext,
)


# Max citations per kind — keeps the response
# from ballooning when the user has a rich
# profile.
_MAX_PER_KIND = 5


class CitationBuilder:
    """Build the :class:`Citation` list for a
    given context.

    The builder is stateless; the same context
    produces the same citations.
    """

    def build(
        self,
        context: CopilotContext,
        highlights: tuple[str, ...] = (),
    ) -> tuple[Citation, ...]:
        # Highlights take priority — the mock
        # provider tags the sources it leaned
        # on. We use them to seed the citation
        # list, then pad with the context's
        # top-by-impact sources so the response
        # always carries at least one citation
        # when the context has data.
        out: list[Citation] = []
        seen: set[tuple[str, str]] = set()

        for tag in highlights:
            citation = _from_highlight(tag, context)
            if citation is None:
                continue
            key = (citation.kind, citation.id)
            if key in seen:
                continue
            seen.add(key)
            out.append(citation)

        # Pad with top-by-impact sources per
        # kind — same ordering rule the
        # provider uses. Skip kinds the
        # provider already covered.
        for kind in CITATION_KINDS:
            count = sum(1 for c in out if c.kind == kind)
            if count >= _MAX_PER_KIND:
                continue
            extras = _top_citations_for_kind(kind, context)
            for c in extras:
                key = (c.kind, c.id)
                if key in seen:
                    continue
                if count >= _MAX_PER_KIND:
                    break
                seen.add(key)
                out.append(c)
                count += 1

        return tuple(out)


# --------------------------------------------------------------------------- #
# Highlight parsing
# --------------------------------------------------------------------------- #


def _from_highlight(
    tag: str, ctx: CopilotContext
) -> Citation | None:
    """Convert a provider highlight tag
    (``"rule:rule.export.no_iec"``,
    ``"score:export"``, ``"dna:archetype.foundation_builder"``)
    into a :class:`Citation`.
    """
    if ":" not in tag:
        return None
    kind, _, raw = tag.partition(":")
    kind = kind.strip().lower()
    raw = raw.strip()
    if not raw:
        return None
    if kind not in CITATION_KINDS:
        return None

    if kind == "rule":
        return _lookup_rule(ctx, raw)
    if kind == "recommendation":
        return _lookup_recommendation(ctx, raw)
    if kind == "article":
        return _lookup_article(ctx, raw)
    if kind == "roadmap":
        return _lookup_roadmap(ctx, raw)
    if kind == "score":
        return _lookup_score(ctx, raw)
    if kind == "dna":
        return _lookup_dna(ctx, raw)
    if kind == "intelligence":
        return _lookup_intelligence(ctx, raw)
    return None


# --------------------------------------------------------------------------- #
# Per-kind lookups
# --------------------------------------------------------------------------- #


def _lookup_rule(ctx: CopilotContext, rid: str) -> Citation | None:
    cats = ((ctx.rules or {}).get("categories") or {})
    if not isinstance(cats, dict):
        return None
    for cat, block in cats.items():
        if not isinstance(block, dict):
            continue
        for f in block.get("firings") or []:
            if not isinstance(f, dict):
                continue
            if str(f.get("id", "")) == rid:
                return Citation(
                    kind="rule",
                    id=rid,
                    label=str(f.get("title", rid)),
                    reference=_rule_reference(f, cat),
                )
    # Even when the lookup misses (the
    # highlight came from a previously-cached
    # snapshot, e.g.) we still return a stub
    # so the highlight round-trips.
    return Citation(
        kind="rule",
        id=rid,
        label=rid,
        reference="Rule reference — see Rule Engine response.",
    )


def _lookup_recommendation(
    ctx: CopilotContext, rid: str
) -> Citation | None:
    for r in (ctx.recommendations or {}).get("recommendations") or []:
        if not isinstance(r, dict):
            continue
        if str(r.get("id", "")) == rid:
            return Citation(
                kind="recommendation",
                id=rid,
                label=str(r.get("title", rid)),
                reference=(
                    f"{r.get('priority', '?')} priority — "
                    f"impact {r.get('business_impact', 0)}."
                ),
            )
    return Citation(
        kind="recommendation", id=rid, label=rid,
        reference="Recommendation reference.",
    )


def _lookup_article(ctx: CopilotContext, aid: str) -> Citation | None:
    for a in (ctx.knowledge or {}).get("articles") or []:
        if not isinstance(a, dict):
            continue
        if str(a.get("id", "")) == aid:
            return Citation(
                kind="article",
                id=aid,
                label=str(a.get("title", aid)),
                reference=(
                    f"{a.get('topic', '?')} / {a.get('category', '?')}"
                ),
            )
    return Citation(
        kind="article", id=aid, label=aid,
        reference="Knowledge article reference.",
    )


def _lookup_roadmap(
    ctx: CopilotContext, rid: str
) -> Citation | None:
    for it in (ctx.roadmap or {}).get("items") or []:
        if not isinstance(it, dict):
            continue
        if str(it.get("recommendation_id", "")) == rid:
            return Citation(
                kind="roadmap",
                id=rid,
                label=str(it.get("title", rid)),
                reference=(
                    f"{it.get('phase', '?')} / "
                    f"{it.get('priority', '?')}"
                ),
            )
    return Citation(
        kind="roadmap", id=rid, label=rid,
        reference="Roadmap item reference.",
    )


def _lookup_score(ctx: CopilotContext, key: str) -> Citation | None:
    for s in (ctx.scores or {}).get("scores") or []:
        if not isinstance(s, dict):
            continue
        if str(s.get("key", "")) == key:
            return Citation(
                kind="score",
                id=key,
                label=str(s.get("title", key)),
                reference=(
                    f"score {s.get('score', '?')} "
                    f"({s.get('level', '?')})"
                ),
            )
    return Citation(
        kind="score", id=key, label=key,
        reference="Business score key reference.",
    )


def _lookup_dna(ctx: CopilotContext, raw: str) -> Citation | None:
    dna_inner = (ctx.dna or {}).get("dna") or {}
    archetype = dna_inner.get("archetype") or {}
    if raw == f"archetype.{archetype.get('key', '')}":
        return Citation(
            kind="dna",
            id=str(archetype.get("key", raw)),
            label=str(archetype.get("title", raw)),
            reference=(
                f"match {archetype.get('match_score', 0)}"
            ),
        )
    if raw.startswith("trait."):
        trait_key = raw.partition(".")[2]
        for tr in dna_inner.get("secondary_traits") or []:
            if not isinstance(tr, dict):
                continue
            if str(tr.get("key", "")) == trait_key:
                return Citation(
                    kind="dna",
                    id=trait_key,
                    label=str(tr.get("title", trait_key)),
                    reference=(
                        f"strength {tr.get('strength', 0)}, "
                        f"present={tr.get('present', False)}"
                    ),
                )
    return Citation(
        kind="dna", id=raw, label=raw,
        reference="DNA reference.",
    )


def _lookup_intelligence(
    ctx: CopilotContext, raw: str
) -> Citation | None:
    # The intelligence engine payload uses the
    # same lens keys the score engine does.
    return _lookup_score(ctx, raw) or Citation(
        kind="intelligence",
        id=raw,
        label=raw,
        reference="Intelligence lens reference.",
    )


def _rule_reference(firing: dict, category: str) -> str:
    return (
        f"{firing.get('priority', '?')} priority — "
        f"impact {firing.get('estimated_impact', 0)} — "
        f"category {category}"
    )


# --------------------------------------------------------------------------- #
# Top-by-impact padding
# --------------------------------------------------------------------------- #


def _top_citations_for_kind(
    kind: str, ctx: CopilotContext
) -> list[Citation]:
    if kind == "rule":
        flat = _flatten_rules(ctx.rules)
        return [
            Citation(
                kind="rule",
                id=str(f.get("id", "")),
                label=str(f.get("title", "")),
                reference=_rule_reference(f, str(f.get("category", ""))),
            )
            for f in flat[:_MAX_PER_KIND]
            if f.get("id")
        ]
    if kind == "recommendation":
        recs = sorted(
            (ctx.recommendations or {}).get("recommendations") or [],
            key=lambda r: -int((r or {}).get("business_impact", 0) or 0),
        )
        return [
            Citation(
                kind="recommendation",
                id=str(r.get("id", "")),
                label=str(r.get("title", "")),
                reference=(
                    f"{r.get('priority', '?')} priority — "
                    f"impact {r.get('business_impact', 0)}"
                ),
            )
            for r in recs[:_MAX_PER_KIND]
            if r.get("id")
        ]
    if kind == "article":
        arts = sorted(
            (ctx.knowledge or {}).get("articles") or [],
            key=lambda a: str((a or {}).get("id", "")),
        )
        return [
            Citation(
                kind="article",
                id=str(a.get("id", "")),
                label=str(a.get("title", "")),
                reference=(
                    f"{a.get('topic', '?')} / {a.get('category', '?')}"
                ),
            )
            for a in arts[:_MAX_PER_KIND]
            if a.get("id")
        ]
    if kind == "roadmap":
        items = sorted(
            (ctx.roadmap or {}).get("items") or [],
            key=lambda it: int((it or {}).get("estimated_start_order", 0) or 0),
        )
        return [
            Citation(
                kind="roadmap",
                id=str(it.get("recommendation_id", "")),
                label=str(it.get("title", "")),
                reference=(
                    f"{it.get('phase', '?')} / "
                    f"{it.get('priority', '?')}"
                ),
            )
            for it in items[:_MAX_PER_KIND]
            if it.get("recommendation_id")
        ]
    if kind == "score":
        scores = (ctx.scores or {}).get("scores") or []
        return [
            Citation(
                kind="score",
                id=str(s.get("key", "")),
                label=str(s.get("title", "")),
                reference=(
                    f"score {s.get('score', '?')} "
                    f"({s.get('level', '?')})"
                ),
            )
            for s in scores[:_MAX_PER_KIND]
            if s.get("key")
        ]
    if kind == "dna":
        dna_inner = (ctx.dna or {}).get("dna") or {}
        archetype = dna_inner.get("archetype") or {}
        out: list[Citation] = []
        if archetype.get("key"):
            out.append(Citation(
                kind="dna",
                id=str(archetype.get("key", "")),
                label=str(archetype.get("title", "")),
                reference=(
                    f"match {archetype.get('match_score', 0)}"
                ),
            ))
        for tr in dna_inner.get("secondary_traits") or []:
            if not isinstance(tr, dict):
                continue
            if tr.get("key") and tr.get("present"):
                out.append(Citation(
                    kind="dna",
                    id=str(tr.get("key", "")),
                    label=str(tr.get("title", "")),
                    reference=(
                        f"strength {tr.get('strength', 0)}"
                    ),
                ))
            if len(out) >= _MAX_PER_KIND:
                break
        return out
    if kind == "intelligence":
        # The intelligence engine uses the
        # same lens keys as the score engine.
        # We already emit ``score`` citations
        # for the same keys; the intelligence
        # kind is here for completeness so
        # future highlights survive the
        # round-trip.
        return []
    return []


def _flatten_rules(rules_payload: dict | None) -> list[dict]:
    out: list[dict] = []
    cats = (rules_payload or {}).get("categories") or {}
    if not isinstance(cats, dict):
        return out
    for cat, block in cats.items():
        if not isinstance(block, dict):
            continue
        for f in block.get("firings") or []:
            if isinstance(f, dict):
                f2 = dict(f)
                f2.setdefault("category", cat)
                out.append(f2)
    out.sort(
        key=lambda f: (
            -int(f.get("estimated_impact", 0) or 0),
            str(f.get("id", "")),
        )
    )
    return out
