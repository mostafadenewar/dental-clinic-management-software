import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import TitleBar from './titlebar/TitleBar.tsx'
import './index.css'
import { LookupsProvider } from './api/lookups'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LookupsProvider>
      <>
        <TitleBar />
        <App />
      </>
    </LookupsProvider>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
