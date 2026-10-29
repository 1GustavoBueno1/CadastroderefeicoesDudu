const LADO_MAXIMO = 1600;
const QUALIDADES = [0.75, 0.6, 0.45];
// abaixo do limite de 1.000.000 da regra fotoValida, com folga
const TAMANHO_MAXIMO = 900_000;
const REDUCOES_MAXIMAS = 6;
const FATOR_REDUCAO = 0.75;

// Foto (de celular ou não) → data URL JPEG pequeno o bastante para caber num documento do Firestore
export async function comprimirImagem(arquivo: File): Promise<string> {
    let bitmap: ImageBitmap;
    try {
        // 'from-image' aplica o EXIF: foto de celular tirada em pé não fica deitada
        bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch {
        throw new Error('Não foi possível abrir a foto.');
    }

    try {
        const maiorLado = Math.max(bitmap.width, bitmap.height);
        let lado = Math.min(LADO_MAXIMO, maiorLado);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível comprimir a foto.');

        for (let reducao = 0; reducao <= REDUCOES_MAXIMAS; reducao++) {
            const escala = lado / maiorLado;
            canvas.width = Math.max(1, Math.round(bitmap.width * escala));
            canvas.height = Math.max(1, Math.round(bitmap.height * escala));
            // JPEG não tem transparência: sem o fundo branco, PNG transparente vira preto
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

            for (const qualidade of QUALIDADES) {
                const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
                if (dataUrl.length <= TAMANHO_MAXIMO) return dataUrl;
            }
            lado = Math.floor(lado * FATOR_REDUCAO);
        }
        throw new Error('Não foi possível comprimir a foto.');
    } finally {
        bitmap.close();
    }
}
