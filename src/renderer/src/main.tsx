import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/Toast'
import App from './App'
import './globals.css'

// In bubble overlay mode, make body/html transparent so the overlay works
if (new URLSearchParams(window.location.search).get('mode') !== 'app') {
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ToastProvider>
      <App />
    </ToastProvider>
  </QueryClientProvider>
)
