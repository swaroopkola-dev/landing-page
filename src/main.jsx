import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LiveAnnouncement from './LiveAnnouncement'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <>
      <App />
      <LiveAnnouncement />
    </>
  </React.StrictMode>,
)