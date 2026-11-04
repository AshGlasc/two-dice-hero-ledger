import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Newspaper,
  Send,
  Trash2,
  UserPlus,
  Filter,
  Plus,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/rpg/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatMoney, GROUP, inConversation, NPC, transferError } from "@/lib/phone";
import { getPlayerCharacterId } from "@/lib/player-character";
import {
  charactersQuery,
  messagesQuery,
  phoneCluesQuery,
  phoneContactsQuery,
  phoneGalleryQuery,
  type Character,
  type Message,
  type PhoneClue,
  type PhoneContact,
} from "@/lib/rpg-queries";
import { cn } from "@/lib/utils";
import { fileToSmallImage } from "@/lib/image";

export const Route = createFileRoute("/celular")({
  head: () => ({
    meta: [
      { title: "Celular — Eco dos Caídos" },
      {
        name: "description",
        content: "Celular de campanha: banco em rupias, mensagens, pistas e galeria.",
      },
      { property: "og:title", content: "Celular — Eco dos Caídos" },
      { property: "og:description", content: "Rupias, mensagens, notícias e pistas da mesa." },
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

type Screen =
  | { app: "home" }
  | { app: "bank" }
  | { app: "chats" }
  | { app: "chat"; with: string }
  | { app: "news" }
  | { app: "gallery" };

type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

const FUTURE_APPS = [
  { emoji: "🗺️", name: "Mapa" },
  { emoji: "📻", name: "Rádio" },
];

function PhonePage() {
  const [screen, setScreen] = useState<Screen>({ app: "home" });
  const { data: characters } = useSuspenseQuery(charactersQuery);
  const { data: messages } = useSuspenseQuery(messagesQuery);
  const {
    data: contacts = [],
    error: contactsError,
    isPending: contactsPending,
  } = useQuery(phoneContactsQuery);
  const {
    data: clues = [],
    isPending: cluesPending,
    error: cluesError,
  } = useQuery({ ...phoneCluesQuery, enabled: screen.app === "news" });
  const {
    data: photos = [],
    isPending: photosPending,
    error: photosError,
  } = useQuery({ ...phoneGalleryQuery, enabled: screen.app === "gallery" });
  const { isMaster } = useMasterAuth();
  const [myId, setMyId] = useState<string | null>(null);
  const [asNpc, setAsNpc] = useState(false);
  const [npcName, setNpcName] = useState("Desconhecido");
  const [contactName, setContactName] = useState("");
  const [contactTarget, setContactTarget] = useState("");
  const [npcContactId, setNpcContactId] = useState("");
  const qc = useQueryClient();

  useEffect(() => setMyId(getPlayerCharacterId()), []);
  useEffect(() => {
    if (!isMaster) setAsNpc(false);
  }, [isMaster]);

  const me = characters.find((c) => c.id === myId) ?? null;
  const npcMode = isMaster && asNpc;
  const selectedContact = contacts.find((contact) => contact.id === npcContactId) ?? null;
  const phoneMigrationMissing =
    contactsError?.message.includes("phone_contacts") ||
    contactsError?.message.includes("schema cache") ||
    contactsError?.message.includes("does not exist");
  const addContact = useMutation({
    mutationFn: async () => {
      const name = contactName.trim();
      if (!name) throw new Error("Digite um nome para o contato.");
      const { data, error } = await supabase
        .from("phone_contacts")
        .insert({ name, target_character_id: contactTarget || null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["phone_contacts"] });
      setContactName("");
      setNpcContactId(id);
      setAsNpc(true);
      toast.success("Contato adicionado à agenda.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível criar o contato."),
  });

  return (
    <main className="mx-auto max-w-md px-3 py-4 md:py-8">
      {contactsError && (
        <div
          role="alert"
          className="mb-3 space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <p className="font-semibold text-warning">Agenda do celular indisponível</p>
          <p className="text-muted-foreground">
            {phoneMigrationMissing
              ? "A migração do celular ainda não foi aplicada no Supabase. No SQL Editor do projeto, execute drizzle/migrations/0006_phone_apps_contacts.sql."
              : `Não foi possível carregar os contatos: ${contactsError.message}`}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["phone_contacts"] })}
          >
            Tentar carregar de novo
          </Button>
        </div>
      )}
      {isMaster && (
        <div className="mb-3 space-y-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          <p className="label-caps text-primary">Mestre: usar o celular como</p>
          <select
            className="h-9 w-full rounded-md border border-border bg-card px-2"
            value={
              npcMode ? (selectedContact ? `contact:${selectedContact.id}` : NPC) : (myId ?? "")
            }
            onChange={(e) => {
              const v = e.target.value;
              setScreen({ app: "home" });
              if (v === NPC) {
                setNpcContactId("");
                setAsNpc(true);
              } else if (v.startsWith("contact:")) {
                const id = v.slice("contact:".length);
                const contact = contacts.find((item) => item.id === id);
                setNpcContactId(id);
                setNpcName(contact?.name ?? "Desconhecido");
                setAsNpc(true);
              } else {
                setNpcContactId("");
                setAsNpc(false);
                setMyId(v || null);
              }
            }}
          >
            <option value="">Escolha…</option>
            <option value={NPC}>🎭 Um NPC (mensagens anônimas)</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={`contact:${contact.id}`}>
                🎭 {contact.name}
              </option>
            ))}
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {npcMode && (
            <div className="space-y-2">
              {!selectedContact && (
                <Input
                  value={npcName}
                  onChange={(e) => setNpcName(e.target.value)}
                  placeholder="Nome ou identidade do NPC"
                  aria-label="Nome do NPC"
                />
              )}
              <form
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  addContact.mutate();
                }}
              >
                <Input
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Ex.: Bu Ratna, Pak Surya"
                  aria-label="Nome do novo contato"
                />
                <select
                  className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                  value={contactTarget}
                  onChange={(event) => setContactTarget(event.target.value)}
                  aria-label="Destinatário do contato"
                >
                  <option value="">Toda a mesa</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={addContact.isPending || !contactName.trim()}
                >
                  <UserPlus /> Salvar contato
                </Button>
              </form>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-[2.2rem] border-4 border-foreground/20 bg-card shadow-paint">
        <div className="flex items-center justify-between bg-background/70 px-5 py-2 text-xs text-muted-foreground">
          <Clock />
          <span>
            {npcMode ? `🎭 ${selectedContact?.name ?? npcName}` : (me?.name ?? "Sem chip")}
          </span>
          <span>📶 🔋</span>
        </div>

        <div className="min-h-[560px]">
          {!me && !npcMode ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-5xl">📵</p>
              <p className="font-display text-2xl font-bold uppercase">Sem personagem</p>
              <p className="text-sm text-muted-foreground">
                {isMaster
                  ? "Escolha acima de quem é este celular."
                  : "Crie ou abra a sua ficha neste aparelho para usar o celular."}
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
            <Bank
              me={me}
              characters={characters}
              messages={messages}
              back={() => setScreen({ app: "home" })}
            />
          ) : screen.app === "chats" ? (
            <Chats
              me={me}
              npcMode={npcMode}
              characters={characters}
              contacts={contacts}
              messages={messages}
              back={() => setScreen({ app: "home" })}
              open={(w) => setScreen({ app: "chat", with: w })}
            />
          ) : screen.app === "chat" ? (
            <Chat
              me={me}
              npcMode={npcMode}
              npcName={npcName}
              contact={selectedContact}
              other={screen.with}
              characters={characters}
              contacts={contacts}
              contactsAvailable={!contactsPending && !contactsError}
              messages={messages}
              back={() => setScreen({ app: "chats" })}
            />
          ) : screen.app === "news" ? (
            <News
              clues={clues}
              isMaster={isMaster}
              isLoading={cluesPending}
              error={cluesError?.message}
              back={() => setScreen({ app: "home" })}
            />
          ) : screen.app === "gallery" ? (
            <Gallery
              photos={photos}
              character={me}
              isLoading={photosPending}
              error={photosError?.message}
              back={() => setScreen({ app: "home" })}
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
    const tick = () =>
      setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
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
  const incoming = me
    ? messages.filter((m) => m.to_character_id === me.id && m.from_character_id !== me.id).length
    : 0;
  return (
    <div className="space-y-6 p-5">
      <p className="label-caps text-center text-muted-foreground">
        Indonésia · Guerra Fria · arquivo de campo
      </p>
      {me && !npcMode && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-center">
          <p className="label-caps text-warning">Rupias</p>
          <p className="tabular font-display text-5xl font-bold">{formatMoney(me.money)}</p>
        </div>
      )}
      <div className="grid grid-cols-4 gap-4">
        <AppIcon
          emoji="💬"
          name="Mensagens"
          badge={incoming}
          onClick={() => open({ app: "chats" })}
        />
        {me && !npcMode && (
          <AppIcon emoji="💴" name="Banco Rupia" onClick={() => open({ app: "bank" })} />
        )}
        <AppIcon emoji="📷" name="Câmera / Galeria" onClick={() => open({ app: "gallery" })} />
        <AppIcon emoji="📰" name="Notícias / Pistas" onClick={() => open({ app: "news" })} />
        {FUTURE_APPS.map((a) => (
          <AppIcon
            key={a.name}
            emoji={a.emoji}
            name={a.name}
            disabled
            onClick={() => toast("Em breve neste celular.")}
          />
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
    <button
      type="button"
      onClick={onClick}
      className={cn("flex flex-col items-center gap-1", disabled && "opacity-45")}
    >
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
    .filter(
      (m) => m.kind === "pix" && (m.from_character_id === me.id || m.to_character_id === me.id),
    )
    .reverse();

  const pix = useMutation({
    mutationFn: async () => {
      const value = Math.round(Number(amount));
      const err = transferError(me.money, value, me.id, to || null);
      if (err) throw new Error(err);
      const { error } = await supabase.rpc("transfer_money", {
        _from: me.id,
        _to: to,
        _amount: value,
        _note: note,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Transferência em rupias enviada!");
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
      <AppHeader title="Banco rupia" back={back} />
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-center">
          <p className="label-caps text-warning">Rupias de {me.name}</p>
          <p className="tabular font-display text-5xl font-bold">{formatMoney(me.money)}</p>
        </div>
        <form
          className="space-y-2 rounded-xl border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            pix.mutate();
          }}
        >
          <p className="label-caps text-primary">Enviar rupias</p>
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
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Valor em rupias"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Valor em rupias"
          />
          <Input
            placeholder="Mensagem (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Mensagem da transferência"
          />
          <Button type="submit" variant="paint" className="w-full" disabled={pix.isPending}>
            💴 Transferir
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
                      <span className="block truncate">
                        {out
                          ? `Para ${nameOf(m.to_character_id)}`
                          : `De ${nameOf(m.from_character_id)}`}
                      </span>
                      {m.body && (
                        <span className="block truncate text-xs text-muted-foreground">
                          “{m.body}”
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "tabular shrink-0 font-bold",
                        out ? "text-destructive" : "text-success",
                      )}
                    >
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

const NEWS_CATEGORIES = [
  { label: "🚨 Urgente", badge: "border-red-500/40 bg-red-500/15 text-red-300" },
  { label: "🕵️ Pista", badge: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300" },
  { label: "📰 Manchete", badge: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  { label: "👁️ Rumor", badge: "border-purple-500/40 bg-purple-500/15 text-purple-300" },
  { label: "⚠️ Alerta", badge: "border-yellow-500/40 bg-yellow-500/15 text-yellow-300" },
  { label: "💀 Necrológio", badge: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300" },
] as const;

function News({
  clues,
  isMaster,
  isLoading,
  error,
  back,
}: {
  clues: PhoneClue[];
  isMaster: boolean;
  isLoading: boolean;
  error: string | undefined;
  back: () => void;
}) {
  const qc = useQueryClient();
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState<string>("📰 Manchete");
  const [selectedFilter, setSelectedFilter] = useState<string>("todas");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!headline.trim()) throw new Error("Escreva uma manchete para a notícia.");
      const { error } = await supabase.from("phone_clues").insert({
        headline: headline.trim(),
        body: body.trim(),
        image_url: imageUrl,
        category: category,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setHeadline("");
      setBody("");
      setImageUrl("");
      setIsFormOpen(false);
      await qc.invalidateQueries({ queryKey: ["phone_clues"] });
      toast.success("Notícia publicada na Gazeta!");
    },
    onError: (error) => toast.error(error.message || "Não foi possível publicar a notícia."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("phone_clues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["phone_clues"] });
      toast.success("Notícia removida.");
    },
    onError: () => toast.error("Não foi possível apagar a notícia."),
  });

  const filteredClues = useMemo(() => {
    if (selectedFilter === "todas") return clues;
    return clues.filter((c) => (c.category || "📰 Manchete") === selectedFilter);
  }, [clues, selectedFilter]);

  const getCategoryBadgeClass = (cat?: string | null) => {
    const found = NEWS_CATEGORIES.find((item) => item.label === cat);
    return found ? found.badge : "border-border bg-zinc-800 text-zinc-300";
  };

  return (
    <div className="pb-8">
      <AppHeader title="Notícias e Pistas" back={back} />

      <div className="space-y-4 p-4">
        {/* CABEÇALHO ESTILO TABLÓIDE INVESTIGATIVO */}
        <header className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-lg">
          <div className="border-b-2 border-zinc-700/80 pb-2 text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">
              Arquivo Confidencial • Redação da Cidade
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-black uppercase tracking-tight text-zinc-100 sm:text-3xl">
              Gazeta dos Caídos
            </h1>
            <div className="mt-1.5 flex items-center justify-between border-t border-zinc-800 pt-1 font-mono text-[10px] uppercase text-zinc-400">
              <span>Edição Especial</span>
              <span className="italic">"A verdade nunca dorme"</span>
              <span>5 Rupias</span>
            </div>
          </div>

          {/* BOTÃO DO MESTRE PARA CRIAR NOTÍCIA */}
          {isMaster && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant={isFormOpen ? "secondary" : "outline"}
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="h-8 gap-1.5 text-xs"
              >
                {isFormOpen ? (
                  <>
                    <X className="size-3.5" /> Fechar formulário
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5" /> Nova notícia / pista
                  </>
                )}
              </Button>
            </div>
          )}
        </header>

        {/* FORMULÁRIO DO MESTRE */}
        {isMaster && isFormOpen && (
          <form
            className="space-y-3 rounded-xl border border-primary/40 bg-zinc-950/90 p-4 shadow-lg animate-in fade-in"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <FileText className="size-3.5" /> Redigir notícia ou pista
              </p>
              <span className="text-[10px] text-muted-foreground">Exclusivo do Mestre</span>
            </div>

            {/* SELEÇÃO DE CATEGORIA */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Categoria / Tag da matéria
              </label>
              <div className="flex flex-wrap gap-1.5">
                {NEWS_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setCategory(cat.label)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      category === cat.label
                        ? `${cat.badge} ring-1 ring-primary`
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MANCHETE */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Manchete</label>
              <Input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="Ex: Assassinato no Píer 4 choca as autoridades"
                aria-label="Manchete da notícia"
                required
              />
            </div>

            {/* CONTEÚDO */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">
                Conteúdo / Relato investigativo
              </label>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 font-serif text-sm italic"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Detalhes, pistas encontradas, testemunhos ou boletim oficial..."
                aria-label="Texto da notícia"
              />
            </div>

            {/* FOTO */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-muted-foreground">
                Fotografia jornalística (opcional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (file.size > 8 * 1024 * 1024) {
                      toast.error("Escolha uma imagem de até 8 MB.");
                      return;
                    }
                    try {
                      setImageUrl(await fileToSmallImage(file, 960, 0.72));
                    } catch {
                      toast.error("Não consegui abrir essa imagem.");
                    }
                  }}
                />
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={() => setImageUrl("")}
                  >
                    Remover
                  </Button>
                )}
              </div>
              {imageUrl && (
                <div className="mt-2 overflow-hidden rounded-lg border border-border">
                  <img
                    src={imageUrl}
                    alt="Prévia da notícia"
                    className="max-h-40 w-full object-cover"
                  />
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={save.isPending || !headline.trim()}
              className="gap-2"
            >
              <Newspaper className="size-4" />
              Publicar na Gazeta
            </Button>
          </form>
        )}

        {/* FILTROS POR CATEGORIA */}
        {clues.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="shrink-0 text-muted-foreground">
              <Filter className="inline size-3 mr-1" />
              Filtro:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFilter("todas")}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition",
                selectedFilter === "todas"
                  ? "border-primary bg-primary/10 font-bold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/30",
              )}
            >
              Todas ({clues.length})
            </button>
            {NEWS_CATEGORIES.map((cat) => {
              const count = clues.filter((c) => (c.category || "📰 Manchete") === cat.label).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setSelectedFilter(cat.label)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition",
                    selectedFilter === cat.label
                      ? `${cat.badge} font-bold`
                      : "border-border text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* LISTAGEM DE NOTÍCIAS */}
        {error ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            Não foi possível carregar as notícias: {error}
          </p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Imprimindo as edições recentes…
          </p>
        ) : filteredClues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Newspaper className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm italic text-muted-foreground">
              Nenhuma notícia ou pista encontrada para este filtro.
            </p>
          </div>
        ) : (
          filteredClues.map((clue) => {
            const clueCategory = clue.category || "📰 Manchete";
            const dateStr = new Date(clue.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <article
                key={clue.id}
                className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-md transition hover:border-zinc-700"
              >
                {/* CABEÇALHO DO ARTIGO COM TAG E DATA */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/50 px-3.5 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold",
                        getCategoryBadgeClass(clueCategory),
                      )}
                    >
                      {clueCategory}
                    </span>
                    <time className="font-mono text-[10px] text-zinc-400">{dateStr}</time>
                  </div>

                  {isMaster && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 text-zinc-400 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => remove.mutate(clue.id)}
                      disabled={remove.isPending}
                      aria-label="Apagar notícia"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>

                {/* IMAGEM JORNALÍSTICA */}
                {clue.image_url && (
                  <div className="relative border-b border-zinc-800/80 bg-black">
                    <img
                      src={clue.image_url}
                      alt={clue.headline}
                      loading="lazy"
                      decoding="async"
                      className="max-h-60 w-full object-cover"
                    />
                    <div className="absolute bottom-1 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-300">
                      Evidência Fotográfica
                    </div>
                  </div>
                )}

                {/* CORPO DA NOTÍCIA */}
                <div className="p-4">
                  <h2 className="font-display text-lg font-black uppercase tracking-tight text-zinc-100 sm:text-xl">
                    {clue.headline}
                  </h2>

                  {clue.body && (
                    <p className="mt-2.5 whitespace-pre-wrap font-serif text-sm leading-relaxed text-zinc-300">
                      {clue.body}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between border-t border-dashed border-zinc-800/80 pt-2 font-mono text-[10px] text-zinc-500">
                    <span>Investigação registrada</span>
                    <span>Doc #{clue.id.slice(0, 8)}</span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

function Gallery({
  photos,
  character,
  isLoading,
  error,
  back,
}: {
  photos: {
    id: string;
    character_id: string | null;
    caption: string;
    image_url: string;
    created_at: string;
  }[];
  character: Character | null;
  isLoading: boolean;
  error: string | undefined;
  back: () => void;
}) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const upload = useMutation({
    mutationFn: async () => {
      if (!imageUrl) throw new Error("Selecione uma foto primeiro.");
      const { error } = await supabase.from("phone_gallery").insert({
        character_id: character?.id ?? null,
        caption: caption.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setCaption("");
      setImageUrl("");
      await qc.invalidateQueries({ queryKey: ["phone_gallery"] });
      toast.success("Foto guardada na galeria do grupo.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível guardar a foto."),
  });

  return (
    <div>
      <AppHeader title="Câmera e galeria" back={back} />
      <div className="space-y-4 p-4">
        <form
          className="space-y-2 rounded-xl border border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <p className="label-caps text-primary">Adicionar evidência ao arquivo compartilhado</p>
          <Input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Legenda ou local da foto"
            aria-label="Legenda da foto"
          />
          <input
            className="block w-full text-sm"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 8 * 1024 * 1024) {
                toast.error("Escolha uma imagem de até 8 MB.");
                return;
              }
              try {
                setImageUrl(await fileToSmallImage(file, 960, 0.72));
              } catch {
                toast.error("Não consegui abrir essa imagem.");
              }
            }}
          />
          {imageUrl && (
            <img src={imageUrl} alt="Prévia da foto" className="max-h-36 rounded-lg object-cover" />
          )}
          <Button type="submit" size="sm" disabled={upload.isPending || !imageUrl}>
            <Camera /> Guardar no arquivo
          </Button>
        </form>
        {error ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            Não foi possível carregar a galeria: {error}
          </p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando galeria…</p>
        ) : photos.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            A galeria compartilhada ainda está vazia.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-lg border border-border bg-background"
              >
                <img
                  src={photo.image_url}
                  alt={photo.caption || "Foto de pista"}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
                <figcaption className="p-2 text-xs">
                  <span className="block line-clamp-2">{photo.caption || "Sem legenda"}</span>
                  <time className="mt-1 block text-[10px] text-muted-foreground">
                    {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                  </time>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function threadKeyMessages(
  messages: Message[],
  me: Character | null,
  npcMode: boolean,
  other: string,
) {
  if (other.startsWith("contact:")) {
    const contactId = other.slice("contact:".length);
    return messages.filter(
      (message) => message.kind === "text" && message.contact_id === contactId,
    );
  }
  if (other === GROUP) {
    return messages.filter(
      (message) =>
        message.kind === "text" && !message.contact_id && message.to_character_id === null,
    );
  }
  if (npcMode) {
    // Mestre como NPC: grupo, ou a conversa NPC de cada personagem.
    return messages.filter(
      (m) => m.kind === "text" && !m.contact_id && inConversation(m, other, NPC),
    );
  }
  return messages.filter(
    (m) => m.kind === "text" && !m.contact_id && inConversation(m, me?.id ?? null, other),
  );
}

function Chats({
  me,
  npcMode,
  characters,
  contacts,
  messages,
  back,
  open,
}: {
  me: Character | null;
  npcMode: boolean;
  characters: Character[];
  contacts: PhoneContact[];
  messages: Message[];
  back: () => void;
  open: (w: string) => void;
}) {
  const threads = [
    { id: GROUP, name: "Grupo da mesa", avatar: "", emoji: "👥" },
    ...(npcMode ? [] : [{ id: NPC, name: "Número desconhecido", avatar: "", emoji: "🎭" }]),
    ...contacts
      .filter(
        (contact) =>
          npcMode || !contact.target_character_id || contact.target_character_id === me?.id,
      )
      .map((contact) => ({
        id: `contact:${contact.id}`,
        name: contact.name,
        avatar: "",
        emoji: "🎭",
      })),
    ...characters
      .filter((c) => c.id !== me?.id)
      .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar_url, emoji: "" })),
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
              <button
                type="button"
                onClick={() => open(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
              >
                {t.emoji ? (
                  <span className="grid size-10 place-items-center rounded-full bg-muted text-xl">
                    {t.emoji}
                  </span>
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
  contact,
  other,
  characters,
  contacts,
  contactsAvailable,
  messages,
  back,
}: {
  me: Character | null;
  npcMode: boolean;
  npcName: string;
  contact: PhoneContact | null;
  other: string;
  characters: Character[];
  contacts: PhoneContact[];
  contactsAvailable: boolean;
  messages: Message[];
  back: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const list = useMemo(
    () => threadKeyMessages(messages, me, npcMode, other),
    [messages, me, npcMode, other],
  );
  const selectedContact = contacts.find((item) => `contact:${item.id}` === other) ?? contact;
  const title =
    other === GROUP
      ? "Grupo da mesa"
      : other === NPC
        ? "Número desconhecido"
        : (selectedContact?.name ?? characters.find((c) => c.id === other)?.name ?? "Conversa");

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [list.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const row: MessageInsert = npcMode
        ? {
            from_character_id: null,
            from_name: (selectedContact?.name ?? npcName.trim()) || "Desconhecido",
            to_character_id:
              other === GROUP
                ? null
                : (selectedContact?.target_character_id ?? (selectedContact ? null : other)),
            ...(contactsAvailable ? { contact_id: selectedContact?.id ?? null } : {}),
            body,
          }
        : {
            from_character_id: me!.id,
            from_name: me!.name,
            // Resposta ao NPC fica endereçada a si mesmo (só o mestre e o jogador veem).
            to_character_id:
              other === GROUP ? null : other === NPC ? me!.id : selectedContact ? me!.id : other,
            ...(contactsAvailable ? { contact_id: selectedContact?.id ?? null } : {}),
            body,
          };
      const { error } = await supabase.from("messages").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
    onError: (error) => toast.error(`Mensagem não enviada: ${error.message}`),
  });

  const isMine = (m: Message) =>
    npcMode ? m.from_character_id === null : m.from_character_id === me?.id;

  return (
    <div className="flex h-[560px] flex-col">
      <AppHeader title={title} back={back} />
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {list.length === 0 && (
          <p className="py-10 text-center text-sm italic text-muted-foreground">
            Nenhuma mensagem ainda.
          </p>
        )}
        {list.map((m) => (
          <div key={m.id} className={cn("flex", isMine(m) ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                isMine(m)
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted",
              )}
            >
              {!isMine(m) && (
                <p className="text-[11px] font-bold opacity-80">{m.from_name || "Desconhecido"}</p>
              )}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className="mt-0.5 text-right text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem"
          aria-label="Mensagem"
        />
        <Button type="submit" size="icon" aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </div>
  );
}
