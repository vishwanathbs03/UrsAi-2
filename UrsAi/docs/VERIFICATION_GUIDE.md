# Atlas AI
## Verification Guide

This document defines the mandatory verification process for every milestone.

A milestone is NOT complete until it passes verification.

Verification must happen before moving to the next milestone.

---

# Philosophy

Implementation proves that code exists.

Verification proves that code works.

Never skip verification.

---

# Verification Levels

Level 1

Compilation

Level 2

API Contract

Level 3

Business Logic

Level 4

Regression

Level 5

Determinism

Level 6

Performance

Every milestone should pass every applicable level.

---

# Backend Verification

Always verify

✓ FastAPI starts

✓ Database migrations

✓ Endpoint registration

✓ Response schema

✓ Validation

✓ Error handling

✓ Determinism

✓ Regression

---

# Frontend Verification

Always verify

✓ npm install

✓ TypeScript

✓ Next build

✓ Responsive layout

✓ API integration

✓ Empty states

✓ Error states

✓ Loading states

✓ No console errors

---

# HTTP Verification

Every endpoint should verify

401

Unauthenticated request

404

Missing resource

422

Validation error

200

Successful request

Never verify only the happy path.

---

# Schema Verification

Every response must verify

Required fields exist

Correct types

No unexpected fields

Nested structures

Lists

Enums

Response models must match Pydantic schemas exactly.

---

# Database Verification

Verify

No unintended writes

No broken migrations

No missing relations

No duplicated records

Correct updates

Correct inserts

Correct deletes

---

# Determinism Verification

Run the same request twice.

Ignore timestamps.

Responses must be byte-identical.

If responses differ,

the engine is not deterministic.

---

# Regression Verification

Every new milestone must prove

Previous endpoints still work.

Previous schemas still match.

Previous services remain untouched.

Previous features remain functional.

Never break completed work.

---

# Performance Verification

Avoid unnecessary database queries.

Avoid duplicated calculations.

Reuse existing services.

Reuse cached frontend data where appropriate.

No unnecessary network requests.

---

# OCR Verification

Verify

Supported formats

Unsupported formats

File size limits

Field extraction

Confidence scores

Validation

Read-only extraction

OCR Apply writes only approved fields

No overwrite of valid existing values

---

# Scenario Verification

Verify

Simulation succeeds

Real database unchanged

Repeated calls deterministic

Projected values reasonable

Recommendations updated

Roadmap updated

---

# Digital Twin Verification

Verify

Every block exists

Scores valid

Timeline valid

Risk matrix valid

Opportunity matrix valid

Health summary valid

No database writes

---

# Dashboard Verification

Verify

Loading state

Error state

Empty state

Successful state

Refresh

Responsive layout

Correct API usage

---

# Action Board Verification

Verify

Drag & Drop

Local storage

Filtering

Sorting

Searching

Slide-over

Summary calculations

Journey preview

---

# Future Sprint Verification

Task Engine

CRUD

Status changes

Dependencies

Completion

Execution Score

Calendar

Collaboration

Documents

Notifications

Integrations

LLM Provider

Each future module must define its own verification checklist.

---

# Verification Output

Every milestone should finish with

Implementation Summary

Files Created

Files Modified

Design Decisions

Verification Summary

Known Limitations

Sample Output

This format keeps milestone history consistent.

---

# Preferred Verification Order

1.
Run backend.

2.
Run frontend.

3.
Run build.

4.
Run TypeScript.

5.
Run endpoint verification.

6.
Run regression.

7.
Run determinism.

8.
Review output.

Only after all pass

↓

Milestone Complete.

---

# If Verification Fails

Do not continue.

Fix the issue.

Run verification again.

Repeat until all checks pass.

---

# Definition of Done

A milestone is complete only when

Implementation complete

Verification passed

Regression-free

Deterministic

Documented

No architecture violations

No broken previous milestones

---

# Golden Rule

Never trust implementation.

Always verify.