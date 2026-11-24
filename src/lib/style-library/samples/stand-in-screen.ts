import { svgDataUri } from "./svg-data-uri";

/**
 * A drawn stand-in for whatever a creator shows above themselves: a plain
 * dashboard with two numbers and a rising line. Made-up figures, no product.
 */
export const STAND_IN_SCREEN = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" font-family="Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3B6EF5" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#3B6EF5" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="#FFFFFF"/>
  <rect x="60" y="56" width="420" height="190" rx="18" fill="#3B6EF5"/>
  <text x="96" y="124" font-size="38" fill="#FFFFFF" opacity="0.85">Visitors</text>
  <text x="96" y="208" font-size="76" font-weight="700" fill="#FFFFFF">12.4K</text>
  <rect x="508" y="56" width="420" height="190" rx="18" fill="#F1F3F7"/>
  <text x="544" y="124" font-size="38" fill="#5B6472">Signups</text>
  <text x="544" y="208" font-size="76" font-weight="700" fill="#1B1F27">1,284</text>
  <g stroke="#E6E9EF" stroke-width="3">
    <path d="M60 420 H1540 M60 580 H1540 M60 740 H1540 M60 900 H1540"/>
  </g>
  <path d="M60 860 L250 820 L440 836 L630 760 L820 700 L1010 590 L1200 520 L1390 400 L1540 330 L1540 900 L60 900 Z" fill="url(#area)"/>
  <path d="M60 860 L250 820 L440 836 L630 760 L820 700 L1010 590 L1200 520 L1390 400 L1540 330" fill="none" stroke="#3B6EF5" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="1540" cy="330" r="20" fill="#FFFFFF" stroke="#3B6EF5" stroke-width="10"/>
</svg>`);
