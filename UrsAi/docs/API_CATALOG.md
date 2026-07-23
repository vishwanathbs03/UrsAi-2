# Atlas AI — API Catalog

> This document is the authoritative reference for every public API exposed by Atlas AI.
>
> Every AI coding agent should consult this document before creating new endpoints.
>
> Goals:
>
> - Prevent duplicate endpoints
> - Prevent inconsistent response structures
> - Encourage API reuse
> - Preserve backward compatibility

---

# API Design Standards

All APIs follow these principles.

- REST API
- JSON Request/Response
- Cookie Authentication
- Pydantic v2 Schemas
- `extra="forbid"`
- Deterministic responses
- FastAPI routing
- Modular services

Base Prefix

/api/v1

---

# Authentication APIs

Base

/api/v1/auth

Endpoints

POST /register

Purpose

Register new user

Authentication

No

Service

Authentication Service

Returns

User information

---

POST /login

Purpose

Authenticate user

Authentication

No

Returns

Session Cookie

---

POST /logout

Purpose

Destroy session

Authentication

Yes

---

GET /me

Purpose

Current authenticated user

Authentication

Yes

---

# Business Profile APIs

Base

/api/v1/business

Endpoints

POST /

Create Business Profile

GET /

Fetch Business Profile

PUT /

Update Business Profile

DELETE /

Delete Business Profile

Authentication

Required

Primary Service

Business Service

Database

Business Tables

---

# Intelligence Engine

Endpoint

GET /business/intelligence

Purpose

Analyze business profile

Consumes

Business Profile

Produces

Business Intelligence

Used By

- Dashboard
- AI Decision
- Recommendation Engine
- Digital Twin

Deterministic

Yes

---

# Business Score Engine

Endpoint

GET /business/scores

Purpose

Calculate business readiness scores

Produces

Overall Score

Digital Score

Compliance Score

Growth Score

Export Score

Innovation Score

Sustainability Score

Capacity Score

Used By

- Dashboard
- DNA
- Recommendation
- Scenario
- Digital Twin

Deterministic

Yes

---

# Business DNA

Endpoint

GET /business/dna

Purpose

Identify business archetype

Produces

Archetype

Traits

SWOT

Confidence

Match Score

Consumes

Business Scores

Business Intelligence

Used By

- Dashboard
- AI Decision
- Digital Twin

---

# Rule Engine

Endpoint

GET /business/rules

Purpose

Evaluate business rules

Produces

Rule Firings

Priority

Evidence

Recommendations Source

Used By

- Recommendation Engine
- Dashboard
- Action Board
- Digital Twin

---

# Knowledge Engine

Endpoint

GET /business/knowledge

Purpose

Match business issues to knowledge articles

Produces

Knowledge Articles

Categories

References

Used By

- AI Decision
- Recommendation
- Action Board

---

# AI Decision Engine

Endpoint

GET /business/decision

Purpose

Generate explainable business decision summary

Consumes

- Intelligence
- Scores
- DNA
- Rules
- Knowledge

Produces

Summary

Insights

Strengths

Risks

References

Deterministic

Current Provider

Mock Provider

Future

OpenAI

Claude

Gemini

Ollama

---

# Recommendation Engine

Endpoint

GET /business/recommendations

Purpose

Generate business recommendations

Consumes

Rules

Scores

DNA

Knowledge

Produces

Prioritized recommendations

ROI

Timeline

Dependencies

Projected DNA Effects

Used By

Action Board

Roadmap

Digital Twin

Scenario

---

# Roadmap Engine

Endpoint

GET /business/roadmap

Purpose

Convert recommendations into execution roadmap

Produces

Roadmap Items

Execution Order

Dependencies

Timeline

Projected Improvements

Used By

Dashboard

Digital Twin

Scenario

---

# Scenario Simulator

Endpoint

POST /business/scenario

Purpose

Run hypothetical business simulations

Consumes

Business Profile

Mutation List

Produces

Current Snapshot

Projected Snapshot

Delta

Recommendation Impact

Roadmap Impact

Database Writes

Never

---

# Digital Twin

Endpoint

GET /business/twin

Purpose

Aggregate entire business state

Consumes

Every analytical engine

Produces

Complete Business Twin

Identity

Scores

DNA

Roadmap

Recommendations

Timeline

Risk Matrix

Opportunity Matrix

Health Summary

Used By

Future Analytics

Executive Reports

---

# OCR Engine

Endpoint

POST /business/ocr

Purpose

Extract structured information from uploaded documents

Consumes

PDF

PNG

JPEG

Produces

Detected Fields

Confidence

Validation

Preview

Database Writes

Never

---

# OCR Apply

Endpoint

POST /business/ocr/apply

Purpose

Apply approved OCR fields

Consumes

OCR Extraction

Approved Fields

Produces

Applied Changes

Rejected Fields

Summary

Database Writes

Yes

Protected

Never overwrite valid data

---

# Frontend Route Mapping

Dashboard

↓

GET /business/intelligence

GET /business/scores

GET /business/dna

GET /business/decision

---

Action Board

↓

GET /business/rules

GET /business/decision

GET /business/recommendations

---

Roadmap

↓

GET /business/roadmap

---

Scenario Simulator

↓

POST /business/scenario

---

Digital Twin

↓

GET /business/twin

---

OCR Upload

↓

POST /business/ocr

---

OCR Apply

↓

POST /business/ocr/apply

---

# Engine Dependency Graph

Business Profile

↓

Intelligence

↓

Scores

↓

DNA

↓

Rules

↓

Knowledge

↓

AI Decision

↓

Recommendations

↓

Roadmap

↓

Scenario

↓

Digital Twin

OCR is independent.

OCR Apply writes only to Business Profile.

---

# API Response Standards

Every response should:

Return JSON

Use Pydantic Schemas

Reject unknown fields

Be deterministic

Avoid duplicated information

Preserve backward compatibility

---

# Future APIs (Not Yet Implemented)

Sprint 6

Analytics

Reports

Historical Trends

Benchmarks

Audit Timeline

---

Sprint 7

Notifications

Comments

Tasks

Team Members

Sharing

---

Sprint 8

Monitoring

Metrics

Health Checks

Administration

Deployment APIs

---

# Deprecated APIs

None

---

# Breaking Change Policy

Never:

Rename endpoints

Remove fields

Rename response keys

Remove schemas

Change authentication behavior

Without explicit approval.

Always extend existing APIs instead.

---

Last Updated

Sprint 5 Complete