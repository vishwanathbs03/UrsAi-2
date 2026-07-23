"""Business Score Engine — façade that runs every score calculator
and builds the API response.

The service is intentionally thin: it owns no scoring rules
itself. Each score calculator in :mod:`app.services.scoring.scores_lifted`
or :mod:`app.services.scoring.scores_derived` does the work; this
module's job is to:

  1. Reuse the intelligence engine (do not recompute fields)
  2. Run every score in a stable, documented order
  3. Aggregate the eight scores into a single ``summary`` block
     so the UI can render one headline + eight section cards
  4. Stamp the response with the time it was generated so the
     UI can display "Updated X minutes ago"
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.business_repository import BusinessRepository
from app.services.intelligence import IntelligenceService
from app.services.scoring.base import BusinessScore
from app.services.scoring.scores_derived import (
    InnovationScore,
    RiskScore,
    SustainabilityScore,
)
from app.services.scoring.scores_lifted import (
    ComplianceScore,
    DigitalScore,
    ExportScore,
    GrowthScore,
    OverallScore,
)


# Order is the order the cards appear in the UI.
_DEFAULT_SCORES = (
    OverallScore(),
    ExportScore(),
    DigitalScore(),
    ComplianceScore(),
    GrowthScore(),
    RiskScore(),
    InnovationScore(),
    SustainabilityScore(),
)


class BusinessScoreService:
    """Compute standardized Business Scores for the authenticated
    user's business profile.

    The service delegates field analysis to
    :class:`~app.services.intelligence.service.IntelligenceService`
    so there is one source of truth. The score layer is pure
    transformation on top of the analyzer output.

    The service is constructed with a BusinessRepository rather
    than a Session so it can be unit-tested with an in-memory
    session and a hand-built Business row.
    """

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._intelligence = IntelligenceService(repo)

    def compute(self, owner_id: int) -> dict:
        # Reuse Part 1 — never re-derive field-by-field scoring here.
        report = self._intelligence.analyze(owner_id)
        analyzers = {a["key"]: a for a in report["analyzers"]}

        # We need real AnalyzerResult objects (not the serialized
        # payload) to feed into the score calculators, because
        # those calculators read ``breakdown`` and ``key`` from
        # the typed objects. Re-fetch via the service's analyzer
        # list to keep the data flow clean.
        from app.services.intelligence.service import _DEFAULT_ANALYZERS

        business = self._repo.get_by_owner(owner_id)
        if business is None:
            from app.repositories.business_repository import BusinessNotFound
            raise BusinessNotFound("No business profile to score.")

        results = [analyzer.run(business) for analyzer in _DEFAULT_ANALYZERS]
        analyzer_map = {r.key: r for r in results}

        scores: list[BusinessScore] = [
            calc.compute(analyzer_map) for calc in _DEFAULT_SCORES
        ]

        return {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "summary": _summary(scores),
            "scores": [s.to_payload() for s in scores],
        }


def _summary(scores: list[BusinessScore]) -> dict:
    """Aggregate the eight scores into a single headline block.

    The headline is a weighted average where the Overall score
    is given 50% weight (it's already a weighted composite of
    the five analyzers) and the remaining seven scores split the
    other 50% equally. This avoids double-counting the lifted
    scores *too* heavily while still letting the risk / innovation
    / sustainability scores move the headline.

    The ``band_distribution`` count tells the UI how many scores
    sit in each band (Low / Medium / High / Excellent) so it can
    render a one-line histogram next to the headline.
    """
    if not scores:
        return {
            "score": 0,
            "level": "Low",
            "weighted_inputs": 0,
            "band_distribution": {"Low": 0, "Medium": 0, "High": 0, "Excellent": 0},
        }

    by_key = {s.key: s for s in scores}
    overall = by_key.get("overall")
    derived_keys = [k for k in ("risk", "innovation", "sustainability", "export", "digital", "compliance", "growth") if k in by_key]

    # 50% Overall + 50% / N split across the other scores.
    if overall is not None and derived_keys:
        per_derived = 0.5 / len(derived_keys)
        weighted = 0.5 * overall.score + sum(per_derived * by_key[k].score for k in derived_keys)
    elif overall is not None:
        weighted = float(overall.score)
    else:
        weighted = sum(s.score for s in scores) / len(scores)

    from app.services.scoring.levels import level_for

    band = {"Low": 0, "Medium": 0, "High": 0, "Excellent": 0}
    for s in scores:
        band[s.level] = band.get(s.level, 0) + 1

    return {
        "score": int(round(weighted)),
        "level": level_for(int(round(weighted))),
        "weighted_inputs": len(scores),
        "band_distribution": band,
    }
