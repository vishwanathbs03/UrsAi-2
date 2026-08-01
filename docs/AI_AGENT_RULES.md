# Atlas AI — AI Agent Rules

> This document defines the mandatory rules every AI coding agent must follow.
>
> Whether the agent is Cursor, Claude Code, Codex, Gemini CLI, Ollama, or any future coding assistant, these rules are non-negotiable.
>
> Read this file before making any code changes.

---

# Primary Goal

Your objective is to extend Atlas AI incrementally while preserving the existing architecture, APIs, coding style, and deterministic behavior.

This repository is **not** a greenfield project.

Assume that all existing code is production-quality unless explicitly told otherwise.

---

# General Rules

Always:

- Read existing code before writing new code.
- Reuse existing services whenever possible.
- Extend modules instead of replacing them.
- Preserve API compatibility.
- Keep changes as small as possible.
- Follow the existing folder structure.
- Follow the existing coding style.

Never:

- Rewrite working code.
- Refactor unrelated modules.
- Rename files or folders unnecessarily.
- Introduce breaking API changes.
- Replace existing implementations because you prefer another approach.

---

# Repository Understanding

Before implementing any feature:

1. Read PROJECT_STATE.md
2. Read ARCHITECTURE.md
3. Read this document.
4. Inspect the relevant modules.

Do not assume anything until the existing implementation has been inspected.

---

# Build-on-Top Principle

Atlas AI follows a layered architecture.

New modules must consume existing services.

Do not duplicate logic.

Example:

Correct

Recommendation Service

↓

Rule Engine

↓

Business Score Engine

Incorrect

Recommendation Service

↓

Database

↓

Duplicate score calculation

Always reuse upstream outputs.

---

# Code Modification Rules

Modify only the files required for the requested milestone.

Do not make unrelated improvements.

Do not perform "cleanup" unless explicitly requested.

Avoid formatting-only commits.

Avoid unnecessary renaming.

Avoid moving files.

---

# Refactoring Policy

Refactoring is prohibited unless the user explicitly requests it.

Examples of prohibited changes:

- Renaming modules
- Changing folder structure
- Splitting files for style only
- Replacing patterns because they are "better"
- Rewriting working logic

Bug fixes are allowed.

Feature additions are allowed.

Architecture rewrites are not.

---

# Database Rules

Do not:

- Modify existing models
- Rename database columns
- Delete tables
- Change relationships

Unless the milestone explicitly requires schema changes.

Avoid migrations whenever possible.

---

# API Rules

Never remove existing endpoints.

Never rename endpoints.

Never change response structures.

Never remove existing fields.

Only add new endpoints or optional fields when required.

Maintain backward compatibility.

---

# Service Rules

Each service should have one responsibility.

Business logic belongs inside services.

Avoid putting business logic into:

- API routes
- React components
- Utility files

Services may consume other services but should not duplicate them.

---

# Frontend Rules

Business logic belongs in hooks or feature services.

Presentation components should remain reusable.

Prefer composition over duplication.

Reuse UI components whenever possible.

Do not redesign the UI unless requested.

---

# Dependency Rules

Do not introduce new dependencies unless absolutely necessary.

Before adding a library:

- Check whether the functionality already exists.
- Check whether the existing stack already provides it.

Smaller dependency trees are preferred.

---

# Determinism Rules

Unless explicitly requested:

No randomness.

No hidden timestamps inside calculations.

No UUID generation for deterministic engines.

No unstable ordering.

The same input should always produce the same output.

---

# Performance Rules

Avoid duplicate database queries.

Avoid recalculating existing values.

Reuse service outputs.

Prefer linear algorithms.

Avoid unnecessary loops over the same data.

---

# Security Rules

Never trust client input.

Validate every request.

Validate uploaded files.

Check ownership before accessing business resources.

Never expose internal information.

Never hardcode secrets.

Never commit credentials.

---

# Error Handling

Fail explicitly.

Do not silently ignore exceptions.

Return meaningful validation errors.

Prefer structured errors over generic messages.

---

# Testing & Verification

For every milestone:

Verify only what changed.

Do not rerun unrelated verification.

Do not modify existing verified modules.

Keep verification focused and deterministic.

---

# Output Rules

After implementation, provide only:

## Files Created

- ...

## Files Modified

- ...

## Verification

- PASS/FAIL summary

## Notes

- Important implementation decisions

Avoid lengthy explanations.

Avoid repeating architecture descriptions.

Avoid restating unchanged information.

---

# Communication Style

Be concise.

Avoid repeating previous milestone summaries.

Avoid generating unnecessary documentation.

Focus on the requested milestone only.

---

# When Unsure

If an existing implementation already solves the problem:

Reuse it.

If two approaches are possible:

Choose the one that requires the fewest code changes.

Prefer consistency over novelty.

---

# Forbidden Actions

Do NOT:

- Rewrite the architecture
- Rename services
- Rename APIs
- Change folder structures
- Replace deterministic logic with AI
- Duplicate business logic
- Introduce breaking changes
- Modify unrelated modules
- Perform speculative optimizations
- Add TODO placeholders instead of implementations
- Leave partially completed milestones

---

# Definition of Success

A milestone is successful when:

- Only the requested functionality is implemented.
- Existing behavior remains unchanged.
- The architecture is preserved.
- Code is modular.
- Deterministic behavior is maintained.
- Verification passes.
- No unrelated files are modified.

---

# Final Principle

When making implementation decisions, always choose the option that:

1. Reuses the most existing code.
2. Introduces the fewest changes.
3. Preserves compatibility.
4. Keeps the architecture consistent.
5. Minimizes future maintenance.