import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [sessionId] = useState(() => {
    const storedId = localStorage.getItem('sessionId');
    if (storedId) return storedId;

    const newId = 'session-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionId', newId);
    return newId;
  });

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    // ✅ Use .env variables instead of hardcoding
    const wsUrl =
      process.env.NODE_ENV === 'production'
        ? process.env.REACT_APP_WS_URL_PROD
        : process.env.REACT_APP_WS_URL_DEV;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('✅ Connected to backend WebSocket');
      setIsConnected(true);

      // Example initial message
      ws.current.send(
        JSON.stringify({
          session_id: sessionId,
          user_message: 'Hello Assistant!',
        })
      );
    };

    ws.current.onclose = () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);

      // Try to reconnect
      setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        connectWebSocket();
      }, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('⚠️ WebSocket error:', error);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📩 Message from backend:', data);

      if (data.type === 'chunk') {
        setMessages((prev) => {
          const newMessages = [...prev];
          if (
            newMessages.length > 0 &&
            newMessages[newMessages.length - 1].role === 'assistant'
          ) {
            newMessages[newMessages.length - 1].content += data.content;
          } else {
            newMessages.push({ role: 'assistant', content: data.content });
          }
          return newMessages;
        });
      } else if (data.type === 'complete') {
        setIsLoading(false);
      } else if (data.type === 'error') {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: 'error', content: data.content },
        ]);
      }
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setIsLoading(true);

    // Placeholder for AI response
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    ws.current.send(
      JSON.stringify({
        session_id: sessionId,
        user_message: message,
      })
    );
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Assistant</h1>
        <div className="connection-status">
          Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === 'user' && <div className="avatar user">You</div>}
              {msg.role === 'assistant' && <div className="avatar ai">AI</div>}
              {msg.role === 'error' && <div className="avatar error">!</div>}

              <div className="content">
                {msg.content ||
                  (msg.role === 'assistant' && isLoading && 'Thinking...')}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            disabled={!isConnected || isLoading}
            rows={3}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || !isConnected || isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;