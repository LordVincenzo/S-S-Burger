"use server";

import { z } from "zod";

import type { CreateOrderResult } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

const itemSchema = z.object({
  product_id: z.uuid(),
  qty: z.number().int().min(1).max(99),
  notes: z.string().trim().max(160).optional().nullable(),
});

const checkoutSchema = z
  .object({
    customer_name: z.string().trim().min(2, "Escribe tu nombre").max(80),
    customer_phone: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length >= 7, "El teléfono no es válido"),
    order_type: z.enum(["pickup", "delivery"]),
    // Sin delivery_zone_id a propósito: el cliente no cotiza su propio
    // domicilio. Manda la dirección y el municipio, y el local le pone
    // el valor.
    delivery_address: z.string().trim().max(200).optional().nullable(),
    delivery_city: z.string().trim().max(80).optional().nullable(),
    delivery_notes: z.string().trim().max(200).optional().nullable(),
    customer_notes: z.string().trim().max(400).optional().nullable(),
    payment_method: z.string().trim().max(40).optional().nullable(),
    cash_received: z.number().int().min(0).nullable().optional(),
    items: z.array(itemSchema).min(1, "Tu carrito está vacío").max(50),
  })
  .refine(
    (data) => data.order_type !== "delivery" || !!data.delivery_address,
    { message: "Falta la dirección de entrega", path: ["delivery_address"] },
  );

export type CheckoutInput = z.input<typeof checkoutSchema>;

export type SubmitOrderResult =
  | { ok: true; order: CreateOrderResult }
  | { ok: false; error: string; field?: string };

/**
 * Crea el pedido del cliente.
 *
 * Los precios NO se mandan desde el navegador: solo van los ids y las
 * cantidades. create_order() los vuelve a leer de la base y calcula el
 * total allá. Es la única forma de que nadie se pida una hamburguesa
 * por $1.000 editando la petición.
 */
export async function submitOrder(input: CheckoutInput): Promise<SubmitOrderResult> {
  const parsed = checkoutSchema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, field: issue.path.join(".") };
  }

  // Cliente sin cookies a propósito.
  //
  // El cliente de servidor normal arrastra la sesión del navegador, y si
  // el dueño abre su propia carta teniendo el panel abierto, el pedido
  // llegaría firmado como administrador. La carta es pública: sus pedidos
  // se crean sin identidad, mire quien mire.
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("create_order", {
    payload: {
      ...parsed.data,
      channel: "online",
      payment_timing: "on_delivery",
    },
  });

  if (error) {
    // Los mensajes de las excepciones P0001 están escritos para el cliente
    // ("La tienda no está recibiendo pedidos...") y se pueden mostrar tal cual.
    return { ok: false, error: error.message || "No pudimos registrar tu pedido" };
  }

  return { ok: true, order: data as CreateOrderResult };
}
