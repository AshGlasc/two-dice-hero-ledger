import { setSilentRoll, useSilentRoll } from "@/lib/silent-roll";
import { cn } from "@/lib/utils";

/** Botãozinho no canto: liga/desliga a rolagem silenciosa deste navegador. */
export function SilentRollToggle() {
  const silent = useSilentRoll();
  return (
    <button
      type="button"
      onClick={() => setSilentRoll(!silent)}
      aria-pressed={silent}
      title={silent ? "Rolagem silenciosa ligada: só você e o mestre veem" : "Ligar rolagem silenciosa"}
      className={cn(
        "fixed bottom-20 left-3 z-40 flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-paint transition-colors md:bottom-4",
        silent
          ? "border-primary bg-primary/20 text-primary"
          : "border-border bg-background/80 text-muted-foreground hover:text-foreground",
      )}
    >
      <span aria-hidden>{silent ? "🤫" : "🎲"}</span>
      {silent ? "Silenciosa" : "Pública"}
    </button>
  );
}
