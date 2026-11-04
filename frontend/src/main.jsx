import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

// Django's CSRF token (set as a cookie by /api/auth/me/), sent with every state-changing API call
const csrfToken = () => document.cookie.split('; ').find(c => c.startsWith('csrftoken='))?.split('=')[1] || ''
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

// Send the user back to the login page when the session expires mid-use
const nativeFetch = window.fetch.bind(window)
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
  const init = args[1] || {}
  if (url.startsWith('/api/') && !SAFE_METHODS.includes((init.method || 'GET').toUpperCase())) {
    const headers = new Headers(init.headers || {})
    headers.set('X-CSRFToken', decodeURIComponent(csrfToken()))
    args[1] = { ...init, headers, credentials: 'same-origin' }
  }
  const res = await nativeFetch(...args)
  if (res.status === 401 && url.includes('/api/') && !url.includes('/api/auth/')) {
    window.dispatchEvent(new Event('auth:expired'))
  }
  return res
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
