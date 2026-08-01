"""ConversationService — Sprint 7 Part 3.

The service composes the chat persistence layer with the
Sprint 7 Part 2 AI provider layer:

    ChatSessionRepository     <— storage
            ^
            |
    ConversationService       <— this file
            |
            v
    AssistantProviderService   <— Sprint 7 Part 2
    AssistantContextBuilder    <— Sprint 7 Part 2

The service owns three pieces of *session-level* state:

  * **Rolling context** — the last N turns fed back into the
    assistant provider as the ``history`` field of the
    request. N is small (default 8) so the prompt stays
    bounded.
  * **Conversation summary** — a short deterministic string
    rebuilt every time a new message is appended. Capped at
    500 chars so the sidebar can render it without joining
    ``chat_messages``. The summary is *derived from the
    existing assistant context* (Twin + Recommendations +
    Roadmap + Rules + Insights) — no new business logic.
  * **Title** — auto-derived from the first user message
    ("First 80 chars of 'How can I improve my business?'")
    when the caller does not pass an explicit one.

What this service is NOT
------------------------

  * It does NOT re-implement intent classification. The
    ``kind`` field on the message is whatever the caller
    classifies — the assistant provider does not require a
    kind to answer.
  * It does NOT store vector embeddings. RAG and semantic
    search are out of scope.
  * It does NOT modify the Business Digital Twin. The
    session is a user-level artefact.
  * It does NOT modify the assistant provider's
    response shape. The provider already returns a
    deterministic body + sources + model + fallback_used;
    the service persists them verbatim.

Determinism contract
--------------------

When the configured provider is the deterministic fallback
(default), two appends of the same user message to the same
session produce the same assistant body (sans the
``generated_at`` / ``updated_at`` timestamps). When Ollama
is configured and reachable, the assistant body is whatever
the model returns — non-deterministic by construction.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Sequence

from app.repositories.chat_session_repository import (
    ChatSessionNotFound,
    ChatSessionRepository,
)
from app.services.ai.providers.base import (
    AssistantContext,
    AssistantTurn,
    ProviderUnavailableError,
    ProviderTimeoutError,
)
from app.services.ai.providers.context_builder import AssistantContextBuilder
from app.services.ai.providers.factory import ProviderFactory
from app.services.ai.providers.ollama import OllamaProvider
from app.services.ai.providers.service import AssistantProviderService
from app.services.knowledge_retrieval.service import KnowledgeRetrievalService


# Default number of recent turns replayed into the
# provider's history. Keep small so the prompt stays
# bounded; raise in a later milestone if needed.
_ROLLING_CONTEXT_TURNS = 8


# Summary cap. Matches the column width on chat_sessions.
_SUMMARY_CAP = 480

# Title cap. Matches the column width on chat_sessions.
_TITLE_CAP = 80


@dataclass(frozen=True)
class AppendResult:
    """The result of an append-message call.

    The service returns this envelope so the endpoint can
    render both messages + a refreshed session detail in a
    single Pydantic response.
    """

    user_message: dict
    assistant_message: dict
    session: dict


class ConversationService:
    """The façade the chat endpoint depends on."""

    def __init__(
        self,
        repo: ChatSessionRepository,
        *,
        assistant_service: AssistantProviderService | None = None,
        rolling_context_turns: int = _ROLLING_CONTEXT_TURNS,
        knowledge_retriever: KnowledgeRetrievalService | None = None,
    ) -> None:
        self._repo = repo
        self._assistant = assistant_service or self._default_assistant_service()
        self._rolling_context_turns = max(0, int(rolling_context_turns))
        # Optional Sprint 7 Part 4 retrieval layer. When None
        # the chat service is identical to Part 3 — no
        # retrieval, no citations.
        self._knowledge = knowledge_retriever

    # ---- CRUD -------------------------------------------------------- #

    def list_sessions(self, *, owner_id: int) -> list[dict]:
        sessions = self._repo.list_sessions(owner_id=owner_id)
        return [_session_summary(s) for s in sessions]

    def get_session(self, *, owner_id: int, session_id: int) -> dict:
        session = self._repo.get_session(owner_id=owner_id, session_id=session_id)
        if session is None:
            raise ChatSessionNotFound(
                f"Session {session_id} not found for owner {owner_id}"
            )
        return _session_detail(session)

    def create_session(
        self, *, owner_id: int, title: str = ""
    ) -> dict:
        session = self._repo.create_session(owner_id=owner_id, title=title)
        return _session_detail(session)

    def delete_session(self, *, owner_id: int, session_id: int) -> bool:
        deleted = self._repo.delete_session(
            owner_id=owner_id, session_id=session_id
        )
        if not deleted:
            raise ChatSessionNotFound(
                f"Session {session_id} not found for owner {owner_id}"
            )
        return True

    def append_message(
        self, *, owner_id: int, session_id: int, content: str
    ) -> AppendResult:
        """Append a user message + the assistant's reply.

        1. Load the session (404 if not found).
        2. Insert the user message.
        3. Compose the rolling context from the last N turns.
        4. Build the AssistantContext via the existing
           Part 2 context builder.
        5. Call the AssistantProviderService.
        6. Insert the assistant message.
        7. Refresh the session title / summary / last_model /
           fallback_used / message_count.
        """
        session = self._repo.get_session(owner_id=owner_id, session_id=session_id)
        if session is None:
            raise ChatSessionNotFound(
                f"Session {session_id} not found for owner {owner_id}"
            )

        # 1. Insert the user message.
        user_msg = self._repo.add_message(
            session=session,
            role="user",
            content=content,
            kind="",
        )

        # 2. Compose rolling history. Use every existing
        #    message *before* the user message we just added.
        history = self._build_history(session)

        # 3. Build the assistant context via Part 2.
        context = self._assistant.build_context(owner_id=owner_id)

        # 4. Sprint 7 Part 4 — retrieve, rank, build
        #    citations. Bind Owner_id to the assistant's
        #    context shape so the per-business boost fires
        #    when the layer has access to the data.
        knowledge_ctx = None
        if self._knowledge is not None:
            owner_context = self._build_owner_context(context)
            knowledge_ctx = self._knowledge.retrieve(
                query=content,
                owner_context=owner_context,
            )

        # 5. Call the provider. The provider already
        #    catches ProviderUnavailableError /
        #    ProviderTimeoutError and falls back; any
        #    other AIProviderError propagates so the
        #    endpoint can surface a 502.
        assistant_resp = self._assistant.generate(
            owner_id=owner_id,
            user_prompt=content,
            history=history,
            knowledge=knowledge_ctx,
        )

        # 6. Persist the assistant reply. Sources are the
        #    union of the provider's own sources and the
        #    knowledge retrieval's citations. The chat
        #    schema is the same either way.
        provider_sources = _sources_to_payload(
            getattr(assistant_resp, "sources", ()) or ()
        )
        citation_sources = (
            _citations_to_sources(knowledge_ctx)
            if knowledge_ctx is not None else []
        )
        sources = provider_sources + citation_sources
        assistant_msg = self._repo.add_message(
            session=session,
            role="assistant",
            content=assistant_resp.body,
            kind="",
            sources=sources,
        )

        # 6. Refresh the session meta. Only auto-derive
        #    the title from the first user message when
        #    the caller did not pass one — otherwise the
        #    caller's explicit title is preserved verbatim
        #    across every subsequent append.
        new_count = len(self._repo.get_messages(session=session))
        title = session.title or _derive_title(content)
        summary = _derive_summary(
            session_summary=session.summary,
            context=context,
            latest_user=content,
            latest_assistant=assistant_resp.body,
        )
        self._repo.touch_session(
            session=session,
            title=title,
            summary=summary,
            last_model=assistant_resp.model,
            fallback_used=assistant_resp.fallback_used,
            message_count=new_count,
        )

        return AppendResult(
            user_message=_message_payload(user_msg),
            assistant_message=_message_payload(assistant_msg),
            session=_session_detail(session),
        )

    # ---- internals --------------------------------------------------- #

    def _build_history(
        self, session
    ) -> tuple[AssistantTurn, ...]:
        """Return the last N turns as AssistantTurn records."""
        messages = self._repo.get_messages(session=session)
        # Exclude the message we just added (it's the user
        # message we're about to send as the prompt).
        prior = [m for m in messages if m.id != session.id and m.role in ("user", "assistant")]
        if self._rolling_context_turns <= 0:
            return ()
        prior = prior[-self._rolling_context_turns:]
        return tuple(
            AssistantTurn(role=m.role, content=m.content) for m in prior
        )

    def _build_owner_context(self, context) -> dict:
        """Project the assembled AssistantContext into the
        per-business boost payload the retriever consumes.

        The projection is a degeneralization: the
        :class:`AssistantContext` is already a narrow
        projection of Twin + Recommendations, so we only
        forward the keys the retriever understands.

        Two calls with the same upstream state produce
        the same boost payload.
        """
        try:
            from app.services.knowledge_retrieval.service import (
                KnowledgeRetrievalService,
            )
        except ImportError:
            return {}
        low_score_keys: list[str] = []
        for score in getattr(context, "scores", ()) or ():
            try:
                if str(score.level).lower() == "low":
                    low_score_keys.append(str(score.key).lower())
            except AttributeError:
                continue
        rec_categories: list[str] = []
        for rec in getattr(context, "recommendations", ()) or ():
            try:
                cat = rec.category
                if isinstance(cat, str) and cat:
                    rec_categories.append(cat.lower())
            except AttributeError:
                continue
        return {
            "low_score_keys": tuple(sorted(set(low_score_keys))),
            "recommendation_categories": tuple(sorted(set(rec_categories))),
        }

    def _default_assistant_service(self) -> AssistantProviderService:
        """Build the default AssistantProviderService.

        Wires the Sprint 7 Part 2 context builder to call
        the five upstream engines (Twin, Recommendations,
        Roadmap, Rules, Insights) via a callable bridge that
        the endpoint will close over with the request's
        ``BusinessRepository``.
        """
        from app.config.settings import get_settings
        from app.repositories.business_repository import BusinessRepository
        from app.services.intelligence import IntelligenceService
        from app.services.recommendations import RecommendationService
        from app.services.roadmap import RoadmapService
        from app.services.rules import RuleEngineService
        from app.services.twin import TwinService
        from app.services.ai import AIDecisionService

        # NOTE: a real endpoint that owns a session
        #       will construct its own AssistantProviderService
        #       with a closure over BusinessRepository.
        #       This default is only used by callers that
        #       want a service for tests / scripts.
        raise RuntimeError(
            "ConversationService requires an explicit assistant_service. "
            "Build one with AssistantContextBuilder bound to the request's "
            "BusinessRepository and pass it in."
        )


# --------------------------------------------------------------------------- #
# Helpers — payload projection
# --------------------------------------------------------------------------- #


def _message_payload(msg) -> dict:
    try:
        sources_raw = json.loads(msg.sources_json or "[]")
    except json.JSONDecodeError:
        sources_raw = []
    sources: list[dict] = []
    for s in sources_raw:
        if not isinstance(s, dict):
            continue
        topic = str(s.get("topic", ""))
        detail = str(s.get("detail", ""))
        if topic and detail:
            sources.append({"topic": topic, "detail": detail})
    return {
        "id": int(msg.id),
        "role": str(msg.role),
        "kind": str(msg.kind or ""),
        "content": str(msg.content),
        "sources": sources,
        "created_at": _iso(msg.created_at),
    }


def _session_summary(session) -> dict:
    return {
        "id": int(session.id),
        "title": str(session.title or ""),
        "summary": str(session.summary or ""),
        "message_count": int(session.message_count or 0),
        "last_model": str(session.last_model or ""),
        "fallback_used": bool(session.fallback_used),
        "created_at": _iso(session.created_at),
        "updated_at": _iso(session.updated_at),
    }


def _session_detail(session) -> dict:
    out = _session_summary(session)
    out["messages"] = [_message_payload(m) for m in session.messages]
    return out


def _sources_to_payload(sources) -> list[dict]:
    """Map provider sources (ChatSource dataclasses) to dict payload."""
    out: list[dict] = []
    for s in sources:
        topic = getattr(s, "topic", None)
        detail = getattr(s, "detail", None)
        if topic and detail:
            out.append({"topic": str(topic), "detail": str(detail)})
    return out


def _iso(value: Any) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return str(value)


def _derive_title(content: str) -> str:
    """First 80 chars of the user message, single-line, trimmed."""
    flat = " ".join((content or "").split())
    if not flat:
        return "New conversation"
    return flat[:_TITLE_CAP]


def _derive_summary(
    *,
    session_summary: str,
    context: AssistantContext,
    latest_user: str,
    latest_assistant: str,
) -> str:
    """Compose the conversation summary.

    The summary is a single line that names the score band +
    the DNA archetype + a short hint of the latest exchange.
    It is rebuilt on every append so the sidebar always
    shows the freshest state.
    """
    bits: list[str] = []
    bits.append(
        f"Score {context.overall_business_score}/100 ({context.band})"
    )
    if context.dna.archetype_title:
        bits.append(
            f"DNA: {context.dna.archetype_title} ({context.dna.match_score}%)"
        )
    rec = (latest_user or "").strip()
    if rec:
        flat_user = " ".join(rec.split())[:80]
        bits.append(f"Latest: {flat_user}")
    summary = " · ".join(bits)
    if len(summary) > _SUMMARY_CAP:
        summary = summary[: _SUMMARY_CAP - 1] + "…"
    return summary


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _citations_to_sources(knowledge_ctx) -> list[dict]:
    """Translate :class:`Citation` rows into the
    ``ChatSource`` payload the chat schema stores.

    The schema is the same shape the existing providers
    use:

      {
        "topic": <SourceCategory-as-string>,
        "detail": <Citation.detail>,
      }

    Citation ``article_id`` is preserved in the detail
    string so the UI can deep-link to the knowledge
    article once such a route exists.
    """
    if knowledge_ctx is None:
        return []
    out: list[dict] = []
    for c in getattr(knowledge_ctx, "citations", ()) or ():
        topic = getattr(c, "source_category", None) or "Knowledge"
        detail = getattr(c, "detail", None) or ""
        if detail:
            out.append({
                "topic": str(topic),
                "detail": f"{detail} (article {c.article_id})",
            })
    return out