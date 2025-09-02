import React, { useState } from 'react';
import ChatApp from './ChatApp';
import SignIn from './SignIn';
import SignUp from './SignUp';
import './App.css';

export default function App() {
  const [isSignedUp, setIsSignedUp] = useState(true);
  const token = localStorage.getItem('token');

  if (!token) {
    return isSignedUp ? (
      <SignIn onSwitch={() => setIsSignedUp(false)} />
    ) : (
      <SignUp onSwitch={() => setIsSignedUp(true)} />
    );
  }

  return (
    <ChatApp
      onLogout={() => {
        localStorage.removeItem('token');
        window.location.reload();
      }}
    />
  );
}