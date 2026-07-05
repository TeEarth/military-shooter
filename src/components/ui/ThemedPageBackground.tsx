/**
 * v8 #12: shared page-background treatment extracted from the Character page
 * (v7 #5's gradient/glow look) — use this instead of a plain
 * `min-h-screen bg-military-darker` div so every page shares the same base look.
 */
export default function ThemedPageBackground({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`page-bg-themed ${className}`}>{children}</div>;
}
