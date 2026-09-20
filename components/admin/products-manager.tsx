"use client";

import { Archive, FolderPlus, ImageIcon, Loader2, Pencil, Plus, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  archiveProduct,
  saveCategory,
  saveProduct,
  toggleProductAvailability,
} from "@/app/actions/admin";
import type { Category, Product } from "@/lib/database.types";
import { cn, currency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

type Props = { categories: Category[]; products: Product[] };

type Draft = {
  id?: string;
  category_id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  is_available: boolean;
  is_active: boolean;
  sort_order: string;
};

const emptyDraft = (categoryId: string): Draft => ({
  category_id: categoryId,
  name: "",
  description: "",
  price: "",
  image_url: "",
  is_available: true,
  is_active: true,
  sort_order: "99",
});

export function ProductsManager({ categories, products }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(
    () =>
      categories.map((category) => ({
        category,
        items: products.filter(
          (p) => p.category_id === category.id && (showArchived || p.is_active),
        ),
      })),
    [categories, products, showArchived],
  );

  function newCategory() {
    const name = window.prompt("Nombre de la nueva categoría");
    if (!name) return;
    startTransition(async () => {
      const result = await saveCategory(name, categories.length + 1);
      if (!result.ok) window.alert(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Carta</h1>
          <p className="text-xs text-ink-muted">
            Los cambios de precio se ven de inmediato en la carta pública.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="size-4"
            />
            Ver archivados
          </label>
          <button
            type="button"
            onClick={newCategory}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold"
          >
            <FolderPlus className="size-4" />
            Categoría
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft(categories[0]?.id ?? ""))}
            disabled={categories.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            <Plus className="size-4" />
            Producto
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {grouped.map(({ category, items }) => (
          <section key={category.id}>
            <h2 className="mb-2 text-sm font-extrabold tracking-wide text-ink-muted uppercase">
              {category.name}
            </h2>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-ink-muted">
                Sin productos en esta categoría.
              </p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {items.map((product) => (
                  <li
                    key={product.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-white p-3",
                      product.is_active ? "border-line" : "border-dashed border-line opacity-60",
                    )}
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cream">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-ink-muted">
                          <ImageIcon className="size-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{product.name}</p>
                      <p className="text-sm font-semibold text-brand-600">
                        {currency(product.price)}
                      </p>
                    </div>

                    <label
                      className="flex cursor-pointer flex-col items-center gap-1"
                      title="Disponible hoy"
                    >
                      <input
                        type="checkbox"
                        checked={product.is_available}
                        onChange={(event) =>
                          startTransition(async () => {
                            const result = await toggleProductAvailability(
                              product.id,
                              event.target.checked,
                            );
                            if (!result.ok) window.alert(result.error);
                            else router.refresh();
                          })
                        }
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "relative h-6 w-11 rounded-full transition",
                          product.is_available ? "bg-ok" : "bg-line",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                            product.is_available ? "left-[22px]" : "left-0.5",
                          )}
                        />
                      </span>
                      <span className="text-[10px] font-semibold text-ink-muted">
                        {product.is_available ? "Hay" : "Agotado"}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          id: product.id,
                          category_id: product.category_id,
                          name: product.name,
                          description: product.description ?? "",
                          price: String(product.price),
                          image_url: product.image_url ?? "",
                          is_available: product.is_available,
                          is_active: product.is_active,
                          sort_order: String(product.sort_order),
                        })
                      }
                      aria-label={`Editar ${product.name}`}
                      className="grid size-9 place-items-center rounded-xl border border-line text-ink-muted"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {draft && (
        <ProductDialog
          draft={draft}
          categories={categories}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductDialog({
  draft,
  categories,
  onChange,
  onClose,
  onSaved,
}: {
  draft: Draft;
  categories: Category[];
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    onChange({ ...draft, [key]: value });

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("productos")
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("productos").getPublicUrl(path);
      set("image_url", data.publicUrl);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo subir la imagen. Revisa que el bucket «productos» exista.",
      );
    } finally {
      setUploading(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await saveProduct({
        id: draft.id,
        category_id: draft.category_id,
        name: draft.name,
        description: draft.description || null,
        price: Number(draft.price || 0),
        image_url: draft.image_url || null,
        is_available: draft.is_available,
        is_active: draft.is_active,
        sort_order: Number(draft.sort_order || 99),
      });

      if (!result.ok) setError(result.error);
      else onSaved();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="animate-in-up flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-extrabold">
            {draft.id ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full bg-cream"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="flex items-center gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cream">
              {draft.image_url ? (
                <Image src={draft.image_url} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-ink-muted">
                  <ImageIcon className="size-6" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Subiendo…" : "Subir foto"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
              <p className="mt-1 text-[11px] text-ink-muted">JPG o PNG, menos de 2 MB.</p>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-bold">Nombre</span>
            <input
              required
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              maxLength={80}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold">Descripción</span>
            <textarea
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              rows={2}
              maxLength={200}
              placeholder="Carne 150 g, queso, tocineta y papas"
              className={cn(inputClass, "resize-none")}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Precio</span>
              <input
                required
                value={draft.price}
                onChange={(event) => set("price", event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Orden</span>
              <input
                value={draft.sort_order}
                onChange={(event) => set("sort_order", event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-bold">Categoría</span>
            <select
              value={draft.category_id}
              onChange={(event) => set("category_id", event.target.value)}
              className={inputClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.is_available}
              onChange={(event) => set("is_available", event.target.checked)}
              className="size-4"
            />
            Disponible hoy
          </label>

          {error && (
            <p className="rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{error}</p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-line px-5 py-4">
          {draft.id && draft.is_active && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("¿Archivar este producto? Sale de la carta, pero el historial de pedidos se conserva.")) return;
                startTransition(async () => {
                  const result = await archiveProduct(draft.id!);
                  if (!result.ok) setError(result.error);
                  else onSaved();
                });
              }}
              className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-3 text-sm font-semibold text-bad"
            >
              <Archive className="size-4" />
              Archivar
            </button>
          )}
          <button
            type="submit"
            disabled={pending || uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400";
