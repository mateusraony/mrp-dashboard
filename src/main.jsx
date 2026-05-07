import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Restaura rota após redirect do 404.html (SPA fallback para Static Site)
const _redirect = sessionStorage.getItem('spa_redirect');
if (_redirect) {
  sessionStorage.removeItem('spa_redirect');
  window.history.replaceState(null, '', _redirect);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
