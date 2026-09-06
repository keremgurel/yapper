/**
 * Rewrites em and en dashes into punctuation the app uses.
 *
 * House rule: no dashes of either kind in anything a creator reads. The
 * models like them, so text that comes back from a model and lands on screen
 * (canvas blocks, hooks, overlay names) goes through here first. A dash
 * between two numbers is a range and becomes "to"; anywhere else it is a
 * pause and becomes a comma.
 */
export function undash(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/,\s*\)/g, ")")
    .replace(/^,\s*/gm, "")
    .replace(/,\s*$/gm, "")
    .replace(/,\s*([.!?;:])/g, "$1");
}
