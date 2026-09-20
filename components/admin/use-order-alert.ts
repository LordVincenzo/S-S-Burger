"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Aviso sonoro de pedido nuevo.
 *
 * El sonido se sintetiza con WebAudio en vez de cargar un mp3: no hay
 * archivo que se caiga y suena igual en cualquier navegador. Eso sí, los
 * navegadores no dejan sonar nada hasta que la persona interactúe con la
 * página, así que el panel muestra un botón para "activar el sonido".
 */
export function useOrderAlert() {
  const contextRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(async () => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      contextRef.current ??= new Ctor();
      await contextRef.current.resume();
      setEnabled(true);

      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {
      /* sin audio disponible: el panel sigue funcionando en silencio */
    }
  }, []);

  const play = useCallback(() => {
    const ctx = contextRef.current;
    if (!ctx) return;

    // Dos notas cortas, como una campana de mostrador.
    [0, 0.18].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = index === 0 ? 880 : 1175;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.18);
    });
  }, []);

  const notify = useCallback((title: string, body: string) => {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/img/logo_ss.png", tag: "pedido" });
      }
    } catch {
      /* el aviso visual del panel ya cubre el caso */
    }
  }, []);

  useEffect(() => () => void contextRef.current?.close(), []);

  return { enabled, enable, play, notify };
}
