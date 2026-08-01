# Atlas AI — Project State

> This document is the authoritative project status for any AI coding agent joining the repository.
>
> Read this file completely before making any code changes.
> Do not make assumptions based on filenames alone.
> The repository is built incrementally and every completed module should be treated as production code unless explicitly marked otherwise.

---

# Project Overview

Atlas AI is an AI-powered Business Intelligence Platform for MSMEs (Micro, Small and Medium Enterprises).

The platform analyzes business data, evaluates operational maturity, generates intelligence, recommends improvements, simulates business changes, builds execution roadmaps, and creates a digital twin of the business.

The system is intentionally modular.

Every analytical capability is implemented as an independent engine.

Higher-level engines build on lower-level engines instead of duplicating logic.

---

# Technology Stack

## Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic v2
- Alembic
- PostgreSQL (primary database)

---

## Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query

---

# Architectural Philosophy

The project follows these principles.

- Build on top of existing services.
- Never duplicate business logic.
- Never recalculate values already produced by another engine.
- Every service has one responsibility.
- Services communicate through structured models.
- API schemas are strict (`extra="forbid"`).
- All deterministic engines must produce identical output for identical input.
- No hidden side effects.

---

# Current Completion Status

## Sprint 1

Status: ✅ Complete

Implemented:

- Authentication
- User management
- Business profile creation
- Core database models
- API foundation

---

## Sprint 2

Status: ✅ Complete

Implemented:

- Business Intelligence Engine
- Rule Engine
- Business Score Engine
- Business DNA Engine
- Knowledge Engine

---

## Sprint 3

Status: ✅ Complete

Implemented:

- AI Decision Engine
- Recommendation Intelligence Engine
- Business Roadmap Engine

---

## Sprint 4

Status: ✅ Complete

Implemented:

Frontend Dashboard

- Business Dashboard
- Health Cards
- Radar Placeholder
- Action Board
- UX Polish
- Query Caching
- Drag-and-Drop
- Business Journey Preview

---

## Sprint 5

Status: ✅ Complete

Implemented

Backend

- Scenario Simulator
- Digital Twin Engine
- OCR Extraction Engine
- OCR Review & Apply Engine

---

# Existing Major Engines

The following engines already exist.

Business Service

Business Intelligence Engine

Business Score Engine

Business DNA Engine

Rule Engine

Knowledge Engine

AI Decision Engine

Recommendation Engine

Roadmap Engine

Scenario Simulator

Digital Twin Engine

OCR Engine

OCR Apply Engine

---

# Completed API Endpoints

Authentication

Business Profile

Business Intelligence

Business Scores

Business DNA

Rule Engine

Knowledge

AI Decision

Recommendations

Roadmap

Scenario Simulator

Digital Twin

OCR

OCR Apply

---

# Database Status

Existing database schema is considered stable.

No pending redesign.

Avoid schema changes unless explicitly requested.

Avoid migrations unless required for a new feature.

---

# Frontend Status

Completed

Dashboard

Action Board

Dashboard Polish

Responsive Layout

TanStack Query Integration

Business Journey Preview

---

# Remaining Roadmap

Sprint 6

Analytics
Reporting
Monitoring
Insights

Sprint 7

Collaboration
Notifications
Sharing
Team Features

Sprint 8

Production Readiness

Performance

Security

Deployment

Observability

Testing

---

# Current Development Rules

Unless explicitly instructed:

Do NOT

- rewrite architecture
- rename folders
- rename APIs
- rename services
- refactor unrelated modules
- replace working implementations

Always

- extend existing modules
- reuse existing services
- preserve API compatibility
- keep deterministic behaviour
- keep modules small
- maintain coding style

---

# Before Starting Any New Feature

Every new implementation must first inspect:

existing services

existing schemas

existing endpoints

existing frontend components

existing utilities

If functionality already exists, reuse it.

Do not implement parallel systems.

---

# Definition of Done

A milestone is complete only when:

- feature implemented
- schemas updated
- endpoint registered
- frontend integrated (if applicable)
- deterministic behaviour maintained
- verification completed
- no unrelated files modified

---

Last Updated

Sprint 5 Complete