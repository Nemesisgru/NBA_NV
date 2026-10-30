import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'

// Send the user back to the login page when the session expires mid-use
const nativeFetch = window.fetch.bind(window)
window.fetch = async (...args) => {
  const res = await nativeFetch(...args)
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
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
