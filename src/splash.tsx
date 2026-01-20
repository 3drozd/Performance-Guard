import React from 'react'
import ReactDOM from 'react-dom/client'
import { SplashApp } from './components/splash/SplashApp'
import './splash.css'

// Ghost shield hiding and window showing moved to SplashApp useEffect
// to ensure React has rendered before showing the window

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SplashApp />
  </React.StrictMode>,
)
