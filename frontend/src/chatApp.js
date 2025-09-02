import React, { useEffect, useState, useRef } from 'react';
import { listSessions, createSession, getSessionMessages } from './api';
import './App.css';

export default function ChatApp({ onLogout }) {
  const token = localStorage.getItem('token');
  const wsRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const WS_URL = (process.env.NODE_ENV === 'production'
    ? process.env.REACT_APP_WS_URL_PROD
    : process.env.REACT_APP_WS_URL_DEV) || "ws://localhost:8000/ws/chat";

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.id);
      connectWebSocket(activeSession.id);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  async function loadSessions() {
    try {
      const s = await listSessions(token);
      setSessions(s);
      if (s.length > 0) setActiveSession(s[0]);
      else {
        // create first session automatically
        const created = await createSession(token);
        setSessions([created]);
        setActiveSession(created);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function newSession() {
    try {
      const s = await createSession(token);
      setSessions(prev => [s, ...prev]);
      setActiveSession(s);
      setMessages([]);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadMessages(sessionId) {
    try {
      const m = await getSessionMessages(sessionId, token);
      setMessages(m);
    } catch (err) {
      console.error(err);
    }
  }

  function connectWebSocket(sessionId) {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // handshake: send token + session_id once
      ws.send(JSON.stringify({ token, session_id: sessionId }));
    };

    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'history') {
        // [{role, content}]
        setMessages(data.content.map(m => ({ ...m })));
      } else if (data.type === 'chunk') {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            const copy = [...prev];
            copy[copy.length - 1].content += data.content;
            return copy;
          } else {
            return [...prev, { role: 'assistant', content: data.content }];
          }
        });
      } else if (data.type === 'complete') {
        setIsLoading(false);
      } else if (data.type === 'error') {
        setIsLoading(false);
        setMessages(prev => [...prev, { role: 'error', content: data.content }]);
      }
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = (err) => console.error('WS error', err);
  }

  function sendMessage() {
    if (!input.trim() || !isConnected || !activeSession) return;
    const content = input.trim();
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }]);
    wsRef.current.send(JSON.stringify({ user_message: content }));
  }

  return (
    <div style={{display:'flex', height:'100vh'}}>
      <aside style={{width:280, borderRight:'1px solid #ddd', padding:12, position:'relative'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:12}}>
          <b>Chats</b>
          <button onClick={newSession}>New</button>
        </div>
        <div style={{overflowY:'auto', height:'calc(100vh - 140px)'}}>
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={()=>setActiveSession(s)}
              style={{
                padding:8, cursor:'pointer',
                background: activeSession && s.id===activeSession.id ? '#eee' : 'transparent',
                borderRadius:8, marginBottom:6
              }}
            >
              <div style={{fontWeight:600}}>{s.title || 'New Chat'}</div>
              <small>{new Date(s.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
        <div style={{position:'absolute', bottom:12, left:12}}>
          <button onClick={()=>{ localStorage.removeItem('token'); onLogout(); }}>Logout</button>
        </div>
      </aside>

      <main style={{flex:1, display:'flex', flexDirection:'column', padding:12}}>
        <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>{activeSession ? (activeSession.title || "Chat") : "No session"}</h3>
          <div>Status: {isConnected ? '🟢' : '🔴'} {isLoading && 'Thinking...'}</div>
        </header>

        <div style={{flex:1, border:'1px solid #ddd', marginTop:12, padding:12, overflowY:'auto'}}>
          {messages.map((m, idx) => (
            <div key={idx} style={{marginBottom:10, textAlign: m.role === 'user' ? 'right' : 'left'}}>
              <div style={{
                display:'inline-block', padding:8, borderRadius:8,
                background: m.role==='user' ? '#007bff' : (m.role==='assistant' ? '#f1f1f1' : '#ffe6e6'),
                color: m.role==='user' ? 'white' : 'black', maxWidth:'80%'
              }}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex', gap:8, marginTop:12}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} rows={3} style={{flex:1}} placeholder="Type your message..." />
          <button onClick={sendMessage} disabled={!isConnected || isLoading || !activeSession}>Send</button>
        </div>
      </main>
    </div>
  );
}