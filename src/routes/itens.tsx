import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Package, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MasterLockScreen } from "@/components/rpg/MasterLockScreen";
import { Stepper } from "@/components/rpg/Stepper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMasterAuth } from "@/context/MasterAuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { groupQuery } from "@/lib/rpg-queries";
import { ALL_SKILLS } from "@/lib/skills";

export const Route = createFileRoute("/itens")({
  head: () => ({
    meta: [
      { title: "Catálogo de itens — Eco dos Caídos" },
      { name: "description", content: "Compêndio de itens, armas e elementos de cenário da mesa." },
    ],
  }),
  component: ItemsPage,
});

type CatalogItem = Tables<"catalog_items">;
type ItemCategory = "weapon" | "consumable" | "equipment" | "scenery";

type ItemForm = {
  name: string;
  category: ItemCategory;
  description: string;
  image_url: string;
  damage: string;
  skill_key: string;
  range: string;
  ammo: string;
  uses_max: string;
  heal_hp: string;
  heal_sanity: string;
  restore_energy: string;
  temp_shield: string;
  skill_bonuses: Record<string, number>;
  armor_part: string;
  armor_reduction: string;
  hand_slot: string;
  is_movable: boolean;
  requires_roll_to_interact: boolean;
  interaction_skill_key: string;
  interaction_difficulty: string;
};

const emptyForm: ItemForm = {
  name: "",
  category: "equipment",
  description: "",
  image_url: "",
  damage: "",
  skill_key: "ferramenta_fisica",
  range: "1",
  ammo: "",
  uses_max: "0",
  heal_hp: "0",
  heal_sanity: "0",
  restore_energy: "0",
  temp_shield: "0",
  skill_bonuses: {},
  armor_part: "",
  armor_reduction: "0",
  hand_slot: "none",
  is_movable: false,
  requires_roll_to_interact: false,
  interaction_skill_key: "",
  interaction_difficulty: "",
};

const categories: { value: ItemCategory | "all"; label: string }[] = [
  { value: "all", label: "Todas as categorias" },
  { value: "weapon", label: "Armas" },
  { value: "consumable", label: "Consumíveis" },
  { value: "equipment", label: "Equipamentos" },
  { value: "scenery", label: "Cenário" },
];

const catalogItemsQuery = {
  queryKey: ["catalog_items"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
};

function ItemsPage() {
  const { isMaster, isLoading } = useMasterAuth();
  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="font-display text-lg uppercase tracking-wider text-muted-foreground animate-pulse">
          Verificando credenciais do mestre...
        </p>
      </main>
    );
  }
  if (!isMaster) return <MasterLockScreen />;
  return <ItemsPageContent />;
}

