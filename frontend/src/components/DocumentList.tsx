import { useState, useEffect, useCallback } from "react";
import {
  Paper,
  Group,
  Text,
  Button,
  Title,
  ThemeIcon,
  Table,
  Badge,
  ActionIcon,
  Alert,
  Center,
  Loader,
  Tooltip,
} from "@mantine/core";
import {
  IconFiles,
  IconRefresh,
  IconTrash,
  IconAlertCircle,
  IconFileTypePdf,
} from "@tabler/icons-react";
import api from "../services/api";
import { modals } from "@mantine/modals";

interface DocumentInfo {
  document_id: string;
  filename: string;
  total_chunks: number;
  total_pages: number;
}

interface DocumentsResponse {
  total_documents: number;
  documents: DocumentInfo[];
}

interface DocumentListProps {
  refreshKey?: number;
}

function DocumentList({ refreshKey = 0 }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<DocumentsResponse>("/documents");
      setDocuments(response.data.documents);
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Unable to load the document list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshKey]);

  const performDelete = async (documentId: string) => {
    setDeletingId(documentId);
    setError("");
    try {
      await api.delete(`/documents/${documentId}`);
      setDocuments((prev) =>
        prev.filter((doc) => doc.document_id !== documentId)
      );
    } catch (err) {
      console.error("Failed to delete document:", err);
      setError("Failed to delete the document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (documentId: string, filename: string) => {
    modals.openConfirmModal({
      title: "Delete document",
      centered: true,
      children: (
        <Text size="sm">
          Delete{" "}
          <Text span fw={600}>
            "{filename}"
          </Text>
          ? This removes all of its indexed chunks and cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => performDelete(documentId),
    });
  };

  return (
    <Paper withBorder shadow="sm" radius="md" p="lg" maw={860} mx="auto" mt="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon variant="light" size="lg" radius="md">
            <IconFiles size={20} />
          </ThemeIcon>
          <div>
            <Title order={5}>Indexed Documents</Title>
            <Text size="xs" c="dimmed">
              {documents.length} document(s) in the knowledge base.
            </Text>
          </div>
        </Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconRefresh size={14} />}
          onClick={fetchDocuments}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      {error && (
        <Alert
          variant="light"
          color="red"
          icon={<IconAlertCircle size={18} />}
          mb="md"
        >
          {error}
        </Alert>
      )}

      {loading && documents.length === 0 ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : documents.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed" size="sm">
            No documents indexed yet. Upload a PDF to get started.
          </Text>
        </Center>
      ) : (
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Document</Table.Th>
              <Table.Th>Pages</Table.Th>
              <Table.Th>Chunks</Table.Th>
              <Table.Th ta="right">Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {documents.map((doc) => (
              <Table.Tr key={doc.document_id}>
                <Table.Td>
                  <Group gap="xs">
                    <IconFileTypePdf
                      size={18}
                      color="var(--mantine-color-red-6)"
                    />
                    <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                      {doc.filename}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="gray">
                    {doc.total_pages}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="indigo">
                    {doc.total_chunks}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Tooltip label="Delete document">
                    <ActionIcon
                      variant="light"
                      color="red"
                      loading={deletingId === doc.document_id}
                      onClick={() =>
                        handleDelete(doc.document_id, doc.filename)
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}

export default DocumentList;
