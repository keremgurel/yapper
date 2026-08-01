"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useEditorWorkspaceLayout } from "@/hooks/use-editor-workspace-layout";

type EditorLayoutValue = ReturnType<typeof useEditorWorkspaceLayout>;

const EditorLayoutContext = createContext<EditorLayoutValue | null>(null);

export function EditorLayoutProvider({ children }: { children: ReactNode }) {
  const layout = useEditorWorkspaceLayout();
  return (
    <EditorLayoutContext.Provider value={layout}>
      {children}
    </EditorLayoutContext.Provider>
  );
}

export function useEditorLayout(): EditorLayoutValue {
  const value = useContext(EditorLayoutContext);
  if (!value)
    throw new Error("useEditorLayout must be used inside EditorLayoutProvider");
  return value;
}

export function useOptionalEditorLayout(): EditorLayoutValue | null {
  return useContext(EditorLayoutContext);
}
