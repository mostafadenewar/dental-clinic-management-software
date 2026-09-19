import { Minus, Square, X } from '@phosphor-icons/react'
import './titlebar.css'

const TitleBar = () => {
  const sendWindowCommand = (channel: 'window-minimize' | 'window-toggle-maximize' | 'window-close') => {
    window.ipcRenderer.send(channel)
  }

  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <span className="titlebar-dot" />
        <span>Dental Clinic Management</span>
      </div>
      <div className="titlebar-controls">
        <button type="button" aria-label="Minimize" onClick={() => sendWindowCommand('window-minimize')}>
          <Minus size={13} weight="bold" />
        </button>
        <button type="button" aria-label="Maximize" onClick={() => sendWindowCommand('window-toggle-maximize')}>
          <Square size={11} weight="bold" />
        </button>
        <button type="button" aria-label="Close" className="titlebar-close" onClick={() => sendWindowCommand('window-close')}>
          <X size={13} weight="bold" />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
