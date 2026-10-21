import { Card, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { FIGURES } from "../figures";

/** Review page: every registered figure with its id (not linked from the menu). */
export function GalleryPage() {
  return (
    <Stack gap="md">
      <Title order={3}>Figure gallery</Title>
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
