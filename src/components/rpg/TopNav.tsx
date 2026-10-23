import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Radio, Skull, Theater, Users } from "lucide-react";

import { RollDrawer } from "@/components/rpg/RollDrawer";

const LINKS = [
  { to: "/", label: "Personagens", short: "Fichas", icon: Users, exact: true },
  { to: "/bestiario", label: "Bestiário", short: "Monstros", icon: Skull, exact: false },
  { to: "/combate", label: "Combate", short: "Combate", icon: MapIcon, exact: false },
  { to: "/mestre", label: "Mestre", short: "Mestre", icon: Theater, exact: false },
] as const;

const linkClass =
  "font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary";

export function TopNav() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="font-display text-2xl font-bold uppercase tracking-wide">
            Fungo <span className="text-primary">Disco</span>
          </Link>
          <nav className="hidden items-center gap-5 md:flex">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass} activeOptions={{ exact: l.exact }}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-success lg:flex" title="Tudo atualiza ao vivo para todos">
              <Radio className="size-3.5" /> Ao vivo
            </span>
            <RollDrawer />
          </div>
        </div>
      </header>

      {/* Barra de baixo no celular */}
      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.exact }}
            className="flex flex-col items-center gap-0.5 py-2 font-display text-[11px] font-semibold uppercase tracking-wider text-muted-foreground data-[status=active]:text-primary"
          >
            <l.icon className="size-5" />
            {l.short}
          </Link>
        ))}
      </nav>
    </>
  );
}
