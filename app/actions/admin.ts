"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CreateOrderResult, OrderStatus } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

/**
 * Todas las acciones del panel pasan por aquí.
 *
 * La autorización real la hace la base de datos con RLS e is_admin();
 * esta comprobación solo sirve para devolver un mensaje entendible en
 * vez de un error de permisos críptico.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  if (!data) return { supabase, admin: false as const };
  return { supabase, admin: true as const };
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/entregas");
  revalidatePath("/admin/historial");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}

// ---------------------------------------------------------------- pedidos

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  cancelReason?: string,
): Promise<ActionResult> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase
    .from("orders")
    .update({
      status,
      cancel_reason: status === "cancelled" ? (cancelReason ?? null) : null,
    })
    .eq("id", orderId);

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

/**
 * El local le pone valor al domicilio viendo la dirección.
 *
 * El cliente no elige su zona en el checkout: no conoce las zonas del
 * negocio y, si pudiera elegir, siempre marcaría la más barata.
 */
export async function quoteDelivery(
  orderId: string,
  input: { zoneId?: string | null; fee?: number | null },
): Promise<ActionResult> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  if (!input.zoneId && (input.fee == null || input.fee < 0)) {
    return fail("Elige una zona o escribe un valor");
  }

  const { error } = await supabase.rpc("quote_delivery", {
    p_order_id: orderId,
    p_zone_id: input.zoneId ?? null,
    p_fee: input.zoneId ? null : (input.fee ?? 0),
  });

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

const paymentSchema = z.object({
  method: z.string().trim().min(1, "Elige el medio de pago").max(40),
  reference: z.string().trim().max(60).optional().nullable(),
  cashReceived: z.number().int().min(0).nullable().optional(),
});

export async function markOrderPaid(
  orderId: string,
  input: z.input<typeof paymentSchema>,
): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: parsed.data.method,
      payment_ref: parsed.data.reference || null,
      cash_received: parsed.data.cashReceived ?? null,
    })
    .eq("id", orderId);

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

export async function markOrderUnpaid(orderId: string): Promise<ActionResult> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "pending",
      payment_method: null,
      payment_ref: null,
      cash_received: null,
    })
    .eq("id", orderId);

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

const manualOrderSchema = z.object({
  customer_name: z.string().trim().min(1, "Escribe el nombre del cliente").max(80),
  customer_phone: z.string().trim().max(20).optional().nullable(),
  order_type: z.enum(["pickup", "delivery"]),
  delivery_zone_id: z.uuid().nullable().optional(),
  delivery_address: z.string().trim().max(200).optional().nullable(),
  customer_notes: z.string().trim().max(400).optional().nullable(),
  mark_paid: z.boolean().optional(),
  payment_method: z.string().trim().max(40).optional().nullable(),
  payment_ref: z.string().trim().max(60).optional().nullable(),
  cash_received: z.number().int().min(0).nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.uuid(),
        qty: z.number().int().min(1).max(99),
        notes: z.string().trim().max(160).optional().nullable(),
      }),
    )
    .min(1, "Agrega al menos un producto"),
});

export type ManualOrderInput = z.input<typeof manualOrderSchema>;

/** Pedido tomado por teléfono o en mostrador. Entra por la misma puerta que el online. */
export async function createManualOrder(
  input: z.input<typeof manualOrderSchema>,
): Promise<ActionResult<CreateOrderResult>> {
  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { data, error } = await supabase.rpc("create_order", {
    payload: { ...parsed.data, channel: "manual" },
  });

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true, data: data as CreateOrderResult };
}

// ---------------------------------------------------------------- productos

const editOrderSchema = z.object({
  customer_name: z.string().trim().min(1, "Escribe el nombre del cliente").max(80),
  customer_phone: z.string().trim().max(20).nullable().optional(),
  order_type: z.enum(["pickup", "delivery"]),
  delivery_address: z.string().trim().max(200).nullable().optional(),
  delivery_notes: z.string().trim().max(200).nullable().optional(),
  customer_notes: z.string().trim().max(400).nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.uuid(),
        qty: z.number().int().min(1).max(99),
        notes: z.string().trim().max(160).nullable().optional(),
      }),
    )
    .min(1, "El pedido no puede quedar sin productos"),
});

