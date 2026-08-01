"""CSV Export Service — Sprint 13.3.

Exports dashboard business data into clean CSV format including:
  * KPIs (Employees, Revenue, Years, Products, Completeness)
  * Recommendations (Title, Category, Priority, Score, Impact, Effort)
  * Business DNA (Stage, Digital Maturity, Risk Profile, Growth Potential)
  * SWOT (Strengths, Weaknesses, Opportunities, Threats)
"""

from __future__ import annotations

import csv
import io

from app.models.business import Business
from app.repositories.business_repository import BusinessNotFound, BusinessRepository
from app.services.report_service import ReportService


class CsvExportService:
    """Service layer for CSV Data Export (Sprint 13.3)."""

    def __init__(self, repo: BusinessRepository) -> None:
        self._repo = repo
        self._report_service = ReportService(repo)

    def generate_csv_export(self, business: Business) -> str:
        """Generate structured CSV export string for a business instance."""
        unified = self._report_service.generate_unified_report(business)
        output = io.StringIO()
        writer = csv.writer(output)

        # 1. Header & Business Info
        writer.writerow(["=== BUSINESS PROFILE & EXECUTIVE SUMMARY ==="])
        writer.writerow(["Field", "Value"])
        writer.writerow(["Legal Name", unified.executive_summary.business_name])
        writer.writerow(["Industry", unified.executive_summary.industry])
        writer.writerow(["Health Score", f"{unified.executive_summary.overall_health_score}/100"])
        writer.writerow(["Health Grade", unified.executive_summary.health_grade])
        writer.writerow(["Readiness Grade", unified.executive_summary.readiness_grade])
        writer.writerow([])

        # 2. Key Performance Indicators (KPIs)
        writer.writerow(["=== KEY PERFORMANCE INDICATORS (KPIs) ==="])
        writer.writerow(["KPI Name", "Value"])
        for k, v in unified.kpi_summary.items():
            writer.writerow([k, v])
        writer.writerow([])

        # 3. Business DNA
        writer.writerow(["=== BUSINESS DNA ANALYSIS ==="])
        writer.writerow(["DNA Dimension", "Value"])
        writer.writerow(["Business Stage", unified.business_dna.business_stage])
        writer.writerow(["Digital Maturity", unified.business_dna.digital_maturity])
        writer.writerow(["Operational Complexity", unified.business_dna.operational_complexity])
        writer.writerow(["Growth Potential", unified.business_dna.growth_potential])
        writer.writerow(["Risk Profile", unified.business_dna.risk_profile])
        writer.writerow([])

        # 4. SWOT Analysis
        writer.writerow(["=== SWOT ANALYSIS ==="])
        writer.writerow(["SWOT Category", "Item Title", "Item Description"])
        for s in unified.swot.strengths:
            writer.writerow(["Strength", s.title, s.description])
        for w in unified.swot.weaknesses:
            writer.writerow(["Weakness", w.title, w.description])
        for o in unified.swot.opportunities:
            writer.writerow(["Opportunity", o.title, o.description])
        for t in unified.swot.threats:
            writer.writerow(["Threat", t.title, t.description])
        writer.writerow([])

        # 5. Prioritized Recommendations
        writer.writerow(["=== STRATEGIC RECOMMENDATIONS ==="])
        writer.writerow(["ID", "Title", "Category", "Priority", "Score", "Impact", "Effort", "Description"])
        for r in unified.recommendations.recommendations:
            writer.writerow([r.id, r.title, r.category, r.priority, r.priority_score, r.impact, r.effort, r.description])

        return output.getvalue()

    def compute_csv(self, owner_id: int) -> str:
        """Compute CSV string for owner_id."""
        business = self._repo.get_by_owner(owner_id)
        if business is None:
            raise BusinessNotFound("No business profile found for this user.")

        return self.generate_csv_export(business)
