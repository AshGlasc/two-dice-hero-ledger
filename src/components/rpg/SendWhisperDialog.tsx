import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2, BookmarkPlus, Send, Users, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GroupData } from "@/lib/rpg-queries";
import { SKILL_ICONS, ATTRIBUTE_THEME } from "@/lib/attribute-theme";
import { ALL_SKILLS, type AttributeKey } from "@/lib/skills";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SendWhisperDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillKey: string;
  skillName: string;
  group: GroupData;
  defaultPassingIds: string[];
};

export function SendWhisperDialog({
  open,
  onOpenChange,
  skillKey,
  skillName,
  group,
  defaultPassingIds,
}: SendWhisperDialogProps) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Inicializa marcando quem passou na dificuldade da cena
  useEffect(() => {
    if (open) {
      setSelectedIds(defaultPassingIds);
      setMessage("");
      setSelectedPresetId("");
      setNewPresetTitle("");
      setShowSavePreset(false);
    }
  }, [open, defaultPassingIds]);

  // Carrega modelos salvos para esta skill_key
  const { data: presets = [], isLoading: presetsLoading } = useQuery({
    queryKey: ["whisper_presets", skillKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whisper_presets")
        .select("*")
        .eq("skill_key", skillKey)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && Boolean(skillKey),
  });

  // Salvar modelo
  const savePresetMutation = useMutation({
    mutationFn: async () => {
      const title = newPresetTitle.trim() || `${skillName} - Revelação`;
      const text = message.trim();
      if (!text) throw new Error("Digite uma mensagem antes de salvar o modelo.");
      const { error } = await supabase.from("whisper_presets").insert({
        skill_key: skillKey,
        title,
        message: text,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["whisper_presets", skillKey] });
      setNewPresetTitle("");
      setShowSavePreset(false);
      toast.success("Modelo salvo com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível salvar o modelo.");
    },
  });

  // Excluir modelo
  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase.from("whisper_presets").delete().eq("id", presetId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["whisper_presets", skillKey] });
      setSelectedPresetId("");
      toast.success("Modelo excluído.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível excluir o modelo.");
    },
  });

  // Enviar sussurro para todos os selecionados
  const sendWhisperMutation = useMutation({
    mutationFn: async () => {
      const text = message.trim();
      if (!text) throw new Error("Escreva o texto do sussurro.");
      if (selectedIds.length === 0) throw new Error("Selecione ao menos um personagem.");

      const rows = selectedIds.map((charId) => ({
        character_id: charId,
        message: text,
        skill_key: skillKey,
        skill_name: skillName,
      }));

      const { error } = await supabase.from("sanity_whispers").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        `Sussurro de ${skillName} enviado para ${selectedIds.length} personagem(ns)!`,
      );
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar sussurro.");
    },
  });

  const matchedSkill = ALL_SKILLS.find((s) => s.key === skillKey);
  const attributeKey: AttributeKey | undefined = matchedSkill?.attribute;
  const theme = attributeKey ? ATTRIBUTE_THEME[attributeKey] : undefined;
  const portraitUrl = SKILL_ICONS[skillKey];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectPassingOnly = () => {
    setSelectedIds(defaultPassingIds);
  };

  const selectAll = () => {
    setSelectedIds(group.characters.map((c) => c.id));
  };

  const selectNone = () => {
    setSelectedIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="gap-1 border-b border-border/50 pb-3">
          <div className="flex items-center gap-3">
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt={skillName}
                className="size-11 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-lg border border-primary/40 bg-primary/10">
                <Sparkles className="size-6 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <span>Sussurrar: {skillName}</span>
                {matchedSkill?.attributeName && (
                  <span className="rounded border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {matchedSkill.attributeName}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Envie uma pista mental ou revelação diretamente para a mente dos investigadores.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. SELEÇÃO DE ALVOS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5" />
                Alvos do sussurro ({selectedIds.length} de {group.characters.length})
              </label>
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={selectPassingOnly}
                  className="rounded px-1.5 py-0.5 text-primary hover:underline"
                >
                  Quem passou
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:underline"
                >
                  Todos
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:underline"
                >
                  Nenhum
                </button>
              </div>
            </div>

            {group.characters.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Nenhum personagem registrado na mesa.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.characters.map((char) => {
                  const isChecked = selectedIds.includes(char.id);
                  const isPassing = defaultPassingIds.includes(char.id);
                  return (
                    <div
                      key={char.id}
                      onClick={() => toggleSelect(char.id)}
                      className={`flex cursor-pointer items-center justify-between gap-2.5 rounded-lg border p-2.5 transition ${
                        isChecked
                          ? "border-primary/60 bg-primary/10 shadow-sm"
                          : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(char.id)}
                          aria-label={`Selecionar ${char.name}`}
                        />
                        <span className="truncate text-sm font-medium">{char.name}</span>
                      </div>
                      {isPassing && (
                        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          Passou
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. MODELOS PRONTOS (PRESETS) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Modelos prontos ({presets.length})
              </label>
              {selectedPresetId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deletePresetMutation.mutate(selectedPresetId)}
                  disabled={deletePresetMutation.isPending}
                >
                  <Trash2 className="size-3" />
                  Excluir modelo
                </Button>
              )}
            </div>

            <Select
              value={selectedPresetId}
              onValueChange={(val) => {
                setSelectedPresetId(val);
                const found = presets.find((p) => p.id === val);
                if (found) {
                  setMessage(found.message);
                }
              }}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue
                  placeholder={
                    presetsLoading
                      ? "Carregando modelos..."
                      : presets.length === 0
                        ? "Nenhum modelo salvo para esta perícia"
                        : "Escolha um modelo salvo..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id} className="text-xs">
                    {preset.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. CAMPO DE TEXTO DO SUSSURRO */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mensagem da revelação
              </label>
              <button
                type="button"
                onClick={() => setShowSavePreset(!showSavePreset)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <BookmarkPlus className="size-3" />
                {showSavePreset ? "Fechar modelo" : "Salvar como modelo..."}
              </button>
            </div>

            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Ex: Algo não faz sentido na história do vigia. Por que a fechadura está arranhada pelo lado de dentro?`}
              className="font-serif italic text-sm leading-relaxed"
            />
          </div>

          {/* 4. FORMULÁRIO DE SALVAR COMO MODELO */}
          {showSavePreset && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-in fade-in">
              <p className="text-xs font-medium text-primary">
                Salvar texto atual como modelo de {skillName}
              </p>
              <div className="flex gap-2">
                <Input
                  size={1}
                  className="h-8 text-xs"
                  placeholder="Título do modelo (ex: Contradição do Vigia)"
                  value={newPresetTitle}
                  onChange={(e) => setNewPresetTitle(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => savePresetMutation.mutate()}
                  disabled={savePresetMutation.isPending || !message.trim()}
                >
                  <BookmarkPlus className="size-3.5" />
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => sendWhisperMutation.mutate()}
            disabled={sendWhisperMutation.isPending || !message.trim() || selectedIds.length === 0}
            className="gap-2"
          >
            <Send className="size-4" />
            Enviar sussurro ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

