export type UtilisationColor = "green" | "amber" | "red" | "gray";

/**
 * Returns the colour token for a check utilisation ratio:
 * - green: utilisation <= 0.9
 * - amber: 0.9 < utilisation <= 1.0
 * - red: utilisation > 1.0
 * - gray: null, undefined or non-finite
 */
export function utilisationColor(utilisation: number | null | undefined): UtilisationColor {
  if (utilisation === null || utilisation === undefined || !Number.isFinite(utilisation)) {
    return "gray";
  }
  if (utilisation <= 0.9) {
    return "green";
  }
  if (utilisation <= 1.0) {
    return "amber";
  }
  return "red";
}
