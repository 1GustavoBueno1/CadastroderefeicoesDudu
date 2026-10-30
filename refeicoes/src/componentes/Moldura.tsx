import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { sair } from '../services/auth';
import { listarEmpresas } from '../services/empresas';
import { Marca } from './Marca';
import type { Empresa } from '../types';

type ContextoMoldura = {
    // onde a trilha da tela é desenhada (na barra do topo)
    slotTrilha: HTMLElement | null;
    // a barra lateral lista as empresas ativas: quem cria, renomeia ou desativa uma empresa avisa aqui
    recarregarEmpresas: () => void;
};

const Contexto = createContext<ContextoMoldura>({ slotTrilha: null, recarregarEmpresas: () => {} });

export function useMoldura() {
    return useContext(Contexto);
}

// A trilha da tela ("Empresas / Construtora Horizonte / 14 de outubro") vai para a barra do topo
export function Trilha({ children }: { children: ReactNode }) {
    const { slotTrilha } = useMoldura();
    if (!slotTrilha) return null;
    return createPortal(<nav className="trilha" aria-label="Caminho">{children}</nav>, slotTrilha);
}

type CargaEmpresas = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'pronto'; empresas: Empresa[] };

function IconeEmpresas() {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M2.5 14V3.5l6-2v12.5M8.5 6h5v8M1 14h14M4.5 5.5h1.5M4.5 8.5h1.5M4.5 11.5h1.5M10.5 8.5h1M10.5 11.5h1" />
        </svg>
    );
}

export function Moldura({ email, children }: { email: string | null; children: ReactNode }) {
    const { pathname } = useLocation();
    const [slotTrilha, setSlotTrilha] = useState<HTMLElement | null>(null);
    const [carga, setCarga] = useState<CargaEmpresas>({ estado: 'carregando' });
    const [menuAberto, setMenuAberto] = useState(false);
    const [erroSair, setErroSair] = useState<string | null>(null);

    const recarregarEmpresas = useCallback(() => {
        listarEmpresas().then(
            (todas) => setCarga({ estado: 'pronto', empresas: todas.filter((e) => e.ativa) }),
            () => setCarga({ estado: 'erro' }),
        );
    }, []);

    useEffect(recarregarEmpresas, [recarregarEmpresas]);

    // no celular o menu fecha ao trocar de tela e com Esc
    useEffect(() => setMenuAberto(false), [pathname]);
    useEffect(() => {
        if (!menuAberto) return;
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAberto(false); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [menuAberto]);

    async function aoSair() {
        setErroSair(null);
        try {
            await sair();
        } catch (e) {
            setErroSair((e as Error).message);
        }
    }

    return (
        <Contexto.Provider value={{ slotTrilha, recarregarEmpresas }}>
            <div className="moldura">
                <aside id="menu-principal" className={`barra-lateral${menuAberto ? ' aberta' : ''}`} aria-label="Menu">
                    <div className="cabeca-menu">
                        <Link to="/" aria-label="Dudu Bebidas, ir para empresas"><Marca /></Link>
                        <button type="button" className="fechar-menu" aria-label="Fechar menu" onClick={() => setMenuAberto(false)}>
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
                        </button>
                    </div>

                    <nav className="nav-grupo" aria-label="Telas">
                        <Link to="/" className="nav-item" aria-current={pathname === '/' ? 'page' : undefined}>
                            <IconeEmpresas /><span>Empresas</span>
                        </Link>
                    </nav>

                    <nav className="nav-grupo" aria-labelledby="rotulo-ativas">
                        <span id="rotulo-ativas" className="nav-rotulo">Empresas ativas</span>
                        {carga.estado === 'carregando' && <span className="nav-vazio">Carregando…</span>}
                        {carga.estado === 'erro' && (
                            <span className="nav-vazio">
                                Não foi possível carregar.{' '}
                                <button type="button" className="link-sair" onClick={recarregarEmpresas}>Tentar de novo</button>
                            </span>
                        )}
                        {carga.estado === 'pronto' && carga.empresas.length === 0 && (
                            <span className="nav-vazio">Nenhuma empresa ativa.</span>
                        )}
                        {carga.estado === 'pronto' && carga.empresas.map((e) => {
                            const caminho = `/empresas/${e.id}`;
                            const atual = pathname === caminho || pathname.startsWith(`${caminho}/`);
                            return (
                                <Link key={e.id} to={caminho} className="nav-item" title={e.nome}
                                    aria-current={atual ? 'page' : undefined}>
                                    <span>{e.nome}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="rodape">
                        {email && <span className="usuario" title={email}>{email}</span>}
                        <button type="button" className="link-sair" onClick={aoSair}>Sair</button>
                        {erroSair && <span className="erro-campo" role="alert">{erroSair}</span>}
                    </div>
                </aside>

                <header className="topo-barra">
                    <button type="button" className="botao-menu" aria-label="Abrir menu" aria-expanded={menuAberto}
                        aria-controls="menu-principal" onClick={() => setMenuAberto(true)}>
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14" /></svg>
                    </button>
                    <img className="topo-logo" src="/logo-dudu.png" alt="" width={28} height={28} />
                    <div className="trilha-slot" ref={setSlotTrilha} />
                    <div className="topo-conta">
                        {erroSair && <span className="erro-campo" role="alert">{erroSair}</span>}
                        {email && <span className="usuario" title={email}>{email}</span>}
                        <button type="button" className="btn btn-pequeno" onClick={aoSair}>Sair</button>
                    </div>
                </header>

                <div className="folha">{children}</div>
            </div>
        </Contexto.Provider>
    );
}
