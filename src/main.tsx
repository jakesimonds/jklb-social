import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/AuthContext'
import { SettingsProvider } from './lib/SettingsContext'
import { ToastProvider } from './lib/ToastContext'
import { CuratorProvider } from './lib/CuratorContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <CuratorProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CuratorProvider>
      </SettingsProvider>
    </AuthProvider>
  </StrictMode>,
)
