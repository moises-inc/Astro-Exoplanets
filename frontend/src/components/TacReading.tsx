interface TacReadingProps {
  overline: string;
  text: string;
}

export function TacReading({ overline, text }: TacReadingProps) {
  return (
    <aside className="tac-reading">
      <span className="tac-overline">{overline}</span>
      <p className="tac-text">{text}</p>
    </aside>
  );
}
