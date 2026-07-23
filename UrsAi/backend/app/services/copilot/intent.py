"""IntentEngine — rule-based intent detection.

The Copilot spec mandates:

  * "Implement deterministic intent detection."
  * "No LLM. Rule-based only."

The engine is a pure function over the user's
``message`` plus the keyword table in
:data:`app.services.copilot.base.INTENT_KEYWORDS`.
There is no model, no embedding, no API call.

Algorithm
---------

1. Normalise the message (lowercase, collapse
   whitespace, strip punctuation except for
   apostrophes and hyphens).
2. For each intent, count how many *distinct*
   keyword stems appear as substrings of the
   normalised message. A keyword is a "match"
   when the message contains the stem as a
   bounded word (whitespace- or punctuation-
   delimited on both sides). This avoids
   "score" matching "underscore" or
   "important".
3. Compute a per-intent score:
     base      = 40
     per_match = +12  (one match already exceeds
                       the UNKNOWN threshold)
     bonus     = +2  per extra character of
                       the longest matched stem
   The bonus rewards specific keywords (e.g.
   "export readiness" beats "export" alone)
   while keeping the score 0..100.
4. Specificity tie-break — when two intents
   have the same base+match+length score, the
   intent with the higher *specificity* wins.
   Specificity is the sum of matched-stem
   lengths: a 2-keyword match in DNA ("business
   dna" + "archetype") beats a single
   "business" match in GENERAL_BUSINESS.
5. Order tie-break — when two intents have the
   same specificity, the intent declared
   earlier in :data:`INTENTS` wins. More
   specific categories (DNA, ROADMAP, ...) are
   declared before the catch-all
   GENERAL_BUSINESS / UNKNOWN.
6. If no intent has a non-zero score, the
   winner is :data:`INTENTS[-1]` (``UNKNOWN``)
   with ``confidence == 0``.

The engine is **stateless** and **deterministic**
— two calls with the same message return
byte-identical :class:`IntentResult` objects.
"""

from __future__ import annotations

import re

from app.services.copilot.base import (
    INTENTS,
    INTENT_KEYWORDS,
    INTENT_PRIMARY_SPECIFICITY,
    INTENT_PRIMARY_STEMS,
    IntentCategory,
    IntentResult,
)


# Confidence thresholds. The base score is set
# to 40 so a single keyword match already
# produces a 52% confidence — meaningful without
# being over-confident. Two matches produce 64%
# (clearly above the UNKNOWN band); three match
# produces 76% (clearly decisive).
_BASE_CONFIDENCE = 40
_PER_MATCH_BONUS = 12

# Maximum stems consumed per intent. Keeps the
# score bounded.
_MAX_STEMS = 6


