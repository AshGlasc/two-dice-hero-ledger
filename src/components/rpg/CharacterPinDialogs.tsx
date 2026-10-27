import { useNavigate } from "@tanstack/react-router";
import { KeyRound, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkCharacterPin, saveCharacterPin } from "@/lib/character-pin";
import { setPlayerCharacterId } from "@/lib/player-character";
import type { Character } from "@/lib/rpg-queries";

/** Abre o próprio personagem em outro aparelho digitando o PIN dele. */
export function PinLoginDialog({ characters }: { characters: Character[] }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const withPin = characters.filter((c) => c.pin_hash);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ch = characters.find((c) => c.id === id);
    if (!ch) return;
    setBusy(true);
    const ok = await checkCharacterPin(ch, pin);
    setBusy(false);
    if (!ok) {
      toast.error("PIN errado.");
      return;
    }
    setPlayerCharacterId(ch.id);
    setOpen(false);
    setPin("");
    toast.success(`Você está jogando com ${ch.name} neste aparelho.`);
    navigate({ to: "/personagem/$id", params: { id: ch.id } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LogIn /> Entrar com PIN
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Entrar no meu personagem</DialogTitle>
          <DialogDescription>
            Use o PIN do seu personagem para jogar com ele neste aparelho.
          </DialogDescription>
        </DialogHeader>
        {withPin.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum personagem tem PIN ainda. Crie o PIN dentro da ficha, no aparelho onde ela foi
            criada.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-2 text-sm"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
              aria-label="Personagem"
            >
              <option value="">Escolha o personagem</option>
              {withPin.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
            <Button type="submit" variant="paint" className="w-full" disabled={busy || !id}>
              Entrar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Criar ou trocar o PIN do personagem (dono ou mestre). */
export function SetPinDialog({ characterId, hasPin }: { characterId: string; hasPin: boolean }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await saveCharacterPin(characterId, pin);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("PIN salvo. Use-o para abrir a ficha em outro aparelho.");
    setPin("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={hasPin ? "outline" : "paint"} size="sm">
          <KeyRound /> {hasPin ? "Trocar PIN" : "Criar PIN"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{hasPin ? "Trocar PIN" : "Criar PIN"} do personagem</DialogTitle>
          <DialogDescription>
            Com o PIN você abre este personagem no celular, no computador ou em qualquer aparelho.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Novo PIN (mínimo 3)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            minLength={3}
            required
          />
          <Button type="submit" variant="paint" className="w-full" disabled={busy}>
            Salvar PIN
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
