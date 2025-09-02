import os
import json
import asyncio
from typing import Dict, Optional
import google.generativeai as genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import psycopg_pool
import psycopg.rows

# ----------------- Load environment variables -----------------
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey123")

if not GEMINI_API_KEY or not DATABASE_URL:
    raise ValueError("Missing required environment variables (GEMINI_API_KEY or DATABASE_URL)")

# ----------------- Configure Gemini -----------------
genai.configure(api_key=GEMINI_API_KEY)

# ----------------- App Setup -----------------
app = FastAPI()
origins = [
    "http://localhost:3000",  # React dev
    "http://localhost:5173",  # Vite dev
    "https://real-time-ai-assistant-with-gemini.vercel.app",  # Vercel prod
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Security -----------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=1))
    payload = {"sub": subject, "exp": int(expire.timestamp())}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ----------------- Database -----------------
db_pool: psycopg_pool.AsyncConnectionPool = None

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = psycopg_pool.AsyncConnectionPool(
        DATABASE_URL,
        min_size=1,
        max_size=5,
        kwargs={"row_factory": psycopg.rows.dict_row}
    )

@app.on_event("shutdown")
async def shutdown():
    await db_pool.close()

# ----------------- Helpers -----------------
async def get_user_by_email(email: str):
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT * FROM users WHERE email=%s", (email,))
            return await cur.fetchone()

async def create_user(email: str, password: str):
    hashed = pwd_context.hash(password)
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING *",
                (email, hashed),
            )
            return await cur.fetchone()

async def create_session(user_id: str, title: str = "New Chat"):
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO sessions (user_id, title) VALUES (%s, %s) RETURNING *",
                (user_id, title),
            )
            return await cur.fetchone()

async def list_sessions(user_id: str):
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT * FROM sessions WHERE user_id=%s ORDER BY created_at DESC",
                (user_id,),
            )
            return await cur.fetchall()

async def get_session_messages(session_id: str):
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT * FROM messages WHERE session_id=%s ORDER BY created_at ASC",
                (session_id,),
            )
            return await cur.fetchall()

async def persist_message(session_id: str, role: str, content: str):
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO messages (session_id, role, content) VALUES (%s, %s, %s) RETURNING *",
                (session_id, role, content),
            )
            msg = await cur.fetchone()
    if role == "user":
        await update_session_title(session_id, content)
    return msg

async def update_session_title(session_id: str, content: str):
    snippet = content[:30]
    async with db_pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("UPDATE sessions SET title=%s WHERE id=%s", (snippet, session_id))

# ----------------- REST Auth -----------------
@app.post("/signup")
async def signup(data: Dict):
    email, password = data.get("email"), data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Missing email or password")
    if await get_user_by_email(email):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await create_user(email, password)
    token = create_access_token(str(user["id"]))
    return {"access_token": token, "user_id": str(user["id"])}

@app.post("/login")
async def login(data: Dict):
    email, password = data.get("email"), data.get("password")
    user = await get_user_by_email(email)
    if not user or not pwd_context.verify(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["id"]))
    return {"access_token": token, "user_id": str(user["id"])}

@app.get("/sessions")
async def get_sessions(request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    user_id = decode_access_token(token.replace("Bearer ", ""))
    sessions = await list_sessions(user_id)
    return [dict(s) for s in sessions]

@app.post("/sessions")
async def new_session(request: Request):
    token = request.headers.get("Authorization")
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    user_id = decode_access_token(token.replace("Bearer ", ""))
    session = await create_session(user_id)
    return dict(session)

# ----------------- WebSocket Chat -----------------
@app.websocket("/ws/chat")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    session_id: Optional[str] = None
    user_id: Optional[str] = None

    try:
        while True:
            data = await ws.receive_text()
            payload = json.loads(data)

            if payload["type"] == "auth":
                token = payload.get("token")
                user_id = decode_access_token(token)
                session = await create_session(user_id)
                session_id = str(session["id"])
                await ws.send_text(json.dumps({"type": "session_started", "session_id": session_id}))
                continue

            if payload["type"] == "message" and session_id:
                msg_text = payload["content"]
                await persist_message(session_id, "user", msg_text)

                past_msgs = await get_session_messages(session_id)
                history = [{"role": m["role"], "parts": [m["content"]]} for m in past_msgs]

                model = genai.GenerativeModel("gemini-1.5-flash", system_instruction="You are a helpful assistant.")
                chat = model.start_chat(history=history)
                response = await asyncio.to_thread(chat.send_message, msg_text)

                reply = response.text
                await persist_message(session_id, "assistant", reply)
                await ws.send_text(json.dumps({"type": "assistant", "content": reply}))

    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        await ws.send_text(json.dumps({"type": "error", "message": str(e)}))

# ----------------- Health Check -----------------
@app.get("/")
async def health():
    return {"status": "ok", "message": "Backend is running"}