import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function LoadingCharacter() {
  return (
    <div className="min-h-screen bg-military-darker p-6">
      <div className="flex items-center gap-4 mb-6">
        <SkeletonBlock className="w-16 h-4" />
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest opacity-50">Characters</h1>
      </div>
      <div className="flex gap-6 max-w-6xl mx-auto">
        <div className="w-48 space-y-2 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14" />
          ))}
        </div>
        <SkeletonBlock className="flex-1 h-96" />
      </div>
    </div>
  );
}