/** Editar un pedido ya creado: productos, cantidades, datos y tipo de entrega. */
export async function editOrder(
  orderId: string,
  input: z.input<typeof editOrderSchema>,
): Promise<ActionResult> {
  const parsed = editOrderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  if (parsed.data.order_type === "delivery" && !parsed.data.delivery_address) {
    return fail("Un pedido a domicilio necesita dirección");
  }

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase.rpc("edit_order", {
    p_order_id: orderId,
    payload: parsed.data,
  });

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

/**
 * Borra un pedido de verdad, con sus productos y su bitácora.
 *
 * Para un pedido real lo correcto es cancelarlo: así queda el registro de
 * que existió y por qué no se hizo. Esto es para los que nunca debieron
 * existir — pruebas, duplicados, un pedido tecleado en el cliente
 * equivocado.
 */
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

const productSchema = z.object({
  id: z.uuid().optional(),
  category_id: z.uuid("Elige una categoría"),
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  description: z.string().trim().max(200).optional().nullable(),
  price: z.number().int("El precio debe ser un número entero").min(0).max(10_000_000),
  image_url: z.string().trim().max(500).optional().nullable(),
  is_available: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function saveProduct(
  input: z.input<typeof productSchema>,
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { id, ...parsedValues } = parsed.data;
  const values = {
    ...parsedValues,
    description: parsedValues.description ?? null,
    image_url: parsedValues.image_url ?? null,
  };

  if (id) {
    const { error } = await supabase.from("products").update(values).eq("id", id);
    if (error) return fail(error.message);
  } else {
    // El slug tiene que ser único; si el nombre se repite se le añade un sufijo.
    const base = slugify(values.name) || "producto";
    const { error } = await supabase
      .from("products")
      .insert({ ...values, slug: `${base}-${Date.now().toString(36).slice(-4)}` });
    if (error) return fail(error.message);
  }

  revalidateAdmin();
  return { ok: true };
}

export async function toggleProductAvailability(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", id);

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

/**
 * Los productos no se borran: se archivan.
 * Borrarlos rompería el historial de pedidos que los referencia.
 */
export async function archiveProduct(id: string): Promise<ActionResult> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

// ---------------------------------------------------------------- categorías

export async function saveCategory(name: string, sortOrder = 99): Promise<ActionResult> {
  const clean = name.trim();
  if (clean.length < 2) return fail("Escribe el nombre de la categoría");

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase
    .from("categories")
    .insert({ name: clean, slug: slugify(clean), sort_order: sortOrder, is_active: true });

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

// ---------------------------------------------------------------- configuración

const settingsSchema = z.object({
  store_name: z.string().trim().min(2).max(60),
  whatsapp_phone: z.string().trim().max(20).optional().nullable(),
  store_address: z.string().trim().max(160).optional().nullable(),
  accepting_orders: z.boolean(),
  delivery_enabled: z.boolean(),
  pickup_enabled: z.boolean(),
  min_order: z.number().int().min(0).max(10_000_000),
  prep_time_minutes: z.number().int().min(0).max(240),
  payment_instructions: z.string().trim().max(300).optional().nullable(),
  closed_message: z.string().trim().max(200).optional().nullable(),
});

export async function saveSettings(
  input: z.input<typeof settingsSchema>,
): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", true);
  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}

const zoneSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Escribe el nombre de la zona").max(60),
  // El municipio vive en la zona porque cada uno tiene su tarifa, y
  // porque es lo que decide a dónde navega el repartidor.
  city: z.string().trim().max(80).nullable().optional(),
  fee: z.number().int().min(0).max(1_000_000),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
});

export async function saveDeliveryZone(
  input: z.input<typeof zoneSchema>,
): Promise<ActionResult> {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { supabase, admin } = await requireAdmin();
  if (!admin) return fail("Tu cuenta no tiene permisos de administrador");

  const { id, ...parsedZone } = parsed.data;
  const values = { ...parsedZone, city: parsedZone.city || null };
  const { error } = id
    ? await supabase.from("delivery_zones").update(values).eq("id", id)
    : await supabase.from("delivery_zones").insert(values);

  if (error) return fail(error.message);

  revalidateAdmin();
  return { ok: true };
}
