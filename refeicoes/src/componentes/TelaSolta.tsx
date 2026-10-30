import type { ReactNode } from 'react';

// Telas fora do app (login, sem acesso, sem conexão): o painel da marca em marinho ao lado do conteúdo
export function TelaSolta({ children }: { children: ReactNode }) {
    return (
        <main className="tela-solta">
            <aside className="painel-marca">
                <img src="/logo-dudu.png" alt="Dudu Bebidas" width={168} height={168} />
                <p>
                    Controle de <strong>refeições</strong> servidas por empresa, com as notas fiscais de cada dia
                    e o fechamento do mês.
                </p>
            </aside>
            <div className="lado-form">
                <div className="cartao-solto">{children}</div>
            </div>
        </main>
    );
}
