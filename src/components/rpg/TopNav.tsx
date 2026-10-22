import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";

const linkClass =
  "font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="font-display text-2xl font-bold uppercase tracking-wide">
          Fungo <span className="text-primary">Disco</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link to="/" className={linkClass} activeOptions={{ exact: true }}>
            Personagens
          </Link>
          <Link to="/mestre" className={linkClass}>
            Painel do mestre
          </Link>
          <span className="hidden items-center gap-1.5 text-xs text-success sm:flex" title="Tudo atualiza ao vivo para todos">
            <Radio className="size-3.5" /> Ao vivo
          </span>
        </nav>
      </div>
    </header>
  );
}
