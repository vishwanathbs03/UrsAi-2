"""Pydantic schemas for Funding Advisor Engine (Sprint 12.5)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FundingChecklistItem(BaseModel):
    """Checklist item for funding readiness."""

    model_config = ConfigDict(extra="forbid")

    task: str = Field(..., description="Checklist task requirement")
    completed: bool = Field(..., description="Whether task is satisfied by business profile")
    category: str = Field(..., description="Category: Bank Loan, Equity Investor, Govt Grant")


class FundingReport(BaseModel):
    """Funding readiness report envelope."""

    model_config = ConfigDict(extra="forbid")

    loan_readiness_score: int = Field(..., ge=0, le=100)
    investor_readiness_score: int = Field(..., ge=0, le=100)
    grant_eligibility_score: int = Field(..., ge=0, le=100)
    msme_schemes: list[str] = Field(default_factory=list)
    funding_checklist: list[FundingChecklistItem] = Field(default_factory=list)


class FundingResponse(BaseModel):
    """Response envelope for GET /api/v1/business/funding."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: FundingReport
