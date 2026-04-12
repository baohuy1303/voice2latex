from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.session_store import get_pdf_path

router = APIRouter()


class PdfTextResponse(BaseModel):
    pages: list[dict]
    total_pages: int


@router.post("/session/{session_id}/pdf/text")
async def extract_pdf_text(session_id: str):
    """Extract all text from the uploaded PDF, page by page."""
    pdf_path = get_pdf_path(session_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="No PDF uploaded for this session")

    try:
        import fitz  # PyMuPDF

        doc = fitz.open(str(pdf_path))
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text()
            pages.append({"page": i + 1, "text": text.strip()})
        doc.close()

        return PdfTextResponse(pages=pages, total_pages=len(pages))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)[:200]}")
