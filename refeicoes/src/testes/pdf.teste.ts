import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { gerarPdfDia, gerarPdfMes, resumirMes } from '../lib/pdf';
import { baixarArquivo, nomeDeArquivo } from '../lib/download';
import { formatarCentavos } from '../lib/dinheiro';
import { calcularTotal, type Empresa, type Foto, type ItensDoDia, type Lancamento } from '../types';

function confere(descricao: string, ok: boolean, detalhe?: unknown) {
  console.log(ok ? '✅' : '❌', descricao, detalhe ?? '');
}

// nota falsa desenhada num canvas (retrato ou paisagem), já como JPEG
function notaFalsa(largura: number, altura: number, texto: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largura, altura);
  ctx.strokeStyle = '#b8336a';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, largura - 12, altura - 12);
  ctx.fillStyle = '#1a1216';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(texto, 40, 90);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function doisDigitos(n: number) {
  return String(n).padStart(2, '0');
}

// Extrai os textos desenhados com as fontes padrão (<hex> Tj, codificação WinAnsi) de todas as páginas
async function lerPdf(bytes: Uint8Array): Promise<{ paginas: number; textos: string[] }> {
  const doc = await PDFDocument.load(bytes);
  const winAnsi: Record<number, string> = { 0x85: '…', 0x96: '–', 0x97: '—' };
  const textos: string[] = [];
  for (const [, objeto] of doc.context.enumerateIndirectObjects()) {
    if (!(objeto instanceof PDFRawStream)) continue;
    let conteudo: Uint8Array;
    try {
      conteudo = decodePDFRawStream(objeto).decode();
    } catch {
      continue; // imagens (DCTDecode) e afins
    }
    const fonte = Array.from(conteudo, (b) => String.fromCharCode(b)).join('');
    for (const m of fonte.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
      let t = '';
      for (let i = 0; i < m[1].length; i += 2) {
        const b = parseInt(m[1].slice(i, i + 2), 16);
        t += winAnsi[b] ?? String.fromCharCode(b);
      }
      textos.push(t);
    }
  }
  return { paginas: doc.getPageCount(), textos };
}

