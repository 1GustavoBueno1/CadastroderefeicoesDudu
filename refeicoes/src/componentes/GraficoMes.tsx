import { useEffect, useRef, useState } from 'react';
import { diasNoMes, nomeDoMes } from '../lib/datas';
import { formatarCentavos } from '../lib/dinheiro';
import type { Lancamento } from '../types';

const ALTURA = 180;
const ESQ = 64;      // faixa dos valores do eixo y
const TOPO = 8;
const BASE = 34;     // faixa dos pontos de nota fiscal e dos dias no eixo x
const DIAS_NO_EIXO = [1, 8, 15, 22, 29];

const reaisInteiros = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// marcas redondas (1, 2, 2,5 ou 5 × 10^n) com a de cima acima do maior valor
function marcasY(maximo: number): number[] {
    const max = Math.max(maximo, 100);
    const bruto = max / 4;
    const mag = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
    let topo = Math.ceil(max / passo) * passo;
    if (topo <= maximo) topo += passo;
    const marcas: number[] = [];
    for (let v = 0; v <= topo + passo / 2; v += passo) marcas.push(v);
    return marcas;
}

type Props = { mes: string; lancamentos: Lancamento[]; aoAbrirDia: (data: string) => void };

// Total de cada dia do mês em colunas; dias sem lançamento ficam vazios
export function GraficoMes({ mes, lancamentos, aoAbrirDia }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [largura, setLargura] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const dias = diasNoMes(mes);
    const porDia = new Map(lancamentos.map((l) => [Number(l.data.slice(8, 10)), l.totalCentavos]));
    const comNota = new Set(lancamentos.filter((l) => (l.qtdFotos ?? 0) > 0).map((l) => Number(l.data.slice(8, 10))));
    const maior = Math.max(0, ...porDia.values());
    const marcas = marcasY(maior);
    const topo = marcas[marcas.length - 1];

    const larguraPlot = Math.max(0, largura - ESQ);
    const alturaPlot = ALTURA - TOPO - BASE;
    const passo = larguraPlot / dias;
    const larguraBarra = Math.max(2, Math.min(18, passo * 0.62));
    const y = (v: number) => TOPO + alturaPlot - (v / topo) * alturaPlot;
    const xCentro = (dia: number) => ESQ + passo * (dia - 0.5);

    const rotulo = lancamentos.length
        ? `Total por dia em ${nomeDoMes(mes)}: ${lancamentos.length} dias lançados, maior dia ${formatarCentavos(maior)}.`
        : `Nenhum dia lançado em ${nomeDoMes(mes)}.`;

    return (
        <div ref={ref} className="grafico">
            {largura > 0 && (
                <svg width={largura} height={ALTURA} role="img" aria-label={rotulo}>
                    {marcas.map((v) => (
                        <g key={v}>
                            <line className={v === 0 ? 'base' : 'linha-grade'} x1={ESQ} x2={largura} y1={y(v)} y2={y(v)} />
                            <text x={ESQ - 10} y={y(v)} dy="0.32em" textAnchor="end">{reaisInteiros.format(v / 100)}</text>
                        </g>
                    ))}
                    {DIAS_NO_EIXO.filter((d) => d <= dias).map((d) => (
                        <text key={d} x={xCentro(d)} y={ALTURA - 4} textAnchor="middle">{d}</text>
                    ))}
                    {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                        const total = porDia.get(d);
                        if (total === undefined) return null;
                        const data = `${mes}-${String(d).padStart(2, '0')}`;
                        const h = Math.max(total > 0 ? 1 : 0, (total / topo) * alturaPlot);
                        return (
                            <g key={d}>
                                <rect className="barra-alvo" x={ESQ + passo * (d - 1)} y={TOPO} width={passo} height={alturaPlot}
                                    onClick={() => aoAbrirDia(data)}>
                                    <title>{`Dia ${d}: ${formatarCentavos(total)}${comNota.has(d) ? ' · com nota fiscal' : ''}`}</title>
                                </rect>
                                <rect className="barra" x={xCentro(d) - larguraBarra / 2} y={TOPO + alturaPlot - h}
                                    width={larguraBarra} height={h} />
                                {comNota.has(d) && <circle className="nota" cx={xCentro(d)} cy={TOPO + alturaPlot + 8} r={2.5} />}
                            </g>
                        );
                    })}
                </svg>
            )}
            {largura === 0 && <div style={{ height: ALTURA }} />}
        </div>
    );
}
