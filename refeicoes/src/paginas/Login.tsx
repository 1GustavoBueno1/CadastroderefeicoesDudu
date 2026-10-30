import { useState, type FormEvent } from 'react';
import { entrar } from '../services/auth';
import { TelaSolta } from '../componentes/TelaSolta';

export function Login() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    async function aoEnviar(e: FormEvent) {
        e.preventDefault();
        setErro(null);
        setEnviando(true);
        try {
            await entrar(email.trim(), senha);
            // a sessão muda sozinha: o App troca de tela
        } catch (err) {
            setErro((err as Error).message);
            setEnviando(false);
        }
    }

    return (
        <TelaSolta>
                <h1>Entrar</h1>
                <p>Use o e-mail e a senha cadastrados para você.</p>
                <form className="form" onSubmit={aoEnviar} noValidate>
                    <div className="campo">
                        <label htmlFor="email">E-mail</label>
                        <input id="email" className="entrada" type="email" autoComplete="username" required
                            value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="campo">
                        <label htmlFor="senha">Senha</label>
                        <input id="senha" className="entrada" type="password" autoComplete="current-password" required
                            value={senha} onChange={(e) => setSenha(e.target.value)} />
                    </div>
                    {erro && <p className="alerta" role="alert">{erro}</p>}
                    <button type="submit" className="btn primario" disabled={enviando}>
                        {enviando ? 'Entrando…' : 'Entrar'}
                    </button>
                </form>
        </TelaSolta>
    );
}
