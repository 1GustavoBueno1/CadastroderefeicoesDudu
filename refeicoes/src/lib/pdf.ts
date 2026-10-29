// Carregado sob demanda: as telas importam com import('../lib/pdf') para o pdf-lib não pesar o bundle inicial.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { REFEICOES, type Empresa, type Foto, type Lancamento, type PorRefeicao } from '../types';
import { formatarCentavos } from './dinheiro';
import { diaDaSemana, formatarData, nomeDoMes } from './datas';
import { NOMES_REFEICOES } from './refeicoes';

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 40;
const LARGURA_UTIL = A4[0] - 2 * MARGEM;

const TINTA = rgb(0.1, 0.07, 0.09);
const CINZA = rgb(0.37, 0.34, 0.35);
const LINHA = rgb(0.85, 0.82, 0.83);
const DESTAQUE_FUNDO = rgb(0.99, 0.95, 0.97);
const DESTAQUE_TINTA = rgb(0.42, 0.11, 0.24);

const inteiro = new Intl.NumberFormat('pt-BR');

type Fontes = { normal: PDFFont; negrito: PDFFont };

export type ResumoMes = {
    quantidades: PorRefeicao;
    valores: PorRefeicao;
    totalCentavos: number;
};

// Totais do mês com os preços gravados em cada lançamento (não o preço padrão atual da empresa)
export function resumirMes(lancamentos: Lancamento[]): ResumoMes {
    const quantidades: PorRefeicao = { cafeManha: 0, almoco: 0, cafeTarde: 0, janta: 0 };
    const valores: PorRefeicao = { cafeManha: 0, almoco: 0, cafeTarde: 0, janta: 0 };
    let totalCentavos = 0;
    for (const l of lancamentos) {
        for (const r of REFEICOES) {
            quantidades[r] += l.quantidades[r];
            valores[r] += l.quantidades[r] * l.precos[r];
        }
        totalCentavos += l.totalCentavos;
    }
    return { quantidades, valores, totalCentavos };
}

export function legendaNota(empresa: Empresa, data: string, posicao: number, total: number): string {
    return `${empresa.nome} — ${formatarData(data)} — nota ${posicao} de ${total}`;
}

// ---------- texto ----------

// As fontes padrão do PDF só têm o alfabeto latino (acentos do português incluídos);
// qualquer outro caractere (emoji, por exemplo) faria o pdf-lib lançar erro, então vira "?".
const caracteresPorFonte = new WeakMap<PDFFont, Set<number>>();

function seguro(fonte: PDFFont, texto: string): string {
    let suportados = caracteresPorFonte.get(fonte);
    if (!suportados) {
        suportados = new Set(fonte.getCharacterSet());
        caracteresPorFonte.set(fonte, suportados);
    }
    const conjunto = suportados;
    return Array.from(texto, (c) => (conjunto.has(c.codePointAt(0)!) ? c : '?')).join('');
}

// corta com "…" o que não cabe na largura
function caber(fonte: PDFFont, texto: string, tamanho: number, largura: number): string {
    let t = seguro(fonte, texto);
    if (fonte.widthOfTextAtSize(t, tamanho) <= largura) return t;
    while (t.length > 1 && fonte.widthOfTextAtSize(t + '…', tamanho) > largura) t = t.slice(0, -1);
    return t + '…';
}

function escrever(pagina: PDFPage, texto: string, x: number, y: number, fonte: PDFFont, tamanho: number, cor = TINTA) {
    pagina.drawText(seguro(fonte, texto), { x, y, font: fonte, size: tamanho, color: cor });
}

function escreverDireita(pagina: PDFPage, texto: string, direita: number, y: number, fonte: PDFFont, tamanho: number, cor = TINTA) {
    const t = seguro(fonte, texto);
    pagina.drawText(t, { x: direita - fonte.widthOfTextAtSize(t, tamanho), y, font: fonte, size: tamanho, color: cor });
}

async function criarDocumento(titulo: string): Promise<{ pdf: PDFDocument; fontes: Fontes }> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(titulo);
    pdf.setLanguage('pt-BR');
    const fontes = {
        normal: await pdf.embedFont(StandardFonts.Helvetica),
        negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
    };
    return { pdf, fontes };
}

function numerarPaginas(pdf: PDFDocument, fontes: Fontes) {
    const paginas = pdf.getPages();
    paginas.forEach((p, i) => {
        escreverDireita(p, `página ${i + 1} de ${paginas.length}`, A4[0] - MARGEM, MARGEM / 2, fontes.normal, 8, CINZA);
    });
}

// ---------- notas ----------

const TAMANHO_LEGENDA = 11;

