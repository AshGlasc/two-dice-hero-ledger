import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Newspaper, Send, Trash2, UserPlus } from "lucide-react";
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
      context.queryClient.ensureQueryData(phoneContactsQuery),
      context.queryClient.ensureQueryData(phoneCluesQuery),
      context.queryClient.ensureQueryData(phoneGalleryQuery),
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
  const { data: characters } = useSuspenseQuery(charactersQuery);
  const { data: messages } = useSuspenseQuery(messagesQuery);
  const { data: contacts } = useSuspenseQuery(phoneContactsQuery);
  const { data: clues } = useSuspenseQuery(phoneCluesQuery);
  const { data: photos } = useSuspenseQuery(phoneGalleryQuery);
  const { isMaster } = useMasterAuth();
  const [myId, setMyId] = useState<string | null>(null);
  const [asNpc, setAsNpc] = useState(false);
  const [npcName, setNpcName] = useState("Desconhecido");
  const [contactName, setContactName] = useState("");
  const [contactTarget, setContactTarget] = useState("");
  const [npcContactId, setNpcContactId] = useState("");
  const [screen, setScreen] = useState<Screen>({ app: "home" });
  const qc = useQueryClient();

  useEffect(() => setMyId(getPlayerCharacterId()), []);
  useEffect(() => {
    if (!isMaster) setAsNpc(false);
  }, [isMaster]);

  const me = characters.find((c) => c.id === myId) ?? null;
  const npcMode = isMaster && asNpc;
  const selectedContact = contacts.find((contact) => contact.id === npcContactId) ?? null;
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
              messages={messages}
              back={() => setScreen({ app: "chats" })}
            />
          ) : screen.app === "news" ? (
            <News clues={clues} isMaster={isMaster} back={() => setScreen({ app: "home" })} />
          ) : screen.app === "gallery" ? (
            <Gallery photos={photos} character={me} back={() => setScreen({ app: "home" })} />
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
          <p className="label-caps text-warning">Saldo</p>
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

function News({
  clues,
  isMaster,
  back,
}: {
  clues: PhoneClue[];
  isMaster: boolean;
  back: () => void;
}) {
  const qc = useQueryClient();
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      if (!headline.trim()) throw new Error("Escreva uma manchete.");
      const { error } = await supabase.from("phone_clues").insert({
        headline: headline.trim(),
        body: body.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setHeadline("");
      setBody("");
      setImageUrl("");
      await qc.invalidateQueries({ queryKey: ["phone_clues"] });
      toast.success("Pista publicada para a mesa.");
    },
    onError: (error) => toast.error(error.message || "Não foi possível publicar a pista."),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("phone_clues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phone_clues"] }),
    onError: () => toast.error("Não foi possível apagar a pista."),
  });

  return (
    <div>
      <AppHeader title="Notícias e pistas" back={back} />
      <div className="space-y-4 p-4">
        {isMaster && (
          <form
            className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <p className="label-caps text-primary">Mestre — publicar nos jornais locais</p>
            <Input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              placeholder="Manchete de Jakarta, Bandung ou Surabaya"
              aria-label="Manchete"
              required
            />
            <textarea
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Nota de investigação, rumor ou pista..."
              aria-label="Texto da pista"
            />
            <label className="block space-y-1 text-xs text-muted-foreground">
              Foto da notícia
              <input
                className="block w-full text-sm"
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
            </label>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Prévia da notícia"
                className="max-h-36 rounded-lg object-cover"
              />
            )}
            <Button type="submit" size="sm" disabled={save.isPending || !headline.trim()}>
              <Newspaper /> Publicar pista
            </Button>
          </form>
        )}
        {clues.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            Nenhuma notícia ou pista publicada.
          </p>
        ) : (
          clues.map((clue) => (
            <article
              key={clue.id}
              className="overflow-hidden rounded-xl border border-border bg-background"
            >
              {clue.image_url && (
                <img src={clue.image_url} alt="" className="max-h-56 w-full object-cover" />
              )}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-bold uppercase">{clue.headline}</h2>
                  {isMaster && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove.mutate(clue.id)}
                      aria-label="Apagar pista"
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                {clue.body && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {clue.body}
                  </p>
                )}
                <time className="mt-2 block text-[10px] text-muted-foreground">
                  {new Date(clue.created_at).toLocaleString("pt-BR")}
                </time>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Gallery({
  photos,
  character,
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
        {photos.length === 0 ? (
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
            contact_id: selectedContact?.id ?? null,
            body,
          }
        : {
            from_character_id: me!.id,
            from_name: me!.name,
            // Resposta ao NPC fica endereçada a si mesmo (só o mestre e o jogador veem).
            to_character_id:
              other === GROUP ? null : other === NPC ? me!.id : selectedContact ? me!.id : other,
            contact_id: selectedContact?.id ?? null,
            body,
          };
      const { error } = await supabase.from("messages").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
    onError: () => toast.error("Mensagem não enviada."),
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
