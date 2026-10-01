import { describe, it, expect } from "vitest";
import { rotY, rotZ, apply, v, axisAngle, rotateAboutLine, gravityDirInGroundFrame, terrainFromGrades, gradesFromTerrain, gradePercentFromAngle, rad, combinedCg, resolveDatums } from "../src/index.js";

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe("rotations", () => {
  it("rotY(+a) tips +z toward +x (forward)", () => {
    const p = apply(rotY(rad(30)), v(0, 0, 1));
    close(p.x, Math.sin(rad(30))); close(p.z, Math.cos(rad(30)));
  });
  it("rotZ(+a) turns +x toward +y (left)", () => {
    const p = apply(rotZ(rad(90)), v(1, 0, 0));
    close(p.x, 0); close(p.y, 1);
  });
  it("axis-angle matches rotZ", () => {
    const a = apply(axisAngle(v(0, 0, 1), 0.7), v(1, 2, 3)), b = apply(rotZ(0.7), v(1, 2, 3));
    close(a.x, b.x); close(a.y, b.y); close(a.z, b.z);
  });
  it("rotating about a line keeps points on the line fixed", () => {
    const p = rotateAboutLine(v(2, 2, 0), v(1, 1, 0), v(1, 1, 0), 1.3);
    close(p.x, 2); close(p.y, 2); close(p.z, 0);
  });
});

describe("terrain", () => {
  it("facing downhill: gravity pulls forward by sin(θ)", () => {
    const g = gravityDirInGroundFrame({ slopeAngle: rad(10), heading: Math.PI, friction: 0.7 });
    close(g.x, Math.sin(rad(10))); close(g.y, 0); close(g.z, -Math.cos(rad(10)));
  });
  it("facing uphill: gravity pulls rearward", () => {
    const g = gravityDirInGroundFrame({ slopeAngle: rad(10), heading: 0, friction: 0.7 });
    close(g.x, -Math.sin(rad(10))); close(g.z, -Math.cos(rad(10)));
  });
  it("across the slope with uphill on the right: gravity pulls left (+y)", () => {
    const g = gravityDirInGroundFrame({ slopeAngle: rad(10), heading: Math.PI / 2, friction: 0.7 });
    close(g.x, 0); close(g.y, Math.sin(rad(10)));
  });
  it("grade round-trips: longitudinal + cross grade ⇄ slope + heading", () => {
    const t = terrainFromGrades(0.10, -0.05);
    const { longGrade, crossGrade } = gradesFromTerrain(t);
    close(longGrade, 0.10, 1e-12); close(crossGrade, -0.05, 1e-12);
    close(gradePercentFromAngle(rad(45)), 100, 1e-9);
  });
});

describe("mass", () => {
  it("combined CG of two masses is the mass-weighted mean", () => {
    const r = combinedCg([{ mass: 1, cg: v(0, 0, 0) }, { mass: 3, cg: v(4, 0, 8) }]);
    close(r.mass, 4); close(r.cg.x, 3); close(r.cg.z, 6);
  });
});

describe("profile datums", () => {
  it("converts mm and deg to SI and preserves plain values", () => {
    const r = resolveDatums<{ a: number; b: number; s: string; arr: number[] }>({
      a: { value: 1500, unit: "mm", status: "assumed" }, b: { value: 90, unit: "deg", status: "measured" }, s: "x",
      arr: [{ value: 2, unit: "t", status: "assumed" }],
    });
    close(r.a, 1.5); close(r.b, Math.PI / 2); expect(r.s).toBe("x"); close(r.arr[0]!, 2000);
  });
});
