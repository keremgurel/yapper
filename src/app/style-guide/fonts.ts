import { Hanken_Grotesk } from "next/font/google";

/**
 * Hanken Grotesk — our free stand-in for Aave's FT Regola Neue (a paid
 * geo-grotesque). One family, many weights, high legibility, circular profile.
 * Scoped to the style-guide wrapper for now via its CSS variable.
 */
export const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
