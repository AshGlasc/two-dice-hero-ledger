import React, { useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, ShieldAlert } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { toast } from "sonner";

interface MasterUnlockModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function MasterUnlockModal({
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  trigger,
  onSuccess,
}: MasterUnlockModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const { isConfigured, unlock, setupPin } = useMasterAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSetup = isConfigured === false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!pin.trim()) {
      setErrorMsg("Digite o PIN.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSetup) {
        if (pin.length < 3) {
          setErrorMsg("Mínimo de 3 caracteres.");
          setIsSubmitting(false);
          return;
        }
        if (pin !== confirmPin) {
          setErrorMsg("Os PINs não coincidem.");
          setIsSubmitting(false);
          return;
        }
        const res = await setupPin(pin, remember);
        if (res.success) {
          toast.success("PIN de Mestre criado com sucesso!");
          setOpen(false);
          setPin("");
          setConfirmPin("");
          onSuccess?.();
        } else {
          setErrorMsg(res.error || "Erro ao salvar PIN.");
        }
      } else {
        const res = await unlock(pin, remember);
        if (res.success) {
          toast.success("Modo Mestre desbloqueado!");
          setOpen(false);
          setPin("");
          onSuccess?.();
        } else {
          setErrorMsg(res.error || "PIN incorreto.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isSetup ? <KeyRound className="size-5 text-primary" /> : <Lock className="size-5 text-primary" />}
            <DialogTitle className="font-display text-2xl uppercase">
              {isSetup ? "Configurar Acesso do Mestre" : "Desbloquear Modo Mestre"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isSetup
              ? "Defina um PIN para gerenciar os bastidores, monstros e o combate."
              : "Digite o PIN de mestre para ter acesso total a esta ação."}
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
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              {isSetup ? "Novo PIN / Senha" : "PIN do Mestre"}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setErrorMsg("");
                  setPin(e.target.value);
                }}
                placeholder={isSetup ? "Crie um PIN" : "Digite o PIN"}
                className="h-11 pr-10 font-mono text-center text-lg tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {isSetup && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Confirmar PIN
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => {
                  setErrorMsg("");
                  setConfirmPin(e.target.value);
                }}
                placeholder="Repita o PIN"
                className="h-11 text-center font-mono text-lg tracking-wider"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="modal-remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(Boolean(checked))}
            />
            <label htmlFor="modal-remember" className="text-xs text-muted-foreground cursor-pointer select-none">
              Lembrar desbloqueio neste navegador
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="paint" disabled={isSubmitting || !pin.trim()}>
              {isSubmitting ? "Verificando..." : isSetup ? "Salvar PIN" : "Desbloquear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
