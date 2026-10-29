import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sair } from '../services/auth';
import { Marca } from './Marca';

export function Topo({ email }: { email: string | null }) {
    const [erro, setErro] = useState<string | null>(null);

    async function aoSair() {
        setErro(null);
        try {
            await sair();
        } catch (e) {
            setErro((e as Error).message);
        }
    }

    return (
        <header className="topo">
            <div className="topo-dentro">
                <Link to="/" aria-label="Refeições, ir para empresas">
                    <Marca />
                </Link>
                <span className="espaco" />
                {erro && <span className="erro-campo" role="alert">{erro}</span>}
                {email && <span className="usuario">{email}</span>}
                <button type="button" className="btn" onClick={aoSair}>Sair</button>
            </div>
        </header>
    );
}
