// Marca do produto: um prato visto de cima, no tom da marca
export function Marca() {
    return (
        <span className="marca">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="11" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="6.5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
            </svg>
            Refeições
        </span>
    );
}
