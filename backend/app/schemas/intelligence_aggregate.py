"""Pydantic schemas for the Unified Intelligence API (Sprint 11.6)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.benchmark import BenchmarkReport
from app.schemas.dna import DNAPayload
from app.schemas.opportunity import OpportunityReport
from app.schemas.readiness import ReadinessReport
from app.schemas.swot import SWOTReport


class FullBusinessIntelligencePayload(BaseModel):
    """Aggregated Sprint 11 Business Intelligence Payload."""

    model_config = ConfigDict(extra="forbid")

    generated_at: str
    dna: DNAPayload
    swot: SWOTReport
    readiness: ReadinessReport
    benchmark: BenchmarkReport
    opportunities: OpportunityReport
