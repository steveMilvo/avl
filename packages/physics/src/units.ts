/** Unit helpers. The physics core works in SI (m, kg, s, rad, N, N·m). */
export const G = 9.80665; // standard gravity, m/s^2

export const deg = (radians: number): number => (radians * 180) / Math.PI;
export const rad = (degrees: number): number => (degrees * Math.PI) / 180;
export const mm = (millimetres: number): number => millimetres / 1000;

/** grade (%) = 100 × tan(slope angle). */
export const gradePercentFromAngle = (slopeRad: number): number => 100 * Math.tan(slopeRad);
export const angleFromGradePercent = (gradePercent: number): number => Math.atan(gradePercent / 100);
