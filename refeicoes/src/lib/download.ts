export function baixarArquivo(bytes: Uint8Array, nome: string, tipo = 'application/pdf'): void {
    // cópia num ArrayBuffer comum: o Blob não aceita uma view sobre SharedArrayBuffer
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: tipo }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // dá tempo para o navegador começar o download antes de liberar a memória
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ['Construtora Alfa', '2026-10'] → 'construtora-alfa-2026-10.pdf'
export function nomeDeArquivo(partes: string[], extensao = 'pdf'): string {
    const base = partes
        .join(' ')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${base || 'arquivo'}.${extensao}`;
}
