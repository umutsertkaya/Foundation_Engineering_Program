import { ActionIcon, Button, Checkbox, NumberInput, ScrollArea, Select, Table, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export interface RecordColumn {
  key: string;
  label: string;
  kind: "number" | "text" | "bool" | "select";
  options?: readonly string[];
  width?: number;
}

interface Props<T extends object> {
  columns: readonly RecordColumn[];
  rows: T[];
  onChange: (rows: T[]) => void;
  /** Row added by the "add row" button. */
  blank: () => T;
  addLabel: string;
}

/** Editable table for a list of flat records; numbers are stored as number or null. */
export function RecordTable<T extends object>({ columns, rows, onChange, blank, addLabel }: Props<T>) {
  const { t } = useTranslation();
  const set = (index: number, key: string, value: unknown) =>
    onChange(rows.map((row, i) => (i === index ? ({ ...row, [key]: value } as T) : row)));

  return (
    <>
      <ScrollArea type="auto" offsetScrollbars="x">
        <Table withTableBorder withColumnBorders verticalSpacing={2} miw={columns.length * 90}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((c) => (
                <Table.Th key={c.key}>{c.label}</Table.Th>
              ))}
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, index) => (
              <Table.Tr key={index}>
                {columns.map((c) => {
                  const value = (row as Record<string, unknown>)[c.key];
                  const aria = `${c.label} ${index + 1}`;
                  return (
                    <Table.Td key={c.key} miw={c.width}>
                      {c.kind === "number" && (
                        <NumberInput
                          size="xs"
                          aria-label={aria}
                          hideControls
                          decimalScale={4}
                          value={typeof value === "number" ? value : ""}
                          onChange={(v) => set(index, c.key, typeof v === "number" ? v : null)}
                        />
                      )}
                      {c.kind === "text" && (
                        <TextInput
                          size="xs"
                          aria-label={aria}
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => set(index, c.key, e.currentTarget.value)}
                        />
                      )}
                      {c.kind === "bool" && (
                        <Checkbox
                          aria-label={aria}
                          checked={value === true}
                          onChange={(e) => set(index, c.key, e.currentTarget.checked)}
                        />
                      )}
                      {c.kind === "select" && (
                        <Select
                          size="xs"
                          aria-label={aria}
                          clearable
                          data={[...(c.options ?? [])]}
                          value={typeof value === "string" ? value : null}
                          onChange={(v) => set(index, c.key, v)}
                        />
                      )}
                    </Table.Td>
                  );
                })}
                <Table.Td>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="subtle"
                    aria-label={t("web.site.row_delete", { n: index + 1 })}
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} mt="xs" onClick={() => onChange([...rows, blank()])}>
        {addLabel}
      </Button>
    </>
  );
}
