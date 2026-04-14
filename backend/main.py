from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from services.google_auth import get_google_auth_warning

load_dotenv(Path(__file__).with_name(".env"))

from routers import chat, chat_stream, voice, session, compile

app = FastAPI(title="StemFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api")
app.include_router(chat_stream.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(compile.router, prefix="/api")


@app.on_event("startup")
async def check_google_auth():
    warning = get_google_auth_warning()
    if warning:
        print(f"Google Cloud auth warning: {warning}")


@app.get("/ping")
async def ping():
    return {"status": "ok"}
