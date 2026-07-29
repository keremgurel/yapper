import { useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  channels?: number;
  sample_rate?: string;
}
interface Probe {
  format?: { duration?: string; size?: string; format_name?: string };
  streams?: ProbeStream[];
}

type Stage = "idle" | "probing" | "proxying" | "extracting" | "ready" | "error";

export default function App() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Video", extensions: ["mp4", "mov", "m4v", "mkv", "webm"] },
      ],
    });
    if (typeof selected !== "string") return;
    setFile(selected);
    setProbe(null);
    setProxyUrl(null);
    setAudioPath(null);
    setError(null);
    try {
      setStage("probing");
      const p = await invoke<Probe>("probe_media", { path: selected });
      setProbe(p);

      setStage("proxying");
      const proxy = await invoke<string>("start_proxy", { path: selected });
      for (;;) {
        const status = await invoke<"pending" | "ready" | "failed">(
          "proxy_status",
          {
            outPath: proxy,
          },
        );
        if (status === "ready") break;
        if (status === "failed") {
          throw new Error("Proxy generation failed");
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      setProxyUrl(convertFileSrc(proxy));

      setStage("extracting");
      const audio = await invoke<string>("extract_audio", { path: selected });
      setAudioPath(audio);

      setStage("ready");
    } catch (e) {
      setError(String(e));
      setStage("error");
    }
  }

  const v = probe?.streams?.find((s) => s.codec_type === "video");
  const a = probe?.streams?.find((s) => s.codec_type === "audio");
  const dur = probe?.format?.duration ? Number(probe.format.duration) : 0;
  const busy =
    stage === "probing" || stage === "proxying" || stage === "extracting";

  return (
    <div className="app">
      <header>
        <div className="mark">🎬</div>
        <div className="brand">
          <h1>Yapper Studio</h1>
          <p className="sub">native media engine · ffmpeg · phase 0</p>
        </div>
        <button className="open" onClick={pick} disabled={busy}>
          {busy ? "Working…" : "Open video"}
        </button>
      </header>

      {!file && (
        <div className="empty">
          <p className="big">Drop in the file that broke the browser.</p>
          <p className="hint">
            HEVC, odd containers, any size — ffmpeg decodes it natively.
          </p>
        </div>
      )}

      {file && (
        <div className="grid">
          <section className="panel">
            <h2>Source</h2>
            <div className="path">{file}</div>
            {stage === "probing" && <p className="status">Probing…</p>}
            {probe && (
              <table className="meta">
                <tbody>
                  <tr>
                    <td>Container</td>
                    <td>{probe.format?.format_name ?? "?"}</td>
                  </tr>
                  <tr>
                    <td>Video</td>
                    <td>
                      {v ? `${v.codec_name} ${v.width}×${v.height}` : "?"}
                    </td>
                  </tr>
                  <tr>
                    <td>Audio</td>
                    <td>
                      {a
                        ? `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch`
                        : "?"}
                    </td>
                  </tr>
                  <tr>
                    <td>Duration</td>
                    <td>{dur ? `${dur.toFixed(1)}s` : "?"}</td>
                  </tr>
                  <tr>
                    <td>Size</td>
                    <td>
                      {probe.format?.size
                        ? `${(Number(probe.format.size) / 1e6).toFixed(1)} MB`
                        : "?"}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            <div className="steps">
              <Step
                label="Probe (ffprobe)"
                done={!!probe}
                active={stage === "probing"}
              />
              <Step
                label="H.264 proxy (ffmpeg)"
                done={!!proxyUrl}
                active={stage === "proxying"}
              />
              <Step
                label="Extract audio for ASR"
                done={!!audioPath}
                active={stage === "extracting"}
              />
            </div>
            {audioPath && (
              <p className="audio">
                audio → <code>{audioPath.split("/").pop()}</code> · one file, no
                chunking, no 4.5MB cap
              </p>
            )}
            {error && <pre className="err">{error}</pre>}
          </section>

          <section className="panel preview">
            <h2>Preview</h2>
            {proxyUrl ? (
              <video src={proxyUrl} controls autoPlay muted />
            ) : (
              <div className="placeholder">
                {busy ? "Transcoding proxy…" : "—"}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Step({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className={`step ${done ? "done" : ""} ${active ? "active" : ""}`}>
      <span className="dot">{done ? "✓" : active ? "…" : "○"}</span>
      {label}
    </div>
  );
}
