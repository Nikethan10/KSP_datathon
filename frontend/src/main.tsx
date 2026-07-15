import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './lib/i18n'
import { FocusProvider } from './lib/focus'
import { NavProvider } from './lib/nav'
import { RouteProvider } from './lib/route'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RouteProvider>
        <FocusProvider>
          <NavProvider>
            <App />
          </NavProvider>
        </FocusProvider>
      </RouteProvider>
    </I18nProvider>
  </StrictMode>,
)
