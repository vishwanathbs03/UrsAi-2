"""Chat endpoint — Sprint 7 Part 3 (Conversation Memory).

Five routes:

    POST   /api/v1/chat                  Create a new conversation.
    GET    /api/v1/chat                  List the user's conversations.
    GET    /api/v1/chat/{id}             Fetch a conversation + messages.
    DELETE /api/v1/chat/{id}             Delete a conversation.
    POST   /api/v1/chat/{id}/message     Append a user message; get a reply.

All routes are auth-gated. The owner id is the JWT subject —
the request body never carries it. Cross-owner access returns
404, not 403, so a resource's existence is not leaked.

Architecture
------------

The endpoint is a thin HTTP translator. Every business rule
lives in :class:`app.services.chat.ConversationService`,
which in turn delegates to:

  * :class:`app.repositories.chat_session_repository.ChatSessionRepository`
        — SQL for chat_sessions + chat_messages
  * :class:`app.services.ai.providers.service.AssistantProviderService`
        — Sprint 7 Part 2: provider layer (Ollama today,
          deterministic fallback by default)
  * :class:`app.services.ai.providers.context_builder.AssistantContextBuilder`
        — Sprint 7 Part 2: context builder that reads the
          five upstream payloads

The endpoint never imports the provider layer directly; the
service owns that composition.

Out of scope
------------

The endpoint does NOT:
  * call a real LLM (the provider layer handles that with the
    graceful fallback the brief mandates)
  * persist vector embeddings or do semantic search
  * support multi-user collaboration
  * fine-tune a model
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.repositories.chat_session_repository import (
    ChatSessionNotFound,
    ChatSessionRepository,
)
from app.schemas.chat import (
    ChatDeleteResponse,
    ChatMessageAppendResponse,
    ChatMessageCreateRequest,
    ChatSessionCreateRequest,
    ChatSessionDetail,
    ChatSessionListResponse,
    ChatSessionSummary,
)
from app.services.ai import AIDecisionService
from app.services.ai.providers.context_builder import AssistantContextBuilder
from app.services.ai.providers.factory import ProviderFactory
from app.services.ai.providers.service import AssistantProviderService
from app.services.chat import ConversationService
from app.services.intelligence import IntelligenceService
from app.services.knowledge import JsonKnowledgeRepository
from app.services.knowledge_retrieval import KnowledgeRetrievalService
from app.services.recommendations import RecommendationService
from app.services.roadmap import RoadmapService
from app.services.rules import RuleEngineService
from app.services.twin import TwinService
from app.utils.database import get_db
from app.config.settings import get_settings


router = APIRouter(prefix="/chat", tags=["assistant-chat"])


# --------------------------------------------------------------------------- #
# Dependency wiring
# --------------------------------------------------------------------------- #


# Process-level singleton: the JSON catalog is static and
# read-only. Mirrors the pattern the existing knowledge
# endpoint uses.
_KNOWLEDGE_REPO_SINGLETON: JsonKnowledgeRepository | None = None


def _get_knowledge_repository() -> JsonKnowledgeRepository:
    global _KNOWLEDGE_REPO_SINGLETON
    if _KNOWLEDGE_REPO_SINGLETON is None:
        _KNOWLEDGE_REPO_SINGLETON = JsonKnowledgeRepository()
    return _KNOWLEDGE_REPO_SINGLETON


def _service(db: Annotated[Session, Depends(get_db)]) -> ConversationService:
    """Build a ConversationService bound to the request's session."""
    repo = BusinessRepository(db)
    # Five upstream callables. Each one instantiates its
    # service against the same BusinessRepository so every
    # read sees the same database state.
    decision_svc = AIDecisionService(repo)

    def twin_provider(owner_id: int):
        return TwinService(repo).compute(owner_id)

    def recommendations_provider(owner_id: int):
        return RecommendationService(repo).compute(owner_id)

    def roadmap_provider(owner_id: int):
        return RoadmapService(repo).compute(owner_id)

    def rules_provider(owner_id: int):
        return RuleEngineService(repo).compute(owner_id)

    def insights_provider(owner_id: int):
        try:
            return decision_svc.compute(owner_id)
        except BusinessNotFound:
            # AI Decision can legitimately have no output yet
            # for a brand-new business. Return an empty
            # decision so the assistant context builder does
            # not crash.
            return {"generated_at": None, "decision": {"insights": []}}

    context_builder = AssistantContextBuilder(
        twin_provider=twin_provider,
        recommendations_provider=recommendations_provider,
        roadmap_provider=roadmap_provider,
        rules_provider=rules_provider,
        insights_provider=insights_provider,
    )

    settings = get_settings()
    factory = ProviderFactory(settings)
    assistant_service = AssistantProviderService(
        context_builder=context_builder,
        provider_factory=factory,
    )

    knowledge_retriever = KnowledgeRetrievalService.from_repository(
        _get_knowledge_repository(),
        top_k=settings.knowledge_retrieval_top_k
        if hasattr(settings, "knowledge_retrieval_top_k")
        else 3,
    )
    return ConversationService(
        ChatSessionRepository(db),
        assistant_service=assistant_service,
        knowledge_retriever=knowledge_retriever,
    )


