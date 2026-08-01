"""OCR ingestion endpoint.

  * POST /api/v1/business/ocr  — accept a
    multipart/form-data upload (PDF / PNG /
    JPG / JPEG; <= 10 MB) and return a
    deterministic review payload for the
    authenticated user's business profile.

The endpoint is a thin wrapper around the
:class:`OCRService` façade. The 4xx error
contract matches the rest of Atlas AI:

  * 401 — no auth
  * 404 — no business profile
  * 413 — oversize
  * 415 — unsupported media type
  * 422 — empty / invalid extension

The endpoint never modifies the database. The
OCR engine is a read-only ingestion pipeline;
the response is a review payload for the user
to approve, not a business update.
"""

from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.middleware.auth_deps import get_current_user
from app.models.user import User
from app.repositories.business_repository import (
    BusinessNotFound,
    BusinessRepository,
)
from app.schemas.ocr import OcrResponse
from app.services.ocr import OCRService
from app.services.ocr.base import (
    EmptyUploadError,
    OversizedFileError,
    UnsupportedFormatError,
)
from app.services.ocr.parser import (
    MAX_UPLOAD_BYTES,
    parse_upload,
)
from app.utils.database import get_db


router = APIRouter(prefix="/business", tags=["business-ocr"])


def _service() -> OCRService:
    """Build the OCR service. The provider
    (mock) is wired in here — a future
    milestone that swaps in a real provider
    only needs to change this factory."""
    return OCRService()


@router.post(
    "/ocr",
    response_model=OcrResponse,
    summary=(
        "Extract structured business information "
        "from an uploaded document (PDF/PNG/JPG/JPEG; <= 10 MB). "
        "Returns a review payload; never modifies the business profile."
    ),
    status_code=status.HTTP_200_OK,
)
def post_ocr(
    file: UploadFile = File(..., description="The document to ingest."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    service: OCRService = Depends(_service),
) -> OcrResponse:
    # 404 — the spec requires a 404 when the
    # user has no Business Profile. We check
    # the business existence *before* touching
    # the upload so a user with no business
    # does not have to waste a 10 MB upload.
    repo = BusinessRepository(db)
    if not repo.exists_for_owner(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business profile for this user yet.",
        )

    # Read the body. UploadFile.read() is
    # bounded only by FastAPI's default body
    # size limit, but the parser enforces the
    # 10 MB cap. We pass the bytes through the
    # parser; an oversized file raises before
    # we do any work.
    try:
        file_bytes = file.file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read uploaded file: {exc!s}",
        ) from exc

    # Parser handles empty / extension / size.
    try:
        validated_bytes, validated_filename = parse_upload(
            file_bytes=file_bytes, filename=file.filename or ""
        )
    except EmptyUploadError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except UnsupportedFormatError as exc:
        # 415 — Unsupported Media Type is the
        # spec-aligned status for an extension
        # mismatch. (FastAPI's default for
        # ``File(...)`` would 422; we prefer
        # 415 because the body shape matches
        # the MIME type's intent.)
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=str(exc),
        ) from exc
    except OversizedFileError as exc:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"{exc} (max {MAX_UPLOAD_BYTES} bytes / 10 MB)."
            ),
        ) from exc

    # Service façade. The BusinessRepository
    # is *not* passed in — the OCR engine is
    # read-only and does not touch the
    # database. We pass the dependency as a
    # none-token so the façade's signature
    # stays stable for a future milestone that
    # needs to check for cross-tenant
    # collisions (e.g. "this GSTIN is already
    # on file for another business"). For now
    # the engine does not need it.
    try:
        payload = service.ingest(
            file_bytes=validated_bytes,
            filename=validated_filename,
        )
    except BusinessNotFound as exc:
        # Defensive — the existence check above
        # should have caught this. A 404 here
        # means a race condition (the user
        # deleted the business between the
        # check and the ingest).
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business profile for this user yet.",
        ) from exc

    return OcrResponse.model_validate(payload)


# --------------------------------------------------------------------------- #
# POST /api/v1/business/ocr/apply — controlled
# write of approved OCR values to the Business
# Profile.
# --------------------------------------------------------------------------- #


from app.repositories.business_repository import (
    BusinessNotFound,
)
from app.schemas.ocr_apply import (
    OcrApplyRequest,
    OcrApplyResponse,
)
from app.services.ocr_apply import OCRApplyService


@router.post(
    "/ocr/apply",
    response_model=OcrApplyResponse,
    summary=(
        "Apply approved OCR fields to the Business "
        "Profile. The OCR engine itself stays "
        "read-only; this is the only endpoint that "
        "writes OCR-derived data. The user must "
        "explicitly approve each field in the "
        "request. Invalid OCR values never "
        "overwrite valid existing values."
    ),
    status_code=status.HTTP_200_OK,
)
def post_ocr_apply(
    payload: OcrApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OcrApplyResponse:
    repo = BusinessRepository(db)
    # 404 — the spec requires a 404
    # when the user has no Business
    # Profile. The check is up front
    # so an unauthenticated / wrong-
    # tenant request never reaches
    # the apply pass.
    if not repo.exists_for_owner(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business profile for this user yet.",
        )
    service = OCRApplyService(db, repo)
    try:
        result = service.apply(
            owner_id=current_user.id, request=payload
        )
    except BusinessNotFound as exc:
        # Defensive — the existence
        # check above should have
        # caught this.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business profile for this user yet.",
        ) from exc
    return OcrApplyResponse.model_validate(result)
