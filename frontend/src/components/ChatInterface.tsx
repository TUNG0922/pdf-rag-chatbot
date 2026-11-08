import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Paper,
  ScrollArea,
  Group,
  Stack,
  Text,
  Title,
  Textarea,
  Button,
  Badge,
  Box,
  ThemeIcon,
  Loader,
  Alert,
  useMantineColorScheme,
  CopyButton,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconSend,
  IconMessageChatbot,
  IconFile,
  IconAlertCircle,
  IconCopy,
  IconCheck,
  IconPencil,
} from "@tabler/icons-react";

import { getToken, clearToken } from "../services/api";
import type { ChatMessage, ChatSource } from "../hooks/useConversations";
import MarkdownErrorBoundary from "./MarkdownErrorBoundary";

/**
 * Renders markdown code. Fenced blocks get a header (language + copy button)
 * and syntax highlighting so code is clearly distinct from explanation text.
 * Inline code renders as a subtle pill.
 */
function createMarkdownComponents(dark: boolean) {
  return {
    // Let the `code` renderer own block layout; `pre` just passes through
    // so we don't get a <div> nested inside a <pre> (invalid HTML).
    pre(props: { children?: React.ReactNode }) {
      return <>{props.children}</>;
    },
    code(props: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
    }) {
      const { inline, className, children } = props;
      const match = /language-(\w+)/.exec(className || "");
      const codeText = String(children ?? "").replace(/\n$/, "");

      // Inline code (single backticks) -> pill
      if (inline || (!match && !codeText.includes("\n"))) {
        return (
          <code
            style={{
              background: dark
                ? "var(--mantine-color-dark-5)"
                : "var(--mantine-color-gray-2)",
              color: dark
                ? "var(--mantine-color-orange-3)"
                : "var(--mantine-color-pink-7)",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: "0.88em",
              fontFamily: "var(--mantine-font-family-monospace)",
            }}
          >
            {children}
          </code>
        );
      }

      const language = match ? match[1] : "text";

      // Fenced code block -> header bar + highlighted body
      return (
        <div
          style={{
            border: `1px solid ${
              dark
                ? "var(--mantine-color-dark-4)"
                : "var(--mantine-color-gray-3)"
            }`,
            borderRadius: 8,
            overflow: "hidden",
            margin: "0.6em 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 10px",
              background: dark
                ? "var(--mantine-color-dark-8)"
                : "var(--mantine-color-gray-1)",
              borderBottom: `1px solid ${
                dark
                  ? "var(--mantine-color-dark-4)"
                  : "var(--mantine-color-gray-3)"
              }`,
              fontSize: 12,
              fontFamily: "var(--mantine-font-family-monospace)",
              color: "var(--mantine-color-dimmed)",
            }}
          >
            <span>{language}</span>
            <CopyButton value={codeText} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color={copied ? "teal" : "gray"}
                    onClick={copy}
                  >
                    {copied ? (
                      <IconCheck size={14} />
                    ) : (
                      <IconCopy size={14} />
                    )}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </div>
          <SyntaxHighlighter
            language={language}
            style={dark ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: 13,
            }}
          >
            {codeText}
          </SyntaxHighlighter>
        </div>
      );
    },
  };
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  // Called after the first user question so a smart title can be generated.
  onFirstQuestion?: (question: string) => void;
}

interface StreamEvent {
  type: "sources" | "token" | "done" | "error";
  sources?: ChatSource[];
  token?: string;
  detail?: string;
}

