import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Center,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Stack,
  Anchor,
  SegmentedControl,
  Input,
} from "@mantine/core";
import { IconAlertCircle, IconUserPlus } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../context/AuthContext";

interface ApiError {
  response?: { data?: { detail?: string } };
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(username.trim(), password, role);
      // Registration creates the account but does not log in; send the user
      // to the login page to sign in explicitly.
      notifications.show({
        title: "Account created",
        message: "Your account is ready. Please log in to continue.",
        color: "green",
      });
      navigate("/login", { replace: true });
    } catch (err) {
      const detail = (err as ApiError).response?.data?.detail;
      setError(detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="calc(100vh - 96px)">
      <Paper withBorder shadow="md" p="xl" radius="md" w={440} maw="100%">
        <Stack gap="xs" mb="md" align="center">
          <IconUserPlus size={36} color="var(--mantine-color-indigo-6)" />
          <Title order={2}>Create account</Title>
          <Text c="dimmed" size="sm">
            Choose an account type to get started.
          </Text>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack>
            {error && (
              <Alert
                variant="light"
                color="red"
                icon={<IconAlertCircle size={18} />}
              >
                {error}
              </Alert>
            )}

            <TextInput
              label="Username"
              placeholder="Pick a username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
              autoComplete="username"
            />

            <PasswordInput
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              autoComplete="new-password"
            />

            <PasswordInput
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              required
              autoComplete="new-password"
            />

            <Input.Wrapper label="Account type">
              <SegmentedControl
                fullWidth
                value={role}
                onChange={(v) => setRole(v as "user" | "admin")}
                data={[
                  { label: "User — chat with documents", value: "user" },
                  { label: "Admin — manage PDFs", value: "admin" },
                ]}
              />
            </Input.Wrapper>

            <Button type="submit" fullWidth loading={loading} mt="sm">
              Register
            </Button>
          </Stack>
        </form>

        <Text ta="center" mt="lg" size="sm" c="dimmed">
          Already have an account?{" "}
          <Anchor component={Link} to="/login">
            Log in
          </Anchor>
        </Text>
      </Paper>
    </Center>
  );
}

export default RegisterPage;
