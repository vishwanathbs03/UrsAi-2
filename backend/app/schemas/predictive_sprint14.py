"""Pydantic schemas for Sprint 14 Predictive Engines."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RevenuePredictionReport(BaseModel):
    """Revenue forecast report."""

    model_config = ConfigDict(extra="forbid")

    current_annual_revenue: float = Field(..., ge=0.0)
    forecast_3m: float = Field(..., ge=0.0)
    forecast_6m: float = Field(..., ge=0.0)
    forecast_12m: float = Field(..., ge=0.0)
    confidence: int = Field(..., ge=0, le=100)
    trend: str = Field(..., description="Trend: Upward Growth, Stable, Downward Risk")


class RevenuePredictionResponse(BaseModel):
    """Response envelope for GET /api/v1/business/predictions/revenue."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: RevenuePredictionReport


class GrowthPredictionReport(BaseModel):
    """Growth forecast report."""

    model_config = ConfigDict(extra="forbid")

    current_employees: int = Field(..., ge=0)
    predicted_employees_12m: int = Field(..., ge=0)
    current_products: int = Field(..., ge=0)
    predicted_products_12m: int = Field(..., ge=0)
    predicted_health_score_12m: int = Field(..., ge=0, le=100)
    expansion_readiness: str = Field(..., description="Expansion readiness: High, Medium, Low")
    growth_confidence: int = Field(..., ge=0, le=100)


class GrowthPredictionResponse(BaseModel):
    """Response envelope for GET /api/v1/business/predictions/growth."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: GrowthPredictionReport


class FutureRiskItem(BaseModel):
    """Predicted future risk item."""

    model_config = ConfigDict(extra="forbid")

    risk_name: str
    category: str = Field(..., description="Category: Financial, Operational, Market")
    probability_pct: int = Field(..., ge=0, le=100)
    severity: str = Field(..., description="Severity: Critical, High, Medium, Low")
    timeline: str = Field(..., description="Timeline e.g. 1-3 months, 6-12 months")


class FutureRiskReport(BaseModel):
    """Future risk prediction report."""

    model_config = ConfigDict(extra="forbid")

    total_predicted_risks: int = Field(..., ge=0)
    future_risks: list[FutureRiskItem] = Field(default_factory=list)


class FutureRiskPredictionResponse(BaseModel):
    """Response envelope for GET /api/v1/business/predictions/risk."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: FutureRiskReport
