import { Fragment } from 'react';

// "Café da manhã 9 · Almoço 24 · …" com cada item sem quebra; o separador vai junto do item seguinte
export function Itens({ itens }: { itens: string[] }) {
    return (
        <>
            {itens.map((t, i) => (
                <Fragment key={i}>
                    {i > 0 && ' '}
                    <span className="item">{i > 0 ? `· ${t}` : t}</span>
                </Fragment>
            ))}
        </>
    );
}
