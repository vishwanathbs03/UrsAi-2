"""Pydantic schemas for Compliance Advisor Engine (Sprint 12.6 / 12.7)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ComplianceItem(BaseModel):
    """Single compliance requirement item."""

    model_config = ConfigDict(extra="forbid")

    requirement: str = Field(..., description="Compliance requirement name")
    status: str = Field(..., description="Status: Compliant, Pending, Action Required")
    category: str = Field(..., description="Category: Tax, Labor, Quality, Environmental, Trade")
    due_date: str = Field(..., description="Compliance due date or timeline")


class ComplianceReport(BaseModel):
    """Compliance report envelope."""

    model_config = ConfigDict(extra="forbid")

    compliance_score: int = Field(..., ge=0, le=100)
    overall_status: str = Field(..., description="Overall status: Compliant, Moderate Risk, High Risk")
    total_requirements: int = Field(..., ge=0)
    items: list[ComplianceItem] = Field(default_factory=list)


class ComplianceResponse(BaseModel):
    """Response envelope for GET /api/v1/business/compliance."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: ComplianceReport
