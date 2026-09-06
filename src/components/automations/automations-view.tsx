"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Camera, Check, Hash, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnections } from "@/hooks/use-connections";
import {
  automationErrorMessage,
  fetchAutomation,
  saveAutomation,
} from "@/lib/publish/automation-client";
import {
  DEFAULT_AUTOMATION_SETTINGS,
  type AutomationDestination,
  type AutomationResponse,
  type AutomationSettings,
} from "@/lib/publish/automation-types";
import AutomationToggle from "./automation-toggle";
import AutomationHistory from "./automation-history";

type Draft = {
  version: number;
  enabled: boolean;
  settings: AutomationSettings;
};
const initialDraft = (data: AutomationResponse): Draft => ({
  version: data.rule?.version ?? 0,
  enabled: data.rule?.enabled ?? false,
  settings: data.rule?.settings ?? DEFAULT_AUTOMATION_SETTINGS,
});
const DESTINATIONS = [
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
] as const;

export default function AutomationsView() {
  const { user } = useUser();
  return user ? <AutomationEditor key={user.id} /> : null;
}

function AutomationEditor() {
  const {
    connections,
    error: connectionsError,
    refresh: refreshConnections,
  } = useConnections(true);
  const [data, setData] = useState<AutomationResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    fetchAutomation().then(
      (result) => {
        if (active) {
          setData(result);
          setDraft(initialDraft(result));
          setLoadingError(false);
        }
      },
      () => {
        if (active) setLoadingError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [version]);
  const refresh = useCallback(() => {
    const current = ++revision.current;
    void fetchAutomation().then(
      (result) => {
        if (current === revision.current) {
          setData(result);
          setLoadingError(false);
        }
      },
      () => {
        if (current === revision.current) setLoadingError(true);
      },
    );
  }, []);
  useEffect(() => {
    if (!data?.available || !data.rule?.enabled) return;
    const counter = revision;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    return () => {
      window.clearInterval(timer);
      counter.current++;
    };
  }, [data?.available, data?.rule?.enabled, refresh]);
  const change = (patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setSaved(false);
  };
  const toggleDestination = (platform: AutomationDestination) => {
    if (!draft) return;
    change({
      settings: {
        ...draft.settings,
        destinations: draft.settings.destinations.includes(platform)
          ? draft.settings.destinations.filter((value) => value !== platform)
          : [...draft.settings.destinations, platform],
      },
    });
  };
  const save = async () => {
    if (busy.current || !draft) return;
    busy.current = true;
    revision.current++;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveAutomation({
        ...draft,
        expectedAccounts: Object.fromEntries(
          (connections ?? [])
            .filter((connection) => connection.status === "active")
            .map((connection) => [
              connection.platform,
              connection.externalAccountId ?? "",
            ]),
        ),
      });
      setData((current) =>
        current ? { ...current, rule: result.rule } : current,
      );
      setDraft({
        enabled: result.rule.enabled,
        version: result.rule.version,
        settings: result.rule.settings,
      });
      setSaved(true);
      refresh();
    } catch (cause) {
      setError(automationErrorMessage(cause));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const account = (platform: string) =>
    connections?.find(
      (connection) =>
        connection.platform === platform && connection.status === "active",
    );
  const accountLabel = (platform: string) =>
    connections === null
      ? connectionsError
        ? "Couldn’t load account"
        : "Loading account…"
      : (account(platform)?.handle ??
        account(platform)?.externalAccountId ??
        "Not connected");
  const missingAccount =
    draft?.enabled &&
    (!account("instagram") ||
      draft.settings.destinations.some((platform) => !account(platform)));
  if (!data || !draft)
    return (
      <div className="text-muted-foreground text-sm">
        {loadingError ? (
          <>
            <p role="alert">Your automation settings couldn’t be loaded.</p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => setVersion((value) => value + 1)}
            >
              Try again
            </Button>
          </>
        ) : (
          <p>Loading your automation…</p>
        )}
      </div>
    );
  return (
    <div className="flex flex-col gap-5">
      {!data.available && (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-xl border px-4 py-3 text-sm">
          {data.setupAvailable === false
            ? "Automation setup isn’t available on this server yet."
            : "New video checks are paused on this server. Prepared deliveries may still send; pause the rule below to cancel waiting work."}
        </p>
      )}
      {connectionsError && (
        <div
          role="alert"
          className="text-destructive flex items-center gap-3 text-sm"
        >
          <p>Your connected accounts couldn’t be loaded.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refreshConnections()}
          >
            Try again
          </Button>
        </div>
      )}
      {loadingError && (
        <p role="alert" className="text-destructive text-sm">
          Activity couldn’t be refreshed. Your displayed settings are kept.
        </p>
      )}
      <div className="border-border bg-card rounded-2xl border p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent)]">
            <Zap className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight">
              Repurpose my Instagram videos
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              New videos from your connected Instagram account are imported and
              sent to your selected destinations.
            </p>
          </div>
        </div>
        <fieldset
          disabled={saving || data.setupAvailable === false}
          className="mt-5 space-y-5 border-t border-dashed pt-5"
        >
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-bold uppercase">
              <Camera className="size-3.5" /> Source
            </p>
            <p className="text-sm font-bold">
              Instagram · {accountLabel("instagram")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-bold uppercase">
              Send new videos to
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DESTINATIONS.map((destination) => (
                <button
                  key={destination.id}
                  type="button"
                  aria-pressed={draft.settings.destinations.includes(
                    destination.id,
                  )}
                  onClick={() => toggleDestination(destination.id)}
                  className={`rounded-xl border p-3 text-left ${draft.settings.destinations.includes(destination.id) ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/10" : "border-border"}`}
                >
                  <span className="block text-sm font-bold">
                    {destination.label}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {accountLabel(destination.id)}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">
                    {destination.id === "tiktok"
                      ? "Drafts to finish in TikTok"
                      : "Requested as public"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Hash className="text-muted-foreground size-4" /> Strip hashtags
            </span>
            <AutomationToggle
              checked={draft.settings.stripHashtags}
              onChange={(value) =>
                change({
                  settings: { ...draft.settings, stripHashtags: value },
                })
              }
              label="Strip hashtags"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm">
              <Sparkles className="text-muted-foreground size-4" />
              <span>
                <span className="block font-bold">Reformat for YouTube</span>
                <span className="text-muted-foreground block text-xs">
                  Use the opening line as the title and the full caption as the
                  description.
                </span>
              </span>
            </span>
            <AutomationToggle
              checked={draft.settings.reformatForYouTube}
              onChange={(value) =>
                change({
                  settings: { ...draft.settings, reformatForYouTube: value },
                })
              }
              label="Reformat caption for YouTube"
            />
          </label>
          <div className="space-y-3 border-t pt-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold">
                Enable automatic sending
              </span>
              <AutomationToggle
                checked={draft.enabled}
                disabled={!data.available && !draft.enabled}
                onChange={(enabled) => change({ enabled })}
                label="Enable automatic sending"
              />
            </label>
            <p className="text-muted-foreground text-xs">
              Changes take effect when saved. Enabling starts with videos posted
              from that moment. Old posts and videos posted while paused are not
              backfilled. Existing prepared deliveries keep their original
              settings.
            </p>
            <p className="text-muted-foreground text-xs">
              Pausing cancels waiting imports and deliveries. Sending already
              underway may finish. TikTok always receives a draft.
            </p>
          </div>
          {missingAccount && (
            <p className="text-destructive text-sm">
              Connect Instagram and every selected destination before enabling.{" "}
              <Link href="/studio/connections" className="underline">
                Open Connections
              </Link>
            </p>
          )}
          <Button
            disabled={
              Boolean(missingAccount) ||
              (draft.enabled &&
                (!data.available || !draft.settings.destinations.length))
            }
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : draft.enabled ? (
              "Save and enable"
            ) : (
              "Save while paused"
            )}
          </Button>
        </fieldset>
        {saved && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm">
            <Check className="size-4" />
            {data.rule?.enabled
              ? "Saved. New Instagram videos will be checked automatically."
              : "Saved. This automation is paused."}
          </p>
        )}
        {error && (
          <div role="alert" className="mt-3 space-y-2 text-sm">
            <p className="text-destructive">{error}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setError(null);
                setSaved(false);
                setVersion((value) => value + 1);
              }}
            >
              Reload saved settings
            </Button>
          </div>
        )}
        {data.rule?.error && (
          <p className="text-destructive mt-3 text-sm">
            {automationErrorMessage(new Error(data.rule.error))}
          </p>
        )}
        {data.rule && (
          <p className="text-muted-foreground mt-4 text-xs">
            Saved rule: {data.rule.enabled ? "Enabled" : "Paused"}
            {data.rule.lastCheckedAt
              ? ` · Last checked ${new Date(data.rule.lastCheckedAt).toLocaleString()}`
              : " · No check completed yet"}
          </p>
        )}
      </div>
      <AutomationHistory
        runs={data.runs}
        canRetry={data.available && Boolean(data.rule?.enabled)}
        onRefresh={refresh}
      />
    </div>
  );
}
