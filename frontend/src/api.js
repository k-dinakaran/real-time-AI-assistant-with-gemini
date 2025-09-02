const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export async function signup(email, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { access_token }
}

export async function login(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: form.toString(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { access_token }
}

export async function listSessions(token) {
  const res = await fetch(`${API_BASE}/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSession(token) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSessionMessages(sessionId, token) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}