export async function rodarTestePdf() {
  console.log('--- PDF ---');
  const empresa: Empresa = { id: 'teste', nome: 'Construtora Alfa & Filhos Ltda.', ativa: true };

  // um dia de outubro com muitos itens de nome comprido: nada pode ser cortado na tabela
  const LONGOS = Array.from({ length: 25 }, (_, n) =>
    `Item de nome bem comprido número ${n + 1} (embalagem família, sabor especial)`);
  const DIA_LONGO = 14;

  // 40 dias (01/10 → 09/11), com uma nota em novembro, para provar que o PDF de outubro deixa novembro de fora;
  // o preço muda no meio do período, para provar que o PDF usa o preço gravado em cada dia,
  // e a coca é renomeada no meio do mês, para provar que o "Por item" agrupa pelo id
  const dias: { lancamento: Lancamento; fotos: Foto[] }[] = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(2026, 9, 1 + i); // construtor local, sem fuso
    const data = `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
    const caro = i >= 20;
    const itens: ItensDoDia = {
      marmita: { nome: 'Marmita', quantidade: 20 + (i % 11), precoCentavos: caro ? 2450 : 2200 },
      coca: { nome: i < 10 ? 'Coca' : 'Coca lata', quantidade: 5 + (i % 7), precoCentavos: caro ? 650 : 600 },
    };
    // um dia só com coca, como no uso real
    if (i === 3) delete itens.marmita;
    if (i === DIA_LONGO) LONGOS.forEach((nome, n) => { itens[`longo${n}`] = { nome, quantidade: n + 1, precoCentavos: 100 }; });
    const fotos: Foto[] = [];
    if (i === 2) fotos.push({ id: 'a', dataUrl: notaFalsa(600, 900, `Nota dia ${i + 1}`), ordem: 1 });
    if (i === 10) {
      fotos.push({ id: 'c', dataUrl: notaFalsa(900, 600, 'Nota 2 (paisagem)'), ordem: 2 });
      fotos.push({ id: 'b', dataUrl: notaFalsa(600, 900, 'Nota 1 (retrato)'), ordem: 1 });
    }
    if (i === 35) fotos.push({ id: 'd', dataUrl: notaFalsa(500, 1200, `Nota dia ${i + 1}`), ordem: 1 });
    dias.push({ lancamento: { data, itens, totalCentavos: calcularTotal(itens), qtdFotos: fotos.length }, fotos });
  }
  // os 40 dias vão de 01/10 a 09/11: o PDF de outubro só pode trazer os 31 dias e as notas de outubro
  const outubro = dias.filter((d) => d.lancamento.data.startsWith('2026-10-'));
  const novembro = dias.filter((d) => d.lancamento.data.startsWith('2026-11-'));
  const totalFotos = outubro.reduce((s, d) => s + d.fotos.length, 0);
  const somaTotais = outubro.reduce((s, d) => s + d.lancamento.totalCentavos, 0);
  const paraData = (data: string) => data.split('-').reverse().join('/');

  // resumo: o total bate com a soma dos totalCentavos e com a soma por item
  const resumo = resumirMes(outubro.map((d) => d.lancamento));
  confere('resumo: total === soma dos totalCentavos', resumo.totalCentavos === somaTotais, formatarCentavos(resumo.totalCentavos));
  const somaPorItem = resumo.porItem.reduce((s, i) => s + i.valorCentavos, 0);
  confere('resumo: soma dos valores por item === total', somaPorItem === somaTotais, formatarCentavos(somaPorItem));
  const marmita = resumo.porItem.find((i) => i.itemId === 'marmita')!;
  confere('resumo usa o preço de cada dia, não o atual', marmita.valorCentavos !== marmita.quantidade * 2450,
    `${formatarCentavos(marmita.valorCentavos)} ≠ ${formatarCentavos(marmita.quantidade * 2450)}`);
  const cocas = resumo.porItem.filter((i) => i.itemId === 'coca');
  confere('resumo: coca renomeada aparece uma vez, com o nome mais recente', cocas.length === 1 && cocas[0].nome === 'Coca lata', cocas);

  // PDF do mês: recebe os 40 dias, mas é o de outubro
  const pdfMes = await gerarPdfMes(empresa, '2026-10', dias);
  const mes = await lerPdf(pdfMes);
  const paginasResumo = mes.paginas - totalFotos;
  // 31 linhas + o dia comprido não cabem numa página; o bloco "Por item" e o destaque passam para a seguinte
  confere('PDF do mês: resumo quebrou em 2+ páginas', paginasResumo >= 2, `${paginasResumo} de resumo`);
  confere('PDF do mês: uma página por nota de outubro (3), sem a de novembro',
    totalFotos === 3 && mes.paginas === paginasResumo + 3, `${mes.paginas} páginas`);
  confere('PDF do mês: tem "VALOR TOTAL DO MÊS"', mes.textos.includes('VALOR TOTAL DO MÊS'));
  confere('PDF do mês: tem o bloco "Por item"', mes.textos.includes('Por item'));
  const totalImpresso = formatarCentavos(somaTotais);
  const vezes = mes.textos.filter((t) => t === totalImpresso).length;
  // aparece na linha de total da tabela e no destaque
  confere('PDF do mês: total impresso === soma dos totalCentavos de outubro', vezes >= 2, `${totalImpresso} aparece ${vezes}x`);
  confere('PDF do mês: os 31 dias de outubro na tabela',
    outubro.length === 31 && outubro.every((d) => mes.textos.some((t) => t.startsWith(paraData(d.lancamento.data)))));
  confere('PDF do mês: nenhum dia de novembro na tabela',
    novembro.every((d) => !mes.textos.some((t) => t.includes(paraData(d.lancamento.data)))));
  confere('PDF do mês: nenhuma nota de novembro', !mes.textos.some((t) => t.includes('/11/2026 — nota')));
  const legenda = `${empresa.nome} — 11/10/2026 — nota 1 de 2`;
  confere('PDF do mês: legenda das notas', mes.textos.includes(legenda), legenda);

  // nada cortado: a quebra de linha pode partir o texto em qualquer espaço, então compara sem espaços e sem "·"
  confere('PDF do mês: nenhum texto cortado com "…"', !mes.textos.some((t) => t.includes('…')), mes.textos.filter((t) => t.includes('…')));
  const semEspacos = (t: string) => t.replace(/[\s·]/g, '');
  const tudo = semEspacos(mes.textos.join(''));
  const faltando = LONGOS.filter((nome, n) => !tudo.includes(semEspacos(`${nome} ${n + 1}`)));
  confere('PDF do mês: todos os 25 itens compridos aparecem inteiros, com a quantidade', faltando.length === 0, faltando);

  // as notas vêm depois do resumo, em ordem de data
  const posNota = (t: string) => mes.textos.findIndex((x) => x.startsWith(`${empresa.nome} — ${t}`));
  const posDestaque = mes.textos.indexOf('VALOR TOTAL DO MÊS');
  confere('PDF do mês: notas depois do resumo, em ordem de data',
    posDestaque < posNota('03/10/2026') && posNota('03/10/2026') < posNota('11/10/2026'));

  // PDF do dia (2 notas, a de ordem 1 primeiro)
  const dia = dias[10];
  const pdfDia = await gerarPdfDia(empresa, dia.lancamento, dia.fotos);
  const lidoDia = await lerPdf(pdfDia);
  confere('PDF do dia: 2 páginas', lidoDia.paginas === 2, lidoDia.paginas);
  confere('PDF do dia: legendas "nota 1 de 2" e "nota 2 de 2"',
    lidoDia.textos.includes(`${empresa.nome} — 11/10/2026 — nota 1 de 2`) && lidoDia.textos.includes(`${empresa.nome} — 11/10/2026 — nota 2 de 2`));

  // nome do arquivo
  const nome = nomeDeArquivo(['Construtora Alfa', '2026-10']);
  confere('nomeDeArquivo sem acentos e espaços', nome === 'construtora-alfa-2026-10.pdf', nome);
  const nomeAcentos = nomeDeArquivo(['Refeições São João & Cia.', '2026-10-05']);
  confere('nomeDeArquivo tira acentos e símbolos', nomeAcentos === 'refeicoes-sao-joao-cia-2026-10-05.pdf', nomeAcentos);

  // para conferir visualmente
  baixarArquivo(pdfMes, nomeDeArquivo(['teste', empresa.nome, '2026-10']));
  baixarArquivo(pdfDia, nomeDeArquivo(['teste', empresa.nome, dia.lancamento.data]));
  console.log('📄 baixei 2 PDFs de exemplo (mês e dia) para conferência visual');
}
