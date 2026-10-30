// Marca do produto: a logo da Dudu Bebidas (recortada da arte original) e o nome do sistema
export function Marca() {
    return (
        <span className="marca">
            <img src="/logo-dudu.png" alt="" width={40} height={40} />
            <span className="marca-texto">
                <span className="marca-nome">Dudu Bebidas</span>
                <span className="marca-sub">Controle de refeições</span>
            </span>
        </span>
    );
}
