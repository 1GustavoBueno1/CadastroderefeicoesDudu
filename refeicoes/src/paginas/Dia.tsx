import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buscarEmpresa } from '../services/empresas';
import { buscarLancamento, excluirLancamento, salvarLancamento } from '../services/lancamentos';
import { buscarFechamento } from '../services/fechamentos';
import { formatarCentavos, parseReais } from '../lib/dinheiro';
import { dataLocal, dataPorExtenso, dataValida, formatarData } from '../lib/datas';
import { NotasFiscais } from '../componentes/NotasFiscais';
import { Trilha } from '../componentes/Moldura';
import {
    NOMES_REFEICOES, converterPrecos, converterQuantidades, parseQuantidade, precosParaTexto, textoVazio,
    type TextoPorRefeicao,
} from '../lib/refeicoes';
import { REFEICOES, calcularTotal, type Empresa, type Fechamento, type Refeicao } from '../types';

type Carga =
    | { estado: 'carregando' }
    | { estado: 'erro'; mensagem: string }
    | { estado: 'inexistente' }
    | {
        estado: 'pronto';
        empresa: Empresa;
        jaLancado: boolean;
        quantidades: TextoPorRefeicao;
        precos: TextoPorRefeicao;
        // mês fechado: o dia fica somente leitura
        fechamento: Fechamento | null;
    };

const inteiro = new Intl.NumberFormat('pt-BR');

function horaAgora(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Pronto = Extract<Carga, { estado: 'pronto' }>;

function Comanda({ empresaId, data, inicial, jaLancado, aoGravar }: {
    empresaId: string;
    data: string;
    inicial: Pronto;
    jaLancado: boolean;
    aoGravar: () => void;
}) {
    const [quantidades, setQuantidades] = useState(inicial.quantidades);
    const [precos, setPrecos] = useState(inicial.precos);
    const [mostrarErros, setMostrarErros] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [salvoAs, setSalvoAs] = useState<string | null>(null);
    const somenteLeitura = inicial.fechamento !== null;

    const qtd = converterQuantidades(quantidades);
    const prc = converterPrecos(precos);
    const total = calcularTotal(qtd.valores, prc.valores);
    const temInvalido = qtd.invalidos.length > 0 || prc.invalidos.length > 0;

    function mudar(setter: typeof setQuantidades, r: Refeicao, texto: string) {
        setter((t) => ({ ...t, [r]: texto }));
        setSalvoAs(null);
        setErro(null);
    }

    async function aoSalvar(e: FormEvent) {
        e.preventDefault();
        if (somenteLeitura) return;
        setMostrarErros(true);
        setErro(null);
        if (temInvalido) return;
        setSalvando(true);
        try {
            await salvarLancamento(empresaId, data, qtd.valores, prc.valores);
            aoGravar();
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
                    <h2 id="comanda">Refeições do dia</h2>
                    <span className="meta">{jaLancado ? 'Preços gravados neste dia' : 'Preços padrão da empresa'}</span>
                </header>

                <div className="comanda">
                    <div className="comanda-linha comanda-cab" aria-hidden="true">
                        <span>Refeição</span>
                        <span className="n">Quantidade</span>
                        <span className="n">Preço</span>
                        <span className="n comanda-sub">Subtotal</span>
                    </div>
                    {REFEICOES.map((r) => {
                        const qInvalida = mostrarErros && parseQuantidade(quantidades[r]) === null;
                        const pInvalido = mostrarErros && parseReais(precos[r]) === null;
                        const subValido = parseQuantidade(quantidades[r]) !== null && parseReais(precos[r]) !== null;
                        return (
                            <div className="comanda-linha" key={r}>
                                <div>
                                    <span className="comanda-nome">{NOMES_REFEICOES[r]}</span>
                                    {qInvalida && <span id={`qtd-${r}-erro`} className="erro-campo" style={{ display: 'block' }}>Quantidade inválida. Use um número inteiro.</span>}
                                    {pInvalido && <span id={`preco-${r}-erro`} className="erro-campo" style={{ display: 'block' }}>Preço inválido. Use, por exemplo, 22,50.</span>}
                                </div>
                                <input
                                    className="entrada num"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="0"
                                    aria-label={`Quantidade de ${NOMES_REFEICOES[r]}`}
                                    value={quantidades[r]}
                                    readOnly={somenteLeitura}
                                    aria-invalid={qInvalida}
                                    aria-describedby={qInvalida ? `qtd-${r}-erro` : undefined}
                                    onChange={(e) => mudar(setQuantidades, r, e.target.value)}
                                />
                                <div className="prefixo">
                                    <span aria-hidden="true">R$</span>
                                    <input
                                        className="entrada num"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        placeholder="0,00"
                                        aria-label={`Preço de ${NOMES_REFEICOES[r]}`}
                                        value={precos[r]}
                                        readOnly={somenteLeitura}
                                        aria-invalid={pInvalido}
                                        aria-describedby={pInvalido ? `preco-${r}-erro` : undefined}
                                        onChange={(e) => mudar(setPrecos, r, e.target.value)}
                                    />
                                </div>
                                <span className="n comanda-sub num">
                                    {subValido
                                        ? formatarCentavos(qtd.valores[r] * prc.valores[r])
                                        : <span className="traco" aria-label="sem valor">—</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="comanda-total" aria-live="polite">
                    <span>Total do dia · {inteiro.format(REFEICOES.reduce((s, r) => s + qtd.valores[r], 0))} refeições</span>
                    <strong>{formatarCentavos(total)}</strong>
                </div>

                {!somenteLeitura && (
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
            <p className="dica" style={{ marginBottom: 12 }}>Apaga as quantidades, os preços e as notas deste dia.</p>
            <button type="button" className="btn perigo" onClick={excluir} disabled={excluindo}>
                {excluindo ? 'Excluindo…' : 'Excluir dia'}
            </button>
            {erro && <p className="alerta" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
        </section>
    );
}

function DiaPronto({ empresaId, data, inicial }: { empresaId: string; data: string; inicial: Pronto }) {
    const [jaLancado, setJaLancado] = useState(inicial.jaLancado);
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
                    <Comanda empresaId={empresaId} data={data} inicial={inicial}
                        jaLancado={jaLancado} aoGravar={() => setJaLancado(true)} />
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
        ]).then(
            ([empresa, lancamento, fechamento]) => {
                if (!ativo) return;
                if (!empresa) return setCarga({ estado: 'inexistente' });
                const quantidades = textoVazio();
                if (lancamento) for (const r of REFEICOES) quantidades[r] = String(lancamento.quantidades[r]);
                setCarga({
                    estado: 'pronto',
                    empresa,
                    jaLancado: !!lancamento,
                    quantidades,
                    // dia já lançado: o preço daquele dia, não o padrão atual
                    precos: precosParaTexto(lancamento ? lancamento.precos : empresa.precosPadrao),
                    fechamento,
                });
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
                                ? carga.jaLancado ? `Dia já lançado para ${carga.empresa.nome}.` : `Dia ainda não lançado para ${carga.empresa.nome}.`
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
