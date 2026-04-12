from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from services.latex_compiler import compile_latex

router = APIRouter()


class CompileRequest(BaseModel):
    source: str


@router.post("/compile")
async def compile_pdf(request: CompileRequest):
    try:
        pdf_bytes = await compile_latex(request.source)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=document.pdf"},
        )
    except RuntimeError as e:
        return Response(
            content=str(e).encode(),
            status_code=422,
            media_type="text/plain",
        )
    except Exception as e:
        return Response(
            content=f"Compile service unavailable: {str(e)[:200]}".encode(),
            status_code=502,
            media_type="text/plain",
        )
