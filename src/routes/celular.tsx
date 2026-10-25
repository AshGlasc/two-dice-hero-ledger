import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, GROUP, inConversation, NPC, transferError } from "@/lib/phone";
import { getPlayerCharacterId } from "@/lib/player-character";
import { charactersQuery, messagesQuery, type Character, type Message } from "@/lib/rpg-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/celular")({
  head: () => ({
    meta: [
      { title: "Celular — Eco dos Caídos" },
      { name: "description", content: "Celular do personagem: dinheiro, Pix e mensagens com a mesa." },
      { property: "og:title", content: "Celular — Eco dos Caídos" },
      { property: "og:description", content: "Dinheiro, Pix e mensagens entre os personagens da mesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(charactersQuery),
      context.queryClient.ensureQueryData(messagesQuery),
    ]),
  component: PhonePage,
});

type Screen = { app: "home" } | { app: "bank" } | { app: "chats" } | { app: "chat"; with: string };

const FUTURE_APPS = [
  { emoji: "📷", name: "Câmera" },
  { emoji: "🗺️", name: "Mapa" },
  { emoji: "📰", name: "Notícias" },
  { emoji: "📻", name: "Rádio" },
];

function PhonePage() {
  const { data: characters } = useSuspenseQuery(charactersQuery);
  const { data: messages } = useSuspenseQuery(messagesQuery);
  const { isMaster } = useMasterAuth();
  const [myId, setMyId] = useState<string | null>(null);
  const [asNpc, setAsNpc] = useState(false);
  const [npcName, setNpcName] = useState("Desconhecido");
  const [screen, setScreen] = useState<Screen>({ app: "home" });

  useEffect(() => setMyId(getPlayerCharacterId()), []);
  useEffect(() => {
    if (!isMaster) setAsNpc(false);
  }, [isMaster]);

  const me = characters.find((c) => c.id === myId) ?? null;
  const npcMode = isMaster && asNpc;

  return (
    <main className="mx-auto max-w-md px-3 py-4 md:py-8">
      {isMaster && (
        <div className="mb-3 space-y-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          <p className="label-caps text-primary">Mestre: usar o celular como</p>
          <select
            className="h-9 w-full rounded-md border border-border bg-card px-2"
            value={npcMode ? NPC : (myId ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              setScreen({ app: "home" });
              if (v === NPC) setAsNpc(true);
              else {
                setAsNpc(false);
                setMyId(v || null);
              }
            }}
          >
            <option value="">Escolha…</option>
            <option value={NPC}>🎭 Um NPC (mensagens anônimas)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {npcMode && (
            <Input value={npcName} onChange={(e) => setNpcName(e.target.value)} placeholder="Nome do NPC" aria-label="Nome do NPC" />
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-[2.2rem] border-4 border-foreground/20 bg-card shadow-paint">
        <div className="flex items-center justify-between bg-background/70 px-5 py-2 text-xs text-muted-foreground">
          <Clock />
          <span>{npcMode ? `🎭 ${npcName}` : (me?.name ?? "Sem chip")}</span>
          <span>📶 🔋</span>
        </div>

        <div className="min-h-[560px]">
          {!me && !npcMode ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-5xl">📵</p>
              <p className="font-display text-2xl font-bold uppercase">Sem personagem</p>
              <p className="text-sm text-muted-foreground">
                {isMaster ? "Escolha acima de quem é este celular." : "Crie ou abra a sua ficha neste aparelho para usar o celular."}
              </p>
              {!isMaster && (
                <Button asChild variant="paint">
                  <Link to="/">Ir para as fichas</Link>
                </Button>
              )}
            </div>
          ) : screen.app === "home" ? (
            <Home me={me} npcMode={npcMode} messages={messages} open={setScreen} />
          ) : screen.app === "bank" && me ? (
            <Bank me={me} characters={characters} messages={messages} back={() => setScreen({ app: "home" })} />
          ) : screen.app === "chats" ? (
            <Chats
              me={me}
              npcMode={npcMode}
              characters={characters}
              messages={messages}
              back={() => setScreen({ app: "home" })}
              open={(w) => setScreen({ app: "chat", with: w })}
            />
          ) : screen.app === "chat" ? (
            <Chat
              me={me}
              npcMode={npcMode}
              npcName={npcName}
              other={screen.with}
              characters={characters}
              messages={messages}
              back={() => setScreen({ app: "chats" })}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Clock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular">{now}</span>;
}

function AppHeader({ title, back }: { title: string; back: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Button size="icon" variant="ghost" className="size-8" onClick={back} aria-label="Voltar">
        <ArrowLeft />
      </Button>
      <p className="truncate font-display text-xl font-bold uppercase">{title}</p>
    </div>
  );
}

function Home({
  me,
  npcMode,
  messages,
  open,
}: {
  me: Character | null;
  npcMode: boolean;
  messages: Message[];
  open: (s: Screen) => void;
}) {
  const incoming = me ? messages.filter((m) => m.to_character_id === me.id && m.from_character_id !== me.id).length : 0;
  return (
    <div className="space-y-6 p-5">
      {me && !npcMode && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-center">
          <p className="label-caps text-warning">Saldo</p>
          <p className="tabular font-display text-5xl font-bold">{formatMoney(me.money)}</p>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <AppIcon emoji="💬" name="Mensagens" badge={incoming} onClick={() => open({ app: "chats" })} />
        {me && !npcMode && <AppIcon emoji="💸" name="Banco" onClick={() => open({ app: "bank" })} />}
        {FUTURE_APPS.map((a) => (
          <AppIcon key={a.name} emoji={a.emoji} name={a.name} disabled onClick={() => toast("Em breve neste celular.")} />
        ))}
      </div>
    </div>
  );
}

function AppIcon({
  emoji,
  name,
  badge,
  disabled,
  onClick,
}: {
  emoji: string;
  name: string;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1", disabled && "opacity-45")}>
      <span className="relative grid size-14 place-items-center rounded-2xl border border-border bg-muted text-3xl shadow-paint">
        {emoji}
        {!!badge && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[11px] text-muted-foreground">{name}</span>
    </button>
  );
}

function Bank({
  me,
  characters,
  messages,
  back,
}: {
  me: Character;
  characters: Character[];
  messages: Message[];
  back: () => void;
}) {
  const qc = useQueryClient();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const others = characters.filter((c) => c.id !== me.id);
  const history = messages
    .filter((m) => m.kind === "pix" && (m.from_character_id === me.id || m.to_character_id === me.id))
    .reverse();

  const pix = useMutation({
    mutationFn: async () => {
      const value = Math.round(Number(amount));
      const err = transferError(me.money, value, me.id, to || null);
      if (err) throw new Error(err);
      const { error } = await supabase.rpc("transfer_money", { _from: me.id, _to: to, _amount: value, _note: note });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Pix enviado!");
      setAmount("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["characters"] });
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const nameOf = (id: string | null) => characters.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <AppHeader title="Banco" back={back} />
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-center">
          <p className="label-caps text-warning">Saldo de {me.name}</p>
          <p className="tabular font-display text-5xl font-bold">{formatMoney(me.money)}</p>
        </div>
        <form
          className="space-y-2 rounded-xl border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            pix.mutate();
          }}
        >
          <p className="label-caps text-primary">Fazer Pix</p>
          <select
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Para quem"
          >
            <option value="">Para quem?</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Input type="number" inputMode="numeric" min={1} placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Valor" />
          <Input placeholder="Mensagem (opcional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Mensagem do Pix" />
          <Button type="submit" variant="paint" className="w-full" disabled={pix.isPending}>
            💸 Enviar
          </Button>
        </form>
        <div>
          <p className="label-caps mb-1 text-muted-foreground">Extrato</p>
          {history.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Nenhuma transferência ainda.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((m) => {
                const out = m.from_character_id === me.id;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{out ? `Para ${nameOf(m.to_character_id)}` : `De ${nameOf(m.from_character_id)}`}</span>
                      {m.body && <span className="block truncate text-xs text-muted-foreground">“{m.body}”</span>}
                    </span>
                    <span className={cn("tabular shrink-0 font-bold", out ? "text-destructive" : "text-success")}>
                      {out ? "−" : "+"}
                      {formatMoney(m.amount ?? 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function threadKeyMessages(messages: Message[], me: Character | null, npcMode: boolean, other: string) {
  if (npcMode) {
    // Mestre como NPC: grupo, ou a conversa NPC de cada personagem.
    if (other === GROUP) return messages.filter((m) => m.to_character_id === null && m.kind === "text");
    return messages.filter((m) => m.kind === "text" && inConversation(m, other, NPC));
  }
  return messages.filter((m) => m.kind === "text" && inConversation(m, me?.id ?? null, other));
}

function Chats({
  me,
  npcMode,
  characters,
  messages,
  back,
  open,
}: {
  me: Character | null;
  npcMode: boolean;
  characters: Character[];
  messages: Message[];
  back: () => void;
  open: (w: string) => void;
}) {
  const threads = [
    { id: GROUP, name: "Grupo da mesa", avatar: "", emoji: "👥" },
    ...(npcMode ? [] : [{ id: NPC, name: "Número desconhecido", avatar: "", emoji: "🎭" }]),
    ...characters.filter((c) => c.id !== me?.id).map((c) => ({ id: c.id, name: c.name, avatar: c.avatar_url, emoji: "" })),
  ];
  return (
    <div>
      <AppHeader title="Mensagens" back={back} />
      <ul className="divide-y divide-border">
        {threads.map((t) => {
          const list = threadKeyMessages(messages, me, npcMode, t.id);
          const last = list[list.length - 1];
          return (
            <li key={t.id}>
              <button type="button" onClick={() => open(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                {t.emoji ? (
                  <span className="grid size-10 place-items-center rounded-full bg-muted text-xl">{t.emoji}</span>
                ) : (
                  <Avatar src={t.avatar} name={t.name} className="size-10" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {last ? `${last.from_name}: ${last.body}` : "Sem mensagens"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Chat({
  me,
  npcMode,
  npcName,
  other,
  characters,
  messages,
  back,
}: {
  me: Character | null;
  npcMode: boolean;
  npcName: string;
  other: string;
  characters: Character[];
  messages: Message[];
  back: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const list = useMemo(() => threadKeyMessages(messages, me, npcMode, other), [messages, me, npcMode, other]);
  const title =
    other === GROUP ? "Grupo da mesa" : other === NPC ? "Número desconhecido" : (characters.find((c) => c.id === other)?.name ?? "Conversa");

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [list.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const row = npcMode
        ? { from_character_id: null, from_name: npcName.trim() || "Desconhecido", to_character_id: other === GROUP ? null : other, body }
        : {
            from_character_id: me!.id,
            from_name: me!.name,
            // Resposta ao NPC fica endereçada a si mesmo (só o mestre e o jogador veem).
            to_character_id: other === GROUP ? null : other === NPC ? me!.id : other,
            body,
          };
      const { error } = await supabase.from("messages").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
    onError: () => toast.error("Mensagem não enviada."),
  });

  const isMine = (m: Message) => (npcMode ? m.from_character_id === null : m.from_character_id === me?.id);

  return (
    <div className="flex h-[560px] flex-col">
      <AppHeader title={title} back={back} />
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {list.length === 0 && <p className="py-10 text-center text-sm italic text-muted-foreground">Nenhuma mensagem ainda.</p>}
        {list.map((m) => (
          <div key={m.id} className={cn("flex", isMine(m) ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                isMine(m) ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
              )}
            >
              {!isMine(m) && <p className="text-[11px] font-bold opacity-80">{m.from_name || "Desconhecido"}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="mt-0.5 text-right text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          send.mutate(body);
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" aria-label="Mensagem" />
        <Button type="submit" size="icon" aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </div>
  );
}
