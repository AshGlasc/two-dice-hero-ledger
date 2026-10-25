import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/phone";
import { cn } from "@/lib/utils";

/** Dinheiro do personagem/monstro. Só quem pode editar (mestre) vê a caixa de valor. */
export function MoneyField({
  value,
  canEdit,
  onSave,
  className,
}: {
  value: number;
  canEdit: boolean;
  onSave: (v: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5", className)}>
      <span aria-hidden>💰</span>
      <span className="label-caps text-warning">Dinheiro</span>
      {canEdit ? (
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label="Dinheiro"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Math.max(0, Math.round(Number(draft) || 0));
            setDraft(String(n));
            if (n !== value) onSave(n);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="tabular h-7 w-28 font-display text-lg font-bold"
        />
      ) : (
        <span className="tabular font-display text-xl font-bold">{formatMoney(value)}</span>
      )}
    </div>
  );
}
