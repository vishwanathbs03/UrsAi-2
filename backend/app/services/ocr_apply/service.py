"""OCR Review & Apply engine — service
façade.

The façade is the *only* place the
Apply engine wires its helpers
together. The endpoint depends on
this class; the helpers in the
sibling modules are private to
the package.

Pipeline
--------

  OcrApplyRequest
        |
        v
  Build the per-field plan
  (map field names to ApplyField
   records)
        |
        v
  Validate (apply-time format
  checks; never overwrite valid
  existing values with invalid
  OCR — enforced by the applier)
        |
        v
  Apply each field (one
  transaction)
        |
        v
  Build the response (summary +
  per-field changes)

The OCR engine itself stays
read-only. The Apply engine is
the only place the OCR data
flow becomes a database write.

Determinism
-----------

The pipeline is purely
deterministic: same request body
+ same Business row → byte-
identical response (sans
``generated_at``). The
validator and applier are pure
functions of their inputs; the
session is committed at the
end of the apply pass.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.business import Business
from app.repositories.business_repository import BusinessRepository
from app.schemas.ocr_apply import (
    OcrApplyRequest,
    OcrApplyResponse,
)
from app.services.ocr_apply import applier as applier_module
from app.services.ocr_apply.base import (
    APPLY_STATUS_APPLIED,
    APPLY_STATUS_REJECTED,
    APPLY_STATUS_SKIPPED,
    ApplyChange,
    ApplyField,
    ApplySummary,
)


class OCRApplyService:
    """The public façade for the OCR
    Apply engine.

    The service is the *only* place
    the engine writes to the
    database. The endpoint is a
    thin wrapper; the helpers
    (mapper, validator, applier)
    are pure functions."""

    def __init__(self, db: Session, repo: BusinessRepository) -> None:
        self._db = db
        self._repo = repo

    def apply(
        self, *, owner_id: int, request: OcrApplyRequest
    ) -> dict[str, Any]:
        """Run the full apply pipeline
        and return a dict matching
        :class:`OcrApplyResponse`.

        Raises :class:`BusinessNotFound`
        when the user has no Business
        Profile. The endpoint
        translates this to 404."""

        business = self._repo.get_by_owner(owner_id)
        if business is None:
            # Defensive: the endpoint
            # should have caught this
            # before calling the
            # service. A 404 here means
            # a race condition (the
            # user deleted the
            # business between the
            # check and the apply).
            from app.repositories.business_repository import (
                BusinessNotFound,
            )
            raise BusinessNotFound(
                "No business profile for this user yet."
            )

        changes: list[ApplyChange] = []
        for f in request.fields:
            apply_field = self._build_apply_field(f)
            change = applier_module.apply_field(
                field=apply_field, business=business
            )
            changes.append(change)

        # Commit the transaction. The
        # service owns the boundary;
        # the applier is pure.
        self._db.commit()

        summary = self._build_summary(changes)

        response = {
            "generated_at": _now_iso(),
            "extraction_id": request.extraction_id,
            "summary": {
                "applied": summary.applied,
                "skipped": summary.skipped,
                "rejected": summary.rejected,
                "updated_sections": list(
                    summary.updated_sections
                ),
            },
            "changes": [
                {
                    "field_name": c.field_name,
                    "mapped_business_field": (
                        c.mapped_business_field
                    ),
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "confidence": c.confidence,
                    "status": c.status,
                    "reason": c.reason,
                }
                for c in changes
            ],
        }
        # Validate against the schema
        # so a refactor that
        # accidentally leaks a field
        # fails loudly here, not at
        # the client. Pydantic's
        # ``extra="forbid"`` is the
        # guard.
        OcrApplyResponse.model_validate(response)
        return response

    # ---- Helpers ------------------------------------------------- #

    def _build_apply_field(self, f: Any) -> ApplyField:
        """Convert the request's
        ``OcrApplyFieldIn`` to the
        internal :class:`ApplyField`
        plan.

        The plan carries the *effective*
        value (cleaned when the
        upstream validator accepted
        it, raw otherwise) plus the
        user's approval flag. The
        mapper is invoked here so the
        applier does not have to call
        the OCR mapper at apply time
        — separation of concerns."""

        from app.services.ocr import mapper as ocr_mapper_module

        ocr_mapping = ocr_mapper_module.map_field(f.field)
        return ApplyField(
            field_name=f.field,
            raw_value=f.value,
            cleaned_value=f.cleaned_value,
            confidence=int(f.confidence or 0),
            upstream_validation_status=f.validation_status,
            user_approved=bool(f.approved),
            mapped_business_field=ocr_mapping.mapped_business_field,
        )

    def _build_summary(
        self, changes: list[ApplyChange]
    ) -> ApplySummary:
        applied = sum(
            1 for c in changes if c.status == APPLY_STATUS_APPLIED
        )
        skipped = sum(
            1 for c in changes if c.status == APPLY_STATUS_SKIPPED
        )
        rejected = sum(
            1 for c in changes if c.status == APPLY_STATUS_REJECTED
        )
        # The set of sections the
        # apply pass actually modified.
        # An "applied" change is one
        # the engine wrote to the
        # Business row; the section
        # is whatever the mapper
        # resolved the field to. The
        # mapper's section is the
        # source of truth here — the
        # applier just executes the
        # plan, the summary derives
        # the section list from the
        # mapper.
        sections: list[str] = []
        for c in changes:
            if c.status != APPLY_STATUS_APPLIED:
                continue
            from app.services.ocr_apply.mapper import map_field
            section = map_field(c.field_name).section
            if section and section not in sections:
                sections.append(section)
        return ApplySummary(
            applied=applied,
            skipped=skipped,
            rejected=rejected,
            updated_sections=tuple(sections),
        )


def _now_iso() -> str:
    """Return the current UTC time as
    an ISO-8601 string. The response
    carries this as ``generated_at``;
    the determinism contract excludes
    it from the two-call diff."""
    return (
        datetime.now(tz=timezone.utc)
        .isoformat(timespec="microseconds")
    )
