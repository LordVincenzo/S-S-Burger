"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { Product } from "@/lib/database.types";

const STORAGE_KEY = "ssburger_cart_v1";

export type CartLine = { productId: string; qty: number; notes: string };
type CartState = Record<string, CartLine>;

/*
 * El carrito vive fuera de React, en un store diminuto que se sincroniza
 * con localStorage.
 *
 * Se hace así y no con useState + useEffect porque el servidor no puede
 * saber qué hay guardado en el navegador: si se leyera durante el render,
 * el HTML del servidor y el del cliente no coincidirían. useSyncExternalStore
 * resuelve justo eso — sirve un carrito vacío en el servidor y el real en
 * cuanto el componente se monta.
 */

const EMPTY: CartState = {};

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartState) : EMPTY;
  } catch {
    // Navegación privada o almacenamiento bloqueado: el carrito solo vive
    // en memoria. No es motivo para romper la página.
    return EMPTY;
  }
}

function writeStorage(value: CartState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* sin almacenamiento, seguimos en memoria */
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!loaded) {
    loaded = true;
    state = readStorage();
    emit();
  }

  return () => {
    listeners.delete(listener);
  };
}

function update(next: CartState) {
  state = next;
  writeStorage(next);
  emit();
}

function withoutKey(source: CartState, key: string): CartState {
  const next = { ...source };
  delete next[key];
  return next;
}

export function useCart(products: Product[]) {
  const cart = useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const add = useCallback((productId: string) => {
    update({
      ...state,
      [productId]: {
        productId,
        qty: Math.min((state[productId]?.qty ?? 0) + 1, 99),
        notes: state[productId]?.notes ?? "",
      },
    });
  }, []);

  const remove = useCallback((productId: string) => {
    const qty = state[productId]?.qty ?? 0;
    if (qty <= 1) {
      update(withoutKey(state, productId));
      return;
    }
    update({ ...state, [productId]: { ...state[productId], qty: qty - 1 } });
  }, []);

  const drop = useCallback((productId: string) => {
    update(withoutKey(state, productId));
  }, []);

  const setNotes = useCallback((productId: string, notes: string) => {
    if (!state[productId]) return;
    update({ ...state, [productId]: { ...state[productId], notes } });
  }, []);

  const clear = useCallback(() => update(EMPTY), []);

  // Si el admin marca un producto como agotado, deja de contar aunque
  // siga guardado en este navegador.
  const lines = useMemo(
    () =>
      Object.values(cart)
        .map((line) => ({ ...line, product: byId.get(line.productId) }))
        .filter(
          (line): line is CartLine & { product: Product } =>
            Boolean(line.product?.is_available),
        ),
    [cart, byId],
  );

  const count = lines.reduce((acc, line) => acc + line.qty, 0);
  const subtotal = lines.reduce((acc, line) => acc + line.product.price * line.qty, 0);

  return { cart, lines, count, subtotal, add, remove, drop, setNotes, clear };
}
