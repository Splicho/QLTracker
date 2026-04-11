const quakeColorCodePattern = /\^[0-9A-Za-z]/g;
const combiningMarkPattern = /[\u0300-\u036f\u0483-\u0489\u20d0-\u20ff]/g;
const zeroWidthPattern = /[\u200B-\u200D\uFEFF]/g;

export function formatPickupPlayerName(name: string): string {
  return name
    .replace(quakeColorCodePattern, '')
    .replace(zeroWidthPattern, '')
    .normalize('NFKC')
    .replace(combiningMarkPattern, '')
    .trim();
}
