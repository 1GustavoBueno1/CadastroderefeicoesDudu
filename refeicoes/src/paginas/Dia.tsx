import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buscarEmpresa } from '../services/empresas';
import { buscarLancamento, excluirLancamento, salvarLancamento } from '../services/lancamentos';
import { buscarFechamento } from '../services/fechamentos';
import { listarItens } from '../services/itens';
import { formatarCentavos } from '../lib/dinheiro';
import { dataLocal, dataPorExtenso, dataValida, formatarData } from '../lib/datas';
import { NotasFiscais } from '../componentes/NotasFiscais';
import { Trilha } from '../componentes/Moldura';
import { contarItens, montarItensDoDia, normalizar, ordenarPorNome, parseQuantidade } from '../lib/itens';
import { calcularTotal, type Empresa, type Fechamento, type Item, type ItensDoDia } from '../types';

type Carga =
    | { estado: 'carregando' }
    | { estado: 'erro'; mensagem: string }
    | { estado: 'inexistente' }
    | {
        estado: 'pronto';
        empresa: Empresa;
        // itens gravados no dia (null = dia ainda não lançado)
        gravados: ItensDoDia | null;
        catalogo: Item[];
        // mês fechado: o dia fica somente leitura
        fechamento: Fechamento | null;
    };

const inteiro = new Intl.NumberFormat('pt-BR');

