
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import api from "../services/api";
import "./ChatInterface.css";

// Backend source structure
interface ChatSource {
  filename: string;
  page_number: number;
  chunk_id: string;
  distance: number;
}

// Backend response structure
interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

// Frontend message structure
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

function ChatInterface() {

  // Store current question
  const [question, setQuestion] = useState("");

  // Store conversation messages
  const [messages, setMessages] = useState<Message[]>([]);

  // Store loading state
  const [loading, setLoading] = useState(false);

  // Store error message
  const [error, setError] = useState("");

  // Reference to the last message
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Send question to backend
  const handleSendMessage = async () => {

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: trimmedQuestion,
    };

    // Display user message immediately
    setMessages((previous) => [
      ...previous,
      userMessage,
    ]);

    setQuestion("");
    setLoading(true);
    setError("");

    try {

      const response = await api.post<ChatResponse>(
        "/chat",
        {
          question: trimmedQuestion,
          top_k: 3,
        }
      );

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.data.answer,
        sources: response.data.sources,
      };

      setMessages((previous) => [
        ...previous,
        assistantMessage,
      ]);

    } catch (err) {

      console.error("Chat request failed:", err);

      setError(
        "Unable to get an answer. Please try again."
      );

    } finally {

      setLoading(false);

    }
  };

  // Handle Enter key
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSendMessage();
    }

  };

  // Clear conversation
  const handleClearChat = () => {

    setMessages([]);
    setError("");
    setQuestion("");

  };

  return (

    <div className="chat-container">

      {/* Chat Header */}
      <div className="chat-header">

        <div>
          <h2>Chat with your PDF</h2>

          <p>
            Ask questions about your uploaded documents.
          </p>
        </div>

        <button
          className="clear-button"
          onClick={handleClearChat}
          disabled={messages.length === 0 || loading}
        >
          Clear Chat
        </button>

      </div>

      {/* Chat Messages */}
      <div className="chat-messages">

        {messages.length === 0 && (

          <div className="chat-empty">

            <h3>Start a Conversation</h3>

            <p>
              Ask anything about your uploaded PDF documents.
            </p>

          </div>

        )}

        {messages.map((message) => (

          <div
            key={message.id}
            className={`message ${message.role}`}
          >

            <div className="message-role">

              {message.role === "user"
                ? "You"
                : "AI Assistant"}

            </div>

            <div className="message-content">

              {message.role === "assistant" ? (

                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                >
                  {message.content}
                </ReactMarkdown>

              ) : (

                message.content

              )}

            </div>

            {/* Sources */}
            {message.role === "assistant" &&
              message.sources &&
              message.sources.length > 0 && (

              <div className="sources-container">

                <h4>Sources</h4>

                {message.sources.map((source) => (

                  <div
                    key={source.chunk_id}
                    className="source-item"
                  >

                    <span>
                      📄 {source.filename}
                    </span>

                    <span>
                      Page {source.page_number}
                    </span>

                  </div>

                ))}

              </div>

            )}

          </div>

        ))}

        {/* AI Loading Indicator */}
        {loading && (

          <div className="message assistant">

            <div className="message-role">
              AI Assistant
            </div>

            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>

          </div>

        )}

        {/* Auto Scroll Reference */}
        <div ref={messagesEndRef} />

      </div>

      {/* Error Message */}
      {error && (

        <div className="chat-error">
          {error}
        </div>

      )}

      {/* Chat Input */}
      <div className="chat-input-container">

        <textarea
          value={question}
          onChange={(event) =>
            setQuestion(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your PDF..."
          rows={2}
          disabled={loading}
        />

        <button
          onClick={handleSendMessage}
          disabled={!question.trim() || loading}
        >
          {loading ? "Sending..." : "Send"}
        </button>

      </div>

      <div className="chat-hint">
        Press Enter to send. Shift + Enter for a new line.
      </div>

    </div>

  );
}

export default ChatInterface;
