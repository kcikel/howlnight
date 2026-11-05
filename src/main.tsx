import { render } from 'preact'
import { App } from './app'
import { initAnalytics } from './analytics'
import './styles/app.css'

initAnalytics()
render(<App />, document.getElementById('app')!)
