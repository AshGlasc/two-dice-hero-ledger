import React, { useState } from "react";
import { KeyRound, ShieldAlert, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { toast } from "sonner";

export function ChangePinDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { changePin } = useMasterAuth();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!currentPin.trim() || !newPin.trim()) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    if (newPin.trim().length < 3) {
      setErrorMsg("O novo PIN deve ter no mínimo 3 caracteres.");
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMsg("A confirmação do novo PIN não coincide.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePin(currentPin, newPin);
      if (res.success) {
        toast.success("PIN do Mestre alterado com sucesso!");
        setOpen(false);
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      } else {
        setErrorMsg(res.error || "Não foi possível alterar o PIN.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <KeyRound className="mr-1.5 size-3.5" /> Alterar PIN
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <DialogTitle className="font-display text-2xl uppercase">Alterar PIN do Mestre</DialogTitle>
          </div>
          <DialogDescription>
            Digite o PIN atual e defina um novo PIN para proteger o acesso às partes do mestre.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">PIN Atual</label>
            <Input
              type="password"
              autoFocus
              value={currentPin}
              onChange={(e) => {
                setErrorMsg("");
                setCurrentPin(e.target.value);
              }}
              placeholder="Digite o PIN atual"
              className="h-10 text-center font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Novo PIN</label>
            <Input
              type="password"
              value={newPin}
              onChange={(e) => {
                setErrorMsg("");
                setNewPin(e.target.value);
              }}
              placeholder="Digite o novo PIN"
              className="h-10 text-center font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Confirmar Novo PIN</label>
            <Input
              type="password"
              value={confirmPin}
              onChange={(e) => {
                setErrorMsg("");
                setConfirmPin(e.target.value);
              }}
              placeholder="Repita o novo PIN"
              className="h-10 text-center font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="paint" disabled={isSubmitting}>
              {isSubmitting ? (
                "Salvando..."
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> Salvar Novo PIN
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
