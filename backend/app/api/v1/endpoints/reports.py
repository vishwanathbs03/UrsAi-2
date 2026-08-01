"""Reports & Data Export API Endpoints — Sprint 13.

Endpoints:
  * GET /api/v1/reports/unified — Unified JSON report model
  * GET /api/v1/reports/pdf — PDF Report download (Executive / Health)
  * GET /api/v1/reports/csv — CSV Data Export download (KPIs, Recs, DNA, SWOT)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.reports import UnifiedReportResponse
from app.services.csv_export_service import CsvExportService
from app.services.pdf_report_service import PdfReportService
from app.services.report_service import ReportService
from app.utils.database import get_db

router = APIRouter(prefix="/reports", tags=["business-reports"])


@router.get(
    "/unified",
    response_model=UnifiedReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate unified business intelligence report model",
)
def get_unified_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UnifiedReportResponse:
    service = ReportService(BusinessRepository(db))
    try:
        return service.compute(current_user.id)
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.get(
    "/pdf",
    status_code=status.HTTP_200_OK,
    summary="Download PDF Business Report (Executive / Health)",
)
def download_pdf_report(
    report_type: str = Query("executive", description="Report type: executive or health"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = PdfReportService(BusinessRepository(db))
    try:
        pdf_bytes = service.compute_pdf(current_user.id, report_type=report_type)
        filename = f"Business_{report_type.capitalize()}_Report.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc


@router.get(
    "/csv",
    status_code=status.HTTP_200_OK,
    summary="Download CSV Business Data Export (KPIs, Recommendations, DNA, SWOT)",
)
def download_csv_export(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    service = CsvExportService(BusinessRepository(db))
    try:
        csv_str = service.compute_csv(current_user.id)
        filename = "Business_Dashboard_Export.csv"
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except BusinessNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
