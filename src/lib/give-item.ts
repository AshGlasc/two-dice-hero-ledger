import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CatalogItemRow = Tables<"catalog_items">;

/** Entrega um item do catálogo a um personagem: armas vão para o arsenal, o resto para a mochila. */
export async function giveCatalogItem(item: CatalogItemRow, characterId: string) {
  if (item.category === "weapon") {
    const { error } = await supabase.from("weapons").insert({
      character_id: characterId,
      name: item.name,
      weapon_type: "Arma",
      damage: item.damage ?? "",
      ammo: item.ammo ?? "",
      notes: item.description,
      skill_key: item.skill_key ?? "ferramenta_fisica",
      range: item.range ?? 1,
      uses_max: item.uses_max ?? 0,
      uses_current: item.uses_max ?? 0,
      hand_slot: item.hand_slot,
      image_url: item.image_url,
    });
    if (error) throw error;
    return "weapon" as const;
  }
  const { error } = await supabase.from("backpack_items").insert({
    character_id: characterId,
    catalog_item_id: item.id,
    name: item.name,
    notes: item.description,
    category: item.category,
    quantity: 1,
    skill_bonuses: item.skill_bonuses,
    heal_hp: item.heal_hp ?? 0,
    restore_energy: item.restore_energy,
    temp_shield: item.temp_shield ?? 0,
    survival_tag: item.survival_tag ?? "",
    image_url: item.image_url,
    armor_part: item.armor_part,
    armor_reduction: item.armor_reduction,
    hand_slot: item.hand_slot,
    equipped: false,
  });
  if (error) throw error;
  return "backpack" as const;
}
