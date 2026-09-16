/**
 * The README badge.
 *
 * Drawn here rather than fetched from shields.io: a badge that depends on a
 * third party is a badge that disappears when they have a bad day, and it would
 * hand every reader of every contributor's repository to someone else's logs.
 * It is also the one piece of Subless that lives on other people's pages, so it
 * carries the brand's own colours rather than a generic grey.
 */

const BG = "#0a0b0d";
const ACID = "#c9f24d";
const FG = "#e9ebef";

/**
 * Width of a string at 11px in the badge's font stack.
 *
 * An approximation on purpose: the exact metrics differ per renderer anyway, so
 * the padding below absorbs the error. Wide characters are counted as wide
 * because a clipped badge looks broken, while a roomy one just looks roomy.
 */
function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (/[A-Z@#%&]/.test(char)) width += 7.6;
    else if (/[ijlt.,:;'!|]/.test(char)) width += 3.4;
    else if (/[mwMW]/.test(char)) width += 9.4;
    else if (/[0-9]/.test(char)) width += 6.6;
    else width += 6.3;
  }
  return Math.ceil(width);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBadge({ label, message }: { label: string; message: string }): string {
  const PAD = 9;
  const labelWidth = textWidth(label) + PAD * 2 + 16; // 16 = room for the mark
  const messageWidth = textWidth(message) + PAD * 2;
  const width = labelWidth + messageWidth;
  const height = 20;
  const alt = `${label}: ${message}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(alt)}">
  <title>${escapeXml(alt)}</title>
  <clipPath id="r"><rect width="${width}" height="${height}" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="${height}" fill="${BG}"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${ACID}"/>
  </g>
  <g transform="translate(7, 5.5)">
    <path d="M5.2 0.6c1.9 0 3.4 1.5 3.4 3.4 0 2.3-1.9 4.2-4.2 4.2H1.2c-.4 0-.6-.4-.4-.7L2 6.1c.3-.4.1-.9-.4-1C.7 4.9.2 4.2.2 3.4.2 1.8 1.5.6 3 .6Z" fill="${ACID}"/>
  </g>
  <g font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11">
    <text x="${16 + PAD}" y="14" fill="${FG}">${escapeXml(label)}</text>
    <text x="${labelWidth + PAD}" y="14" fill="${BG}" font-weight="600">${escapeXml(message)}</text>
  </g>
</svg>`;
}
