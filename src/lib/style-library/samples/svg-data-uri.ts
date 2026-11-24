/** An SVG as an image source. It sits in the code, so a sample costs no request and no file. */
export const svgDataUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
