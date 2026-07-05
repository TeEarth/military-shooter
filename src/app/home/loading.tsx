import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function LoadingHome() {
  return (
    <div className="min-h-screen bg-military-darker flex flex-col">
      <div className="bg-military-dark border-b border-military-steel px-4 py-2 flex items-center justify-between">
        <SkeletonBlock className="w-32 h-6" />
        <SkeletonBlock className="w-40 h-6" />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <SkeletonBlock className="w-72 h-8 mb-8" />
        <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}
