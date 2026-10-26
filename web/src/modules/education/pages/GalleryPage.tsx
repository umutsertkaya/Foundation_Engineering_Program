import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import { PageHeader } from "../../../shared/components/PageHeader";
import { FIGURES } from "../figures";

/** Review page: every registered figure with its id (not linked from the menu). */
export function GalleryPage() {
  return (
    <Stack gap="md">
      <PageHeader title="Figure gallery" />
      <SimpleGrid cols={1}>
        {Object.entries(FIGURES).map(([id, Fig]) => (
          <Card key={id} withBorder data-figure={id}>
            <Text size="xs" c="dimmed" mb={4}>{id}</Text>
            <Fig />
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
