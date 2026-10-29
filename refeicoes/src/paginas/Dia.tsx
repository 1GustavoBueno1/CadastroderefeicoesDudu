import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buscarEmpresa } from '../services/empresas';
import { buscarLancamento, salvarLancamento } from '../services/lancamentos';
import { formatarCentavos, parseReais } from '../lib/dinheiro';
import { dataPorExtenso, dataValida } from '../lib/datas';
import {
    NOMES_REFEICOES, converterPrecos, converterQuantidades, parseQuantidade, precosParaTexto, textoVazio,
    type TextoPorRefeicao,
} from '../lib/refeicoes';
import { REFEICOES, calcularTotal, type Empresa, type Refeicao } from '../types';

type Carga =
    | { estado: 'carregando' }
    | { estado: 'erro'; mensagem: string }
    | { estado: 'inexistente' }
    | { estado: 'pronto'; empresa: Empresa; jaLancado: boolean; quantidades: TextoPorRefeicao; precos: TextoPorRefeicao };

const inteiro = new Intl.NumberFormat('pt-BR');

function horaAgora(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Comanda({ empresaId, data, inicial }: {
    empresaId: string;
    data: string;
    inicial: Extract<Carga, { estado: 'pronto' }>;
}) {
    const [quantidades, setQuantidades] = useState(inicial.quantidades);
    const [precos, setPrecos] = useState(inicial.precos);
    const [jaLancado, setJaLancado] = useState(inicial.jaLancado);
    const [mostrarErros, setMostrarErros] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [salvoAs, setSalvoAs] = useState<string | null>(null);

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
        setMostrarErros(true);
        setErro(null);
        if (temInvalido) return;
        setSalvando(true);
        try {
            await salvarLancamento(empresaId, data, qtd.valores, prc.valores);
            setJaLancado(true);
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

                <div className="comanda-rodape">
                    <button type="submit" className="btn primario" disabled={salvando}>
                        {salvando ? 'Salvando…' : 'Salvar'}
                    </button>
                    {salvoAs && <span className="aviso-ok" role="status">Salvo às {salvoAs}</span>}
                    {mostrarErros && temInvalido && <span className="erro-campo" role="alert">Corrija os campos marcados.</span>}
                </div>
                {erro && <p className="alerta" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
            </section>
        </form>
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
        Promise.all([buscarEmpresa(empresaId), buscarLancamento(empresaId, data)]).then(
            ([empresa, lancamento]) => {
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
            <nav className="trilha" aria-label="Caminho">
                <Link to="/">Empresas</Link><span aria-hidden="true">/</span>
                <Link to={`/empresas/${empresaId}?mes=${data.slice(0, 7)}`}>{nomeEmpresa}</Link><span aria-hidden="true">/</span>
            </nav>

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
                <div className="grade">
                    <div className="span-8">
                        <Comanda key={`${empresaId}-${data}`} empresaId={empresaId} data={data} inicial={carga} />
                    </div>
                    <section className="painel calmo span-4" aria-labelledby="notas">
                        <header>
                            <h2 id="notas">Notas fiscais</h2>
                            <span className="em-breve">em breve</span>
                        </header>
                        <p className="dica">As fotos das notas fiscais deste dia vão aparecer aqui.</p>
                    </section>
                </div>
            )}
        </main>
    );
}
