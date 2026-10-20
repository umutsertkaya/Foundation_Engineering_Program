import { useState } from "react";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { create_structure } from "../../../shared/api/client";
import { ErrorAlert } from "../../../shared/components/ErrorAlert";
import { InputsForm } from "../components/InputsForm";
import { MissingList } from "../components/MissingList";
import { SoilSourceForm } from "../components/SoilSourceForm";
import { DEFAULT_INPUTS, DEFAULT_SOIL, missingInputs, toCreatePayload } from "../inputs";

export function SheetPileCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [soil, setSoil] = useState(DEFAULT_SOIL);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const missing = missingInputs(inputs, soil);

  const create = async () => {
    setSubmitted(true);
    if (missing.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const created = await create_structure(toCreatePayload(inputs, soil));
      navigate(`/m/sheet_pile/s/${encodeURIComponent(created.id)}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="md" maw={880}>
      <Group>
        <Button size="xs" variant="subtle" leftSection={<IconArrowLeft size={14} />} onClick={() => navigate("/m/sheet_pile")}>
          {t("web.common.back_to_list")}
        </Button>
      </Group>
      <Title order={3}>{t("sheet_pile.create.title")}</Title>

      <Title order={5}>{t("sheet_pile.create.section_inputs")}</Title>
      <InputsForm value={inputs} onChange={setInputs} missing={submitted ? missing : []} />

      <Title order={5}>{t("sheet_pile.create.section_soil")}</Title>
      <SoilSourceForm value={soil} onChange={setSoil} missing={submitted ? missing : []} />

      {submitted && <MissingList keys={missing} />}
      {error != null && <ErrorAlert error={error} />}
      <Group>
        <Button onClick={() => void create()} loading={saving}>
          {t("web.common.create")}
        </Button>
        <Text size="xs" c="dimmed">
          {t("sheet_pile.create.note")}
        </Text>
      </Group>
    </Stack>
  );
}
