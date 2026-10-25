import { supabase } from "@/integrations/supabase/client";

export type MasterConfig = {
  configured: boolean;
  hash?: string;
  salt?: string;
  updated_at?: string;
};

const MASTER_CONFIG_ID = 2;
const SESSION_KEY = "eco_caidos_master_session";
const LOCAL_KEY = "eco_caidos_master_token";

/** Gera um salt hexadecimal aleatório de 16 bytes. */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Calcula o hash SHA-256 do PIN combinado ao salt. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin.trim()}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Busca as configurações de segurança do mestre no Supabase (gm_notes id: 2). */
export async function fetchMasterConfig(): Promise<MasterConfig> {
  try {
    const { data, error } = await supabase
      .from("gm_notes")
      .select("id, content, updated_at")
      .eq("id", MASTER_CONFIG_ID)
      .maybeSingle();

    if (error || !data || !data.content) {
      return { configured: false };
    }

    try {
      const parsed = JSON.parse(data.content) as { hash?: string; salt?: string };
      if (parsed.hash && parsed.salt) {
        return {
          configured: true,
          hash: parsed.hash,
          salt: parsed.salt,
          updated_at: data.updated_at,
        };
      }
    } catch {
      // Conteúdo não é JSON válido
      return { configured: false };
    }

    return { configured: false };
  } catch {
    return { configured: false };
  }
}

/** Salva um novo PIN de mestre no banco. */
export async function saveMasterPin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPin = pin.trim();
    if (cleanPin.length < 3) {
      return { success: false, error: "O PIN deve ter no mínimo 3 caracteres." };
    }

    const salt = generateSalt();
    const hash = await hashPin(cleanPin, salt);

    const payload = JSON.stringify({
      hash,
      salt,
      created_at: new Date().toISOString(),
    });

    const { error } = await supabase.from("gm_notes").upsert({
      id: MASTER_CONFIG_ID,
      content: payload,
    });

    if (error) {
      return { success: false, error: "Falha ao salvar PIN no servidor: " + error.message };
    }

    // Salva a sessão ativa localmente
    storeLocalUnlock(hash, true);
    return { success: true };
  } catch (err) {
    return { success: false, error: "Erro inesperado ao salvar PIN." };
  }
}

/** Verifica se um PIN fornecido bate com o hash registrado. */
export async function verifyMasterPin(
  pin: string,
  config: MasterConfig,
  remember = false,
): Promise<{ success: boolean; error?: string }> {
  if (!config.configured || !config.hash || !config.salt) {
    return { success: false, error: "PIN do mestre ainda não foi configurado." };
  }

  const computedHash = await hashPin(pin, config.salt);
  if (computedHash === config.hash) {
    storeLocalUnlock(config.hash, remember);
    return { success: true };
  }

  return { success: false, error: "PIN incorreto. Tente novamente." };
}

/** Altera o PIN de mestre requerendo o PIN atual. */
export async function changeMasterPin(
  currentPin: string,
  newPin: string,
  config: MasterConfig,
): Promise<{ success: boolean; error?: string }> {
  const check = await verifyMasterPin(currentPin, config);
  if (!check.success) {
    return { success: false, error: "PIN atual incorreto." };
  }

  return saveMasterPin(newPin);
}

/** Armazena o token de desbloqueio em sessionStorage e opcionalmente em localStorage. */
export function storeLocalUnlock(hash: string, remember: boolean) {
  if (typeof window === "undefined") return;
  const token = hash.slice(0, 24);
  sessionStorage.setItem(SESSION_KEY, token);
  if (remember) {
    localStorage.setItem(LOCAL_KEY, token);
  } else {
    localStorage.removeItem(LOCAL_KEY);
  }
}

/** Limpa a sessão do mestre (bloqueia o acesso). */
export function clearMasterSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCAL_KEY);
}

/** Checa se o navegador atual possui sessão válida com base no hash ativo. */
export function checkHasActiveSession(hash?: string): boolean {
  if (typeof window === "undefined" || !hash) return false;
  const expectedToken = hash.slice(0, 24);
  const sessionToken = sessionStorage.getItem(SESSION_KEY);
  if (sessionToken && sessionToken === expectedToken) return true;

  const localToken = localStorage.getItem(LOCAL_KEY);
  if (localToken && localToken === expectedToken) {
    sessionStorage.setItem(SESSION_KEY, localToken);
    return true;
  }

  return false;
}
