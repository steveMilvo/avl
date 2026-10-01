import { describe, it, expect } from "vitest";
import { evaluatePolygon, v, G } from "../src/index.js";

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("support polygon evaluation", () => {
  const tri = { stage: "t", description: "", points: [
    { id: "A", label: "A", p: v(0, -1, 0) }, { id: "B", label: "B", p: v(0, 1, 0) }, { id: "C", label: "C", p: v(-3, 0, 0) } ] };

  it("vertical force at the centroid: equal margins, moment = W·margin, no friction needed", () => {
    const W = 1000 * G;
    const ev = evaluatePolygon(tri, [{ id: "m", at: v(-1, 0, 2), force: v(0, 0, -W) }]);
    for (const e of ev.edges) close(e.stabilisingMoment, W * e.margin, 1e-6);
    close(ev.normalLoad, W);
    close(ev.requiredFriction, 0);
  });

  it("two forces: resultant line of action equals the mass-weighted mean (parallel forces)", () => {
    const ev = evaluatePolygon(tri, [
      { id: "a", at: v(-2, 0, 1), force: v(0, 0, -100) }, { id: "b", at: v(0, 0, 3), force: v(0, 0, -300) } ]);
    close(ev.intersection!.x, -0.5, 1e-9);
  });

  it("force line outside an edge gives a negative margin and overturning moment", () => {
    const ev = evaluatePolygon(tri, [{ id: "m", at: v(0.2, 0, 1), force: v(0, 0, -10) }]);
    const front = ev.edges.find((e) => e.id === "A-B")!;
    close(front.margin, -0.2); expect(front.stabilisingMoment).toBeLessThan(0);
    expect(ev.critical.id).toBe("A-B");
  });

  it("inclined force: intersection shifts by h·tan(angle); normal and tangential loads split correctly", () => {
    const h = 2, ang = 0.2, W = 500;
    const ev = evaluatePolygon(tri, [{ id: "m", at: v(-1, 0, h), force: v(W * Math.sin(ang), 0, -W * Math.cos(ang)) }]);
    close(ev.intersection!.x, -1 + h * Math.tan(ang), 1e-9);
    close(ev.groundIntersection!.x, -1 + h * Math.tan(ang), 1e-9);
    close(ev.normalLoad, W * Math.cos(ang), 1e-9);
    close(ev.requiredFriction, Math.tan(ang), 1e-9);
  });

  it("an axis above the ground (pivot) is evaluated as a true 3D line: an inclined force can clear it although its vertical projection would not", () => {
    const poly = { stage: "p", description: "", points: [
      { id: "FR", label: "", p: v(0, -0.5, 0) }, { id: "FL", label: "", p: v(0, 0.5, 0) }, { id: "P", label: "", p: v(-1.7, 0, 0.35) } ] };
    // Vertical projection of the FL-P line at x = -0.8 is y = 0.265. Force line through (-0.8, 0, 0.7)
    // inclined 25° to the left meets the ground at y = 0.326 (outside the vertical projection) but
    // meets the support plane higher up, where the axis is further out.
    const ang = 25 * Math.PI / 180;
    const ev = evaluatePolygon(poly, [{ id: "m", at: v(-0.8, 0, 0.7), force: v(0, 10 * Math.sin(ang), -10 * Math.cos(ang)) }]);
    const edge = ev.edges.find((e) => e.id === "FL-P")!;
    expect(ev.groundIntersection!.y).toBeGreaterThan(0.265);
    expect(edge.margin).toBeGreaterThan(0);
    // and the moment about the axis computed directly agrees in sign
    expect(edge.stabilisingMoment).toBeGreaterThan(0);
  });

  it("a force pointing away from the ground is lift-off", () => {
    const ev = evaluatePolygon(tri, [{ id: "m", at: v(-1, 0, 1), force: v(0, 0, 10) }]);
    expect(ev.liftOff).toBe(true);
  });
});
