"""Abstract base + the 5 score calculators that lift an intelligence
analyzer one-to-one.

The Business Score Engine's first job is to give the user a
recognisable business score for each of the five intelligence
lenses. Rather than re-deriving the numbers (which would mean two
sources of truth), the Lift* scores reuse the analyzer's headline
score and add:

  * the 4-band (Low / Medium / High / Excellent) classification
  * a one-sentence explanation that references the business, not
    the analyzer jargon
  * a small set of contributing factors picked from the
    analyzer's breakdown

The 3 derived scores (Risk, Innovation, Sustainability) live in
:mod:`app.services.scoring.scores_derived` and compose signals
from multiple analyzers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.services.intelligence.base import AnalyzerResult
from app.services.scoring.base import BusinessScore
from app.services.scoring.factors import ContributingFactor
from app.services.scoring.levels import level_for


class Score(ABC):
    """Contract every score calculator implements."""

    #: Stable identifier used in the API response.
    key: str = "score"
    #: Human-readable title for the UI.
    title: str = "Score"

    @abstractmethod
    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        """Return the score for the given analyzer map.

        ``analyzers`` is keyed by analyzer ``key`` (e.g.
        ``"export_readiness"``). The map is guaranteed to contain
        every analyzer the engine is configured to run — missing
        analyzers are a programming error and should raise, not
        silently return 0.
        """


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _factor_from(item, present: bool, *, weight_override: int | None = None) -> ContributingFactor:
    """Build a ContributingFactor from a breakdown item.

    ``present`` is what the analyzer reported. ``weight_override``
    lets a score emphasise or de-emphasise the raw item weight in
    its own contributing list — useful for the Overall score where
    we want to show relative impact, not raw points.
    """
    impact = "positive" if item.earned > 0 and present else "negative"
    weight = weight_override if weight_override is not None else int(item.earned)
    return ContributingFactor(
        label=item.label,
        impact=impact,
        weight=max(0, weight),
        source_key=item.key,
        detail=item.hint,
    )


def _summary_for(score: int, *, high: str, mid: str, low: str) -> str:
    """Return a one-sentence verdict at the 4-band level."""
    if score >= 80:
        return high
    if score >= 60:
        return high.replace("Excellent", "Strong").replace("well-", "broadly ")
    if score >= 40:
        return mid
    return low


# --------------------------------------------------------------------------- #
# 1. Overall — average of the 5 analyzer scores, with a profile-quality
#    boost so a near-complete profile reads as a stronger business.
# --------------------------------------------------------------------------- #


class OverallScore(Score):
    """Headline business score.

    Computed as a weighted average:

      * 30% Profile Completeness (data we have to grade the rest)
      * 20% Export Readiness
      * 20% Digital Readiness
      * 15% Compliance Readiness
      * 15% Growth Readiness

    The weights are tuned so a single weak pillar cannot pull the
    overall score below the "Low" band on its own — but a major
    gap (e.g. zero certifications AND no export history) will.
    """

    key = "overall"
    title = "Overall Business Score"

    _WEIGHTS = {
        "profile_completeness": 0.30,
        "export_readiness": 0.20,
        "digital_readiness": 0.20,
        "compliance_readiness": 0.15,
        "growth_readiness": 0.15,
    }

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        missing_key = [k for k in self._WEIGHTS if k not in analyzers]
        if missing_key:
            raise KeyError(f"OverallScore: missing analyzer(s) {missing_key}")

        weighted = sum(
            analyzers[k].score * w for k, w in self._WEIGHTS.items()
        )
        # Round at the end so the 0..100 contract is honest.
        score = int(round(weighted))

        factors: list[ContributingFactor] = []
        for k, w in self._WEIGHTS.items():
            analyzer = analyzers[k]
            factors.append(
                ContributingFactor(
                    label=analyzer.title,
                    impact="positive" if analyzer.score >= 60 else ("negative" if analyzer.score < 40 else "neutral"),
                    weight=int(round(analyzer.score * w)),
                    source_key=analyzer.key,
                    detail=f"Weighted {int(w * 100)}% of overall.",
                )
            )

        explanation = _summary_for(
            score,
            high="Your business shows excellent readiness across all pillars.",
            mid="Your business is broadly ready; a few pillars need attention.",
            low="Your business is in early stages — multiple pillars need work.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# 2. Export Score — lifts ExportReadiness, reframes for the end user.
# --------------------------------------------------------------------------- #


class ExportScore(Score):
    key = "export"
    title = "Export Score"

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        a = analyzers["export_readiness"]
        score = a.score

        factors: list[ContributingFactor] = []
        for item in a.breakdown:
            factors.append(
                ContributingFactor(
                    label=item.label,
                    impact="positive" if item.earned > 0 else "negative",
                    weight=int(item.earned),
                    source_key=f"export_readiness.{item.key}",
                    detail=item.hint,
                )
            )

        explanation = _summary_for(
            score,
            high="Your business is well-positioned to win in international markets.",
            mid="Your business has export fundamentals in place; specific gaps remain.",
            low="Export readiness is low — start with a product catalog and IEC number.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# 3. Digital Score — lifts DigitalReadiness.
# --------------------------------------------------------------------------- #


class DigitalScore(Score):
    key = "digital"
    title = "Digital Score"

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        a = analyzers["digital_readiness"]
        score = a.score

        factors: list[ContributingFactor] = [
            ContributingFactor(
                label=item.label,
                impact="positive" if item.earned > 0 else "negative",
                weight=int(item.earned),
                source_key=f"digital_readiness.{item.key}",
                detail=item.hint,
            )
            for item in a.breakdown
        ]

        explanation = _summary_for(
            score,
            high="Your digital presence is mature and multi-channel.",
            mid="Your digital presence is established but could be expanded.",
            low="Your digital presence is minimal — start with a website.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# 4. Compliance Score — lifts ComplianceReadiness.
# --------------------------------------------------------------------------- #


class ComplianceScore(Score):
    key = "compliance"
    title = "Compliance Score"

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        a = analyzers["compliance_readiness"]
        score = a.score

        factors: list[ContributingFactor] = [
            ContributingFactor(
                label=item.label,
                impact="positive" if item.earned > 0 else "negative",
                weight=int(item.earned),
                source_key=f"compliance_readiness.{item.key}",
                detail=item.hint,
            )
            for item in a.breakdown
        ]

        explanation = _summary_for(
            score,
            high="Your compliance posture is strong and audit-ready.",
            mid="Your compliance posture is partial; more active certifications would help.",
            low="Your compliance posture is weak — start with one active certification.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )


# --------------------------------------------------------------------------- #
# 5. Growth Score — lifts GrowthReadiness, but reweights monthly
#    production + employees higher so the UI emphasises operational
#    capacity over declared text fields.
# --------------------------------------------------------------------------- #


class GrowthScore(Score):
    key = "growth"
    title = "Growth Score"

    def compute(self, analyzers: dict[str, AnalyzerResult]) -> BusinessScore:
        a = analyzers["growth_readiness"]
        score = a.score

        factors: list[ContributingFactor] = [
            ContributingFactor(
                label=item.label,
                impact="positive" if item.earned > 0 else "negative",
                weight=int(item.earned),
                source_key=f"growth_readiness.{item.key}",
                detail=item.hint,
            )
            for item in a.breakdown
        ]

        explanation = _summary_for(
            score,
            high="You have the operational foundation and goals to grow.",
            mid="Your growth posture is mixed — declare goals and confirm production.",
            low="Your growth posture is early-stage — add goals, employees, capacity.",
        )

        return BusinessScore(
            key=self.key,
            title=self.title,
            score=score,
            level=level_for(score),
            explanation=explanation,
            contributing_factors=factors,
        )
