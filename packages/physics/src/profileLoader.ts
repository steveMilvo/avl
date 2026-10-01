import { type Datum } from "./profile.js";

/** Type-level: every `number` in T becomes a Datum (value+unit+status). */
export type Datumised<T> =
  T extends number ? Datum
  : T extends (infer U)[] ? Datumised<U>[]
  : T extends object ? { [K in keyof T]: Datumised<T[K]> }
  : T;

const isDatum = (o: unknown): o is Datum =>
  !!o && typeof o === "object" && typeof (o as Datum).value === "number" && typeof (o as Datum).status === "string" && typeof (o as Datum).unit === "string";

const UNIT_TO_SI: Record<string, (x: number) => number> = {
  m: (x) => x, mm: (x) => x / 1000, kg: (x) => x, t: (x) => x * 1000,
  rad: (x) => x, deg: (x) => (x * Math.PI) / 180, "m3": (x) => x, "m³": (x) => x, "kg/m3": (x) => x, "kg/m³": (x) => x,
  "": (x) => x, "1": (x) => x,
};

/** Strip Datum wrappers, converting units to SI. Non-Datum values pass through. */
export const resolveDatums = <T>(obj: Datumised<T>): T => {
  const walk = (o: unknown): unknown => {
    if (isDatum(o)) {
      const conv = UNIT_TO_SI[o.unit];
      if (!conv) throw new Error(`unknown unit "${o.unit}"`);
      return conv(o.value);
    }
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(o as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return o;
  };
  return walk(obj) as T;
};
