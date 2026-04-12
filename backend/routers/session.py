from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from services.session_store import (
    create_session,
    get_session,
    save_session,
    save_pdf,
    get_pdf_path,
    list_sessions,
)

router = APIRouter()


class SaveSessionRequest(BaseModel):
    document: str
    history: list[dict] = []


@router.post("/session")
async def create_new_session():
    state = create_session()
    return state


@router.get("/session")
async def get_all_sessions():
    return list_sessions()


@router.get("/session/{session_id}")
async def get_session_state(session_id: str):
    state = get_session(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


@router.put("/session/{session_id}")
async def save_session_state(session_id: str, request: SaveSessionRequest):
    state = save_session(session_id, request.document, request.history)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return state


@router.post("/session/{session_id}/upload")
async def upload_pdf(session_id: str, file: UploadFile = File(...)):
    pdf_bytes = await file.read()
    if not save_pdf(session_id, pdf_bytes):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "uploaded", "filename": file.filename}


@router.get("/session/{session_id}/pdf")
async def get_pdf(session_id: str):
    pdf_path = get_pdf_path(session_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="No PDF uploaded")
    return FileResponse(pdf_path, media_type="application/pdf")
