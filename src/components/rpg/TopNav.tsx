import { Link, useLocation } from "@tanstack/react-router";
import {
  Crown,
  Lock,
  LogOut,
  Map as MapIcon,
  Package,
  Radio,
  Skull,
  Smartphone,
  Theater,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
import { messagesQuery } from "@/lib/rpg-queries";
import { getPlayerCharacterId } from "@/lib/player-character";
import { unreadPhoneMessages } from "@/lib/phone";

const LINKS = [
  { to: "/", label: "Personagens", short: "Fichas", icon: Users, exact: true, restricted: false },
  {
    to: "/bestiario",
    label: "Bestiário",
    short: "Monstros",
    icon: Skull,
    exact: false,
    restricted: false,
  },
  {
    to: "/combate",
    label: "Combate",
    short: "Combate",
    icon: MapIcon,
    exact: false,
    restricted: false,
  },
  {
    to: "/celular",
    label: "Celular",
    short: "Celular",
    icon: Smartphone,
    exact: false,
    restricted: false,
  },
  {
    to: "/itens",
    label: "Itens",
    short: "Itens",
    icon: Package,
    exact: false,
    restricted: true,
  },
  {
    to: "/mestre",
    label: "Mestre",
    short: "Mestre",
    icon: Theater,
    exact: false,
    restricted: true,
  },
] as const;

const linkClass =
  "font-display text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-primary flex items-center gap-1.5";

export function TopNav() {
  const { isMaster, lock } = useMasterAuth();
  const location = useLocation();
  const { data: messages } = useQuery(messagesQuery);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  useEffect(() => {
    const id = getPlayerCharacterId();
    setCharacterId(id);
    setLastReadAt(id ? localStorage.getItem(`eco_caidos_phone_read_${id}`) : null);
  }, [location.pathname]);

  useEffect(() => {
    if (!characterId || !messages) return;
    const key = `eco_caidos_phone_read_${characterId}`;
    if (!localStorage.getItem(key)) {
      const latest = messages.reduce(
        (time, message) => Math.max(time, Date.parse(message.created_at) || 0),
        0,
      );
      const initialReadAt = new Date(Math.max(Date.now(), latest)).toISOString();
      localStorage.setItem(key, initialReadAt);
      setLastReadAt(initialReadAt);
    }
  }, [characterId, messages]);

  useEffect(() => {
    if (location.pathname !== "/celular" || !characterId) return;
    const readAt = new Date().toISOString();
    localStorage.setItem(`eco_caidos_phone_read_${characterId}`, readAt);
    setLastReadAt(readAt);
  }, [characterId, location.pathname]);

  const unreadCount = unreadPhoneMessages(messages ?? [], characterId, lastReadAt);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="font-display text-2xl font-bold uppercase tracking-wide">
            Eco dos <span className="text-primary">Caídos</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className={linkClass} activeOptions={{ exact: l.exact }}>
                <span>{l.label}</span>
                {l.to === "/celular" && unreadCount > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 text-[10px] leading-4 text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
                {l.restricted &&
                  (isMaster ? (
                    <span title="Mestre autenticado">
                      <Crown className="size-3 text-primary" />
                    </span>
                  ) : (
                    <span title="Acesso restrito ao mestre">
                      <Lock className="size-3 text-muted-foreground/70" />
                    </span>
                  ))}
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
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
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
              {l.to === "/celular" && unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] leading-4 text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
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
