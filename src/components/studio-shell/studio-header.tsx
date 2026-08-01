"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import {
  ChevronDown,
  Columns2,
  Expand,
  LayoutPanelTop,
  Moon,
  RotateCcw,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { studioNav } from "@/data/studio-nav";
import { useOptionalEditorLayout } from "@/components/studio/editor-layout-context";
import UserMenu from "@/components/account/user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function currentTitle(pathname: string): string {
  const match = studioNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.title ?? "Studio";
}

/** Universal app header: navigation context on the left, persistent display
 * controls on the right, plus editor-only workspace presets when available. */
export default function StudioHeader() {
  const pathname = usePathname();
  const editorLayout = useOptionalEditorLayout();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  const layoutLabel =
    editorLayout?.mode === "focus"
      ? "Preview only"
      : editorLayout?.mode === "cinema"
        ? "Tall preview"
        : "Standard layout";

  return (
    <div className="bg-background/80 sticky top-[var(--site-header,3.5rem)] z-20 flex h-12 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-5"
      />
      <span className="font-display text-foreground text-[15px] font-semibold">
        {currentTitle(pathname)}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {editorLayout && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Editor layout"
                title={`Editor layout: ${layoutLabel}`}
                className="text-muted-foreground hover:text-foreground h-8 gap-1.5 px-2.5"
              >
                {editorLayout.mode === "focus" ? (
                  <Expand className="h-4 w-4" />
                ) : editorLayout.mode === "cinema" ? (
                  <Columns2 className="h-4 w-4" />
                ) : (
                  <LayoutPanelTop className="h-4 w-4" />
                )}
                <span className="hidden text-xs font-semibold lg:inline">
                  {layoutLabel}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={editorLayout.mode}
                onValueChange={(value) =>
                  editorLayout.setMode(value as typeof editorLayout.mode)
                }
              >
                <DropdownMenuRadioItem value="classic">
                  <LayoutPanelTop /> Standard · preview above timeline
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="cinema">
                  <Columns2 /> Tall preview · full height
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="focus">
                  <Expand /> Preview only
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={editorLayout.resetLayout}>
                <RotateCcw /> Reset layout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Show when="signed-in">
          <UserMenu />
        </Show>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
          title={`Switch to ${dark ? "light" : "dark"} mode`}
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid h-8 w-8 place-items-center rounded-md transition-colors"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
