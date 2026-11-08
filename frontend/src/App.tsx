import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import {
  AppShell,
  Burger,
  Group,
  Title,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconFileText, IconSun, IconMoon } from "@tabler/icons-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConversationsContext } from "./context/ConversationsContext";
import { useConversations } from "./hooks/useConversations";
import { useSidebarWidth } from "./hooks/useSidebarWidth";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import UserPage from "./pages/UserPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

/**
 * Authenticated layout: AppShell with a collapsible sidebar (navbar).
 * The conversations store is provided here so both the sidebar and the
 * chat page share the same history.
 */
function ColorSchemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === "dark";
  return (
    <Tooltip label={dark ? "Light mode" : "Dark mode"}>
      <ActionIcon
        variant="default"
        size="lg"
        radius="md"
        onClick={toggleColorScheme}
        aria-label="Toggle color scheme"
      >
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

function AuthenticatedLayout() {
  const { user, isAdmin } = useAuth();
  const [opened, { toggle }] = useDisclosure(true);
  const conversations = useConversations(user?.username ?? "anonymous");
  const { width, onMouseDown } = useSidebarWidth();

  return (
    <ConversationsContext.Provider value={conversations}>
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width,
          breakpoint: "sm",
          collapsed: { mobile: !opened, desktop: !opened },
        }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" gap="sm" justify="space-between">
            <Group gap="sm">
              <Burger opened={opened} onClick={toggle} size="sm" />
              <ThemeIcon variant="light" size="md" radius="md">
                <IconFileText size={18} />
              </ThemeIcon>
              <Title order={5}>PDF RAG Chatbot</Title>
            </Group>
            <ColorSchemeToggle />
          </Group>
        </AppShell.Header>

        <AppShell.Navbar>
          <Sidebar />
          {/* Drag handle to resize the sidebar */}
          {opened && (
            <div
              onMouseDown={onMouseDown}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 6,
                height: "100%",
                cursor: "col-resize",
                zIndex: 10,
              }}
              title="Drag to resize"
            />
          )}
        </AppShell.Navbar>

        <AppShell.Main h="100vh">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute requireUser>
                  <UserPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={<Navigate to={isAdmin ? "/admin" : "/"} replace />}
            />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </ConversationsContext.Provider>
  );
}

/**
 * Chooses between the auth pages (no shell) and the authenticated layout.
 */
function Root() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
