/**
 * v8 #12: shared card component with the same glow-on-hover/selected language
 * used on the Character page — use instead of a plain `card-military` div
 * wherever a card can be hovered/selected.
 */
export default function ThemedCard({
  children,
  glow = false,
  selected = false,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  glow?: boolean;
  selected?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const classes = ["card-military", glow ? "card-themed-glow" : "", selected ? "card-themed-selected" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}
