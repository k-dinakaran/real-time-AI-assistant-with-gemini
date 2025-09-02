import React, { useState } from 'react';
import { signup } from './api';

export default function SignUp({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      const { access_token } = await signup(email, password);
      localStorage.setItem('token', access_token);
      window.location.reload();
    } catch (e) {
      setErr(e.message || 'Signup failed');
    }
  }

  return (
    <div style={{display:'grid', placeItems:'center', height:'100vh'}}>
      <form onSubmit={handleSubmit} style={{width:320, display:'grid', gap:12}}>
        <h2>Create account</h2>
        {err && <div style={{color:'red'}}>{err}</div>}
        <input type="email" placeholder="Email" value={email}
               onChange={e=>setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password}
               onChange={e=>setPassword(e.target.value)} required />
        <button type="submit">Sign Up</button>
        <button type="button" onClick={onSwitch} style={{background:'transparent', border:'none', color:'#007bff', cursor:'pointer'}}>Back to Sign In</button>
      </form>
    </div>
  );
}