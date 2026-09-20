"use client";

import { AlertCircle, Loader2, Lock } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Correo o contraseña incorrectos");
      setLoading(false);
      return;
    }

    // refresh() hace que el servidor vuelva a leer la sesión recién creada.
    router.replace(params.get("next") || "/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-line bg-white p-7"
      >
        <div className="mb-6 text-center">
          <Image
            src="/img/logo_ss.png"
            alt=""
            width={56}
            height={56}
            className="mx-auto size-14 object-contain"
          />
          <h1 className="mt-3 text-xl font-extrabold">Panel del local</h1>
          <p className="text-sm text-ink-muted">Entra para gestionar los pedidos</p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-bold">Correo</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1.5 block text-sm font-bold">Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400"
          />
        </label>

        {error && (
          <p className="mb-4 flex items-center gap-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          Entrar
        </button>
      </form>
    </main>
  );
}
