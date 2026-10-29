import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { rodarTesteLancamentos } from './testes/lancamentos.teste'
import { rodarTesteRegrasEmpresas } from './testes/regras-empresas.teste'
import { rodarTesteRegrasLancamentos } from './testes/regras-lancamentos.teste'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
console.log('RODAR_TESTES =', import.meta.env.VITE_RODAR_TESTES);
if (import.meta.env.VITE_RODAR_TESTES === 'true') {
  // descomente UM por vez: eles fazem login/logout e atrapalham um ao outro
  rodarTesteLancamentos().catch((e) => console.error('💥 quebrou:', e));
  //  rodarTesteRegrasEmpresas().catch((e) => console.error('💥 quebrou:', e));
  //rodarTesteRegrasLancamentos().catch((e) => console.error('💥 quebrou:', e));
}