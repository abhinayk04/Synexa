import os
import re
import uuid
import logging

from app.services.file_loader import SUPPORTED_EXTENSIONS, get_file_type

logger = logging.getLogger(__name__)


def sanitize_filename(filename: str) -> str:
    """Sanitizes filename by replacing illegal Windows characters (\/*?:\"<>|) with underscores."""
    if not filename:
        return "document.pdf"
    # Replace illegal Windows characters
    sanitized = re.sub(r'[\\/*?:"<>|]', '_', filename)
    # Replace non-printable ASCII / control characters
    sanitized = re.sub(r'[\x00-\x1f\x7f]', '_', sanitized)
    # Strip leading/trailing spaces and dots
    sanitized = sanitized.strip(" .")
    return sanitized or "document.pdf"


def save_upload_file(upload_file_bytes: bytes, filename: str, documents_dir: str) -> tuple:
    os.makedirs(documents_dir, exist_ok=True)

    clean_name = sanitize_filename(filename)
    unique_prefix = str(uuid.uuid4())[:8]
    safe_filename = f"{unique_prefix}_{clean_name}"
    file_path = os.path.join(documents_dir, safe_filename)

    try:
        with open(file_path, "wb") as f:
            f.write(upload_file_bytes)
    except OSError as err:
        logger.warning(f"[helpers] OSError saving file '{safe_filename}': {err}. Using UUID fallback.")
        ext = os.path.splitext(clean_name)[1] or ".pdf"
        fallback_filename = f"{unique_prefix}_document{ext}"
        file_path = os.path.join(documents_dir, fallback_filename)
        with open(file_path, "wb") as f:
            f.write(upload_file_bytes)

    logger.info(f"Saved uploaded file: {file_path}")
    return file_path, filename


def validate_file_extension(filename: str) -> bool:
    return get_file_type(filename) is not None


def validate_pdf_extension(filename: str) -> bool:
    return validate_file_extension(filename)


def get_supported_extensions_str() -> str:
    return ", ".join(SUPPORTED_EXTENSIONS.keys())