function ItemsPageContent() {
  const qc = useQueryClient();
  const { data: items = [], isLoading, error } = useQuery(catalogItemsQuery);
  const { data: group } = useQuery(groupQuery);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [bonusSkill, setBonusSkill] = useState("");
  const [bonusValue, setBonusValue] = useState(1);

  const saveItem = useMutation({
    mutationFn: async ({ id, values }: { id: string | null; values: ItemForm }) => {
      const payload = {
        name: values.name.trim(),
        category: values.category,
        description: values.description,
        image_url: values.image_url.trim(),
        damage: values.damage.trim() || null,
        skill_key: values.skill_key.trim() || null,
        range: Number(values.range) || 0,
        ammo: values.ammo.trim() || null,
        uses_max: Number(values.uses_max) || 0,
        heal_hp: Number(values.heal_hp) || 0,
        heal_sanity: Number(values.heal_sanity) || 0,
        restore_energy: Number(values.restore_energy) || 0,
        temp_shield: Number(values.temp_shield) || 0,
        skill_bonuses: values.skill_bonuses,
        armor_part: values.armor_part,
        armor_reduction: Number(values.armor_reduction) || 0,
        hand_slot:
          values.category === "weapon" && values.hand_slot === "none" ? "right" : values.hand_slot,
        is_movable: values.is_movable,
        requires_roll_to_interact: values.requires_roll_to_interact,
        interaction_skill_key: values.interaction_skill_key.trim() || null,
        interaction_difficulty: values.interaction_difficulty
          ? Number(values.interaction_difficulty)
          : null,
      };
      const result = id
        ? await supabase.from("catalog_items").update(payload).eq("id", id)
        : await supabase.from("catalog_items").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["catalog_items"] });
      setForm(emptyForm);
      setEditingId(null);
      toast.success(id ? "Item atualizado." : "Item adicionado ao catálogo.");
    },
    onError: (saveError) => toast.error(`Não foi possível salvar o item: ${saveError.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from("catalog_items").delete().eq("id", id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["catalog_items"] });
      toast.success("Item removido do catálogo.");
    },
    onError: (deleteError) =>
      toast.error(`Não foi possível remover o item: ${deleteError.message}`),
  });

  const deliverItem = useMutation({
    mutationFn: async ({ item, characterId }: { item: CatalogItem; characterId: string }) => {
      await giveCatalogItem(item, characterId);
    },
    onSuccess: (_, { item, characterId }) => {
      void qc.invalidateQueries({ queryKey: ["group"] });
      void qc.invalidateQueries({ queryKey: ["sheet", characterId] });
      toast.success(`${item.name} entregue.`);
    },
    onError: (deliveryError) =>
      toast.error(`Não foi possível entregar o item: ${deliveryError.message}`),
  });

  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch =
      !query ||
      item.name.toLocaleLowerCase("pt-BR").includes(query) ||
      item.description.toLocaleLowerCase("pt-BR").includes(query);
    return matchesCategory && matchesSearch;
  });

  const editItem = (item: CatalogItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category as ItemCategory,
      description: item.description,
      image_url: item.image_url,
      damage: item.damage ?? "",
      skill_key: item.skill_key ?? "",
      range: String(item.range ?? 1),
      ammo: item.ammo ?? "",
      uses_max: String(item.uses_max ?? 0),
      heal_hp: String(item.heal_hp ?? 0),
      heal_sanity: String(item.heal_sanity ?? 0),
      restore_energy: String(item.restore_energy ?? 0),
      temp_shield: String(item.temp_shield ?? 0),
      skill_bonuses:
        item.skill_bonuses &&
        typeof item.skill_bonuses === "object" &&
        !Array.isArray(item.skill_bonuses)
          ? (item.skill_bonuses as Record<string, number>)
          : {},
      armor_part: item.armor_part,
      armor_reduction: String(item.armor_reduction),
      hand_slot: item.hand_slot,
      is_movable: item.is_movable,
      requires_roll_to_interact: item.requires_roll_to_interact,
      interaction_skill_key: item.interaction_skill_key ?? "",
      interaction_difficulty: item.interaction_difficulty?.toString() ?? "",
    });
    document.getElementById("item-editor")?.scrollIntoView({ behavior: "smooth" });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do item.");
      return;
    }
    saveItem.mutate({ id: editingId, values: form });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6">
      <header className="border-b border-border pb-4">
        <p className="label-caps text-primary">Compêndio da mesa</p>
        <h1 className="mt-1 flex items-center gap-3 text-5xl font-bold uppercase leading-none md:text-6xl">
          <Package className="size-10 text-primary" /> Catálogo de itens
        </h1>
        <p className="mt-2 text-muted-foreground">
          Armas, recursos e vestígios que ainda podem mudar o destino de alguém.
        </p>
      </header>

      <section
        id="item-editor"
        className="rounded-lg border border-border bg-card p-5 shadow-paint"
      >
        <div className="mb-4 flex items-center gap-2">
          {editingId ? (
            <Pencil className="size-5 text-primary" />
          ) : (
            <Plus className="size-5 text-primary" />
          )}
          <h2 className="text-2xl font-bold uppercase">
            {editingId ? "Editar item" : "Novo item"}
          </h2>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label-caps text-muted-foreground">Nome</span>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="label-caps text-muted-foreground">Categoria</span>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value as ItemCategory })}
              >
                <SelectTrigger aria-label="Categoria do item">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((category) => category.value !== "all")
                    .map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="label-caps text-muted-foreground">Descrição</span>
            <Textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label-caps text-muted-foreground">Ícone / imagem (URL)</span>
              <Input
                type="url"
                value={form.image_url}
                onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="label-caps text-muted-foreground">Skill de uso</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={form.skill_key}
                onChange={(event) => setForm({ ...form, skill_key: event.target.value })}
              >
                {ALL_SKILLS.map((skill) => (
                  <option key={skill.key} value={skill.key}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="label-caps text-primary">Equipamento e recursos</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="label-caps text-muted-foreground">Slot de mão</span>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.hand_slot}
                  onChange={(event) => setForm({ ...form, hand_slot: event.target.value })}
                >
                  <option value="none">Sem mão</option>
                  <option value="right">Mão principal direita</option>
                  <option value="left">Mão principal esquerda</option>
                  <option value="offhand">Mão secundária</option>
                  <option value="two_hands">Duas mãos</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="label-caps text-muted-foreground">Região protegida</span>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.armor_part}
                  onChange={(event) => setForm({ ...form, armor_part: event.target.value })}
                >
                  <option value="">Sem proteção</option>
                  <option value="head">Cabeça</option>
                  <option value="torso">Peito / tronco</option>
                  <option value="arms">Braços</option>
                  <option value="legs">Pernas</option>
                </select>
              </label>
              <Field
                label="Redução de dano"
                type="number"
                value={form.armor_reduction}
                onChange={(armor_reduction) => setForm({ ...form, armor_reduction })}
              />
              <Field
                label="Dano"
                value={form.damage}
                onChange={(damage) => setForm({ ...form, damage })}
              />
              <Field
                label="Alcance"
                type="number"
                value={form.range}
                onChange={(range) => setForm({ ...form, range })}
              />
              <Field
                label="Munição"
                value={form.ammo}
                onChange={(ammo) => setForm({ ...form, ammo })}
              />
              <Field
                label="Usos máximos"
                type="number"
                value={form.uses_max}
                onChange={(uses_max) => setForm({ ...form, uses_max })}
              />
              <Field
                label="Cura PV"
                type="number"
                value={form.heal_hp}
                onChange={(heal_hp) => setForm({ ...form, heal_hp })}
              />
              <Field
                label="Cura sanidade"
                type="number"
                value={form.heal_sanity}
                onChange={(heal_sanity) => setForm({ ...form, heal_sanity })}
              />
              <Field
                label="Recupera energia"
                type="number"
                value={form.restore_energy}
                onChange={(restore_energy) => setForm({ ...form, restore_energy })}
              />
              <Field
                label="Escudo temporário"
                type="number"
                value={form.temp_shield}
                onChange={(temp_shield) => setForm({ ...form, temp_shield })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps text-muted-foreground">Bônus de habilidade</span>
              <select
                className="h-9 min-w-48 rounded-md border border-border bg-background px-2 text-sm"
                value={bonusSkill}
                onChange={(event) => setBonusSkill(event.target.value)}
              >
                <option value="">Escolher perícia</option>
                {ALL_SKILLS.map((skill) => (
                  <option key={skill.key} value={skill.key}>
                    {skill.name}
                  </option>
                ))}
              </select>
              {bonusSkill && (
                <>
                  <Stepper
                    label="valor do bônus"
                    value={bonusValue}
                    min={-5}
                    max={10}
                    onChange={setBonusValue}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        skill_bonuses: { ...current.skill_bonuses, [bonusSkill]: bonusValue },
                      }));
                      setBonusSkill("");
                    }}
                  >
                    Adicionar bônus
                  </Button>
                </>
              )}
              {Object.entries(form.skill_bonuses).map(([skillKey, value]) => (
                <button
                  key={skillKey}
                  type="button"
                  className="rounded-full border border-success/50 bg-success/10 px-2 py-1 text-xs"
                  onClick={() =>
                    setForm((current) => {
                      const skill_bonuses = { ...current.skill_bonuses };
                      delete skill_bonuses[skillKey];
                      return { ...current, skill_bonuses };
                    })
                  }
                >
                  {ALL_SKILLS.find((skill) => skill.key === skillKey)?.name ?? skillKey}{" "}
                  {value > 0 ? "+" : ""}
                  {value} ×
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="label-caps text-primary">Interação com cenário</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_movable}
                  onChange={(event) => setForm({ ...form, is_movable: event.target.checked })}
                />
                Objeto movível
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_roll_to_interact}
                  onChange={(event) =>
                    setForm({ ...form, requires_roll_to_interact: event.target.checked })
                  }
                />
                Exige rolagem para interagir
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="label-caps text-muted-foreground">Perícia de interação</span>
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={form.interaction_skill_key}
                  onChange={(event) =>
                    setForm({ ...form, interaction_skill_key: event.target.value })
                  }
                >
                  <option value="">Sem teste</option>
                  {ALL_SKILLS.map((skill) => (
                    <option key={skill.key} value={skill.key}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Dificuldade de interação"
                type="number"
                value={form.interaction_difficulty}
                onChange={(interaction_difficulty) => setForm({ ...form, interaction_difficulty })}
              />
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveItem.isPending}>
              {saveItem.isPending
                ? "Salvando..."
                : editingId
                  ? "Salvar alterações"
                  : "Adicionar item"}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar edição
              </Button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar item..."
            aria-label="Buscar item no catálogo"
          />
          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value as ItemCategory | "all")}
          >
            <SelectTrigger aria-label="Filtrar categoria" className="sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">Carregando o catálogo...</p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
          >
            Não foi possível carregar o catálogo: {error.message}
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center italic text-muted-foreground">
            Nenhum item encontrado.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-lg border border-border bg-card shadow-paint"
              >
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-bold uppercase">{item.name}</h3>
                    <Badge variant="outline">
                      {categories.find((category) => category.value === item.category)?.label ??
                        item.category}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.damage && <span>Dano: {item.damage}</span>}
                    {(item.heal_hp ?? 0) > 0 && <span>PV +{item.heal_hp ?? 0}</span>}
                    {(item.heal_sanity ?? 0) > 0 && <span>Sanidade +{item.heal_sanity ?? 0}</span>}
                    {item.restore_energy > 0 && <span>Energia +{item.restore_energy}</span>}
                    {(item.temp_shield ?? 0) > 0 && <span>Escudo +{item.temp_shield ?? 0}</span>}
                  </div>
                  <div className="flex gap-2 border-t border-border pt-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="secondary">
                          <Send className="mr-1.5 size-3.5" /> Entregar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Entregar {item.name}</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-72 space-y-2 overflow-y-auto">
                          {(group?.characters ?? []).map((character) => (
                            <Button
                              key={character.id}
                              className="w-full justify-start"
                              variant="outline"
                              disabled={deliverItem.isPending}
                              onClick={() =>
                                deliverItem.mutate({ item, characterId: character.id })
                              }
                            >
                              {character.name}
                            </Button>
                          ))}
                          {(group?.characters.length ?? 0) === 0 && (
                            <p className="text-sm text-muted-foreground">
                              Não há personagens na mesa.
                            </p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="outline" onClick={() => editItem(item)}>
                      <Pencil className="mr-1.5 size-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={deleteItem.isPending}
                      onClick={() => {
                        if (confirm(`Remover "${item.name}" do catálogo?`))
                          deleteItem.mutate(item.id);
                      }}
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="label-caps text-muted-foreground">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
