import { useState } from "react";
import {
  Paper,
  Group,
  Text,
  Button,
  Stack,
  ThemeIcon,
  Title,
  Alert,
  SimpleGrid,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import {
  IconUpload,
  IconFileTypePdf,
  IconX,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import api from "../services/api";

interface UploadResponse {
  message: string;
  document_id: string;
  filename: string;
  total_pages: number;
  total_characters: number;
  total_chunks: number;
  saved_chunks: number;
}

interface PdfUploadProps {
  onUploadSuccess?: () => void;
}

function PdfUpload({ onUploadSuccess }: PdfUploadProps) {
  const [file, setFile] = useState<FileWithPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResponse | null>(null);

  const handleDrop = (files: FileWithPath[]) => {
    setError("");
    setResult(null);
    setFile(files[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post<UploadResponse>("/pdf/upload", formData);
      setResult(response.data);
      setFile(null);
      onUploadSuccess?.();
    } catch (err: unknown) {
      console.error("Upload failed:", err);
      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosError = err as {
          response?: { data?: { detail?: string } };
          message?: string;
        };
        setError(
          axiosError.response?.data?.detail ||
            axiosError.message ||
            "Upload failed. Please try again."
        );
      } else {
        setError("Unable to connect to the backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="sm" radius="md" p="lg" maw={860} mx="auto">
      <Stack gap="md">
        <Group gap="xs">
          <ThemeIcon variant="light" size="lg" radius="md">
            <IconFileTypePdf size={20} />
          </ThemeIcon>
          <div>
            <Title order={5}>Upload a PDF</Title>
            <Text size="xs" c="dimmed">
              Drop a document to index it for Q&amp;A.
            </Text>
          </div>
        </Group>

        <Dropzone
          onDrop={handleDrop}
          onReject={() => setError("Please select a valid PDF file.")}
          accept={["application/pdf"]}
          multiple={false}
          loading={loading}
        >
          <Group
            justify="center"
            gap="xl"
            mih={140}
            style={{ pointerEvents: "none" }}
          >
            <Dropzone.Accept>
              <IconUpload size={48} color="var(--mantine-color-indigo-6)" />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={48} color="var(--mantine-color-red-6)" />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconFileTypePdf size={48} color="var(--mantine-color-gray-5)" />
            </Dropzone.Idle>

            <div>
              <Text size="lg" inline>
                Drag a PDF here or click to select
              </Text>
              <Text size="sm" c="dimmed" inline mt={7}>
                {file ? `Selected: ${file.name}` : "Only .pdf files are accepted"}
              </Text>
            </div>
          </Group>
        </Dropzone>

        {error && (
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={18} />}
          >
            {error}
          </Alert>
        )}

        <Button
          leftSection={<IconUpload size={16} />}
          onClick={handleUpload}
          disabled={!file || loading}
          loading={loading}
        >
          {loading ? "Processing PDF..." : "Upload & Index"}
        </Button>

        {result && (
          <Alert
            variant="light"
            color="green"
            icon={<IconCheck size={18} />}
            title="PDF indexed successfully"
          >
            <SimpleGrid cols={2} spacing="xs" mt="xs">
              <Text size="sm">
                <b>Filename:</b> {result.filename}
              </Text>
              <Text size="sm">
                <b>Pages:</b> {result.total_pages}
              </Text>
              <Text size="sm">
                <b>Chunks:</b> {result.total_chunks}
              </Text>
              <Text size="sm">
                <b>Characters:</b> {result.total_characters}
              </Text>
            </SimpleGrid>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

export default PdfUpload;
