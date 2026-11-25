// The bdap gift box, as in the blueprint: pink box, sun ribbon and bow.
// When `open`, the lid and bow fly off.
export function GiftArt({ size = 170, open = false }: { size?: number; open?: boolean }) {
  const s = size / 170;
  const fly = open ? "translate(40px,-60px) rotate(25deg)" : "none";
  const lidStyle = { transform: fly, opacity: open ? 0 : 1, transition: "transform 600ms var(--ease-pop), opacity 600ms" };
  return (
    <span aria-hidden="true" className="relative block" style={{ width: size, height: size }}>
    <span className="absolute left-0 top-0 block" style={{ width: 170, height: 170, transform: `scale(${s})`, transformOrigin: "top left" }}>
      <span className="absolute bottom-0 left-[15px] right-[15px] h-[110px] rounded-sm bg-accent" />
      <span className="absolute bottom-0 left-1/2 top-[30px] w-[22px] -translate-x-1/2 bg-sun" />
      <span className="absolute left-[5px] right-[5px] top-[30px] h-9 rounded-sm bg-accent-soft" style={lidStyle} />
      <span className="absolute left-1/2 top-[30px] h-9 w-[22px] -translate-x-1/2 bg-sun" style={lidStyle} />
      <span className="absolute left-1/2 top-1 h-[30px] w-[60px] -translate-x-1/2" style={lidStyle}>
        <span className="absolute left-0 top-0 h-7 w-7 border-[7px] border-sun" style={{ borderRadius: "50% 50% 0 50%" }} />
        <span className="absolute right-0 top-0 h-7 w-7 -scale-x-100 border-[7px] border-sun" style={{ borderRadius: "50% 50% 0 50%" }} />
      </span>
    </span>
    </span>
  );
}
