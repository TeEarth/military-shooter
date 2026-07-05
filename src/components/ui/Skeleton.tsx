export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`bg-military-dark border border-military-steel animate-pulse ${className}`} />;
}

export function SkeletonPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-military-darker p-6">
      <div className="flex items-center gap-4 mb-6">
        <SkeletonBlock className="w-16 h-4" />
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest opacity-50">{title}</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
