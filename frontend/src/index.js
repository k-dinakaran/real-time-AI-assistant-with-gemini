import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './index.css';

// Grab the <div id="root"></div> from public/index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render <App /> into it
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);