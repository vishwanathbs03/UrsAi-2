"""Pydantic schemas for the Risk Detection Engine (Sprint 12.3)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RiskItem(BaseModel):
    """Detected risk item."""

    model_config = ConfigDict(extra="forbid")

    risk: str = Field(..., description="Name/summary of the detected risk")
    category: str = Field(..., description="Risk category: financial, operational, compliance, digital, growth")
    severity: str = Field(..., description="Risk severity: Critical, High, Medium, Low")
    recommendation: str = Field(..., description="Recommended mitigation step")


class RiskReport(BaseModel):
    """Risk detection report envelope."""

    model_config = ConfigDict(extra="forbid")

    overall_risk_level: str = Field(..., description="Overall risk level: High, Medium, Low")
    total_risks_detected: int = Field(..., ge=0)
    risks: list[RiskItem] = Field(default_factory=list)


class RiskResponse(BaseModel):
    """Response envelope for GET /api/v1/business/risks."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: RiskReport
