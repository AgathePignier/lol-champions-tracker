import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'

// Importez les styles
import './index.css'
import './App.css'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SessionContextProvider 
      supabaseClient={supabase}
      initialSession={null}
    >
      <App />
    </SessionContextProvider>
  </BrowserRouter>
)
