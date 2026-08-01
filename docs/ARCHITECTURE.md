# Atlas AI — System Architecture

> This document describes the architecture of Atlas AI.
>
> Every AI coding agent MUST read this document before implementing new features.
>
> The architecture defined here is considered the source of truth.
> New functionality must extend this architecture instead of replacing it.

---

# System Overview

Atlas AI is a modular Business Intelligence platform that analyzes MSME businesses using deterministic analytical engines.

The platform is intentionally layered.

Lower-level engines generate facts.

Higher-level engines consume those facts.

No engine should duplicate another engine's calculations.

Every engine should have exactly one responsibility.

---

# High-Level Architecture

                +---------------------+
                |     Frontend        |
                | Next.js + React     |
                +----------+----------+
                           |
                    REST API Calls
                           |
                +----------v----------+
                |      FastAPI        |
                |   API Endpoints     |
                +----------+----------+
                           |
                +----------v----------+
                | Service Layer       |
                +----------+----------+
                           |
         +-----------------+-----------------+
         |                 |                 |
 Intelligence        Rule Engine      Score Engine
         |                 |                 |
         +--------+--------+-----------------+
                  |
            Business DNA Engine
                  |
        +---------+----------+
        |                    |
 Recommendation         AI Decision
        |                    |
        +---------+----------+
                  |
           Roadmap Engine
                  |
        +---------+----------+
        |                    |
 Scenario Simulator    Digital Twin
                  |
            OCR + Apply Engine

---

# Backend Folder Structure

backend/

app/

api/

core/

db/

models/

schemas/

services/

utils/

Every feature follows the same structure.

Example

services/

intelligence/

rules/

scoring/

dna/

recommendations/

roadmap/

scenario/

twin/

ocr/

ocr_apply/

Each service is independent.

---

# Frontend Folder Structure

frontend/

app/

components/

features/

hooks/

lib/

types/

Every feature owns its own UI.

Business logic should stay inside feature hooks.

Presentation components should remain stateless whenever possible.

---

# Service Layer Philosophy

Every analytical capability lives inside a dedicated service.

Example

Business Intelligence Service

↓

Business Score Service

↓

Business DNA Service

↓

Recommendation Service

↓

Roadmap Service

Higher-level services consume lower-level services.

Never duplicate upstream logic.

---

# Dependency Graph

Business Profile

↓

Business Intelligence

↓

Business Scores

↓

Business DNA

↓

Rule Engine

↓

Knowledge Matching

↓

AI Decision

↓

Recommendations

↓

Roadmap

↓

Scenario Simulator

↓

Digital Twin

↓

OCR Apply

This dependency order should never be reversed.

---

# Data Flow

Business Profile

↓

Validation

↓

Database

↓

Intelligence Engine

↓

Score Engine

↓

DNA Engine

↓

Rule Engine

↓

Knowledge Engine

↓

AI Decision

↓

Recommendations

↓

Roadmap

↓

Frontend

Every downstream engine depends on structured upstream output.

---

# API Design Principles

All APIs are REST.

Authentication is required.

Responses are deterministic.

Every endpoint exposes explicit response schemas.

Unknown fields are forbidden.

Every endpoint returns JSON.

No endpoint should expose internal dataclasses.

---

# Schema Philosophy

Internal processing

↓

Python Dataclasses

↓

Service Output

↓

Pydantic Models

↓

FastAPI Response

Internal models should never leak directly into API responses.

---

# Database Philosophy

The database stores facts.

The engines compute intelligence.

Examples

Store

Business Name

GST

Employees

Website

Products

Do NOT Store

Business Score

DNA

Recommendations

Roadmap

Scenario Results

Digital Twin

Those are computed every request.

---

# Deterministic Engines

The following engines must always produce identical output given identical input.

Business Intelligence

Business Score

Business DNA

Rule Engine

Recommendation Engine

Roadmap Engine

Scenario Simulator

Digital Twin

OCR Mapping

OCR Apply

Randomness is prohibited.

External API dependence is prohibited unless explicitly introduced.

---

# Build-on-Top Principle

Every new engine should consume existing services.

Correct

Recommendation

↓

Rule Engine

↓

Business Scores

Incorrect

Recommendation

↓

Direct database calculations

↓

Duplicate score logic

Never duplicate calculations already available elsewhere.

---

# Frontend Architecture

Pages

↓

Feature Hooks

↓

API Client

↓

REST API

↓

Backend

Components should never directly contain business logic.

Business logic belongs inside hooks or feature services.

---

# State Management

Primary

TanStack Query

Local UI State

React State

Persistent Browser State

Local Storage

No global state library unless absolutely necessary.

---

# Error Handling

Backend

Raise HTTPException with appropriate status.

Frontend

Display user-friendly error components.

Never silently swallow errors.

---

# Validation Strategy

Input

↓

Pydantic Validation

↓

Service Validation

↓

Business Rules

↓

Database

Never trust frontend validation alone.

---

# Security Principles

Authentication required for private endpoints.

Ownership checks on business resources.

No hidden admin endpoints.

No client-controlled identifiers.

Validate all uploaded files.

Never trust OCR output without user approval.

---

# Performance Philosophy

Reuse existing services.

Avoid repeated database queries.

Avoid duplicate computations.

Cache frontend requests where appropriate.

Keep backend services stateless.

---

# Coding Standards

Keep modules focused.

Prefer composition over inheritance.

Avoid circular dependencies.

Prefer pure helper functions.

Keep APIs backward compatible.

Avoid magic numbers.

Document heuristics.

---

# Future Expansion

The architecture is intentionally extensible.

Future engines should plug into the existing service layer.

Examples

Analytics Engine

Reporting Engine

Notification Engine

Collaboration Engine

Monitoring Engine

Audit Engine

These should consume existing services instead of introducing parallel systems.

---

# Architectural Rules (Do Not Break)

Never duplicate an engine.

Never bypass an existing service.

Never rewrite stable modules without request.

Never rename public APIs.

Never change database schema without approval.

Never introduce breaking API changes.

Always build incrementally.

Always preserve determinism.

Always reuse existing services.

---

Last Updated

Sprint 5 Complete