function paginaDeNota(pdf: PDFDocument, fontes: Fontes, legenda: string, imagem: PDFImage) {
    const pagina = pdf.addPage(A4);
    const [largura, altura] = A4;
    const yLegenda = altura - MARGEM - TAMANHO_LEGENDA;
    pagina.drawText(caber(fontes.negrito, legenda, TAMANHO_LEGENDA, LARGURA_UTIL), {
        x: MARGEM, y: yLegenda, font: fontes.negrito, size: TAMANHO_LEGENDA, color: TINTA,
    });

    // a imagem ocupa o resto da página, centralizada, mantendo a proporção
    const areaLargura = LARGURA_UTIL;
    const areaAltura = yLegenda - 16 - MARGEM;
    const escala = Math.min(areaLargura / imagem.width, areaAltura / imagem.height);
    const w = imagem.width * escala;
    const h = imagem.height * escala;
    pagina.drawImage(imagem, {
        x: (largura - w) / 2,
        y: MARGEM + (areaAltura - h) / 2,
        width: w,
        height: h,
    });
}

async function adicionarNotas(pdf: PDFDocument, fontes: Fontes, empresa: Empresa, data: string, fotos: Foto[]) {
    const ordenadas = [...fotos].sort((a, b) => a.ordem - b.ordem);
    for (let i = 0; i < ordenadas.length; i++) {
        const imagem = await pdf.embedJpg(ordenadas[i].dataUrl);
        paginaDeNota(pdf, fontes, legendaNota(empresa, data, i + 1, ordenadas.length), imagem);
    }
}

export async function gerarPdfDia(empresa: Empresa, lancamento: Lancamento, fotos: Foto[]): Promise<Uint8Array> {
    if (fotos.length === 0) throw new Error('Este dia não tem notas.');
    const { pdf, fontes } = await criarDocumento(`${empresa.nome} — notas de ${formatarData(lancamento.data)}`);
    await adicionarNotas(pdf, fontes, empresa, lancamento.data, fotos);
    numerarPaginas(pdf, fontes);
    return pdf.save();
}

// ---------- resumo do mês ----------

const ALTURA_LINHA = 18;
const TAMANHO_TABELA = 9;
// Data | 4 refeições | Total do dia: 95 + 4 × 80 + 100 = 515 (largura útil do A4 com 40 de margem)
const COLUNA_DATA = 95;
const COLUNA_REFEICAO = 80;
const COLUNA_TOTAL = LARGURA_UTIL - COLUNA_DATA - 4 * COLUNA_REFEICAO;

// borda direita de cada coluna numérica
function direitaRefeicao(i: number): number {
    return MARGEM + COLUNA_DATA + (i + 1) * COLUNA_REFEICAO;
}
const DIREITA_TOTAL = MARGEM + COLUNA_DATA + 4 * COLUNA_REFEICAO + COLUNA_TOTAL;

