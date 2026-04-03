import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Yapper - Free Topic Generator for Speech Practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 72, marginBottom: 8, display: "flex" }}>🎤</div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: "white",
          marginBottom: 16,
          display: "flex",
        }}
      >
        Yapper
      </div>
      <div
        style={{
          fontSize: 28,
          color: "#94a3b8",
          display: "flex",
        }}
      >
        Free Topic Generator for Speech Practice
      </div>
      <div
        style={{
          fontSize: 20,
          color: "#64748b",
          marginTop: 24,
          display: "flex",
        }}
      >
        ypr.app
      </div>
    </div>,
    { ...size },
  );
}
