"""ResponseParser — turns a raw LLM response into a structured
:class:`AIDecision`.

The parser is defensive: real LLM providers sometimes return
malformed JSON, and the response shape is a contract. The
parser is the single point of validation; everything else in
the engine trusts that a :class:`AIDecision` is well-formed.

The mock provider already produces a well-formed
:class:`AIDecision`, so the parser's happy path is trivial.
The error path is what protects a future real provider from
poisoning the API response.
"""

from __future__ import annotations

import json
from typing import Any

from app.services.ai.base import (
    AIDecision,
    AIInsight,
    AIProviderError,
    LLMResponse,
)


class ResponseParser:
    """Parse an :class:`LLMResponse` into an :class:`AIDecision`.

    Accepts:
      * a :class:`LLMResponse` whose ``decision`` is already a
        well-formed dataclass (the mock provider's output)
      * a JSON string in ``raw_text`` that decodes to the
        documented shape
      * a Python ``dict`` in ``raw_text`` (for tests)

    Any other shape raises :class:`AIProviderError`.
    """

    def parse(self, response: LLMResponse) -> AIDecision:
        if isinstance(response.decision, AIDecision):
            return response.decision
        return self._from_raw(response.raw_text)

    @staticmethod
    def _from_raw(raw: str) -> AIDecision:
        if not raw or not isinstance(raw, str):
            raise AIProviderError("Provider returned empty response.")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIProviderError(
                f"Provider returned non-JSON response: {exc}"
            ) from exc
        return _decision_from_dict(data)


def _decision_from_dict(data: Any) -> AIDecision:
    if not isinstance(data, dict):
        raise AIProviderError("Provider response is not a JSON object.")

    summary = str(data.get("summary", "")).strip()
    if not summary:
        raise AIProviderError("Provider response missing 'summary'.")
    archetype_label = str(data.get("archetype_label", "")).strip()
    overall_health = str(data.get("overall_health", "")).strip()

    top_strengths = tuple(_as_str_list(data.get("top_strengths")))
    top_risks = tuple(_as_str_list(data.get("top_risks")))

    insights_in = data.get("insights", []) or []
    if not isinstance(insights_in, list):
        raise AIProviderError("'insights' must be a list.")
    insights: list[AIInsight] = []
    for i, raw in enumerate(insights_in):
        if not isinstance(raw, dict):
            raise AIProviderError(f"insights[{i}] is not an object.")
        iid = str(raw.get("id", "")).strip()
        title = str(raw.get("title", "")).strip()
        explanation = str(raw.get("explanation", "")).strip()
        if not iid or not title or not explanation:
            raise AIProviderError(
                f"insights[{i}] missing id/title/explanation."
            )
        confidence = raw.get("confidence", 60)
        try:
            confidence_i = max(0, min(100, int(confidence)))
        except (TypeError, ValueError) as exc:
            raise AIProviderError(
                f"insights[{i}].confidence must be an int 0..100."
            ) from exc
        insights.append(
            AIInsight(
                id=iid,
                title=title,
                explanation=explanation,
                category=str(raw.get("category", "general")),
                priority=str(raw.get("priority", "Medium")),
                confidence=confidence_i,
                supporting_rule_ids=tuple(
                    _as_str_list(raw.get("supporting_rule_ids"))
                ),
                supporting_article_ids=tuple(
                    _as_str_list(raw.get("supporting_article_ids"))
                ),
            )
        )

    return AIDecision(
        summary=summary,
        archetype_label=archetype_label,
        overall_health=overall_health,
        top_strengths=top_strengths,
        top_risks=top_risks,
        insights=tuple(insights),
    )


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value if v is not None]
    return [str(value)]
