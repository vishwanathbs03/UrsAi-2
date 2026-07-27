"""Chat service package — Sprint 7 Part 3.

The package exposes :class:`ConversationService`, the façade
the chat endpoint depends on. See the module docstring on
``conversation_service.py`` for the full architecture.
"""
from app.services.chat.conversation_service import (
    AppendResult,
    ConversationService,
)

__all__ = ["AppendResult", "ConversationService"]