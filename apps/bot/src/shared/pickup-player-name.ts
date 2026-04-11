const quakeColorCodePattern = /\^[0-9A-Za-z]/g;
const zeroWidthPattern = /[\u200B-\u200D\uFEFF]/g;

export function formatPickupPlayerName(name: string): string {
  return name
    .replace(quakeColorCodePattern, '')
    .replace(zeroWidthPattern, '')
    .normalize('NFKC')
    .trim();
}
