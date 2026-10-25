import { Link } from "@tanstack/react-router";
import { Crown, Lock, LogOut, Map as MapIcon, Radio, Skull, Smartphone, Theater, Users } from "lucide-react";

import { RollDrawer } from "@/components/rpg/RollDrawer";
import { MasterUnlockModal } from "@/components/rpg/MasterUnlockModal";
import { ChangePinDialog } from "@/components/rpg/ChangePinDialog";
import { useMasterAuth } from "@/context/MasterAuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const LINKS = [
  { to: "/", label: "Personagens", short: "Fichas", icon: Users, exact: true, restricted: false },
  { to: "/bestiario", label: "Bestiário", short: "Monstros", icon: Skull, exact: false, restricted: false },
  { to: "/combate", label: "Combate", short: "Combate", icon: MapIcon, exact: false, restricted: false },
  { to: "/celular", label: "Celular", short: "Celular", icon: Smartphone, exact: false, restricted: false },
  { to: "/mestre", label: "Mestre", short: "Mestre", icon: Theater, exact: false, restricted: true },
] as const;

const linkClass =
  "font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary flex items-center gap-1.5";

export function TopNav() {
  const { isMaster, lock } = useMasterAuth();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="font-display text-2xl font-bold uppercase tracking-wide">
            Eco dos <span className="text-primary">Caídos</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass} activeOptions={{ exact: l.exact }}>
                <span>{l.label}</span>
                {l.restricted && (
                  isMaster ? (
                    <span title="Mestre autenticado"><Crown className="size-3 text-primary animate-pulse" /></span>
                  ) : (
                    <span title="Acesso restrito ao mestre"><Lock className="size-3 text-muted-foreground/70" /></span>
                  )
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {/* Status do Mestre */}
            {isMaster ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-primary/40 bg-primary/10 text-xs font-semibold uppercase text-primary hover:bg-primary/20"
                  >
                    <Crown className="size-3.5" /> Mestre Ativo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                    Controle de Acesso
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to="/mestre" className="cursor-pointer font-medium">
                      <Theater className="mr-2 size-4" /> Painel do Mestre
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <ChangePinDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs font-normal"
                        >
                          Alterar PIN de Acesso
                        </Button>
                      }
                    />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={lock}
                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut className="mr-2 size-4" /> Bloquear Modo Mestre
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <MasterUnlockModal
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:border hover:border-border hover:text-foreground"
                    title="Acesso exclusivo do mestre"
                  >
                    <Lock className="size-3.5" /> Acesso Mestre
                  </Button>
                }
              />
            )}

            <span
              className="hidden items-center gap-1.5 text-xs text-success lg:flex"
              title="Tudo atualiza ao vivo para todos"
            >
              <Radio className="size-3.5" /> Ao vivo
            </span>
            <RollDrawer />
          </div>
        </div>
      </header>

      {/* Barra de baixo no celular */}
      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.exact }}
            className="relative flex flex-col items-center gap-0.5 py-2 font-display text-[10px] font-semibold uppercase tracking-wider text-muted-foreground data-[status=active]:text-primary"
          >
            <div className="relative">
              <l.icon className="size-5" />
              {l.restricted && (
                <span className="absolute -right-1.5 -top-1">
                  {isMaster ? (
                    <Crown className="size-3 text-primary" />
                  ) : (
                    <Lock className="size-2.5 text-muted-foreground" />
                  )}
                </span>
              )}
            </div>
            {l.short}
          </Link>
        ))}
      </nav>
    </>
  );
}
