"""Filesystem-based session store. Each session is a directory with state.json and optional PDF."""

import json
import uuid
from pathlib import Path
from datetime import datetime, timezone

SESSIONS_DIR = Path(__file__).parent.parent / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)


def create_session() -> dict:
    session_id = str(uuid.uuid4())[:8]
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir(parents=True)

    state = {
        "id": session_id,
        "document": "",
        "history": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    (session_dir / "state.json").write_text(json.dumps(state, indent=2))
    return state


def get_session(session_id: str) -> dict | None:
    state_file = SESSIONS_DIR / session_id / "state.json"
    if not state_file.exists():
        return None
    return json.loads(state_file.read_text())


def save_session(session_id: str, document: str, history: list[dict]) -> dict | None:
    state_file = SESSIONS_DIR / session_id / "state.json"
    if not state_file.exists():
        return None

    state = json.loads(state_file.read_text())
    state["document"] = document
    state["history"] = history
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    state_file.write_text(json.dumps(state, indent=2))
    return state


def save_pdf(session_id: str, pdf_bytes: bytes) -> bool:
    session_dir = SESSIONS_DIR / session_id
    if not session_dir.exists():
        return False
    (session_dir / "document.pdf").write_bytes(pdf_bytes)
    return True


def get_pdf_path(session_id: str) -> Path | None:
    pdf_path = SESSIONS_DIR / session_id / "document.pdf"
    return pdf_path if pdf_path.exists() else None


def list_sessions() -> list[dict]:
    sessions = []
    for d in sorted(SESSIONS_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if d.is_dir() and (d / "state.json").exists():
            state = json.loads((d / "state.json").read_text())
            sessions.append({"id": state["id"], "updated_at": state.get("updated_at", "")})
    return sessions[:10]