function horaAgora(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Pronto = Extract<Carga, { estado: 'pronto' }>;

type Linha = { id: string; nome: string; precoCentavos: number };

// Primeiro o que já está gravado no dia (com o nome e o preço daquele dia, mesmo que o item
// tenha sido desativado depois), depois os itens ativos do catálogo que ainda não estão no dia.
function linhasDoDia(gravados: ItensDoDia | null, catalogo: Item[]): Linha[] {
    const doDia = ordenarPorNome(Object.entries(gravados ?? {}).map(([id, i]) => ({ id, nome: i.nome, precoCentavos: i.precoCentavos })));
    const resto = catalogo.filter((i) => i.ativo && !gravados?.[i.id]);
    return [...doDia, ...ordenarPorNome(resto)];
}

function Comanda({ empresaId, data, inicial, aoGravar }: {
    empresaId: string;
    data: string;
    inicial: Pronto;
    aoGravar: (itens: ItensDoDia) => void;
}) {
    const { catalogo } = inicial;
    const [gravados, setGravados] = useState(inicial.gravados);
    // texto digitado no campo de quantidade, por id do item
    const [textos, setTextos] = useState<Record<string, string>>(() =>
        Object.fromEntries(Object.entries(inicial.gravados ?? {}).map(([id, i]) => [id, String(i.quantidade)])));
    const [busca, setBusca] = useState('');
    const [mostrarErros, setMostrarErros] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [salvoAs, setSalvoAs] = useState<string | null>(null);
    const somenteLeitura = inicial.fechamento !== null;

    const linhas = linhasDoDia(gravados, catalogo);
    const termo = normalizar(busca);
    const visiveis = termo ? linhas.filter((l) => normalizar(l.nome).includes(termo)) : linhas;

    const quantidades: Record<string, number> = {};
    const invalidos = new Set<string>();
    for (const l of linhas) {
        const q = parseQuantidade(textos[l.id] ?? '');
        if (q === null) invalidos.add(l.id);
        else quantidades[l.id] = q;
    }
    const itens = montarItensDoDia(quantidades, catalogo, gravados);
    const total = calcularTotal(itens);
    const temInvalido = invalidos.size > 0;

    function mudar(id: string, texto: string) {
        setTextos((t) => ({ ...t, [id]: texto }));
        setSalvoAs(null);
        setErro(null);
    }

    async function aoSalvar(e: FormEvent) {
        e.preventDefault();
        if (somenteLeitura) return;
        setMostrarErros(true);
        setErro(null);
        if (temInvalido) return;
        if (Object.keys(itens).length === 0) {
            setErro(gravados ? 'Informe ao menos um item. Para tirar este dia, use "Excluir dia".' : 'Informe ao menos um item.');
            return;
        }
        setSalvando(true);
        try {
            await salvarLancamento(empresaId, data, itens);
            // daqui em diante o dia guarda esses nomes e preços
            setGravados(itens);
            aoGravar(itens);
            setSalvoAs(horaAgora());
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setSalvando(false);
        }
    }

    return (
        <form onSubmit={aoSalvar} noValidate>
            <section className="painel" aria-labelledby="comanda">
                <header>
                    <h2 id="comanda">Itens do dia</h2>
                    <span className="meta">{gravados ? 'Itens lançados primeiro' : 'Preencha só o que saiu'}</span>
                </header>

                {linhas.length === 0 ? (
                    <div className="vazio-caixa">
                        <p>Nenhum item cadastrado. <Link className="nome-link" to="/itens">Cadastre os itens</Link> para lançar o dia.</p>
                    </div>
                ) : (
                    <>
                        <div className="campo" style={{ marginBottom: 12 }}>
                            <label htmlFor="busca-item" className="visualmente-oculto">Buscar item</label>
                            <input id="busca-item" className="entrada" type="search" autoComplete="off"
                                placeholder="Buscar item…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                        </div>

                        <div className="comanda">
                            <div className="comanda-linha comanda-cab" aria-hidden="true">
                                <span>Item</span>
                                <span className="n">Quantidade</span>
                                <span className="n">Preço</span>
                                <span className="n comanda-sub">Subtotal</span>
                            </div>
                            {visiveis.length === 0 && <p className="dica" style={{ padding: '12px 0' }}>Nenhum item encontrado para "{busca}".</p>}
                            {visiveis.map((l) => {
                                const qInvalida = mostrarErros && invalidos.has(l.id);
                                const q = quantidades[l.id];
                                return (
                                    <div className="comanda-linha" key={l.id}>
                                        <div>
                                            <span className="comanda-nome">{l.nome}</span>
                                            {qInvalida && <span id={`qtd-${l.id}-erro`} className="erro-campo" style={{ display: 'block' }}>Quantidade inválida. Use um número inteiro.</span>}
                                        </div>
                                        <input
                                            className="entrada num"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            placeholder="0"
                                            aria-label={`Quantidade de ${l.nome}`}
                                            value={textos[l.id] ?? ''}
                                            readOnly={somenteLeitura}
                                            aria-invalid={qInvalida}
                                            aria-describedby={qInvalida ? `qtd-${l.id}-erro` : undefined}
                                            onChange={(e) => mudar(l.id, e.target.value)}
                                        />
                                        <span className="n num">{formatarCentavos(l.precoCentavos)}</span>
                                        <span className="n comanda-sub num">
                                            {q ? formatarCentavos(q * l.precoCentavos) : <span className="traco" aria-label="sem valor">—</span>}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                <div className="comanda-total" aria-live="polite">
                    <span>Total do dia · {inteiro.format(contarItens(itens))} {contarItens(itens) === 1 ? 'item' : 'itens'}</span>
                    <strong>{formatarCentavos(total)}</strong>
                </div>

                {!somenteLeitura && linhas.length > 0 && (
                    <div className="comanda-rodape">
                        <button type="submit" className="btn primario" disabled={salvando}>
                            {salvando ? 'Salvando…' : 'Salvar'}
                        </button>
                        {salvoAs && <span className="aviso-ok" role="status">Salvo às {salvoAs}</span>}
                        {mostrarErros && temInvalido && <span className="erro-campo" role="alert">Corrija os campos marcados.</span>}
                    </div>
                )}
                {erro && <p className="alerta" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
            </section>
        </form>
    );
}

function ExcluirDia({ empresaId, data }: { empresaId: string; data: string }) {
    const navigate = useNavigate();
    const [excluindo, setExcluindo] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    async function excluir() {
        if (!window.confirm(`Excluir o dia ${formatarData(data)} com todas as notas dele? Isso não pode ser desfeito.`)) return;
        setErro(null);
        setExcluindo(true);
        try {
            await excluirLancamento(empresaId, data);
            navigate(`/empresas/${empresaId}?mes=${data.slice(0, 7)}`);
        } catch (err) {
            setErro((err as Error).message);
            setExcluindo(false);
        }
    }

    return (
        <section className="painel" aria-labelledby="excluir-dia">
            <header><h2 id="excluir-dia">Excluir dia</h2></header>
            <p className="dica" style={{ marginBottom: 12 }}>Apaga os itens e as notas deste dia.</p>
            <button type="button" className="btn perigo" onClick={excluir} disabled={excluindo}>
                {excluindo ? 'Excluindo…' : 'Excluir dia'}
            </button>
            {erro && <p className="alerta" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
        </section>
    );
}

function DiaPronto({ empresaId, data, inicial }: { empresaId: string; data: string; inicial: Pronto }) {
    const [jaLancado, setJaLancado] = useState(inicial.gravados !== null);
    const { fechamento } = inicial;
    return (
        <>
            {fechamento && (
                <p className="aviso-fechado" role="status" style={{ marginBottom: 'var(--gap)' }}>
                    Mês fechado em {formatarData(dataLocal(fechamento.fechadoEm))}. Este dia é somente leitura.
                </p>
            )}
            <div className="grade">
                <div className="span-8">
                    <Comanda empresaId={empresaId} data={data} inicial={inicial} aoGravar={() => setJaLancado(true)} />
                </div>
                <div className="span-4 lateral">
                    <NotasFiscais empresa={inicial.empresa} data={data} jaLancado={jaLancado} somenteLeitura={!!fechamento} />
                    {jaLancado && !fechamento && <ExcluirDia empresaId={empresaId} data={data} />}
                </div>
            </div>
        </>
    );
}

export function Dia() {
    const { empresaId = '', data = '' } = useParams();
    const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
    const valida = dataValida(data);

    const carregar = useCallback(() => {
        if (!valida) return;
        let ativo = true;
        setCarga({ estado: 'carregando' });
        Promise.all([
            buscarEmpresa(empresaId),
            buscarLancamento(empresaId, data),
            buscarFechamento(empresaId, data.slice(0, 7)),
            listarItens(),
        ]).then(
            ([empresa, lancamento, fechamento, catalogo]) => {
                if (!ativo) return;
                if (!empresa) return setCarga({ estado: 'inexistente' });
                setCarga({ estado: 'pronto', empresa, gravados: lancamento?.itens ?? null, catalogo, fechamento });
            },
            (e: Error) => { if (ativo) setCarga({ estado: 'erro', mensagem: e.message }); },
        );
        return () => { ativo = false; };
    }, [empresaId, data, valida]);

    useEffect(carregar, [carregar]);

    const nomeEmpresa = carga.estado === 'pronto' ? carga.empresa.nome : 'Empresa';

    return (
        <main className="canvas">
            <Trilha>
                <Link to="/">Empresas</Link><span className="sep" aria-hidden="true">/</span>
                <Link to={`/empresas/${empresaId}?mes=${data.slice(0, 7)}`}>{nomeEmpresa}</Link>
                {valida && <><span className="sep" aria-hidden="true">/</span><span aria-current="page">{formatarData(data)}</span></>}
            </Trilha>

            {!valida && (
                <div className="titulo"><div><h1>Data inválida</h1><p className="sub">Volte para a empresa e escolha o dia de novo.</p></div></div>
            )}

            {valida && (
                <div className="titulo">
                    <div>
                        <h1>{dataPorExtenso(data)}</h1>
                        <p className="sub">
                            {carga.estado === 'pronto'
                                ? carga.gravados ? `Dia já lançado para ${carga.empresa.nome}.` : `Dia ainda não lançado para ${carga.empresa.nome}.`
                                : ' '}
                        </p>
                    </div>
                </div>
            )}

            {valida && carga.estado === 'carregando' && <p className="carregando" role="status">Carregando…</p>}
            {valida && carga.estado === 'inexistente' && <p className="vazio-caixa">Empresa não encontrada.</p>}
            {valida && carga.estado === 'erro' && (
                <div className="vazio-caixa" role="alert">
                    <p>Não foi possível abrir o dia. {carga.mensagem}</p>
                    <button type="button" className="btn" style={{ marginTop: 12 }} onClick={carregar}>Tentar de novo</button>
                </div>
            )}

            {valida && carga.estado === 'pronto' && (
                <DiaPronto key={`${empresaId}-${data}`} empresaId={empresaId} data={data} inicial={carga} />
            )}
        </main>
    );
}
