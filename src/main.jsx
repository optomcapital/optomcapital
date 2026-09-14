import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Text and inputs stay masked and media stays blocked by default — this
      // app shows customer PAN/Aadhaar/bank details, so replays must never
      // capture that on screen.
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    enableLogs: true,

    // Session Replay: record a small slice of all sessions, but always record
    // when an error actually happens (highest-value replays), to stay well
    // within the free-tier quota.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

function ErrorFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-[420px] max-w-full rounded-panel border border-border-subtle bg-surface shadow-panel p-6 text-center">
        <div className="text-[18px] font-semibold text-accent">Optom Capital</div>
        <div className="mt-2 text-[14px] font-medium">Something went wrong.</div>
        <button
          className="mt-4 inline-flex h-[34px] items-center justify-center rounded-md bg-accent px-4 text-[13px] font-medium text-white"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
