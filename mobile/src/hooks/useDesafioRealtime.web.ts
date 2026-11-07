import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { io, type Socket } from "socket.io-client";
import { obtenerToken } from "@/auth/session";
import { API_URL } from "@/api/client";
import {
  CHANGE_EVENTS,
  EMOJIS,
  type Aliento,
  type Change,
  type ServerEvents,
  type ClientEvents,
} from "./realtimeTypes";

export function useDesafioRealtime(
  desafioIdOriginal: string,
  personaId: string | undefined,
  habilitado: boolean,
  refrescar: () => Promise<void>,
) {
  const desafioId = desafioIdOriginal.toLowerCase();
  const [estado, setEstado] = useState("Desconectado");
  const [error, setError] = useState("");
  const [alientos, setAlientos] = useState<Aliento[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enEspera, setEnEspera] = useState(false);
  const [aviso, setAviso] = useState("");
  const [intento, setIntento] = useState(0);
  const refreshRef = useRef(refrescar);
  const enviarRef = useRef<((emoji: string) => void) | null>(null);
  useEffect(() => {
    refreshRef.current = refrescar;
  }, [refrescar]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      let joined = false;
      let revoked = false;
      let sending = false;
      let waiting = false;
      let refreshing = false;
      let dirty = false;
      let renewing = false;
      let authRetries = 0;

      let cooldown: ReturnType<typeof setTimeout> | undefined;
      setAlientos([]);
      setError("");
      setAviso("");
      setEnviando(false);
      setEnEspera(false);
      if (!habilitado || !personaId || !API_URL) {
        setEstado(habilitado ? "Falta configurar la API" : "Sin sala activa");
        return () => {
          live = false;
        };
      }
      setEstado("Conectando");
      let refreshOnConnect = intento > 0;
      const socket: Socket<ServerEvents, ClientEvents> = io(
        API_URL.replace(/\/$/, "") + "/rachas",
        {
          autoConnect: false,
          forceNew: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          auth: (callback) => {
            const force = refreshOnConnect;
            refreshOnConnect = false;
            void obtenerToken(force)
              .then((token) => {
                if (live) callback({ token });
              })
              .catch(() => {
                if (live) callback({ token: null });
              });
          },
        },
      );

      async function reload() {
        dirty = true;
        if (refreshing) return;
        refreshing = true;
        try {
          while (dirty && live) {
            dirty = false;
            await refreshRef.current();
          }
        } finally {
          refreshing = false;
        }
      }

      async function subscribe() {
        try {
          const response = await socket
            .timeout(8000)
            .emitWithAck("desafio:suscribir", { desafioId });
          if (!live || revoked) return;
          if (!response.ok) {
            setEstado("Sin suscripción");
            setError(response.message);
            await reload();
            return;
          }
          joined = true;
          authRetries = 0;
          setEstado("Conectado");
          setError("");
          // El estado perdido durante una desconexión siempre se recupera por HTTP.
          await reload();
        } catch {
          if (live) {
            setEstado("Sin suscripción");
            setError("No se pudo confirmar la sala. Volvé a conectar.");
          }
        }
      }

      async function renew() {
        if (!live || renewing || revoked) return;
        renewing = true;
        try {
          const token = await obtenerToken(true);
          if (!live || revoked) return;
          if (!token) throw new Error("Sin sesión");
          socket.connect();
        } catch {
          if (live) {
            setEstado("Desconectado");
            setError("No se pudo renovar la sesión. Volvé a ingresar.");
          }
        } finally {
          renewing = false;
        }
      }

      function changed(event: Change) {
        if (live && !revoked && event.desafioId === desafioId) void reload();
      }
      function received(event: Aliento) {
        if (
          !live ||
          !joined ||
          revoked ||
          event.desafioId !== desafioId ||
          !EMOJIS.some((emoji) => emoji === event.emoji)
        )
          return;
        setAlientos((previous) =>
          previous.some((item) => item.id === event.id)
            ? previous
            : [...previous, event].slice(-20),
        );
      }
      function startCooldown(ms: number) {
        waiting = true;
        setEnEspera(true);
        clearTimeout(cooldown);
        cooldown = setTimeout(
          () => {
            waiting = false;
            if (live) setEnEspera(false);
          },
          Math.max(1, Math.min(ms, 10000)),
        );
      }
      async function send(emoji: string) {
        if (
          !live ||
          revoked ||
          !joined ||
          !socket.connected ||
          sending ||
          waiting
        )
          return;
        sending = true;
        setEnviando(true);
        setError("");
        setAviso("");
        try {
          const response = await socket
            .timeout(8000)
            .emitWithAck("aliento:enviar", { desafioId, emoji });
          if (!live) return;
          if (response.ok) {
            setAviso("Aliento enviado.");
            startCooldown(10000);
          } else {
            setError(response.message);
            if (response.code === "RATE_LIMIT")
              startCooldown(response.retryAfterMs ?? 10000);
          }
        } catch {
          if (live)
            setError(
              "No se confirmó el envío. Revisá la conexión; no se reenvía automáticamente.",
            );
        } finally {
          sending = false;
          if (live) setEnviando(false);
        }
      }

      enviarRef.current = (emoji) => {
        void send(emoji);
      };
      socket.on("connect", () => {
        if (live) void subscribe();
      });
      socket.on("connect_error", (e: Error & { data?: { code?: string } }) => {
        if (!live) return;
        joined = false;
        setEstado("Desconectado");
        if (e.data?.code === "AUTH_REQUIRED" && authRetries++ < 1) {
          void renew();
        } else {
          if (e.data) socket.disconnect();
          setError(
            e.data
              ? "No se pudo autorizar el socket. Revisá tu sesión y perfil."
              : "No se pudo conectar en tiempo real. Revisá el servidor y los orígenes permitidos.",
          );
        }
      });
      socket.on("disconnect", (reason) => {
        joined = false;
        if (!live || revoked) return;
        setEstado("Reconectando");
        if (reason === "io server disconnect") {
          void renew();
        }
      });
      socket.on("sesion:expirada", () => {
        if (live) setEstado("Renovando sesión");
      });
      socket.on("sala:revocada", (event) => {
        if (!live || event.desafioId !== desafioId) return;
        revoked = true;
        joined = false;
        setEstado("Suscripción cerrada");
        setError(event.message);
        socket.disconnect();
        void reload();
      });
      for (const event of CHANGE_EVENTS) socket.on(event, changed);
      socket.on("aliento:recibido", received);
      socket.connect();

      return () => {
        live = false;
        joined = false;
        enviarRef.current = null;
        clearTimeout(cooldown);
        socket.removeAllListeners();
        socket.disconnect();
      };
    }, [desafioId, personaId, habilitado, intento]),
  );

  return {
    estado,
    error,
    alientos: alientos.filter((event) => event.desafioId === desafioId),
    enviando,
    enEspera,
    aviso,
    enviar: useCallback((emoji: string) => {
      enviarRef.current?.(emoji);
    }, []),
    reconectar: useCallback(() => setIntento((value) => value + 1), []),
  };
}
