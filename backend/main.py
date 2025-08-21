import os
import json
import asyncio
from typing import Dict, List
import google.generativeai as genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAjJFwdpqB2inMa1hhtU4huvf__WgeFoOI")
genai.configure(api_key=GEMINI_API_KEY)

# In-memory session storage (replace with Redis for production)
sessions: Dict[str, List[Dict]] = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_text(message)

manager = ConnectionManager()

def get_session_history(session_id: str) -> List[Dict]:
    if session_id not in sessions:
        sessions[session_id] = []
    return sessions[session_id]

def add_to_history(session_id: str, role: str, message: str):
    if session_id not in sessions:
        sessions[session_id] = []
    sessions[session_id].append({"role": role, "message": message})

async def stream_gemini_response(session_id: str, user_message: str):
    try:
        # Get conversation history
        history = get_session_history(session_id)
        
        # Add user message to history
        add_to_history(session_id, "user", user_message)
        
        # Format history for Gemini
        formatted_history = []
        for msg in history:
            if msg["role"] == "user":
                formatted_history.append({"role": "user", "parts": [msg["message"]]})
            else:
                formatted_history.append({"role": "model", "parts": [msg["message"]]})
        
        # Initialize the model
        model = genai.GenerativeModel('gemini-pro')
        
        # Start chat with history
        chat = model.start_chat(history=formatted_history)
        
        # Stream the response
        response = chat.send_message(user_message, stream=True)
        
        full_response = ""
        for chunk in response:
            chunk_text = chunk.text
            full_response += chunk_text
            await manager.send_message(json.dumps({
                "type": "chunk",
                "content": chunk_text
            }), session_id)
            await asyncio.sleep(0.01)  # Small delay to make streaming visible
        
        # Add AI response to history
        add_to_history(session_id, "assistant", full_response)
        
        await manager.send_message(json.dumps({
            "type": "complete",
            "content": full_response
        }), session_id)
        
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        await manager.send_message(json.dumps({
            "type": "error",
            "content": error_msg
        }), session_id)

@app.websocket("/ws/assistant")
async def websocket_endpoint(websocket: WebSocket):
    try:
        data = await websocket.receive_text()
        message_data = json.loads(data)
        
        session_id = message_data.get("session_id")
        user_message = message_data.get("user_message")
        
        if not session_id or not user_message:
            await websocket.send_text(json.dumps({
                "type": "error",
                "content": "Missing session_id or user_message"
            }))
            return
        
        await manager.connect(websocket, session_id)
        await stream_gemini_response(session_id, user_message)
        
    except WebSocketDisconnect:
        if session_id:
            manager.disconnect(session_id)
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        await websocket.send_text(json.dumps({
            "type": "error",
            "content": error_msg
        }))

@app.get("/")
def read_root():
    return {"message": "AI Assistant API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)