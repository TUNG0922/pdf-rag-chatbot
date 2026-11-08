import { useEffect } from "react";
import { Box } from "@mantine/core";
import ChatInterface from "../components/ChatInterface";
import { useConversationsContext } from "../context/ConversationsContext";
import api from "../services/api";
import { deriveTitle } from "../hooks/useConversations";

function UserPage() {
  const {
    activeConversation,
    activeId,
    conversations,
    createConversation,
    setActiveId,
    updateMessages,
    setTitle,
  } = useConversationsContext();

  // Ensure there is always an active conversation to write into.
  useEffect(() => {
    if (activeId === null) {
      if (conversations.length > 0) {
        setActiveId(conversations[0].id);
      } else {
        createConversation();
      }
    }
  }, [activeId, conversations, createConversation, setActiveId]);

  const handleFirstQuestion = async (question: string) => {
    if (!activeConversation) return;
    const convoId = activeConversation.id;
    try {
      // Ask the backend for a smart, summarized title.
      const res = await api.post<{ title: string }>("/chat/title", {
        question,
      });
      setTitle(convoId, res.data.title);
    } catch {
      // Fall back to a trimmed version of the question if the LLM is down.
      setTitle(convoId, deriveTitle([{ id: 0, role: "user", content: question }]));
    }
  };

  return (
    <Box h="calc(100vh - 56px)" w="100%">
      <ChatInterface
        messages={activeConversation?.messages ?? []}
        onMessagesChange={(messages) => {
          if (activeConversation) {
            updateMessages(activeConversation.id, messages);
          }
        }}
        onFirstQuestion={handleFirstQuestion}
      />
    </Box>
  );
}

export default UserPage;
