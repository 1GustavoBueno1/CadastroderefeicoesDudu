import { listarLancamentosDoMes } from './lancamentos';
import { listarFotos } from './fotos';
import type { Foto, Lancamento } from '../types';

export type DiaDoMes = { lancamento: Lancamento; fotos: Foto[] };

// Lançamentos do mês com as notas de cada dia, em ordem de data
export async function carregarMes(empresaId: string, mes: string): Promise<DiaDoMes[]> {
    const lancamentos = await listarLancamentosDoMes(empresaId, mes);
    return Promise.all(
        lancamentos.map(async (lancamento) => ({
            lancamento,
            // só busca fotos onde o contador diz que há
            fotos: (lancamento.qtdFotos ?? 0) > 0 ? await listarFotos(empresaId, lancamento.data) : [],
        })),
    );
}
