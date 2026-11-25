// The bdap gift box, drawn in SVG with theme colours.
export function GiftArt({ size = 160, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden="true">
      <ellipse cx="80" cy="148" rx="52" ry="7" fill="var(--ink)" opacity="0.12" />
      <rect x="28" y="70" width="104" height="74" rx="10" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
      <rect x="72" y="70" width="16" height="74" fill="var(--sun)" stroke="var(--ink)" strokeWidth="4" />
      <g style={{ transform: open ? "translate(0,-26px) rotate(-14deg)" : "none", transformOrigin: "30px 70px", transition: "transform 420ms var(--ease-pop)" }}>
        <rect x="20" y="50" width="120" height="26" rx="8" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
        <rect x="72" y="50" width="16" height="26" fill="var(--sun)" stroke="var(--ink)" strokeWidth="4" />
        <path d="M80 50 C 60 20, 34 30, 48 46 C 56 54, 72 52, 80 50 Z" fill="var(--sun)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
        <path d="M80 50 C 100 20, 126 30, 112 46 C 104 54, 88 52, 80 50 Z" fill="var(--sun)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <circle cx="44" cy="96" r="4" fill="var(--sun)" />
      <circle cx="116" cy="118" r="4" fill="var(--sun)" />
      <circle cx="110" cy="90" r="3" fill="var(--surface)" />
    </svg>
  );
}
