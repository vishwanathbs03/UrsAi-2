# Atlas AI — Start Here

Welcome to the Atlas AI project.

This file is the quickest way to understand the project before making any code changes.

---

# Project

Atlas AI

AI-powered Business Intelligence Platform for MSMEs.

Goal:

Help businesses understand their current maturity, identify weaknesses, generate recommendations, simulate future improvements, build execution roadmaps, and continuously improve business performance.

---

# Current Status

Current Sprint:
Sprint 6

Current Milestone:
Sprint 6 Part 1

Project Stage:
Advanced Development

Overall Progress:
Approximately 80% complete

---

# Tech Stack

Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic v2

Architecture

Frontend
↓

REST API

↓

Business Services

↓

Rule Engine

↓

Scoring Engine

↓

DNA Engine

↓

Knowledge Engine

↓

Recommendation Engine

↓

Roadmap Engine

↓

Scenario Simulator

↓

Digital Twin

Database

---

# Before Writing Code

Read:

1. PROJECT_STATE.md

2. AGENT_HANDOFF.md

3. DEVELOPMENT_ROADMAP.md

Do NOT read every documentation file unless necessary.

---

# Development Rules

• Never recreate existing architecture.

• Never rewrite working modules.

• Build on top of existing services.

• Keep deterministic behaviour.

• No duplicated business logic.

• Prefer composition over modification.

• Keep modules small.

• Keep schemas strict.

• Preserve API compatibility.

---

# Verification

Every completed milestone must include

- implementation
- verification
- no regressions
- deterministic behaviour

---

# Current Goal

Continue from the milestone listed inside PROJECT_STATE.md.

Do not jump ahead.

Implement only one milestone at a time.

Stop after completing the requested milestone.