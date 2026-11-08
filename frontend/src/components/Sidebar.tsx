import { useNavigate, useLocation } from "react-router-dom";
import {
  Stack,
  Button,
  Divider,
  Text,
  Group,
  Badge,
  ScrollArea,
  ActionIcon,
  Box,
  UnstyledButton,
  Tooltip,
} from "@mantine/core";
import {
  IconFiles,
  IconLogout,
  IconPlus,
  IconTrash,
  IconMessage,
} from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import { useConversationsContext } from "../context/ConversationsContext";
import { modals } from "@mantine/modals";

function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    conversations,
    activeId,
    setActiveId,
    createConversation,
    deleteConversation,
  } = useConversationsContext();

  // Navigate without closing the sidebar (it stays open until the user
  // toggles it with the burger).
  const go = (path: string) => {
    navigate(path);
  };

  const handleNewChat = () => {
    createConversation();
    go("/");
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    go("/");
  };

  const handleDelete = (id: string, title: string) => {
    modals.openConfirmModal({
      title: "Delete conversation",
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete{" "}
          <Text span fw={600}>
            "{title}"
          </Text>
          ? This cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => deleteConversation(id),
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const onChatView = location.pathname === "/";

  return (
    <Stack h="100%" gap="xs" p="sm">
      {isAdmin ? (
        <Button
          variant="light"
          justify="flex-start"
          leftSection={<IconFiles size={18} />}
          onClick={() => go("/admin")}
          fullWidth
        >
          Manage PDFs
        </Button>
      ) : (
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleNewChat}
          fullWidth
        >
          New chat
        </Button>
      )}

      {!isAdmin && (
        <>
          <Divider label="History" labelPosition="left" my={4} />

      <ScrollArea flex={1} type="hover">
        <Stack gap={4}>
          {conversations.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="sm">
              No conversations yet.
            </Text>
          )}

          {conversations.map((c) => {
            const active = c.id === activeId && onChatView;
            return (
              <Box
                key={c.id}
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                  background: active
                    ? "var(--mantine-color-indigo-light)"
                    : "transparent",
                }}
              >
                <Group gap={4} wrap="nowrap" pr={4}>
                  <UnstyledButton
                    onClick={() => handleSelect(c.id)}
                    style={{ flex: 1, overflow: "hidden", padding: "6px 8px" }}
                  >
                    <Group gap={6} wrap="nowrap">
                      <IconMessage
                        size={14}
                        style={{ flexShrink: 0 }}
                        color="var(--mantine-color-gray-6)"
                      />
                      <Text size="sm" truncate>
                        {c.title}
                      </Text>
                    </Group>
                  </UnstyledButton>
                  <Tooltip label="Delete conversation">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(c.id, c.title);
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
        </>
      )}

      <Divider my={4} />

      <Group justify="space-between" wrap="nowrap">
        <Badge
          color={isAdmin ? "grape" : "blue"}
          variant="light"
          size="lg"
          radius="sm"
          style={{ flex: 1, overflow: "hidden" }}
        >
          {user?.username} · {user?.role}
        </Badge>
        <Tooltip label="Log out">
          <ActionIcon
            variant="light"
            color="red"
            size="lg"
            onClick={handleLogout}
          >
            <IconLogout size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Stack>
  );
}

export default Sidebar;
