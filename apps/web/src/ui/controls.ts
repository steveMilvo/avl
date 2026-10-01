/** Small DOM helpers for labelled sliders with editable numeric fields and visible units. */
export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === "class") e.className = v; else e.setAttribute(k, v); }
  for (const k of kids) e.append(k);
  return e;
};

export const locked = new Set<string>();

export interface Control { el: HTMLElement; refresh(): void }

export interface SliderOpts {
  key: string; label: string; unit: string; min: number; max: number; step: number;
  get(): number; set(v: number): void; onChange(): void; hint?: string; digits?: number; warnOutside?: [number, number];
}

export const slider = (o: SliderOpts): Control => {
  const range = h("input", { type: "range", min: String(o.min), max: String(o.max), step: String(o.step) });
  const num = h("input", { type: "number", min: String(o.min), max: String(o.max), step: String(o.step), class: "num" });
  const lock = h("button", { class: "lock", title: "Lock this variable" }, "🔓");
  const unit = h("span", { class: "unit" }, o.unit);
  const row = h("div", { class: "ctl" },
    h("div", { class: "ctl-head" }, h("label", {}, o.label), h("span", { class: "ctl-val" }, num, unit, lock)),
    range);
  if (o.hint) row.append(h("div", { class: "hint" }, o.hint));
  const digits = o.digits ?? (o.step < 0.01 ? 3 : o.step < 0.1 ? 2 : o.step < 1 ? 1 : 0);
  const apply = (v: number) => {
    if (locked.has(o.key) || Number.isNaN(v)) return;
    o.set(Math.min(o.max, Math.max(o.min, v))); o.onChange();
  };
  range.addEventListener("input", () => apply(parseFloat(range.value)));
  num.addEventListener("change", () => apply(parseFloat(num.value)));
  lock.addEventListener("click", () => {
    if (locked.has(o.key)) locked.delete(o.key); else locked.add(o.key);
    refresh();
  });
  const refresh = () => {
    const v = o.get();
    range.value = String(v); num.value = v.toFixed(digits);
    const isLocked = locked.has(o.key);
    range.disabled = num.disabled = isLocked; lock.textContent = isLocked ? "🔒" : "🔓";
    row.classList.toggle("locked", isLocked);
    row.classList.toggle("outside", !!o.warnOutside && (v < o.warnOutside[0] - 1e-9 || v > o.warnOutside[1] + 1e-9));
  };
  refresh();
  return { el: row, refresh };
};

export const select = <T extends string>(o: { key: string; label: string; options: [T, string][]; get(): T; set(v: T): void; onChange(): void }): Control => {
  const s = h("select", {});
  for (const [v, l] of o.options) s.append(h("option", { value: v }, l));
  s.addEventListener("change", () => { if (locked.has(o.key)) return; o.set(s.value as T); o.onChange(); });
  const row = h("div", { class: "ctl" }, h("div", { class: "ctl-head" }, h("label", {}, o.label)), s);
  return { el: row, refresh: () => { s.value = o.get(); s.disabled = locked.has(o.key); } };
};

export const toggle = (o: { key: string; label: string; get(): boolean; set(v: boolean): void; onChange(): void }): Control => {
  const c = h("input", { type: "checkbox" });
  c.addEventListener("change", () => { o.set(c.checked); o.onChange(); });
  const row = h("label", { class: "ctl toggle" }, c, h("span", {}, o.label));
  return { el: row, refresh: () => { c.checked = o.get(); } };
};

export const section = (title: string, open = true): { el: HTMLDetailsElement; body: HTMLElement } => {
  const body = h("div", { class: "sec-body" });
  const el = h("details", { class: "sec" }, h("summary", {}, title), body) as HTMLDetailsElement;
  el.open = open;
  return { el, body };
};
