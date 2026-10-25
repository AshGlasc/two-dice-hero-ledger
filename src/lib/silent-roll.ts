import { useSyncExternalStore } from "react";

// Rolagem silenciosa: escolha deste navegador. Quando ligada, a rolagem só aparece
// para quem rolou (e para o mestre), nunca no aviso dos outros jogadores.
const KEY = "eco_caidos_silent_roll";
const listeners = new Set<() => void>();

export function isSilentRoll(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(KEY) === "on";
}

export function setSilentRoll(on: boolean) {
  localStorage.setItem(KEY, on ? "on" : "off");
  for (const l of listeners) l();
}

export function useSilentRoll(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    isSilentRoll,
    () => false,
  );
}

/** Quem deve ver o aviso de uma rolagem que chegou de outra tela. */
export function shouldAnnounce(roll: { hidden: boolean }, viewerIsMaster: boolean): boolean {
  return !roll.hidden || viewerIsMaster;
}
