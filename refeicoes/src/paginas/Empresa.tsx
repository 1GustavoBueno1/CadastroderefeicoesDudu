import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { atualizarEmpresa, buscarEmpresa } from '../services/empresas';
import { listarLancamentosDoMes } from '../services/lancamentos';
import { carregarMes } from '../services/relatorios';
import { apagarNotasDoMes, buscarFechamento } from '../services/fechamentos';
import { formatarCentavos } from '../lib/dinheiro';
import { baixarArquivo, nomeDeArquivo } from '../lib/download';
import { dataLocal, dataValida, diaDaSemana, diasNoMes, formatarData, hoje, mesAtual, mesValido, nomeDoMes, somarMeses } from '../lib/datas';
import { NOMES_REFEICOES, converterPrecos, precosParaTexto, type TextoPorRefeicao } from '../lib/refeicoes';
import { CamposPrecos } from '../componentes/CamposPrecos';
import { Itens } from '../componentes/Itens';
import { GraficoMes } from '../componentes/GraficoMes';
import { Trilha, useMoldura } from '../componentes/Moldura';
import { REFEICOES, type Empresa as TipoEmpresa, type Fechamento, type Lancamento, type Refeicao } from '../types';

type CargaEmpresa =
    | { estado: 'carregando' }
    | { estado: 'erro'; mensagem: string }
    | { estado: 'inexistente' }
    | { estado: 'pronto'; empresa: TipoEmpresa };

type CargaMes = { estado: 'carregando' } | { estado: 'erro'; mensagem: string } | { estado: 'pronto'; lancamentos: Lancamento[] };

const inteiro = new Intl.NumberFormat('pt-BR');

function somaQuantidades(l: Lancamento): number {
    return REFEICOES.reduce((s, r) => s + l.quantidades[r], 0);
}

