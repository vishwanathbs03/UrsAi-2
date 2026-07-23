"""Upload parser.

The parser is the *only* place that knows the
upload's wire format. It validates the file's
extension, size, and emptiness *before* invoking
the provider — a malformed upload never reaches
the OCR pipeline.

Validation contract
-------------------

* **Extension** — one of ``.pdf``, ``.png``,
  ``.jpg``, ``.jpeg`` (case-insensitive). Other
  extensions raise :class:`UnsupportedFormatError`.
* **Size** — at most 10 MB (10 * 1024 * 1024
  bytes). Larger uploads raise
  :class:`OversizedFileError`.
* **Content** — non-empty (at least one byte).
  Empty uploads raise :class:`EmptyUploadError`.

The endpoint translates these errors into 4xx
responses with a JSON body of the form
``{"detail": "..."}`` matching the rest of
Atlas AI's error contract.

Why size is a hard cap, not a soft warning
-------------------------------------------

The spec names 10 MB as the *maximum* upload
size; anything larger is rejected. The cap is
enforced at the parser layer because that is
the first place the bytes are inspected —
upstream layers (FastAPI's UploadFile) do not
have a size field until the body is fully
read.
"""

from __future__ import annotations

from pathlib import PurePosixPath

from app.services.ocr.base import (
    EmptyUploadError,
    OversizedFileError,
    UnsupportedFormatError,
)


# Maximum upload size in bytes. 10 MB.
MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024

# Accepted file extensions. Case-insensitive.
ACCEPTED_EXTENSIONS: frozenset[str] = frozenset(
    {".pdf", ".png", ".jpg", ".jpeg"}
)

# MIME types the endpoint will accept. The
# endpoint uses this list to short-circuit
# requests with a non-image / non-pdf
# Content-Type header before reading the body.
ACCEPTED_MIME_TYPES: frozenset[str] = frozenset(
    {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
    }
)


def parse_upload(*, file_bytes: bytes, filename: str) -> tuple[bytes, str]:
    """Validate the upload and return the
    (bytes, filename) pair the provider will
    consume.

    Raises:

      * :class:`EmptyUploadError` — file has
        zero bytes.
      * :class:`UnsupportedFormatError` —
        filename extension is not in
        :data:`ACCEPTED_EXTENSIONS`.
      * :class:`OversizedFileError` — file
        exceeds :data:`MAX_UPLOAD_BYTES`.

    The validation order is:

      1. Empty (cheapest check, runs first).
      2. Extension (no I/O, runs next).
      3. Size (one comparison, runs last).
    """
    if not file_bytes:
        raise EmptyUploadError("Uploaded file is empty.")

    ext = PurePosixPath(filename).suffix.lower()
    if ext not in ACCEPTED_EXTENSIONS:
        raise UnsupportedFormatError(
            f"Unsupported file extension '{ext}'. "
            f"Accepted: {sorted(ACCEPTED_EXTENSIONS)}."
        )

    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise OversizedFileError(
            f"Uploaded file is {len(file_bytes)} bytes; "
            f"the maximum allowed is {MAX_UPLOAD_BYTES} bytes (10 MB)."
        )

    return file_bytes, filename


def is_accepted_content_type(content_type: str | None) -> bool:
    """Return True when the request's Content-Type
    is in the accepted set. The endpoint uses
    this to short-circuit obvious non-image /
    non-pdf uploads before reading the body."""
    if not content_type:
        return False
    # Some browsers send ``image/jpg`` (non-standard)
    # or use a charset suffix; be liberal in what
    # we accept on the Content-Type side and strict
    # on the file extension (which is the canonical
    # signal for the provider).
    base = content_type.split(";", 1)[0].strip().lower()
    return base in ACCEPTED_MIME_TYPES
