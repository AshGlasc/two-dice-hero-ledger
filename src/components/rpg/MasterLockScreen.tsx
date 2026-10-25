import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Lock, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { toast } from "sonner";

export function MasterLockScreen() {
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
      setErrorMsg("Digite o PIN de acesso.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSetup) {
        if (pin.length < 3) {
          setErrorMsg("O PIN deve ter no mínimo 3 dígitos ou caracteres.");
          setIsSubmitting(false);
          return;
        }
        if (pin !== confirmPin) {
          setErrorMsg("Os PINs informados não coincidem.");
          setIsSubmitting(false);
          return;
        }

        const res = await setupPin(pin, remember);
        if (res.success) {
          toast.success("PIN de Mestre configurado com sucesso! Acesso liberado.");
        } else {
          setErrorMsg(res.error || "Erro ao salvar PIN.");
        }
      } else {
        const res = await unlock(pin, remember);
        if (res.success) {
          toast.success("Acesso de Mestre autenticado!");
        } else {
          setErrorMsg(res.error || "PIN incorreto. Tente novamente.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    setErrorMsg("");
    setPin((prev) => prev + val);
  };

  const handleBackspace = () => {
    setErrorMsg("");
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg("");
    setPin("");
  };

  return (
    <div className="relative mx-auto flex min-h-[75vh] max-w-lg flex-col items-center justify-center px-4 py-12">
      <div className="w-full rounded-xl border border-border/80 bg-card p-6 shadow-paint md:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-16 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary shadow-sm">
            {isSetup ? <KeyRound className="size-8" /> : <Lock className="size-8" />}
          </div>
          <span className="label-caps text-primary">Acesso Restrito</span>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-foreground md:text-4xl">
            {isSetup ? "Configurar Mestre" : "Painel do Mestre"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSetup
              ? "Crie um PIN ou senha exclusivo para proteger as notas secretas, testes e ferramentas do mestre da mesa."
              : "Esta área contém bastidores confidenciais da campanha. Digite o PIN do mestre para desbloquear."}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in zoom-in-95">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isSetup ? "Definir novo PIN / Senha" : "PIN / Senha de Acesso"}
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
                placeholder={isSetup ? "Ex: 4 dígitos ou palavra-chave" : "Digite o PIN do mestre"}
                className="h-12 border-border/80 bg-background/50 pr-10 font-mono text-center text-xl tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {isSetup && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Confirmar PIN
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPin}
                onChange={(e) => {
                  setErrorMsg("");
                  setConfirmPin(e.target.value);
                }}
                placeholder="Repita o mesmo PIN"
                className="h-12 border-border/80 bg-background/50 text-center font-mono text-xl tracking-widest"
              />
            </div>
          )}

          {/* Teclado numérico rápido (ótimo para celular ou tablets) */}
          <div className="pt-2">
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant="outline"
                  className="h-11 font-display text-lg font-bold hover:border-primary hover:text-primary"
                  onClick={() => handleKeypadPress(num)}
                >
                  {num}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-11 text-xs font-semibold uppercase text-muted-foreground"
                onClick={handleClear}
              >
                Limpar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 font-display text-lg font-bold hover:border-primary hover:text-primary"
                onClick={() => handleKeypadPress("0")}
              >
                0
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 text-xs font-semibold uppercase text-muted-foreground"
                onClick={handleBackspace}
              >
                Apagar
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(Boolean(checked))}
            />
            <label
              htmlFor="remember"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Lembrar desbloqueio neste navegador
            </label>
          </div>

          <Button
            type="submit"
            variant="paint"
            className="w-full py-6 text-base font-bold uppercase tracking-wider"
            disabled={isSubmitting || !pin.trim()}
          >
            {isSubmitting ? (
              "Verificando..."
            ) : isSetup ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-5" /> Ativar Acesso do Mestre
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="size-5" /> Desbloquear Painel
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6 flex justify-center border-t border-border/40 pt-4">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/">
              <ArrowLeft className="mr-2 size-4" /> Voltar para o início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
