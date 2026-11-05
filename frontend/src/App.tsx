
import PdfUpload from "./components/PdfUpload";
import ChatInterface from "./components/ChatInterface";
import "./App.css";

function App() {
  return (
    <div className="app">

      <header className="app-header">
        <h1>PDF RAG Chatbot</h1>
        <p>Chat with your PDF documents using AI</p>
      </header>

      <main>
        <PdfUpload />

        <ChatInterface />
      </main>

    </div>
  );
}

export default App;
