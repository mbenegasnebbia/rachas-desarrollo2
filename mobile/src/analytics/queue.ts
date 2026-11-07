export interface Properties {
  ingreso_exitoso: Record<string, never>;
  desafio_creado: { desafio_id: string; categoria: string };
  desafio_unido: { desafio_id: string };
  checkin_hecho: { desafio_id: string };
  ranking_consultado: { desafio_id: string };
  racha_perdida: { desafio_id: string; racha_anterior: number };
  aviso_actualizacion_mostrado: {
    tipo: "recomendada" | "obligatoria";
    version_objetivo: string;
  };
}
export interface UsageEvent {
  eventId: string;
  name: keyof Properties;
  occurredAt: string;
  appVersion: string;
  platform: string;
  properties: Properties[keyof Properties];
}
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
const AGE = 7 * 86400000;
const MAX = 200;
const prefix = "rachas.analytics.v1.";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const version = (v: unknown) =>
  typeof v === "string" &&
  v.length <= 20 &&
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v);
export function validEvent(value: unknown, now: number): value is UsageEvent {
  if (
    !object(value) ||
    Object.keys(value).sort().join() !==
      "appVersion,eventId,name,occurredAt,platform,properties" ||
    typeof value.eventId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value.eventId,
    ) ||
    !version(value.appVersion) ||
    !["web", "android", "ios"].includes(value.platform as string) ||
    typeof value.occurredAt !== "string" ||
    !object(value.properties)
  )
    return false;
  const time = Date.parse(value.occurredAt);
  if (
    !Number.isFinite(time) ||
    time < now - AGE ||
    time > now + 300000 ||
    new Date(time).toISOString() !== value.occurredAt
  )
    return false;
  const p = value.properties,
    keys = Object.keys(p).sort().join();
  const id =
    typeof p.desafio_id === "string" && /^[a-f0-9]{24}$/i.test(p.desafio_id);
  switch (value.name) {
    case "ingreso_exitoso":
      return keys === "";
    case "desafio_creado":
      return (
        keys === "categoria,desafio_id" &&
        id &&
        ["SALUD", "ESTUDIO", "FINANZAS", "BIENESTAR", "OTRO"].includes(
          p.categoria as string,
        )
      );
    case "desafio_unido":
    case "checkin_hecho":
    case "ranking_consultado":
      return keys === "desafio_id" && id;
    case "racha_perdida":
      return (
        keys === "desafio_id,racha_anterior" &&
        id &&
        Number.isInteger(p.racha_anterior) &&
        Number(p.racha_anterior) > 0 &&
        Number(p.racha_anterior) <= 90
      );
    case "aviso_actualizacion_mostrado":
      return (
        keys === "tipo,version_objetivo" &&
        ["obligatoria", "recomendada"].includes(p.tipo as string) &&
        version(p.version_objetivo)
      );
    default:
      return false;
  }
}
interface Snapshot {
  day: string;
  streak: number;
}
export class AnalyticsQueue {
  private uid: string | null = null;
  private enabled = false;
  private generation = 0;
  private events: UsageEvent[] = [];
  private streaks: Record<string, Snapshot> = {};
  private io = Promise.resolve();
  private sending = false;
  private dirty = false;
  private saving = false;
  constructor(
    private storage: Storage,
    private send: (events: UsageEvent[], uid: string) => Promise<string[]>,
    private id: () => string,
    private metadata: { appVersion: string; platform: string },
    private now: () => number = Date.now,
  ) {}
  private key(uid: string) {
    return prefix + uid;
  }
  private schedule(task: () => Promise<void>) {
    this.io = this.io.then(task).catch(() => {}); // best effort; never rejects into UI
  }
  private persist() {
    if (!this.uid || !this.enabled) return;
    this.dirty = true;
    if (this.saving) return;
    this.saving = true;
    this.schedule(async () => {
      try {
        while (this.dirty && this.uid && this.enabled) {
          this.dirty = false;
          const uid = this.uid,
            generation = this.generation;
          await this.storage.setItem(
            this.key(uid),
            JSON.stringify({ events: this.events, streaks: this.streaks }),
          );
          if (uid !== this.uid || generation !== this.generation) break;
        }
      } finally {
        this.saving = false;
      }
    });
  }
  suspend() {
    this.enabled = false;
    this.generation++;
  }
  async open(uid: string | null, enabled: boolean) {
    const old = this.uid;
    const generation = ++this.generation;
    this.enabled = false;
    this.uid = uid;
    this.events = [];
    this.streaks = {};
    if (old && old !== uid)
      this.schedule(() => this.storage.removeItem(this.key(old)));
    await this.io;
    if (generation !== this.generation) return;
    if (!uid || !enabled) {
      if (uid) this.schedule(() => this.storage.removeItem(this.key(uid)));
      return;
    }
    try {
      const raw = await this.storage.getItem(this.key(uid));
      if (generation !== this.generation) return;
      if (raw && raw.length <= 256000) {
        const stored: unknown = JSON.parse(raw);
        if (object(stored)) {
          if (Array.isArray(stored.events))
            this.events = [
              ...new Map(
                stored.events
                  .filter((e) => validEvent(e, this.now()))
                  .map((e) => [e.eventId, e]),
              ).values(),
            ].slice(-MAX);
          if (object(stored.streaks))
            for (const [id, v] of Object.entries(stored.streaks).slice(-100)) {
              if (
                /^[a-f0-9]{24}$/i.test(id) &&
                object(v) &&
                typeof v.day === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(v.day) &&
                Number.isInteger(v.streak) &&
                Number(v.streak) >= 0 &&
                Number(v.streak) <= 90
              )
                this.streaks[id] = { day: v.day, streak: Number(v.streak) };
            }
        }
      }
    } catch {
      /* corrupt/unavailable storage: bounded memory only */
    }
    if (generation !== this.generation) return;
    this.enabled = true;
    this.persist();
  }
  revoke() {
    const uid = this.uid;
    this.enabled = false;
    this.generation++;
    this.events = [];
    this.streaks = {};
    if (uid) this.schedule(() => this.storage.removeItem(this.key(uid)));
  }
  track<N extends keyof Properties>(name: N, properties: Properties[N]) {
    if (!this.enabled || !this.uid) return;
    try {
      const event: UsageEvent = {
        eventId: this.id(),
        name,
        properties: { ...properties },
        occurredAt: new Date(this.now()).toISOString(),
        ...this.metadata,
      };
      if (!validEvent(event, this.now())) return;
      this.events = [
        ...this.events.filter((e) => validEvent(e, this.now())),
        event,
      ].slice(-MAX);
      this.persist();
    } catch {
      /* analytics must never change a business operation */
    }
  }
  observe(
    items: { desafio: { id: string }; rachaActual: number }[],
    day: string,
  ) {
    if (!this.enabled || !this.uid) return;
    for (const item of items) {
      const id = item.desafio.id,
        streak = item.rachaActual,
        old = this.streaks[id];
      if (
        !/^[a-f0-9]{24}$/i.test(id) ||
        !Number.isInteger(streak) ||
        streak < 0 ||
        streak > 90
      )
        continue;
      if (streak === 0 && old?.streak > 0 && day > old.day)
        this.track("racha_perdida", {
          desafio_id: id,
          racha_anterior: old.streak,
        });
      this.streaks[id] = { day, streak };
    }
    this.streaks = Object.fromEntries(Object.entries(this.streaks).slice(-100));
    this.persist();
  }
  async settled() {
    await this.io;
  }
  async flush() {
    if (this.sending || !this.enabled || !this.uid) return;
    this.sending = true;
    const generation = this.generation,
      uid = this.uid;
    try {
      await this.io;
      for (
        let i = 0;
        i < 8 &&
        this.enabled &&
        this.uid === uid &&
        generation === this.generation;
        i++
      ) {
        this.events = this.events.filter((e) => validEvent(e, this.now()));
        const batch = this.events.slice(0, 25);
        if (!batch.length) {
          this.persist();
          break;
        }
        let accepted: string[];
        try {
          accepted = await this.send(batch, uid);
        } catch {
          break;
        } // retry on next foreground/online/timer, with unchanged IDs
        if (!this.enabled || this.uid !== uid || generation !== this.generation)
          break;
        if (
          !Array.isArray(accepted) ||
          !accepted.length ||
          accepted.some((id) => !batch.some((e) => e.eventId === id))
        )
          break;
        const ids = new Set(accepted);
        this.events = this.events.filter((e) => !ids.has(e.eventId));
        this.persist();
        await this.io;
      }
    } finally {
      this.sending = false;
    }
  }
}