export async function gerarPdfMes(
    empresa: Empresa,
    mes: string,
    dias: { lancamento: Lancamento; fotos: Foto[] }[],
): Promise<Uint8Array> {
    if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Mês inválido.');
    // só os dias daquele mês entram, no resumo e nas notas, mesmo que venha algum dia a mais
    // (a empresa já vem certa: as fotos são lidas de dentro dos lançamentos dela, em carregarMes)
    const ordenados = dias
        .filter((d) => d.lancamento.data.startsWith(`${mes}-`))
        .sort((a, b) => a.lancamento.data.localeCompare(b.lancamento.data));
    const titulo = `Relatório de refeições — ${nomeDoMes(mes)}`;
    const { pdf, fontes } = await criarDocumento(`${empresa.nome} — ${titulo}`);
    const { normal, negrito } = fontes;
    const resumo = resumirMes(ordenados.map((d) => d.lancamento));

    let pagina = pdf.addPage(A4);
    let y = A4[1] - MARGEM;

    function linhaHorizontal(cor = LINHA, espessura = 0.75) {
        pagina.drawLine({ start: { x: MARGEM, y }, end: { x: MARGEM + LARGURA_UTIL, y }, thickness: espessura, color: cor });
    }

    function cabecalhoTabela() {
        y -= ALTURA_LINHA;
        escrever(pagina, 'Data', MARGEM, y, negrito, TAMANHO_TABELA, CINZA);
        REFEICOES.forEach((r, i) => escreverDireita(pagina, NOMES_REFEICOES[r], direitaRefeicao(i), y, negrito, TAMANHO_TABELA, CINZA));
        escreverDireita(pagina, 'Total do dia', DIREITA_TOTAL, y, negrito, TAMANHO_TABELA, CINZA);
        y -= 6;
        linhaHorizontal();
    }

    // quebra de página no meio da tabela: a página nova repete quem é e o cabeçalho
    function garantirEspaco(altura: number, repetirCabecalho: boolean) {
        if (y - altura >= MARGEM) return;
        pagina = pdf.addPage(A4);
        y = A4[1] - MARGEM - 10;
        escrever(pagina, caber(normal, `${empresa.nome} — ${titulo} (continuação)`, 10, LARGURA_UTIL), MARGEM, y, normal, 10, CINZA);
        y -= 10;
        if (repetirCabecalho) cabecalhoTabela();
    }

    // título
    y -= 18;
    pagina.drawText(caber(negrito, empresa.nome, 18, LARGURA_UTIL), { x: MARGEM, y, font: negrito, size: 18, color: TINTA });
    y -= 22;
    escrever(pagina, titulo, MARGEM, y, normal, 12, CINZA);
    y -= 16;

    // uma linha por dia
    cabecalhoTabela();
    if (ordenados.length === 0) {
        y -= ALTURA_LINHA;
        escrever(pagina, 'Nenhum dia lançado neste mês.', MARGEM, y, normal, TAMANHO_TABELA, CINZA);
    }
    for (const { lancamento: l } of ordenados) {
        garantirEspaco(ALTURA_LINHA, true);
        y -= ALTURA_LINHA;
        escrever(pagina, `${formatarData(l.data)} ${diaDaSemana(l.data)}`, MARGEM, y, normal, TAMANHO_TABELA);
        REFEICOES.forEach((r, i) => escreverDireita(pagina, inteiro.format(l.quantidades[r]), direitaRefeicao(i), y, normal, TAMANHO_TABELA));
        escreverDireita(pagina, formatarCentavos(l.totalCentavos), DIREITA_TOTAL, y, normal, TAMANHO_TABELA);
    }
    garantirEspaco(ALTURA_LINHA + 8, true);
    y -= 6;
    linhaHorizontal(TINTA);
    y -= ALTURA_LINHA - 4;
    escrever(pagina, 'Total', MARGEM, y, negrito, TAMANHO_TABELA);
    REFEICOES.forEach((r, i) => escreverDireita(pagina, inteiro.format(resumo.quantidades[r]), direitaRefeicao(i), y, negrito, TAMANHO_TABELA));
    escreverDireita(pagina, formatarCentavos(resumo.totalCentavos), DIREITA_TOTAL, y, negrito, TAMANHO_TABELA);

    // quantidade e valor por tipo de refeição (bloco inteiro na mesma página)
    const direitaQtd = MARGEM + 300;
    const direitaValor = MARGEM + 420;
    garantirEspaco(36 + ALTURA_LINHA * (REFEICOES.length + 2), false);
    y -= 36;
    escrever(pagina, 'Por tipo de refeição', MARGEM, y, negrito, 12);
    y -= ALTURA_LINHA;
    escreverDireita(pagina, 'Quantidade', direitaQtd, y, negrito, TAMANHO_TABELA, CINZA);
    escreverDireita(pagina, 'Valor', direitaValor, y, negrito, TAMANHO_TABELA, CINZA);
    y -= 6;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: direitaValor, y }, thickness: 0.75, color: LINHA });
    for (const r of REFEICOES) {
        y -= ALTURA_LINHA;
        escrever(pagina, NOMES_REFEICOES[r], MARGEM, y, normal, TAMANHO_TABELA);
        escreverDireita(pagina, inteiro.format(resumo.quantidades[r]), direitaQtd, y, normal, TAMANHO_TABELA);
        escreverDireita(pagina, formatarCentavos(resumo.valores[r]), direitaValor, y, normal, TAMANHO_TABELA);
    }

    // destaque: valor total do mês
    const alturaDestaque = 64;
    garantirEspaco(28 + alturaDestaque, false);
    y -= 28 + alturaDestaque;
    pagina.drawRectangle({ x: MARGEM, y, width: LARGURA_UTIL, height: alturaDestaque, color: DESTAQUE_FUNDO });
    escrever(pagina, 'VALOR TOTAL DO MÊS', MARGEM + 16, y + alturaDestaque / 2 - 5, negrito, 13, DESTAQUE_TINTA);
    escreverDireita(pagina, formatarCentavos(resumo.totalCentavos), MARGEM + LARGURA_UTIL - 16, y + alturaDestaque / 2 - 8, negrito, 22, DESTAQUE_TINTA);

    // depois do resumo, todas as notas em ordem de data
    for (const { lancamento, fotos } of ordenados) {
        await adicionarNotas(pdf, fontes, empresa, lancamento.data, fotos);
    }

    numerarPaginas(pdf, fontes);
    return pdf.save();
}
