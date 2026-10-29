import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
console.log('RODAR_TESTES =', import.meta.env.VITE_RODAR_TESTES);
if (import.meta.env.VITE_RODAR_TESTES === 'true') {
  // import() dinâmico: os testes não entram no bundle de produção.
  // deixe só a fase atual ativa: os testes fazem login/logout e atrapalham um ao outro se rodarem juntos.
  const quebrou = (e: unknown) => console.error('💥 quebrou:', e);

  // Fase C — fechamento: service e regras, um depois do outro
  (async () => {
    await (await import('./testes/fechamento.teste')).rodarTesteFechamento();
    await (await import('./testes/regras-fechamento.teste')).rodarTesteRegrasFechamento();
  })().catch(quebrou);

  // testes anteriores
  // Fase B — PDFs (não usa o Firestore)
  // import('./testes/pdf.teste').then((m) => m.rodarTestePdf()).catch(quebrou);
  // Fase A — fotos: service e regras, um depois do outro
  // (async () => {
  //   await (await import('./testes/fotos.teste')).rodarTesteFotos();
  //   await (await import('./testes/regras-fotos.teste')).rodarTesteRegrasFotos();
  // })().catch(quebrou);
  // import('./testes/lancamentos.teste').then((m) => m.rodarTesteLancamentos()).catch(quebrou);
  // import('./testes/regras-empresas.teste').then((m) => m.rodarTesteRegrasEmpresas()).catch(quebrou);
  // import('./testes/regras-lancamentos.teste').then((m) => m.rodarTesteRegrasLancamentos()).catch(quebrou);
}
