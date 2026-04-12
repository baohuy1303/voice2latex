from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import chat, chat_stream, voice, session, compile

load_dotenv()

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


@app.get("/ping")
async def ping():
    return {"status": "ok"}