def _chat_repo(db: Annotated[Session, Depends(get_db)]) -> ChatSessionRepository:
    return ChatSessionRepository(db)


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #


@router.get(
    "",
    response_model=ChatSessionListResponse,
    summary="List the user's assistant conversations.",
)
def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ConversationService, Depends(_service)],
) -> ChatSessionListResponse:
    sessions = service.list_sessions(owner_id=current_user.id)
    return ChatSessionListResponse(
        sessions=[ChatSessionSummary.model_validate(s) for s in sessions],
        count=len(sessions),
    )


@router.post(
    "",
    response_model=ChatSessionDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new assistant conversation.",
)
def create_conversation(
    payload: ChatSessionCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ConversationService, Depends(_service)],
) -> ChatSessionDetail:
    detail = service.create_session(
        owner_id=current_user.id,
        title=payload.title,
    )
    return ChatSessionDetail.model_validate(detail)


@router.get(
    "/{session_id}",
    response_model=ChatSessionDetail,
    summary="Fetch an assistant conversation + every message.",
)
def get_conversation(
    session_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ConversationService, Depends(_service)],
) -> ChatSessionDetail:
    try:
        detail = service.get_session(
            owner_id=current_user.id, session_id=session_id
        )
    except ChatSessionNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return ChatSessionDetail.model_validate(detail)


@router.delete(
    "/{session_id}",
    response_model=ChatDeleteResponse,
    summary="Delete an assistant conversation.",
)
def delete_conversation(
    session_id: Annotated[int, Path(ge=1)],
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ConversationService, Depends(_service)],
) -> ChatDeleteResponse:
    try:
        service.delete_session(
            owner_id=current_user.id, session_id=session_id
        )
    except ChatSessionNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return ChatDeleteResponse(deleted=True, id=session_id)


@router.post(
    "/{session_id}/message",
    response_model=ChatMessageAppendResponse,
    summary="Append a user message; return the assistant's reply.",
)
def append_message(
    session_id: Annotated[int, Path(ge=1)],
    payload: ChatMessageCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ConversationService, Depends(_service)],
) -> ChatMessageAppendResponse:
    try:
        result = service.append_message(
            owner_id=current_user.id,
            session_id=session_id,
            content=payload.content,
        )
    except ChatSessionNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except BusinessNotFound as exc:
        # The user has no business row yet — same contract
        # as the existing AI endpoints. 404, not 500.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return ChatMessageAppendResponse.model_validate({
        "user_message": result.user_message,
        "assistant_message": result.assistant_message,
        "session": result.session,
    })