import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { atualizarItem, criarItem, definirAtivo, listarItens } from '../services/itens';
import { formatarCentavos, parseReais } from '../lib/dinheiro';
import { centavosParaTexto } from '../lib/itens';
import { Trilha } from '../componentes/Moldura';
import type { Item } from '../types';

type Carga = { estado: 'carregando' } | { estado: 'erro'; mensagem: string } | { estado: 'pronto'; itens: Item[] };

const NOME_MAXIMO = 100;

// valida os dois campos como o service valida; devolve os erros de cada campo
function conferir(nome: string, preco: string) {
    const nomeLimpo = nome.trim();
    const erroNome = !nomeLimpo
        ? 'Informe o nome do item.'
        : nomeLimpo.length > NOME_MAXIMO ? `Use no máximo ${NOME_MAXIMO} caracteres.` : null;
    const precoCentavos = preco.trim() === '' ? null : parseReais(preco);
    const erroPreco = precoCentavos === null ? 'Preço inválido. Use, por exemplo, 6,50.' : null;
    return { nomeLimpo, precoCentavos: precoCentavos ?? 0, erroNome, erroPreco };
}

function CamposItem({ idBase, nome, preco, erroNome, erroPreco, aoMudarNome, aoMudarPreco }: {
    idBase: string;
    nome: string;
    preco: string;
    erroNome: string | null;
    erroPreco: string | null;
    aoMudarNome: (t: string) => void;
    aoMudarPreco: (t: string) => void;
}) {
    return (
        <>
            <div className="campo">
                <label htmlFor={`${idBase}-nome`}>Nome</label>
                <input id={`${idBase}-nome`} className="entrada" autoComplete="off" value={nome} maxLength={NOME_MAXIMO}
                    aria-invalid={!!erroNome} aria-describedby={erroNome ? `${idBase}-nome-erro` : undefined}
                    onChange={(e) => aoMudarNome(e.target.value)} />
                {erroNome && <span id={`${idBase}-nome-erro`} className="erro-campo">{erroNome}</span>}
            </div>
            <div className="campo">
                <label htmlFor={`${idBase}-preco`}>Preço</label>
                <div className="prefixo">
                    <span aria-hidden="true">R$</span>
                    <input id={`${idBase}-preco`} className="entrada num" inputMode="decimal" autoComplete="off" placeholder="0,00"
                        value={preco} aria-invalid={!!erroPreco} aria-describedby={erroPreco ? `${idBase}-preco-erro` : undefined}
                        onChange={(e) => aoMudarPreco(e.target.value)} />
                </div>
                {erroPreco && <span id={`${idBase}-preco-erro`} className="erro-campo">{erroPreco}</span>}
            </div>
        </>
    );
}

function NovoItem({ aoCriar }: { aoCriar: () => void }) {
    const [nome, setNome] = useState('');
    const [preco, setPreco] = useState('');
    const [erros, setErros] = useState<{ nome: string | null; preco: string | null }>({ nome: null, preco: null });
    const [erro, setErro] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    async function aoEnviar(e: FormEvent) {
        e.preventDefault();
        setErro(null);
        const c = conferir(nome, preco);
        setErros({ nome: c.erroNome, preco: c.erroPreco });
        if (c.erroNome || c.erroPreco) return;
        setEnviando(true);
        try {
            await criarItem({ nome: c.nomeLimpo, precoCentavos: c.precoCentavos });
            setNome('');
            setPreco('');
            aoCriar();
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setEnviando(false);
        }
    }

    return (
        <section className="painel" aria-labelledby="novo-item">
            <header><h2 id="novo-item">Novo item</h2></header>
            <form className="form" onSubmit={aoEnviar} noValidate>
                <CamposItem idBase="novo-item" nome={nome} preco={preco} erroNome={erros.nome} erroPreco={erros.preco}
                    aoMudarNome={setNome} aoMudarPreco={setPreco} />
                {erro && <p className="alerta" role="alert">{erro}</p>}
                <div className="form-acoes">
                    <button type="submit" className="btn primario" disabled={enviando}>
                        {enviando ? 'Salvando…' : 'Cadastrar item'}
                    </button>
                </div>
            </form>
        </section>
    );
}

function EditarItem({ item, aoSalvar, aoCancelar }: { item: Item; aoSalvar: () => void; aoCancelar: () => void }) {
    const [nome, setNome] = useState(item.nome);
    const [preco, setPreco] = useState(() => centavosParaTexto(item.precoCentavos));
    const [erros, setErros] = useState<{ nome: string | null; preco: string | null }>({ nome: null, preco: null });
    const [erro, setErro] = useState<string | null>(null);
    const [salvando, setSalvando] = useState(false);

    async function aoEnviar(e: FormEvent) {
        e.preventDefault();
        setErro(null);
        const c = conferir(nome, preco);
        setErros({ nome: c.erroNome, preco: c.erroPreco });
        if (c.erroNome || c.erroPreco) return;
        setSalvando(true);
        try {
            await atualizarItem(item.id, { nome: c.nomeLimpo, precoCentavos: c.precoCentavos });
            aoSalvar();
        } catch (err) {
            setErro((err as Error).message);
            setSalvando(false);
        }
    }

    return (
        <form className="form" onSubmit={aoEnviar} noValidate>
            <CamposItem idBase={`item-${item.id}`} nome={nome} preco={preco} erroNome={erros.nome} erroPreco={erros.preco}
                aoMudarNome={setNome} aoMudarPreco={setPreco} />
            <p className="dica">O preço novo vale para os itens lançados daqui em diante. Dias já lançados guardam o preço daquele dia.</p>
            {erro && <p className="alerta" role="alert">{erro}</p>}
            <div className="form-acoes">
                <button type="submit" className="btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
                <button type="button" className="btn fantasma" onClick={aoCancelar} disabled={salvando}>Cancelar</button>
            </div>
        </form>
    );
}

