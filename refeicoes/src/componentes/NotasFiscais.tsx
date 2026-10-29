import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { adicionarFotos, listarFotos, removerFoto } from '../services/fotos';
import { buscarLancamento } from '../services/lancamentos';
import { baixarArquivo, nomeDeArquivo } from '../lib/download';
import type { Empresa, Foto } from '../types';

type Carga = { estado: 'carregando' } | { estado: 'erro'; mensagem: string } | { estado: 'pronto'; fotos: Foto[] };

type Props = {
    empresa: Empresa;
    data: string;
    // as fotos ficam penduradas no lançamento: sem ele salvo, não há onde gravar
    jaLancado: boolean;
    // mês fechado: sem adicionar nem remover
    somenteLeitura: boolean;
};

export function NotasFiscais({ empresa, data, jaLancado, somenteLeitura }: Props) {
    const empresaId = empresa.id;
    const entrada = useRef<HTMLInputElement>(null);
    const [carga, setCarga] = useState<Carga>({ estado: 'carregando' });
    const [processando, setProcessando] = useState(false);
    const [removendo, setRemovendo] = useState<string | null>(null);
    const [gerandoPdf, setGerandoPdf] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const carregar = useCallback(() => {
        if (!jaLancado) {
            setCarga({ estado: 'pronto', fotos: [] });
            return;
        }
        let ativo = true;
        setCarga({ estado: 'carregando' });
        listarFotos(empresaId, data).then(
            (fotos) => { if (ativo) setCarga({ estado: 'pronto', fotos }); },
            (e: Error) => { if (ativo) setCarga({ estado: 'erro', mensagem: e.message }); },
        );
        return () => { ativo = false; };
    }, [empresaId, data, jaLancado]);

    useEffect(carregar, [carregar]);

    async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
        const arquivos = Array.from(e.target.files ?? []);
        // limpa o campo para a mesma foto poder ser escolhida de novo
        e.target.value = '';
        if (arquivos.length === 0) return;
        setErro(null);
        setProcessando(true);
        try {
            await adicionarFotos(empresaId, data, arquivos);
            setCarga({ estado: 'pronto', fotos: await listarFotos(empresaId, data) });
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setProcessando(false);
        }
    }

    async function remover(foto: Foto, posicao: number) {
        if (!window.confirm(`Remover a nota ${posicao}? Isso não pode ser desfeito.`)) return;
        setErro(null);
        setRemovendo(foto.id);
        try {
            await removerFoto(empresaId, data, foto.id);
            setCarga((c) => (c.estado === 'pronto' ? { estado: 'pronto', fotos: c.fotos.filter((f) => f.id !== foto.id) } : c));
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setRemovendo(null);
        }
    }

    async function baixarPdf(fotos: Foto[]) {
        setErro(null);
        setGerandoPdf(true);
        try {
            // o PDF usa o lançamento gravado, não o que está digitado e ainda não foi salvo
            const lancamento = await buscarLancamento(empresaId, data);
            if (!lancamento) throw new Error('Este dia não está mais lançado.');
            const { gerarPdfDia } = await import('../lib/pdf');
            const bytes = await gerarPdfDia(empresa, lancamento, fotos);
            baixarArquivo(bytes, nomeDeArquivo([empresa.nome, data]));
        } catch (err) {
            setErro((err as Error).message);
        } finally {
            setGerandoPdf(false);
        }
    }

    const fotos = carga.estado === 'pronto' ? carga.fotos : [];

    return (
        <section className="painel" aria-labelledby="notas">
            <header>
                <h2 id="notas">Notas fiscais</h2>
                {carga.estado === 'pronto' && fotos.length > 0 && (
                    <span className="meta">{fotos.length} {fotos.length === 1 ? 'nota' : 'notas'}</span>
                )}
            </header>

            {!somenteLeitura && <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={aoEscolher} />}
            {(!somenteLeitura || fotos.length > 0) && (
                <div className="acoes">
                    {!somenteLeitura && (
                        <button type="button" className="btn" disabled={!jaLancado || processando}
                            aria-describedby={!jaLancado ? 'notas-explicacao' : undefined}
                            onClick={() => entrada.current?.click()}>
                            {processando ? 'Processando…' : 'Adicionar fotos'}
                        </button>
                    )}
                    {fotos.length > 0 && (
                        <button type="button" className="btn" disabled={gerandoPdf || processando} onClick={() => baixarPdf(fotos)}>
                            {gerandoPdf ? 'Gerando PDF…' : 'Baixar PDF do dia'}
                        </button>
                    )}
                </div>
            )}
            {somenteLeitura && carga.estado === 'pronto' && fotos.length === 0 && (
                <p className="dica">As notas deste mês foram apagadas no fechamento.</p>
            )}
            {!somenteLeitura && !jaLancado && (
                <p id="notas-explicacao" className="dica" style={{ marginTop: 8 }}>
                    Salve o lançamento do dia antes de adicionar notas.
                </p>
            )}
            {erro && <p className="alerta" role="alert" style={{ marginTop: 12 }}>{erro}</p>}

            {carga.estado === 'carregando' && <p className="carregando" role="status" style={{ marginTop: 16 }}>Carregando notas…</p>}
            {carga.estado === 'erro' && (
                <div className="vazio-caixa" role="alert" style={{ marginTop: 16 }}>
                    <p>Não foi possível carregar as notas. {carga.mensagem}</p>
                    <button type="button" className="btn" style={{ marginTop: 12 }} onClick={carregar}>Tentar de novo</button>
                </div>
            )}
            {!somenteLeitura && jaLancado && carga.estado === 'pronto' && fotos.length === 0 && (
                <p className="dica" style={{ marginTop: 12 }}>Nenhuma nota neste dia.</p>
            )}
            {fotos.length > 0 && (
                <ul className="miniaturas">
                    {fotos.map((f, i) => (
                        <li key={f.id} className="miniatura">
                            <img src={f.dataUrl} alt={`Nota ${i + 1} de ${fotos.length}`} />
                            {!somenteLeitura && (
                                <button type="button" className="btn fantasma" disabled={removendo !== null}
                                    aria-label={`Remover a nota ${i + 1}`} onClick={() => remover(f, i + 1)}>
                                    {removendo === f.id ? 'Removendo…' : 'Remover'}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
