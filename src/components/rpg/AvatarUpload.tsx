import { Camera, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { fileToSmallImage, initials } from "@/lib/image";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
  tone = "player",
}: {
  src?: string | null;
  name: string;
  className?: string;
  tone?: "player" | "monster" | undefined;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-muted font-display font-bold uppercase",
        tone === "monster" ? "border-destructive text-destructive" : "border-primary text-primary",
        className,
      )}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

/** Rosto do personagem/monstro: toque para trocar a foto. */
export function AvatarUpload({
  src,
  name,
  onChange,
  tone,
}: {
  src: string;
  name: string;
  onChange: (dataUrl: string) => void;
  tone?: "player" | "monster";
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative block rounded-full"
        aria-label={`Trocar rosto de ${name}`}
      >
        <Avatar src={src} name={name} tone={tone} className="size-24 text-3xl md:size-28" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="size-6" />
        </span>
        {!src && (
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Camera className="size-4" />
          </span>
        )}
      </button>
      {src && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-destructive"
          aria-label="Remover rosto"
        >
          <X className="size-4" />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onChange(await fileToSmallImage(file, 160, 0.82));
          } catch {
            toast.error("Não consegui abrir essa imagem.");
          }
        }}
      />
    </div>
  );
}
