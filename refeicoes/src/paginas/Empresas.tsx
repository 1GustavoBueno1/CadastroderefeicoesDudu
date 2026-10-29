import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { criarEmpresa, listarEmpresas } from '../services/empresas';
import { formatarCentavos } from '../lib/dinheiro';
import { NOMES_REFEICOES, converterPrecos, textoVazio, type TextoPorRefeicao } from '../lib/refeicoes';
import { CamposPrecos } from '../componentes/CamposPrecos';
import { Itens } from '../componentes/Itens';
import { REFEICOES, type Empresa, type Refeicao } from '../types';

type Carga = { estado: 'carregando' } | { estado: 'erro'; mensagem: string } | { estado: 'pronto'; empresas: Empresa[] };

const NOME_MAXIMO = 100;

function NovaEmpresa({ aoCriar }: { aoCriar: (id: string) => void }) {
    const [nome, setNome] = useState('');
    const [precos, setPrecos] = useState<TextoPorRefeicao>(textoVazio);
    const [invalidos, setInvalidos] = useState<Refeicao[]>([]);
    const [erroNome, setErroNome] = useState<string | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    async function aoEnviar(e: FormEvent) {
        e.preventDefault();
        setErro(null);
        const { valores, invalidos } = converterPrecos(precos);
        setInvalidos(invalidos);
        const nomeLimpo = nome.trim();
        // o banco aceita nomes de 1 a 100 caracteres
        const nomeErro = !nomeLimpo
            ? 'Informe o nome da empresa.'
            : nomeLimpo.length > NOME_MAXIMO ? `Use no máximo ${NOME_MAXIMO} caracteres.` : null;
        setErroNome(nomeErro);
        if (nomeErro || invalidos.length) return;

        setEnviando(true);
        try {
            const id = await criarEmpresa({ nome: nomeLimpo, precosPadrao: valores, ativa: true });
            setNome('');
            setPrecos(textoVazio());
            aoCriar(id);
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setEnviando(false);
        }
    }

    return (
        <section className="painel" aria-labelledby="nova-empresa">
            <header><h2 id="nova-empresa">Nova empresa</h2></header>
            <form className="form" onSubmit={aoEnviar} noValidate>
                <div className="campo">
                    <label htmlFor="nome-empresa">Nome</label>
                    <input id="nome-empresa" className="entrada" autoComplete="off" value={nome} maxLength={NOME_MAXIMO}
                        aria-invalid={!!erroNome} aria-describedby={erroNome ? 'nome-empresa-erro' : undefined}
                        onChange={(e) => setNome(e.target.value)} />
                    {erroNome && <span id="nome-empresa-erro" className="erro-campo">{erroNome}</span>}
                </div>
                <div className="campo">
                    <span className="dica">Preço padrão de cada refeição</span>
                    <CamposPrecos idBase="novo-preco" valores={precos} invalidos={invalidos}
                        aoMudar={(r, t) => setPrecos((p) => ({ ...p, [r]: t }))} />
                </div>
                {erro && <p className="alerta" role="alert">{erro}</p>}
                <div className="form-acoes">
                    <button type="submit" className="btn primario" disabled={enviando}>
                        {enviando ? 'Salvando…' : 'Cadastrar empresa'}
                    </button>
                </div>
            </form>
        </section>
    );
}

export function Empresas() {
    const navigate = useNavigate();
    const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
    const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
    const [criadaId, setCriadaId] = useState<string | null>(null);

    const carregar = useCallback(() => {
        setCarga({ estado: 'carregando' });
        listarEmpresas().then(
            (empresas) => setCarga({ estado: 'pronto', empresas }),
            (e: Error) => setCarga({ estado: 'erro', mensagem: e.message }),
        );
    }, []);

    useEffect(carregar, [carregar]);

    const todas = carga.estado === 'pronto' ? carga.empresas : [];
    const ativas = todas.filter((e) => e.ativa);
    const qtdDesativadas = todas.length - ativas.length;
    const visiveis = mostrarDesativadas ? todas : ativas;
    const criada = todas.find((e) => e.id === criadaId);

    return (
        <main className="canvas">
            <div className="titulo">
                <div>
                    <h1>Empresas</h1>
                    <p className="sub">
                        {carga.estado === 'pronto'
                            ? `${ativas.length} ${ativas.length === 1 ? 'empresa ativa' : 'empresas ativas'}. Abra uma empresa para lançar o dia.`
                            : 'Abra uma empresa para lançar o dia.'}
                    </p>
                </div>
            </div>

            <div className="grade">
                <section className="painel span-8" aria-labelledby="lista-empresas">
                    <header>
                        <h2 id="lista-empresas">Preços padrão por empresa</h2>
                        <label className="caixa-check">
                            <input type="checkbox" checked={mostrarDesativadas}
                                onChange={(e) => setMostrarDesativadas(e.target.checked)} />
                            Mostrar desativadas{carga.estado === 'pronto' ? ` (${qtdDesativadas})` : ''}
                        </label>
                    </header>

                    {criada && (
                        <p className="aviso-ok" role="status" style={{ marginBottom: 12 }}>
                            {criada.nome} foi cadastrada. <Link className="nome-link" to={`/empresas/${criada.id}`}>Abrir</Link>
                        </p>
                    )}

                    {carga.estado === 'erro' && (
                        <div className="vazio-caixa" role="alert">
                            <p>Não foi possível carregar as empresas. {carga.mensagem}</p>
                            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={carregar}>Tentar de novo</button>
                        </div>
                    )}

                    {carga.estado !== 'erro' && (
                        <div className="tabela-rolagem">
                            <table className="tabela-lista">
                                <thead>
                                    <tr>
                                        <th>Empresa</th>
                                        {REFEICOES.map((r) => <th key={r} className="n">{NOMES_REFEICOES[r]}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {carga.estado === 'carregando' && [0, 1, 2].map((i) => (
                                        <tr key={i}>
                                            <td className="l1"><span className="esqueleto" style={{ width: '14ch' }} /></td>
                                            {REFEICOES.map((r) => <td key={r} className="n"><span className="esqueleto" /></td>)}
                                        </tr>
                                    ))}
                                    {carga.estado === 'pronto' && visiveis.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="l1 vazio">
                                                {todas.length === 0
                                                    ? 'Nenhuma empresa cadastrada. Cadastre a primeira ao lado.'
                                                    : 'Nenhuma empresa ativa. Marque "Mostrar desativadas" para ver as outras.'}
                                            </td>
                                        </tr>
                                    )}
                                    {visiveis.map((e) => (
                                        <tr key={e.id} className={`clicavel${e.ativa ? '' : ' linha-desativada'}`}
                                            onClick={() => navigate(`/empresas/${e.id}`)}>
                                            <td className="l1">
                                                <Link className="nome-link" to={`/empresas/${e.id}`} onClick={(ev) => ev.stopPropagation()}>
                                                    {e.nome}
                                                </Link>
                                                {!e.ativa && <span className="pill">Desativada</span>}
                                            </td>
                                            {REFEICOES.map((r) => (
                                                <td key={r} className="n">{formatarCentavos(e.precosPadrao[r])}</td>
                                            ))}
                                            <td className="l2 num">
                                                <Itens itens={REFEICOES.map((r) => `${NOMES_REFEICOES[r]} ${formatarCentavos(e.precosPadrao[r])}`)} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className="span-4">
                    <NovaEmpresa aoCriar={(id) => { setCriadaId(id); carregar(); }} />
                </div>
            </div>
        </main>
    );
}
