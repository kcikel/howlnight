import { render } from 'preact'
import { App } from './app'
import { initAnalytics } from './analytics'
// Self-hosted fonts (bundled by Vite, precached by the PWA service worker).
import '@fontsource/im-fell-english/latin-400.css'
import '@fontsource/im-fell-english/latin-400-italic.css'
import '@fontsource/alegreya-sans/latin-400.css'
import '@fontsource/alegreya-sans/latin-400-italic.css'
import '@fontsource/alegreya-sans/latin-500.css'
import '@fontsource/alegreya-sans/latin-700.css'
import '@fontsource/alegreya-sans/latin-ext-400.css'
import './styles/app.css'

initAnalytics()
render(<App />, document.getElementById('app')!)