class IntentEngine:
    """Rule-based intent detector.

    The engine has no constructor parameters —
    the keyword table is read once from the
    module-level constant in :mod:`base`. A
    subclass can override :meth:`_classify` for
    a different scoring policy; the rest of the
    pipeline (context builder, provider,
    citation builder) is unchanged.
    """

    def __init__(self) -> None:
        # Pre-compile the keyword stems into
        # word-boundary regexes for fast
        # substring matching. The pattern
        # ``\\bstem\\b`` matches the stem only
        # when it is delimited by non-word
        # characters (or string boundaries) on
        # both sides.
        self._patterns: dict[
            IntentCategory, list[tuple[str, re.Pattern[str]]]
        ] = {}
        for intent, stems in INTENT_KEYWORDS.items():
            compiled: list[tuple[str, re.Pattern[str]]] = []
            for stem in stems:
                # Escape regex metacharacters in
                # the stem (e.g. "what if",
                # "what-if", "e-commerce").
                pattern = re.compile(
                    r"(?<![A-Za-z0-9])"
                    + re.escape(stem)
                    + r"(?![A-Za-z0-9])",
                    flags=re.IGNORECASE,
                )
                compiled.append((stem, pattern))
            self._patterns[intent] = compiled
        # Pre-compile the primary stems
        # separately so we can apply the
        # primary-stem specificity boost
        # without re-scanning the message.
        self._primary_patterns: dict[
            IntentCategory, list[re.Pattern[str]]
        ] = {}
        for intent, stems in INTENT_PRIMARY_STEMS.items():
            self._primary_patterns[intent] = [
                re.compile(
                    r"(?<![A-Za-z0-9])"
                    + re.escape(stem)
                    + r"(?![A-Za-z0-9])",
                    flags=re.IGNORECASE,
                )
                for stem in stems
            ]

    # ---- public API -------------------------------------------------- #

    def detect(self, message: str) -> IntentResult:
        """Return the detected :class:`IntentResult`.

        ``message`` is the raw user message. The
        engine never raises — an empty / None
        message falls back to ``UNKNOWN`` with
        confidence 0.
        """
        normalised = _normalise(message)
        if not normalised:
            return IntentResult(
                category="UNKNOWN", confidence=0,
                matched_keywords=(),
            )

        # Score every intent.
        scores: dict[IntentCategory, int] = {}
        matches: dict[IntentCategory, list[tuple[IntentCategory, str]]] = {}
        specificity: dict[IntentCategory, int] = {}
        for intent, patterns in self._patterns.items():
            seen_stem: set[str] = set()
            count = 0
            total_chars = 0
            hit_list: list[tuple[IntentCategory, str]] = []
            for stem, pattern in patterns:
                # Count distinct stems only —
                # duplicate hits should not
                # double-count, but tracking the
                # duplicate *intent* keeps the
                # confidence curve honest.
                if stem in seen_stem:
                    continue
                if pattern.search(normalised):
                    seen_stem.add(stem)
                    count += 1
                    total_chars += len(stem)
                    hit_list.append((intent, stem))
                    if count >= _MAX_STEMS:
                        break
            if hit_list:
                scores[intent] = self._score(count, 0)
                matches[intent] = hit_list
                # Specificity — a three-component
                # lexicographic score:
                #   1. primary_hits (most
                #      significant). 1 always
                #      beats 0. This makes
                #      "What is my business DNA?"
                #      land on DNA (1 primary on
                #      "dna") over GENERAL_BUSINESS
                #      (1 primary on "my business").
                #   2. primary_specificity (tie-
                #      break when both intents
                #      have the same primary
                #      hits). The sum of
                #      per-stem weights from
                #      INTENT_PRIMARY_SPECIFICITY.
                #      "digital" = 14,
                #      "my business" = 2 — so
                #      "Is my business digital-
                #      ready?" lands on DIGITAL
                #      (14 > 2).
                #   3. total_chars (final
                #      tie-break).
                primary_hits = 0
                primary_specificity = 0
                for pstem, pp in zip(
                    INTENT_PRIMARY_STEMS.get(intent, ()),
                    self._primary_patterns.get(intent, ()),
                ):
                    if pp.search(normalised):
                        primary_hits += 1
                        primary_specificity += (
                            INTENT_PRIMARY_SPECIFICITY.get(pstem, 5)
                        )
                specificity[intent] = (
                    primary_hits * 1_000_000
                    + primary_specificity * 1000
                    + total_chars
                )

        # Pick the winner. Three keys, in
        # priority order:
        #   1. score (confidence)
        #   2. specificity (sum of matched stem
        #      lengths) — a 2-keyword match in
        #      DNA beats a single "business"
        #      match in GENERAL_BUSINESS
        #   3. declared order of ``INTENTS``
        #      (more specific first; UNKNOWN
        #      last). When the highest score is
        #      0, fall back to UNKNOWN.
        best_intent: IntentCategory = "UNKNOWN"
        best_score = 0
        best_spec = 0
        for intent in INTENTS:
            sc = scores.get(intent, 0)
            if sc == 0:
                continue
            sp = specificity.get(intent, 0)
            if (
                sc > best_score
                or (sc == best_score and sp > best_spec)
            ):
                best_score = sc
                best_spec = sp
                best_intent = intent
        if best_intent == "UNKNOWN":
            return IntentResult(
                category="UNKNOWN", confidence=0,
                matched_keywords=(),
            )

        return IntentResult(
            category=best_intent,
            confidence=min(100, best_score),
            matched_keywords=tuple(matches.get(best_intent, ())),
        )

    # ---- helpers ----------------------------------------------------- #

    @staticmethod
    def _score(match_count: int, longest_stem_len: int) -> int:
        # The score is purely a function of
        # the number of matched keyword stems.
        # Specificity (long-stem vs short-stem)
        # is handled separately in the winner
        # pick loop via the per-intent
        # primary-stem boost. Keeping these two
        # signals separate is what lets
        # "What is my business DNA?" land on
        # DNA (one match, primary stem) rather
        # than GENERAL_BUSINESS (one match,
        # longer but generic).
        base = _BASE_CONFIDENCE
        match_term = _PER_MATCH_BONUS * match_count
        return base + match_term


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


# Conservative normaliser: lowercase, strip
# non-alphanumeric-except-apostrophe-and-hyphen,
# collapse whitespace, then trim. We deliberately
# keep hyphenated words intact so "what-if" and
# "e-commerce" match the keyword table.
_NON_KEEP = re.compile(r"[^a-z0-9\s'\-]+")
_WS = re.compile(r"\s+")


def _normalise(message: str | None) -> str:
    if not message:
        return ""
    s = message.strip().lower()
    s = _NON_KEEP.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    return s
