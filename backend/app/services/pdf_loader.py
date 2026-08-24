import os
import re
import logging
from typing import List

from langchain_core.documents import Document

logger = logging.getLogger(__name__)

MIN_TOTAL_CHARS = 30


def normalize_pdf_text(text: str) -> str:
    """Fixes concatenated words from PDF margin wraps (e.g., 'Implementedparent' -> 'Implemented parent')."""
    if not text:
        return ""
    # Add space between lower and upper case (e.g., 'reconstructionTo' -> 'reconstruction To')
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    # Add space between letters and numbers (e.g., 'processing500K' -> 'processing 500K')
    text = re.sub(r'([a-zA-Z])(\d+)', r'\1 \2', text)
    text = re.sub(r'(\d+)([a-zA-Z])', r'\1 \2', text)
    # Replace multiple spaces/tabs with single space
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def load_pdf(file_path: str) -> List[Document]:
    from langchain_community.document_loaders import PyPDFLoader

    logger.info(f"[PDF Loader] Loading: {file_path}")

    documents = []
    try:
        loader = PyPDFLoader(file_path)
        documents = loader.load()
    except Exception as e:
        logger.warning(f"[PDF Loader] PyPDFLoader failed: {e}")

    if documents:
        total_chars = 0
        for doc in documents:
            clean_content = normalize_pdf_text(doc.page_content)
            doc.page_content = clean_content
            total_chars += len(clean_content)

        # If sufficient text was extracted, return directly (no OCR needed)
        if total_chars >= MIN_TOTAL_CHARS:
            for doc in documents:
                doc.metadata.setdefault("file_type", "pdf")
                doc.metadata.setdefault("document_name", os.path.basename(file_path))
            logger.info(f"[PDF Loader] Loaded {len(documents)} page(s) ({total_chars} chars) without OCR")
            return documents

    # OCR Fallback attempt (with graceful exception handling so missing Tesseract never crashes upload)
    logger.info("[PDF Loader] Attempting OCR fallback for image-only PDF...")
    try:
        from app.services.ocr import run_ocr_on_pdf
        ocr_documents = run_ocr_on_pdf(file_path)
        if ocr_documents:
            for doc in ocr_documents:
                doc.page_content = normalize_pdf_text(doc.page_content)
            logger.info(f"[PDF Loader] OCR succeeded: {len(ocr_documents)} page(s)")
            return ocr_documents
    except Exception as e:
        logger.warning(f"[PDF Loader] OCR skipped or failed: {e}")

    # Return whatever PyPDF extracted if OCR is unavailable
    if documents:
        for doc in documents:
            doc.metadata.setdefault("file_type", "pdf")
            doc.metadata.setdefault("document_name", os.path.basename(file_path))
        return documents

    raise ValueError(
        f"Unable to extract text from '{os.path.basename(file_path)}'. "
        "File may be empty or corrupted."
    )