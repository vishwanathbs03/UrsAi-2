# Atlas AI
# Agent Handoff Guide

This document is the permanent handoff guide for any AI coding agent working on Atlas AI.

It exists so future agents can continue development without rereading months of conversation history.

Read this document before writing any code.

---

# Project Overview

Atlas AI is an AI-powered Business Intelligence & Business Operating System for MSMEs.

The platform analyzes a business profile and produces:

- Business Intelligence
- Business Scores
- Business DNA
- Rule Engine
- AI Decision
- Recommendations
- Roadmap
- Scenario Simulation
- Digital Twin
- OCR Extraction
- OCR Apply
- Dashboard
- Action Board

The project is intentionally modular.

Every engine builds on previous engines.

---

# Architecture

Frontend

Next.js

React

TypeScript

Tailwind

shadcn/ui

TanStack Query

Backend

FastAPI

SQLAlchemy

Pydantic v2

Layered Services

SQLite (development)

---

# Development Philosophy

Atlas AI is built incrementally.

Never redesign.

Never rewrite.

Never replace.

Always extend.

Every milestone consumes previous milestones.

Never duplicate logic.

---

# Current Progress

Sprint 1

Complete

Business Profile

---

Sprint 2

Complete

Knowledge Engine

---

Sprint 3

Complete

Business Intelligence

Business Scores

Business DNA

Rule Engine

AI Decision

Recommendations

Roadmap

---

Sprint 4

Complete

Dashboard

Action Board

UX Polish

---

Sprint 5

Complete

Scenario Simulator

Digital Twin

OCR Engine

OCR Review UI

OCR Apply Engine

---

Current milestone

Sprint 6

Not Started

---

# Existing Engines

These are production-ready.

Business

Knowledge

Intelligence

Scores

DNA

Rules

AI Decision

Recommendations

Roadmap

Scenario

Twin

OCR

OCR Apply

Dashboard

Action Board

Never recreate them.

---

# Existing API Endpoints

Authentication

Business Profile

Knowledge

Intelligence

Scores

DNA

Rules

AI Decision

Recommendations

Roadmap

Scenario

Twin

OCR

OCR Apply

Never create duplicate endpoints.

Always extend existing APIs.

---

# Coding Rules

Always reuse services.

Never duplicate business logic.

No logic inside routes.

No SQL inside API endpoints.

No business calculations inside React.

Frontend consumes APIs.

Backend performs calculations.

---

# Determinism

Every analytical engine must remain deterministic.

Same input

↓

Same output

Except timestamps.

Never use randomness.

Never hide state.

---

# Build-On-Top Rule

Every new feature consumes previous engines.

Example

Task Engine

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

Never bypass layers.

---

# Database Rules

Prefer additive changes.

Never rename tables.

Never remove columns.

Never break migrations.

Never modify historical migrations.

---

# Validation

Validate at API boundary.

Validate again before writes.

Reject invalid input.

Use Pydantic v2.

extra="forbid"

---

# Error Handling

Use HTTPException.

Correct HTTP status codes.

401

404

409

422

500

Never return plain strings.

---

# Frontend Rules

Reusable components.

Small files.

Hooks first.

Composition over inheritance.

No duplicated UI logic.

No duplicated backend calculations.

---

# Backend Rules

Service layer only.

Pure helper modules.

Dataclasses internally.

Pydantic externally.

Small focused modules.

---

# OCR Rules

OCR extracts only.

OCR Apply writes.

Never combine them.

---

# Scenario Rules

Scenario never touches production DB.

Always use isolated in-memory database.

Dispose after request.

---

# Twin Rules

Twin is computed.

Never stored.

Never cached permanently.

---

# LLM Rules

Provider interface already exists.

Mock provider already implemented.

Real providers arrive later.

Business logic never belongs inside prompts.

Prompts summarize existing engine outputs.

---

# Verification Rules

Every milestone must be verified.

Minimum verification

401

404

200

Schema

Determinism

Regression

Database safety

If verification fails

Stop.

Fix.

Verify again.

Only then continue.

---

# README

Update README after milestones.

Keep folder structure current.

Document new endpoints.

---

# Before Coding

Always determine

1.
Which sprint?

2.
Which milestone?

3.
What existing engine should be reused?

4.
What existing API already provides data?

Only then write code.

---

# Before Creating Files

Ask

Can this be added to an existing module?

If yes

Do not create a new one.

---

# Before Adding Dependencies

Ask

Can this be built using the existing stack?

Prefer existing stack.

Avoid unnecessary packages.

---

# Token Efficiency Rules

This project may move between multiple AI coding agents.

To reduce context usage:

Never summarize completed milestones again.

Never explain completed architecture.

Only discuss the current milestone.

Treat previous milestones as immutable.

Assume all completed milestones work unless explicitly told otherwise.

---

# If Context Is Missing

Do not guess.

Ask for

README

Development Contract

Project Summary

Future Roadmap

Only if absolutely required.

---

# Never Do

Never rewrite completed engines.

Never rename APIs.

Never redesign architecture.

Never move folders.

Never introduce parallel implementations.

Never duplicate services.

Never bypass service layers.

Never break determinism.

---

# Preferred Workflow

Read roadmap.

Locate current sprint.

Locate current milestone.

Reuse previous services.

Implement smallest working increment.

Verify.

Stop.

Wait for next milestone.

---

# Definition of Done

A milestone is complete only if:

Implementation complete

Verification complete

Regression-free

Deterministic

Schema validated

Documented

No broken previous milestones

---

# Golden Rule

Atlas AI grows vertically.

It never grows sideways.

Extend.

Reuse.

Verify.

Stop.

Wait for the next milestone.