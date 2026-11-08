import { createContext, useContext } from "react";
import type { useConversations } from "../hooks/useConversations";

type ConversationsValue = ReturnType<typeof useConversations>;

export const ConversationsContext = createContext<
  ConversationsValue | undefined
>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useConversationsContext() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error(
      "useConversationsContext must be used within ConversationsContext.Provider"
    );
  }
  return ctx;
}
