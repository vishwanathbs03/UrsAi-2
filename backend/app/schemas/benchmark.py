"""Pydantic schemas for the Industry Benchmark Engine (Sprint 11.5)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class BenchmarkMetric(BaseModel):
    """Benchmark evaluation for a single business metric."""

    model_config = ConfigDict(extra="forbid")

    metric_name: str = Field(..., description="Name of benchmark metric e.g. Digital Adoption, Revenue Scale")
    user_score: float = Field(..., description="User business score for this metric")
    industry_average: float = Field(..., description="Benchmark industry average")
    difference: float = Field(..., description="Difference relative to industry benchmark (user_score - industry_average)")
    percentile: int = Field(..., ge=0, le=100, description="Estimated industry percentile position")
    status: str = Field(..., description="Performance status: above_average, average, below_average")


class BenchmarkReport(BaseModel):
    """Industry benchmark comparison report."""

    model_config = ConfigDict(extra="forbid")

    industry: str = Field(..., description="Target industry classification")
    overall_benchmark_score: int = Field(..., ge=0, le=100, description="Composite benchmark percentile (0-100)")
    benchmark_grade: str = Field(..., description="Benchmark grade: A, B, C, D, F")
    metrics: list[BenchmarkMetric] = Field(default_factory=list)


class BenchmarkResponse(BaseModel):
    """Response envelope for GET /api/v1/business/benchmark."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    report: BenchmarkReport
