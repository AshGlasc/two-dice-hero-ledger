import { supabase } from "@/integrations/supabase/client";
import { generateSalt, hashPin } from "@/lib/master-auth";

/** Cada personagem tem um PIN próprio para ser aberto em outros aparelhos. */
export async function saveCharacterPin(characterId: string, pin: string) {
  const clean = pin.trim();
  if (clean.length < 3) return { ok: false, error: "O PIN precisa de pelo menos 3 caracteres." };
  const salt = generateSalt();
  const hash = await hashPin(clean, salt);
  const { error } = await supabase
    .from("characters")
    .update({ pin_hash: hash, pin_salt: salt })
    .eq("id", characterId);
  if (error) return { ok: false, error: "Não foi possível salvar o PIN." };
  return { ok: true };
}

export async function checkCharacterPin(
  character: { pin_hash: string; pin_salt: string },
  pin: string,
) {
  if (!character.pin_hash) return false;
  return (await hashPin(pin, character.pin_salt)) === character.pin_hash;
}
