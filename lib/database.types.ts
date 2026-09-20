/**
 * Tipos de la base de datos.
 *
 * Escritos a mano para que el proyecto arranque sin depender del CLI.
 * Cuando cambies el esquema puedes regenerarlos con:
 *   npx supabase gen types typescript --project-id <tu-id> > lib/database.types.ts
 */

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid";
export type OrderChannel = "online" | "manual";
export type OrderType = "pickup" | "delivery";
export type PaymentTiming = "prepaid" | "on_delivery";

export type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeliveryZone = {
  id: string;
  name: string;
  fee: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreSettings = {
  id: boolean;
  store_name: string;
  whatsapp_phone: string | null;
  store_address: string | null;
  accepting_orders: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  min_order: number;
  prep_time_minutes: number;
  payment_instructions: string | null;
  closed_message: string | null;
  updated_at: string;
};

export type Order = {
  id: string;
  code: string;
  public_token: string;
  channel: OrderChannel;
  order_type: OrderType;
  customer_name: string;
  customer_phone: string | null;
  delivery_zone_id: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  customer_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  delivery_quoted: boolean;
  total: number;
  status: OrderStatus;
  cancel_reason: string | null;
  payment_status: PaymentStatus;
  payment_timing: PaymentTiming;
  payment_method: string | null;
  payment_ref: string | null;
  cash_received: number | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  qty: number;
  notes: string | null;
  line_total: number;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  note: string | null;
  actor: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      categories: Table<Category, Omit<Category, "id" | "created_at" | "updated_at">>;
      products: Table<Product, Omit<Product, "id" | "created_at" | "updated_at">>;
      delivery_zones: Table<DeliveryZone, Omit<DeliveryZone, "id" | "created_at" | "updated_at">>;
      store_settings: Table<StoreSettings>;
      orders: Table<Order>;
      order_items: Table<OrderItem>;
      order_events: Table<OrderEvent>;
      order_counters: Table<{ day: string; last_number: number }>;
      admins: Table<{ user_id: string; label: string | null; created_at: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_order: {
        Args: { payload: CreateOrderPayload };
        Returns: CreateOrderResult;
      };
      edit_order: {
        Args: { p_order_id: string; payload: EditOrderPayload };
        Returns: {
          subtotal: number;
          delivery_fee: number;
          delivery_quoted: boolean;
          total: number;
        };
      };
      quote_delivery: {
        Args: { p_order_id: string; p_zone_id?: string | null; p_fee?: number | null };
        Returns: { delivery_fee: number; total: number };
      };
      get_order_public: {
        Args: { p_token: string };
        Returns: PublicOrder | null;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      order_channel: OrderChannel;
      order_type: OrderType;
      payment_timing: PaymentTiming;
    };
    CompositeTypes: Record<string, never>;
  };
};

/** Lo que se le manda a create_order(). Los precios NO viajan: los pone el servidor. */
export type CreateOrderPayload = {
  channel?: OrderChannel;
  customer_name: string;
  customer_phone?: string | null;
  order_type: OrderType;
  /** Solo lo manda el panel: el cliente no cotiza su propio domicilio. */
  delivery_zone_id?: string | null;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  customer_notes?: string | null;
  payment_timing?: PaymentTiming;
  payment_method?: string | null;
  payment_ref?: string | null;
  cash_received?: number | null;
  mark_paid?: boolean;
  items: { product_id: string; qty: number; notes?: string | null }[];
};

export type EditOrderPayload = {
  customer_name: string;
  customer_phone?: string | null;
  order_type: OrderType;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  customer_notes?: string | null;
  items: { product_id: string; qty: number; notes?: string | null }[];
};

export type CreateOrderResult = {
  id: string;
  code: string;
  public_token: string;
  subtotal: number;
  delivery_fee: number;
  delivery_quoted: boolean;
  total: number;
};

/** Lo que ve el cliente al seguir su pedido con el token. */
export type PublicOrder = {
  code: string;
  status: OrderStatus;
  order_type: OrderType;
  customer_name: string;
  delivery_address: string | null;
  customer_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  /** false = el local todavía no le ha puesto valor al domicilio */
  delivery_quoted: boolean;
  total: number;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_ref: string | null;
  paid_at: string | null;
  created_at: string;
  items: Pick<OrderItem, "product_name" | "unit_price" | "qty" | "notes" | "line_total">[];
};

export type ProductWithCategory = Product & { category: Pick<Category, "id" | "name" | "slug"> };
export type OrderWithItems = Order & {
  order_items: OrderItem[];
  delivery_zone: Pick<DeliveryZone, "name" | "fee"> | null;
};