function PrecosPadrao({ empresa, aoSalvar }: { empresa: TipoEmpresa; aoSalvar: (e: TipoEmpresa) => void }) {
    const [editando, setEditando] = useState(false);
    const [textos, setTextos] = useState<TextoPorRefeicao>(() => precosParaTexto(empresa.precosPadrao));
    const [invalidos, setInvalidos] = useState<Refeicao[]>([]);
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    function abrir() {
        setTextos(precosParaTexto(empresa.precosPadrao));
        setInvalidos([]);
        setErro(null);
        setEditando(true);
    }

    async function aoEnviar(e: FormEvent) {
        e.preventDefault();
        setErro(null);
        const { valores, invalidos } = converterPrecos(textos);
        setInvalidos(invalidos);
        if (invalidos.length) return;
        setSalvando(true);
        try {
            await atualizarEmpresa(empresa.id, { precosPadrao: valores });
            aoSalvar({ ...empresa, precosPadrao: valores });
            setEditando(false);
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setSalvando(false);
        }
    }

    return (
        <section className="painel" aria-labelledby="precos-padrao">
            <header>
                <h2 id="precos-padrao">Preços padrão</h2>
                {!editando && <button type="button" className="btn" onClick={abrir}>Editar preços</button>}
            </header>
            {!editando && (
                <>
                    <dl className="lista-chave">
                        {REFEICOES.map((r) => (
                            <div key={r}>
                                <dt>{NOMES_REFEICOES[r]}</dt>
                                <dd>{formatarCentavos(empresa.precosPadrao[r])}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="dica" style={{ marginTop: 12 }}>Valem para os dias novos. Dias já lançados guardam o preço daquele dia.</p>
                </>
            )}
            {editando && (
                <form className="form" onSubmit={aoEnviar} noValidate>
                    <CamposPrecos idBase="preco-padrao" valores={textos} invalidos={invalidos}
                        aoMudar={(r, t) => setTextos((p) => ({ ...p, [r]: t }))} />
                    {erro && <p className="alerta" role="alert">{erro}</p>}
                    <div className="form-acoes">
                        <button type="submit" className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar preços'}</button>
                        <button type="button" className="btn fantasma" onClick={() => setEditando(false)} disabled={salvando}>Cancelar</button>
                    </div>
                </form>
            )}
        </section>
    );
}

function AbrirDia({ empresaId, mes }: { empresaId: string; mes: string }) {
    const navigate = useNavigate();
    // o campo começa em hoje se o mês mostrado for o atual; senão, no dia 1 daquele mês
    const [data, setData] = useState(() => (mes === mesAtual() ? hoje() : `${mes}-01`));
    const [erro, setErro] = useState<string | null>(null);

    function aoEnviar(e: FormEvent) {
        e.preventDefault();
        if (!dataValida(data)) {
            setErro('Escolha uma data válida.');
            return;
        }
        navigate(`/empresas/${empresaId}/dia/${data}`);
    }

    return (
        <section className="painel primeiro" aria-labelledby="abrir-dia">
            <header><h2 id="abrir-dia">Lançar um dia</h2></header>
            <form className="abrir-dia" onSubmit={aoEnviar} noValidate>
                <div className="campo">
                    <label htmlFor="data-dia" className="visualmente-oculto">Data</label>
                    <input id="data-dia" className="entrada" type="date" value={data}
                        aria-invalid={!!erro} aria-describedby={erro ? 'data-dia-erro' : undefined}
                        onChange={(e) => { setData(e.target.value); setErro(null); }} />
                </div>
                <button type="submit" className="btn primario">Abrir dia</button>
            </form>
            {erro && <p id="data-dia-erro" className="erro-campo" style={{ marginTop: 8 }}>{erro}</p>}
        </section>
    );
}

// meses ('empresaId/AAAA-MM') cujo PDF foi gerado nesta sessão: só eles liberam "Apagar notas do mês".
// Fica na memória da aba: sobrevive à navegação entre telas, some ao recarregar a página.
const pdfsGerados = new Set<string>();

type CargaFechamento = { estado: 'carregando' } | { estado: 'erro'; mensagem: string } | { estado: 'pronto'; fechamento: Fechamento | null };

function FechamentoMes({ empresa, mes, semLancamentos, carga, aoFechar, aoRecarregar }: {
    empresa: TipoEmpresa;
    mes: string;
    semLancamentos: boolean;
    carga: CargaFechamento;
    aoFechar: () => void;
    aoRecarregar: () => void;
}) {
    const chave = `${empresa.id}/${mes}`;
    const [pdfGerado, setPdfGerado] = useState(() => pdfsGerados.has(chave));
    const [gerando, setGerando] = useState(false);
    const [apagando, setApagando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const fechamento = carga.estado === 'pronto' ? carga.fechamento : null;

    async function gerarPdf() {
        setErro(null);
        setGerando(true);
        try {
            const dias = await carregarMes(empresa.id, mes);
            if (dias.length === 0) throw new Error(`Nenhum dia lançado em ${nomeDoMes(mes)}.`);
            const { gerarPdfMes } = await import('../lib/pdf');
            const bytes = await gerarPdfMes(empresa, mes, dias);
            baixarArquivo(bytes, nomeDeArquivo([empresa.nome, mes]));
            pdfsGerados.add(chave);
            setPdfGerado(true);
        } catch (e) {
            setErro((e as Error).message);
        } finally {
            setGerando(false);
        }
    }

    async function apagarNotas() {
        if (!window.confirm('Você conferiu o PDF? As notas serão apagadas e o mês ficará travado.')) return;
        setErro(null);
        setApagando(true);
        try {
            await apagarNotasDoMes(empresa.id, mes);
            aoFechar();
        } catch (e) {
            setErro((e as Error).message);
        } finally {
            setApagando(false);
        }
    }

    return (
        <section className="painel" aria-labelledby="fechamento">
            <header><h2 id="fechamento">Fechamento do mês</h2></header>
            {fechamento && (
                <p className="aviso-fechado" style={{ marginBottom: 12 }}>
                    Mês fechado em {formatarData(dataLocal(fechamento.fechadoEm))} — total {formatarCentavos(fechamento.totalCentavos)}
                </p>
            )}
            {carga.estado === 'erro' && (
                <div className="vazio-caixa" role="alert" style={{ marginBottom: 12 }}>
                    <p>Não foi possível saber se o mês está fechado. {carga.mensagem}</p>
                    <button type="button" className="btn" style={{ marginTop: 12 }} onClick={aoRecarregar}>Tentar de novo</button>
                </div>
            )}
            <div className="acoes">
                <button type="button" className="btn" onClick={gerarPdf} disabled={gerando || semLancamentos}>
                    {gerando ? 'Gerando PDF…' : 'Gerar PDF do mês'}
                </button>
                {carga.estado === 'pronto' && !fechamento && (
                    <button type="button" className="btn perigo" onClick={apagarNotas}
                        disabled={!pdfGerado || apagando || gerando}
                        aria-describedby="fechamento-explicacao">
                        {apagando ? 'Apagando…' : 'Apagar notas do mês'}
                    </button>
                )}
            </div>
            <p id="fechamento-explicacao" className="dica" style={{ marginTop: 8 }}>
                {fechamento
                    ? 'As notas deste mês já foram apagadas: o PDF traz só o resumo.'
                    : semLancamentos
                        ? 'Sem dias lançados neste mês para gerar o PDF.'
                        : pdfGerado
                            ? 'Apagar as notas fecha o mês: nenhum dia dele poderá mais ser editado.'
                            : 'Gere e confira o PDF do mês antes de apagar as notas.'}
            </p>
            {erro && <p className="alerta" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
        </section>
    );
}

export function Empresa() {
    const { empresaId = '' } = useParams();
    const navigate = useNavigate();
    const [busca, setBusca] = useSearchParams();
    const { recarregarEmpresas } = useMoldura();
    const mesUrl = busca.get('mes') ?? '';
    const mes = mesValido(mesUrl) ? mesUrl : mesAtual();

    const [cargaEmpresa, setCargaEmpresa] = useState<CargaEmpresa>({ estado: 'carregando' });
    const [cargaMes, setCargaMes] = useState<CargaMes>({ estado: 'carregando' });
    const [mudandoStatus, setMudandoStatus] = useState(false);
    const [erroStatus, setErroStatus] = useState<string | null>(null);

    const carregarEmpresa = useCallback(() => {
        setCargaEmpresa({ estado: 'carregando' });
        buscarEmpresa(empresaId).then(
            (empresa) => setCargaEmpresa(empresa ? { estado: 'pronto', empresa } : { estado: 'inexistente' }),
            (e: Error) => setCargaEmpresa({ estado: 'erro', mensagem: e.message }),
        );
    }, [empresaId]);

    const carregarMes = useCallback(() => {
        let ativo = true;
        setCargaMes({ estado: 'carregando' });
        listarLancamentosDoMes(empresaId, mes).then(
            (lancamentos) => { if (ativo) setCargaMes({ estado: 'pronto', lancamentos }); },
            (e: Error) => { if (ativo) setCargaMes({ estado: 'erro', mensagem: e.message }); },
        );
        return () => { ativo = false; };
    }, [empresaId, mes]);

    const [cargaFechamento, setCargaFechamento] = useState<CargaFechamento>({ estado: 'carregando' });
    const carregarFechamento = useCallback(() => {
        let ativo = true;
        setCargaFechamento({ estado: 'carregando' });
        buscarFechamento(empresaId, mes).then(
            (fechamento) => { if (ativo) setCargaFechamento({ estado: 'pronto', fechamento }); },
            (e: Error) => { if (ativo) setCargaFechamento({ estado: 'erro', mensagem: e.message }); },
        );
        return () => { ativo = false; };
    }, [empresaId, mes]);

    useEffect(carregarEmpresa, [carregarEmpresa]);
    useEffect(carregarMes, [carregarMes]);
    useEffect(carregarFechamento, [carregarFechamento]);

    function irParaMes(novo: string) {
        setBusca(novo === mesAtual() ? {} : { mes: novo }, { replace: true });
    }

    function abrirDia(data: string) {
        navigate(`/empresas/${empresaId}/dia/${data}`);
    }

    if (cargaEmpresa.estado === 'carregando') {
        return <main className="canvas"><p className="carregando" role="status">Carregando…</p></main>;
    }
    if (cargaEmpresa.estado === 'erro' || cargaEmpresa.estado === 'inexistente') {
        return (
            <main className="canvas">
                <Trilha><Link to="/">Empresas</Link></Trilha>
                <div className="titulo">
                    <div>
                        <h1>{cargaEmpresa.estado === 'inexistente' ? 'Empresa não encontrada' : 'Não foi possível abrir a empresa'}</h1>
                        <p className="sub">{cargaEmpresa.estado === 'erro' ? cargaEmpresa.mensagem : 'Ela pode ter sido removida.'}</p>
                    </div>
                </div>
                {cargaEmpresa.estado === 'erro'
                    ? <button type="button" className="btn" onClick={carregarEmpresa}>Tentar de novo</button>
                    : <Link className="btn" to="/">Voltar para empresas</Link>}
            </main>
        );
    }

    const empresa = cargaEmpresa.empresa;
    const lancamentos = cargaMes.estado === 'pronto' ? cargaMes.lancamentos : [];
    const totalMes = lancamentos.reduce((s, l) => s + l.totalCentavos, 0);
    const refeicoesMes = lancamentos.reduce((s, l) => s + somaQuantidades(l), 0);
    const porRefeicao = Object.fromEntries(
        REFEICOES.map((r) => [r, lancamentos.reduce((s, l) => s + l.quantidades[r], 0)]),
    ) as Record<Refeicao, number>;
    // notas fiscais do mês: o que a operadora confere antes de fechar
    const notasMes = lancamentos.reduce((s, l) => s + (l.qtdFotos ?? 0), 0);
    const diasComNota = lancamentos.filter((l) => (l.qtdFotos ?? 0) > 0).length;
    const fechamento = cargaFechamento.estado === 'pronto' ? cargaFechamento.fechamento : null;
    const carregandoMes = cargaMes.estado === 'carregando';
    const valor = (texto: string) => (carregandoMes ? <span className="esqueleto" /> : texto);

    async function alternarAtiva() {
        setErroStatus(null);
        setMudandoStatus(true);
        try {
            await atualizarEmpresa(empresa.id, { ativa: !empresa.ativa });
            setCargaEmpresa({ estado: 'pronto', empresa: { ...empresa, ativa: !empresa.ativa } });
            recarregarEmpresas();
        } catch (e) {
            setErroStatus((e as Error).message);
        } finally {
            setMudandoStatus(false);
        }
    }

    return (
        <main className="canvas">
            <Trilha>
                <Link to="/">Empresas</Link><span className="sep" aria-hidden="true">/</span>
                <span aria-current="page">{empresa.nome}</span>
            </Trilha>
            <div className="titulo">
                <div>
                    <h1>
                        {empresa.nome}
                        {!empresa.ativa && <span className="pill">Desativada</span>}
                    </h1>
                    <p className="sub">
                        {cargaMes.estado === 'pronto'
                            ? lancamentos.length
                                ? `${lancamentos.length} ${lancamentos.length === 1 ? 'dia lançado' : 'dias lançados'} em ${nomeDoMes(mes)}`
                                    + (fechamento ? ', mês fechado.' : ` · ${diasComNota} com nota fiscal.`)
                                : `Nenhum dia lançado em ${nomeDoMes(mes)}.`
                            : nomeDoMes(mes)}
                    </p>
                </div>
                <div className="acoes">
                    <button type="button" className="btn" onClick={alternarAtiva} disabled={mudandoStatus}>
                        {empresa.ativa ? 'Desativar empresa' : 'Reativar empresa'}
                    </button>
                </div>
            </div>
            {erroStatus && <p className="alerta" role="alert" style={{ marginBottom: 16 }}>{erroStatus}</p>}

            <div className="barra-filtros">
                <div className="seletor-mes" role="group" aria-label="Mês">
                    <button type="button" className="btn btn-icone" aria-label="Mês anterior" onClick={() => irParaMes(somarMeses(mes, -1))}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
                    </button>
                    <strong aria-live="polite">{nomeDoMes(mes)}</strong>
                    {cargaFechamento.estado === 'pronto' && cargaFechamento.fechamento && <span className="pill">Fechado</span>}
                    <button type="button" className="btn btn-icone" aria-label="Próximo mês" onClick={() => irParaMes(somarMeses(mes, 1))}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
                    </button>
                    {mes !== mesAtual() && <button type="button" className="btn fantasma" onClick={() => irParaMes(mesAtual())}>Mês atual</button>}
                </div>
            </div>

            <div className="kpis">
                <div className="kpi">
                    <div className="kpi-rotulo">Total do mês</div>
                    <div className="kpi-valor lider">{valor(formatarCentavos(totalMes))}</div>
                </div>
                <div className="kpi">
                    <div className="kpi-rotulo">Refeições servidas</div>
                    <div className="kpi-valor">{valor(inteiro.format(refeicoesMes))}</div>
                </div>
                <div className="kpi">
                    <div className="kpi-rotulo">Dias lançados</div>
                    <div className="kpi-valor">{valor(String(lancamentos.length))}<small>de {diasNoMes(mes)}</small></div>
                </div>
                <div className="kpi">
                    <div className="kpi-rotulo">Notas fiscais</div>
                    {fechamento
                        ? <div className="kpi-valor">{inteiro.format(fechamento.qtdNotas)}<small>apagadas no fechamento</small></div>
                        : <div className="kpi-valor">{valor(inteiro.format(notasMes))}<small>em {diasComNota} {diasComNota === 1 ? 'dia' : 'dias'}</small></div>}
                </div>
            </div>

            <div className="grade">
                <section className="painel span-8" aria-labelledby="dias-do-mes">
                    <header>
                        <h2 id="dias-do-mes">Total por dia</h2>
                        {diasComNota > 0
                            ? <span className="legenda"><i aria-hidden="true" />dia com nota fiscal</span>
                            : <span className="meta">{nomeDoMes(mes)}</span>}
                    </header>

                    {cargaMes.estado === 'erro' && (
                        <div className="vazio-caixa" role="alert">
                            <p>Não foi possível carregar os lançamentos do mês. {cargaMes.mensagem}</p>
                            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={carregarMes}>Tentar de novo</button>
                        </div>
                    )}

                    {cargaMes.estado !== 'erro' && (
                        <>
                            <GraficoMes mes={mes} lancamentos={lancamentos} aoAbrirDia={abrirDia} />
                            <div className="tabela-rolagem" style={{ marginTop: 16 }}>
                                <table className="tabela-lista">
                                    <thead>
                                        <tr>
                                            <th>Dia</th>
                                            {REFEICOES.map((r) => <th key={r} className="n">{NOMES_REFEICOES[r]}</th>)}
                                            <th className="n">Notas</th>
                                            <th className="n">Total do dia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {carregandoMes && [0, 1, 2].map((i) => (
                                            <tr key={i}>
                                                <td className="l1"><span className="esqueleto" /></td>
                                                {REFEICOES.map((r) => <td key={r} className="n"><span className="esqueleto" style={{ width: '3ch' }} /></td>)}
                                                <td className="n"><span className="esqueleto" style={{ width: '2ch' }} /></td>
                                                <td className="n l1"><span className="esqueleto" /></td>
                                            </tr>
                                        ))}
                                        {cargaMes.estado === 'pronto' && lancamentos.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="l1 vazio">Nenhum dia lançado neste mês. Use "Lançar um dia" para começar.</td>
                                            </tr>
                                        )}
                                        {lancamentos.map((l) => (
                                            <tr key={l.data} className="clicavel" onClick={() => abrirDia(l.data)}>
                                                <td className="l1">
                                                    <Link className="nome-link" to={`/empresas/${empresaId}/dia/${l.data}`} onClick={(e) => e.stopPropagation()}>
                                                        {formatarData(l.data).slice(0, 5)}
                                                    </Link>{' '}
                                                    <span className="traco">{diaDaSemana(l.data)}</span>
                                                </td>
                                                {REFEICOES.map((r) => (
                                                    <td key={r} className="n">{inteiro.format(l.quantidades[r])}</td>
                                                ))}
                                                <td className="n">
                                                    {(l.qtdFotos ?? 0) > 0 ? l.qtdFotos : <span className="traco" aria-label="sem nota">—</span>}
                                                </td>
                                                <td className="n l1">{formatarCentavos(l.totalCentavos)}</td>
                                                <td className="l2 num">
                                                    <Itens itens={[
                                                        ...REFEICOES.map((r) => `${NOMES_REFEICOES[r]} ${l.quantidades[r]}`),
                                                        ...((l.qtdFotos ?? 0) > 0 ? [`${l.qtdFotos} ${l.qtdFotos === 1 ? 'nota' : 'notas'}`] : []),
                                                    ]} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {lancamentos.length > 0 && (
                                        <tfoot>
                                            <tr>
                                                <td className="l1">Total do mês</td>
                                                {REFEICOES.map((r) => <td key={r} className="n">{inteiro.format(porRefeicao[r])}</td>)}
                                                <td className="n">{inteiro.format(notasMes)}</td>
                                                <td className="n l1">{formatarCentavos(totalMes)}</td>
                                                <td className="l2 num">
                                                    <Itens itens={REFEICOES.map((r) => `${NOMES_REFEICOES[r]} ${inteiro.format(porRefeicao[r])}`)} />
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </>
                    )}
                </section>

                <div className="span-4 lateral">
                    <AbrirDia key={mes} empresaId={empresaId} mes={mes} />
                    <PrecosPadrao key={empresa.id} empresa={empresa}
                        aoSalvar={(e) => setCargaEmpresa({ estado: 'pronto', empresa: e })} />
                    <FechamentoMes key={mes} empresa={empresa} mes={mes}
                        semLancamentos={cargaMes.estado === 'pronto' && lancamentos.length === 0}
                        carga={cargaFechamento} aoFechar={carregarFechamento} aoRecarregar={carregarFechamento} />
                </div>
            </div>
        </main>
    );
}
