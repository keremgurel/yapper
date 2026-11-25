/**
 * The signed Mac app. GitHub's "latest" link follows each new release, and
 * native-macos/scripts/release-app.sh always writes this file name.
 */
export const MAC_DOWNLOAD_URL =
  "https://github.com/keremgurel/yapper/releases/latest/download/Yapper-Studio.dmg";

/** Matches LSMinimumSystemVersion in native-macos/Resources/Info.plist. */
export const MAC_REQUIREMENTS = "macOS 14 or later, Apple silicon or Intel";