function ChatInterface({
  messages,
  onMessagesChange,
  onFirstQuestion,
}: ChatInterfaceProps) {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  const mdComponents = createMarkdownComponents(dark);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  // Id of the assistant message currently being streamed. While streaming we
  // render plain text (partial markdown such as an unclosed code fence can
  // crash the markdown renderer); once done we render full markdown.
  const [streamingId, setStreamingId] = useState<number | null>(null);
  // Live text of the in-progress stream, kept in local state and flushed on a
  // rAF tick so we don't call the parent's setState on every single token
  // (which caused "Maximum update depth exceeded").
  const [streamingContent, setStreamingContent] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, streamingContent]);

  const handleSendMessage = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setQuestion("");
    await runQuestion(trimmed, messages);
  };

  // Core send/stream routine. `priorMessages` is the conversation BEFORE this
  // question (for a fresh send it's all current messages; for an edit it's the
  // messages before the edited one, so the edit replaces it).
  const runQuestion = async (
    trimmed: string,
    priorMessages: ChatMessage[]
  ) => {
    if (!trimmed || loading) return;

    const isFirstQuestion = priorMessages.length === 0;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed,
    };
    const assistantId = Date.now() + 1;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    // Show the user's message and an empty assistant bubble to fill in.
    const base = [...priorMessages, userMessage, assistantMessage];
    onMessagesChange(base);
    setLoading(true);
    setStreamingId(assistantId);
    setError("");

    // Ask for a smart title based on what was actually asked.
    if (isFirstQuestion) {
      onFirstQuestion?.(trimmed);
    }

    let streamedContent = "";
    let streamedSources: ChatSource[] | undefined;
    let sawError = false;

    // Reset the live stream buffer for this turn.
    setStreamingContent("");
    let rafScheduled = false;
    const scheduleFlush = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        setStreamingContent(streamedContent);
      });
    };

    // Persist the final assistant message to the parent store ONCE (not per
    // token) to avoid a setState storm.
    const persistFinal = () => {
      onMessagesChange([
        ...priorMessages,
        userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: streamedContent,
          sources: streamedSources,
        },
      ]);
    };

    try {
      const token = getToken();
      // Send prior turns (excluding the just-added empty assistant bubble) so
      // the backend has conversation memory for follow-up questions.
      const history = priorMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: trimmed, top_k: 3, history }),
      });

      if (!response.ok) {
        // Session expired/invalid: clear token and send to login, matching
        // the axios interceptor behavior (raw fetch bypasses it).
        if (response.status === 401) {
          clearToken();
          window.location.href = "/login";
          return;
        }

        // Try to surface the backend's error detail (e.g. 503 Ollama down).
        let detail = `Request failed (status ${response.status}).`;
        try {
          const data = await response.json();
          if (data?.detail) detail = data.detail;
        } catch {
          /* body not JSON */
        }
        setError(detail);
        return;
      }

      if (!response.body) {
        throw new Error("No response stream received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Read the NDJSON stream line by line, appending tokens as they arrive.
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep the last partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }

          if (evt.type === "sources") {
            streamedSources = evt.sources;
          } else if (evt.type === "token") {
            streamedContent += evt.token ?? "";
            scheduleFlush();
          } else if (evt.type === "error") {
            sawError = true;
            setError(evt.detail || "The assistant is unavailable.");
          }
        }
      }

      // Flush any trailing buffered line.
      if (buffer.trim()) {
        try {
          const evt = JSON.parse(buffer) as StreamEvent;
          if (evt.type === "token") {
            streamedContent += evt.token ?? "";
          } else if (evt.type === "sources") {
            streamedSources = evt.sources;
          } else if (evt.type === "error") {
            sawError = true;
            setError(evt.detail || "The assistant is unavailable.");
          }
        } catch {
          /* ignore */
        }
      }

      setStreamingContent(streamedContent);
      persistFinal();

      // Only show the generic error if the stream produced nothing AND no
      // explicit error event was received during this request.
      if (!streamedContent && !sawError) {
        setError("The assistant returned an empty response. Please try again.");
      }
    } catch (err) {
      console.error("Chat stream failed:", err);
      const msg =
        err instanceof Error ? err.message : String(err);
      setError(`Unable to get an answer: ${msg}`);
    } finally {
      setLoading(false);
      setStreamingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Inline editing of a previously-sent user message.
  const startEdit = (messageId: number, content: string) => {
    if (loading) return;
    setEditingId(messageId);
    setEditText(content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || editingId === null) return;
    const idx = messages.findIndex((m) => m.id === editingId);
    if (idx === -1) {
      cancelEdit();
      return;
    }
    // Everything before the edited message is the new prior context; the
    // edited question (and a fresh answer) replaces it and all later turns.
    const prior = messages.slice(0, idx);
    cancelEdit();
    await runQuestion(trimmed, prior);
  };

  return (
    <Paper
      withBorder
      radius={0}
      w="100%"
      h="100%"
      style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* Messages */}
      {messages.length === 0 && !loading ? (
        <Box
          flex={1}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack align="center" gap="xs">
            <ThemeIcon variant="light" size={60} radius="xl">
              <IconMessageChatbot size={32} />
            </ThemeIcon>
            <Title order={4}>Start a conversation</Title>
            <Text c="dimmed" size="sm" ta="center">
              Ask anything about your uploaded PDF documents.
            </Text>
          </Stack>
        </Box>
      ) : (
        <ScrollArea flex={1} viewportRef={viewportRef} p="md">
        <Stack gap="md">
          {messages.map((message) => (
            <Box
              key={message.id}
              style={{
                alignSelf:
                  message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "min(85%, 760px)",
              }}
            >
              <Paper
                p="sm"
                radius="md"
                bg={
                  message.role === "user"
                    ? "indigo.6"
                    : "light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))"
                }
                c={
                  message.role === "user"
                    ? "white"
                    : "light-dark(var(--mantine-color-dark-8), var(--mantine-color-gray-0))"
                }
              >
                <Text size="xs" fw={700} mb={4} opacity={0.75}>
                  {message.role === "user" ? "You" : "AI Assistant"}
                </Text>

                <Box
                  style={{ textAlign: "justify", lineHeight: 1.6 }}
                  className="markdown-body"
                >
                  {message.role === "assistant" ? (
                    streamingId === message.id ? (
                      // While streaming, show plain text from local buffer —
                      // partial markdown (e.g. an unclosed code fence) can
                      // crash the renderer, and using local state avoids a
                      // parent setState per token.
                      <Text style={{ whiteSpace: "pre-wrap" }}>
                        {streamingContent}
                      </Text>
                    ) : (
                      <MarkdownErrorBoundary fallbackText={message.content}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={mdComponents}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </MarkdownErrorBoundary>
                    )
                  ) : editingId === message.id ? (
                    <Stack gap="xs">
                      <Textarea
                        autosize
                        minRows={1}
                        maxRows={8}
                        value={editText}
                        onChange={(e) => setEditText(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        autoFocus
                        styles={{
                          input: {
                            backgroundColor: "#ffffff",
                            color: "#1f2937",
                            border: "1px solid var(--mantine-color-gray-4)",
                          },
                        }}
                      />
                      <Group gap="xs" justify="flex-end">
                        <Button
                          size="xs"
                          variant="white"
                          color="gray"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          color="indigo"
                          onClick={saveEdit}
                          disabled={!editText.trim()}
                        >
                          Save &amp; resend
                        </Button>
                      </Group>
                    </Stack>
                  ) : (
                    <Text style={{ whiteSpace: "pre-wrap" }}>
                      {message.content}
                    </Text>
                  )}
                </Box>

                {message.role === "assistant" &&
                  message.sources &&
                  message.sources.length > 0 && (
                    <Stack
                      gap={4}
                      mt="sm"
                      pt="sm"
                      style={{
                        borderTop: "1px solid var(--mantine-color-gray-3)",
                      }}
                    >
                      <Text size="xs" fw={700} c="dimmed">
                        Sources
                      </Text>
                      <Group gap="xs">
                        {message.sources.map((source) => (
                          <Badge
                            key={source.chunk_id}
                            variant="light"
                            color="indigo"
                            leftSection={<IconFile size={12} />}
                          >
                            {source.filename} · p.{source.page_number}
                          </Badge>
                        ))}
                      </Group>
                    </Stack>
                  )}
              </Paper>

              {message.role === "user" && editingId !== message.id && (
                <Group gap={4} justify="flex-end" mt={4}>
                  <CopyButton value={message.content} timeout={1500}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color={copied ? "teal" : "gray"}
                          onClick={copy}
                          aria-label="Copy message"
                        >
                          {copied ? (
                            <IconCheck size={14} />
                          ) : (
                            <IconCopy size={14} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                  <Tooltip label="Edit" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="gray"
                      onClick={() => startEdit(message.id, message.content)}
                      aria-label="Edit message"
                      disabled={loading}
                    >
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
            </Box>
          ))}

          {loading && (
            <Group gap="xs" style={{ alignSelf: "flex-start" }}>
              <Loader size="sm" type="dots" />
              <Text size="sm" c="dimmed">
                AI is thinking...
              </Text>
            </Group>
          )}
        </Stack>
      </ScrollArea>
      )}

      {error && (
        <Alert
          variant="light"
          color="red"
          icon={<IconAlertCircle size={18} />}
          m="sm"
        >
          {error}
        </Alert>
      )}

      {/* Input */}
      <Group
        p="md"
        align="flex-end"
        style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}
      >
        <Textarea
          flex={1}
          autosize
          minRows={1}
          maxRows={5}
          placeholder="Ask a question about your PDF..."
          value={question}
          onChange={(e) => setQuestion(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!question.trim() || loading}
          rightSection={<IconSend size={16} />}
        >
          Send
        </Button>
      </Group>
    </Paper>
  );
}

export default ChatInterface;