export function Itens() {
    const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
    const [mostrarDesativados, setMostrarDesativados] = useState(false);
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [mudandoId, setMudandoId] = useState<string | null>(null);
    const [erro, setErro] = useState<string | null>(null);

    const carregar = useCallback(() => {
        listarItens().then(
            (itens) => setCarga({ estado: 'pronto', itens }),
            (e: Error) => setCarga({ estado: 'erro', mensagem: e.message }),
        );
    }, []);

    useEffect(carregar, [carregar]);

    const todos = carga.estado === 'pronto' ? carga.itens : [];
    const ativos = todos.filter((i) => i.ativo);
    const qtdDesativados = todos.length - ativos.length;
    // ativos primeiro; dentro de cada grupo, a ordem alfabética que vem do service
    const visiveis = mostrarDesativados ? [...ativos, ...todos.filter((i) => !i.ativo)] : ativos;

    async function alternarAtivo(item: Item) {
        setErro(null);
        setMudandoId(item.id);
        try {
            await definirAtivo(item.id, !item.ativo);
            carregar();
        } catch (e) {
            setErro((e as Error).message);
        } finally {
            setMudandoId(null);
        }
    }

    return (
        <main className="canvas">
            <Trilha><span aria-current="page">Itens</span></Trilha>
            <div className="titulo">
                <div>
                    <h1>Itens</h1>
                    <p className="sub">
                        {carga.estado === 'pronto'
                            ? `${ativos.length} ${ativos.length === 1 ? 'item ativo' : 'itens ativos'}. Os itens valem para todas as empresas.`
                            : 'Os itens valem para todas as empresas.'}
                    </p>
                </div>
            </div>

            <div className="grade">
                <section className="painel span-8" aria-labelledby="lista-itens">
                    <header>
                        <h2 id="lista-itens">Itens cadastrados</h2>
                        <label className="caixa-check">
                            <input type="checkbox" checked={mostrarDesativados}
                                onChange={(e) => setMostrarDesativados(e.target.checked)} />
                            Mostrar desativados{carga.estado === 'pronto' ? ` (${qtdDesativados})` : ''}
                        </label>
                    </header>

                    {erro && <p className="alerta" role="alert" style={{ marginBottom: 12 }}>{erro}</p>}

                    {carga.estado === 'erro' && (
                        <div className="vazio-caixa" role="alert">
                            <p>Não foi possível carregar os itens. {carga.mensagem}</p>
                            <button type="button" className="btn" style={{ marginTop: 12 }} onClick={carregar}>Tentar de novo</button>
                        </div>
                    )}

                    {carga.estado === 'carregando' && <p className="carregando" role="status">Carregando…</p>}

                    {carga.estado === 'pronto' && visiveis.length === 0 && (
                        <p className="vazio-caixa">
                            {todos.length === 0
                                ? 'Nenhum item cadastrado. Cadastre o primeiro ao lado.'
                                : 'Nenhum item ativo. Marque "Mostrar desativados" para ver os outros.'}
                        </p>
                    )}

                    {visiveis.length > 0 && (
                        <dl className="lista-chave">
                            {visiveis.map((i) => (
                                editandoId === i.id ? (
                                    <div key={i.id} style={{ display: 'block' }}>
                                        <EditarItem item={i} aoCancelar={() => setEditandoId(null)}
                                            aoSalvar={() => { setEditandoId(null); carregar(); }} />
                                    </div>
                                ) : (
                                    <div key={i.id} className={i.ativo ? undefined : 'linha-desativada'} style={{ alignItems: 'center' }}>
                                        <dt>
                                            {i.nome}
                                            {!i.ativo && <span className="pill">Desativado</span>}
                                        </dt>
                                        <dd className="acoes">
                                            <span className="num">{formatarCentavos(i.precoCentavos)}</span>
                                            <button type="button" className="btn btn-pequeno" onClick={() => setEditandoId(i.id)}>Editar</button>
                                            <button type="button" className="btn btn-pequeno" disabled={mudandoId === i.id}
                                                onClick={() => alternarAtivo(i)}>
                                                {i.ativo ? 'Desativar' : 'Reativar'}
                                            </button>
                                        </dd>
                                    </div>
                                )
                            ))}
                        </dl>
                    )}
                </section>

                <div className="span-4">
                    <NovoItem aoCriar={carregar} />
                </div>
            </div>
        </main>
    );
}
