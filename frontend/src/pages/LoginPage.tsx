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
} from "@mantine/core";
import { IconAlertCircle, IconFileText } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";

interface ApiError {
  response?: { data?: { detail?: string } };
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // The role comes from the stored account; route to the right UI.
      const role = await login(username.trim(), password);
      navigate(role === "admin" ? "/admin" : "/", { replace: true });
    } catch (err) {
      const detail = (err as ApiError).response?.data?.detail;
      setError(detail || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="calc(100vh - 96px)">
      <Paper withBorder shadow="md" p="xl" radius="md" w={420} maw="100%">
        <Stack gap="xs" mb="md" align="center">
          <IconFileText size={36} color="var(--mantine-color-indigo-6)" />
          <Title order={2}>Welcome back</Title>
          <Text c="dimmed" size="sm">
            Sign in to your account to continue.
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
              placeholder="Your username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
              autoComplete="username"
            />

            <PasswordInput
              label="Password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              autoComplete="current-password"
            />

            <Button type="submit" fullWidth loading={loading} mt="sm">
              Log in
            </Button>
          </Stack>
        </form>

        <Text ta="center" mt="lg" size="sm" c="dimmed">
          Don't have an account?{" "}
          <Anchor component={Link} to="/register">
            Register
          </Anchor>
        </Text>
      </Paper>
    </Center>
  );
}

export default LoginPage;
