import { useState } from "react";
import { Box, Container } from "@mantine/core";
import PdfUpload from "../components/PdfUpload";
import DocumentList from "../components/DocumentList";

function AdminPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Box h="calc(100vh - 56px)" style={{ overflowY: "auto" }}>
      <Container size="lg" py="md">
        <PdfUpload onUploadSuccess={() => setRefreshKey((k) => k + 1)} />
        <DocumentList refreshKey={refreshKey} />
      </Container>
    </Box>
  );
}

export default AdminPage;
