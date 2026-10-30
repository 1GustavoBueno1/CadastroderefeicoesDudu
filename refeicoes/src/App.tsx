import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { observarSessao, sair, verificarAcesso } from './services/auth';
import { Moldura } from './componentes/Moldura';
import { TelaSolta } from './componentes/TelaSolta';
import { Login } from './paginas/Login';
import { Empresas } from './paginas/Empresas';
import { Empresa } from './paginas/Empresa';
import { Dia } from './paginas/Dia';

type Usuario = { uid: string; email: string | null };
// undefined = o estado inicial da sessão ainda não chegou
type Sessao = Usuario | null | undefined;
type Acesso = 'liberado' | 'negado' | 'erro';

function Carregando() {
    return (
        <main className="tela-carregando">
            <p className="carregando" role="status">Carregando…</p>
        </main>
    );
}

export default function App() {
    const [sessao, setSessao] = useState<Sessao>(undefined);
    // o resultado guarda o uid a que se refere, para nunca valer para outro usuário
    const [resultado, setResultado] = useState<{ uid: string; acesso: Acesso } | null>(null);
    const [tentativa, setTentativa] = useState(0);

    useEffect(() => observarSessao((u) => setSessao(u ? { uid: u.uid, email: u.email } : null)), []);

    const uid = sessao?.uid;
    useEffect(() => {
        if (!uid) return;
        let ativo = true;
        setResultado(null);
        // sem acesso (false) e sem conexão (erro) são situações diferentes
        verificarAcesso(uid).then(
            (ok) => { if (ativo) setResultado({ uid, acesso: ok ? 'liberado' : 'negado' }); },
            () => { if (ativo) setResultado({ uid, acesso: 'erro' }); },
        );
        return () => { ativo = false; };
    }, [uid, tentativa]);

    if (sessao === undefined) return <Carregando />;
    if (sessao === null) return <Login />;
    if (!resultado || resultado.uid !== sessao.uid) return <Carregando />;

    if (resultado.acesso === 'negado') {
        return (
            <TelaSolta>
                <h1>Você não tem acesso a este sistema</h1>
                <p>Você entrou como {sessao.email ?? 'usuário sem e-mail'}. Peça a liberação para quem administra o sistema.</p>
                <button type="button" className="btn" onClick={() => void sair()}>Sair</button>
            </TelaSolta>
        );
    }

    if (resultado.acesso === 'erro') {
        return (
            <TelaSolta>
                <h1>Sem conexão</h1>
                <p>Não foi possível verificar o acesso. Verifique a conexão.</p>
                <button type="button" className="btn primario" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
            </TelaSolta>
        );
    }

    return (
        <BrowserRouter>
            <Moldura email={sessao.email}>
                <Routes>
                    <Route path="/" element={<Empresas />} />
                    <Route path="/empresas/:empresaId" element={<Empresa />} />
                    <Route path="/empresas/:empresaId/dia/:data" element={<Dia />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Moldura>
        </BrowserRouter>
    );
}
