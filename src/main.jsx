import { createRoot } from 'react-dom/client'
import Root from './App.jsx'
import './index.css'

// Bundled fonts (offline-friendly) — Manrope for UI, Space Grotesk for display.
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'

createRoot(document.getElementById('root')).render(<Root />)
