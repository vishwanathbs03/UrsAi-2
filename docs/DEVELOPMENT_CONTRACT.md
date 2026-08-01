# Atlas AI
## Development Contract

This document defines the mandatory engineering rules for every future milestone.

These rules are project-wide.

Violation of these rules is considered a regression.

---

# Core Philosophy

Atlas AI is built incrementally.

Every milestone MUST build on the previous milestone.

Nothing already working may be rewritten.

The project follows:

Build → Verify → Continue

Never

Build → Rewrite → Build Again

---

# Architecture Rules

Maintain the existing architecture.

Never introduce a second implementation of an existing engine.

Always extend.

Never duplicate.

Current architecture:

API
↓

Service Layer

↓

Business Logic

↓

Database

↓

Schemas

↓

Frontend

No shortcuts.

No business logic inside routes.

No SQL inside endpoints.

No business logic inside React pages.

---

# Existing Services

These services are already complete.

Business Service

Knowledge Engine

Intelligence Engine

Business Score Engine

Business DNA Engine

Rule Engine

AI Decision Engine

Recommendation Engine

Roadmap Engine

Scenario Simulator

Digital Twin Engine

OCR Engine

OCR Apply Engine

Future work MUST reuse these services.

Never recreate them.

---

# Existing Endpoints

These endpoints already exist.

Authentication

Business Profile

Knowledge

Business Intelligence

Business Scores

Business DNA

Rule Engine

AI Decision

Recommendations

Roadmap

Scenario Simulator

Digital Twin

OCR

OCR Apply

Never create duplicate endpoints.

---

# API Rules

Every response must use Pydantic v2 schemas.

Every schema

extra="forbid"

Use proper response models.

Never return raw ORM models.

Never expose internal database IDs unless already part of the API.

---

# Database Rules

Never modify previous tables unless required.

Prefer additive migrations.

Never delete columns.

Never rename tables.

Never change existing relationships.

Database compatibility must remain.

---

# Determinism

Every analytical engine must be deterministic.

Same database

+

Same request

↓

Same response

Except timestamps.

No randomness.

No UUID generation inside analytical engines.

No hidden state.

---

# Build-on-Top Rule

Every new engine must consume previous engines.

Example

Scenario

↓

Recommendations

↓

Rules

↓

Scores

↓

DNA

↓

Business

Never recompute logic that already exists.

Reuse.

---

# Dependency Direction

Allowed

Business

↓

Intelligence

↓

Scores

↓

DNA

↓

Rules

↓

Recommendations

↓

Roadmap

↓

Scenario

↓

Twin

Forbidden

Roadmap calling Twin

Rules calling Scenario

Scores calling Recommendations

Lower layers depending on higher layers.

---

# Validation

Validate at the API boundary.

Validate again before database writes.

Never trust client input.

---

# Error Handling

Always return proper HTTP codes.

400

401

403

404

409

422

500

Use FastAPI HTTPException.

Never return plain strings.

---

# Frontend Rules

Frontend consumes APIs.

Frontend does NOT calculate business logic.

Frontend does NOT duplicate backend algorithms.

Frontend only displays data.

---

# UI Rules

Use

Next.js

React

TypeScript

Tailwind

shadcn/ui

Recharts

TanStack Query

No additional UI frameworks.

---

# React Rules

Prefer functional components.

Prefer hooks.

Prefer composition.

No large monolithic components.

Reusable components first.

---

# Backend Rules

FastAPI

SQLAlchemy

Pydantic v2

Layered services

No global mutable state.

---

# AI Rules

Real LLM providers must remain optional.

Provider interface only.

No business logic inside prompts.

Prompts only summarize engine outputs.

Engine outputs remain deterministic.

---

# OCR Rules

OCR extracts.

OCR Apply writes.

Never mix them.

OCR extraction remains read-only.

---

# Scenario Rules

Never write to production database.

Always use isolated in-memory simulation.

Destroy simulation after request.

---

# Twin Rules

Twin is computed.

Twin is never persisted.

Twin is always rebuilt.

---

# Code Quality

Prefer small files.

Prefer pure helper functions.

Prefer dataclasses inside services.

Prefer Pydantic only for APIs.

Avoid circular imports.

---

# Documentation

Every milestone updates

README

Folder structure

API documentation

---

# Verification

Every milestone must be verified.

Verification is mandatory.

Ad-hoc verification is acceptable.

Test suite is preferred when available.

Every verification must include

401

404

200

schema

determinism

regression

No verification

↓

Milestone is incomplete.

---

# What Must Never Change

Authentication

Business Profile

Knowledge Engine

Intelligence Engine

Score Engine

DNA Engine

Rule Engine

Recommendation Engine

Roadmap Engine

Scenario Engine

Twin Engine

OCR Engine

OCR Apply Engine

unless the milestone explicitly requires it.

---

# Golden Rule

Extend.

Never replace.

Reuse.

Never duplicate.

Keep Atlas AI deterministic, modular, auditable, and build-on-top.