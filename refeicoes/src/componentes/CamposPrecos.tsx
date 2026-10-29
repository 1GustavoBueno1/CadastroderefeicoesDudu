import { REFEICOES, type Refeicao } from '../types';
import { NOMES_REFEICOES, type TextoPorRefeicao } from '../lib/refeicoes';

type Props = {
    idBase: string;
    valores: TextoPorRefeicao;
    invalidos: Refeicao[];
    aoMudar: (refeicao: Refeicao, texto: string) => void;
};

// Os 4 preços digitados em reais ("22,50"); a conversão para centavos fica com quem usa
export function CamposPrecos({ idBase, valores, invalidos, aoMudar }: Props) {
    return (
        <div className="grade-precos">
            {REFEICOES.map((r) => {
                const id = `${idBase}-${r}`;
                const invalido = invalidos.includes(r);
                return (
                    <div className="campo" key={r}>
                        <label htmlFor={id}>{NOMES_REFEICOES[r]}</label>
                        <div className="prefixo">
                            <span aria-hidden="true">R$</span>
                            <input
                                id={id}
                                className="entrada num"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="0,00"
                                value={valores[r]}
                                aria-invalid={invalido}
                                aria-describedby={invalido ? `${id}-erro` : undefined}
                                onChange={(e) => aoMudar(r, e.target.value)}
                            />
                        </div>
                        {invalido && <span id={`${id}-erro`} className="erro-campo">Valor inválido. Use, por exemplo, 22,50.</span>}
                    </div>
                );
            })}
        </div>
    );
}
