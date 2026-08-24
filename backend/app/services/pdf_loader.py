import os
import re
import logging
from typing import List

from langchain_core.documents import Document

logger = logging.getLogger(__name__)

MIN_TOTAL_CHARS = 30


def normalize_pdf_text(text: str) -> str:
    """Fixes PDF character kerning and spacing artifacts (e.g., 'A R T I F I C I A L' -> 'ARTIFICIAL')."""
    if not text:
        return ""
    
    # 1. Collapse spaced-out letters from PDF font kerning (e.g. 'A R T I F I C I A L' -> 'ARTIFICIAL')
    text = re.sub(r'(?:(?<=\s)|(?<=^))(?:[A-Za-z]\s+){2,}[A-Za-z](?=\s|$)', lambda m: m.group(0).replace(" ", ""), text)
    
    # 2. Add space between lower and upper case (e.g., 'reconstructionTo' -> 'reconstruction To')
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    
    # 3. Add space between letters and numbers (e.g., 'processing500K' -> 'processing 500K')
    text = re.sub(r'([a-zA-Z])(\d+)', r'\1 \2', text)
    text = re.sub(r'(\d+)([a-zA-Z])', r'\1 \2', text)
    
    # 4. Replace multiple spaces/tabs with single space
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

        if total_chars >= MIN_TOTAL_CHARS:
            for doc in documents:
                doc.metadata.setdefault("file_type", "pdf")
                doc.metadata.setdefault("document_name", os.path.basename(file_path))
            return documents

    # Fallback to OCR if PyPDFLoader extracted empty text
    try:
        from app.services.ocr import extract_text_with_ocr
        logger.info(f"[PDF Loader] PyPDF extracted < {MIN_TOTAL_CHARS} chars. Attempting OCR fallback...")
        ocr_docs = extract_text_with_ocr(file_path)
        for doc in ocr_docs:
            doc.page_content = normalize_pdf_text(doc.page_content)
            doc.metadata.setdefault("file_type", "pdf")
            doc.metadata.setdefault("document_name", os.path.basename(file_path))
        return ocr_docs
    except Exception as ocr_err:
        logger.warning(f"[PDF Loader] OCR fallback skipped or failed: {ocr_err}")

    return documents