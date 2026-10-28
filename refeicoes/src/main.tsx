import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { rodarTesteLancamentos } from './testes/lancamentos.teste'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.VITE_RODAR_TESTES === 'true') {
  rodarTesteLancamentos().catch((e) => console.error('💥 o teste quebrou no meio:', e));
}
