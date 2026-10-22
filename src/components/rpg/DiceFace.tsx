import { cn } from "@/lib/utils";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DiceFace({ value, className }: { value: number; className?: string }) {
  const pips = PIPS[value] ?? [];
  return (
    <div
      role="img"
      aria-label={`Dado: ${value}`}
      className={cn(
        "grid h-16 w-16 animate-dice-in grid-cols-3 grid-rows-3 gap-1 rounded-md border-2 border-foreground/80 bg-foreground p-2 shadow-paint",
        className,
      )}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "m-auto h-2.5 w-2.5 rounded-full",
            pips.includes(i) ? "bg-background" : "bg-transparent",
          )}
        />
      ))}
    </div>
  );
}
