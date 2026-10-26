import { useState } from "react";
import { Button, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { create_structure } from "../../../shared/api/client";
import { ActionBar } from "../../../shared/components/ActionBar";
import { PageHeader } from "../../../shared/components/PageHeader";
import { SectionCard } from "../../../shared/components/SectionCard";
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
      <PageHeader
        title={t("sheet_pile.create.title")}
        back={{ to: "/m/sheet_pile", label: t("web.common.back_to_list") }}
      />

      <InputsForm value={inputs} onChange={setInputs} missing={submitted ? missing : []} />

      <SectionCard step={3} title={t("sheet_pile.card.soil")}>
        <SoilSourceForm value={soil} onChange={setSoil} missing={submitted ? missing : []} />
      </SectionCard>

      {submitted && <MissingList keys={missing} />}
      {error != null && <ErrorAlert error={error} />}
      <ActionBar text={t("sheet_pile.create.note")}>
        <Button onClick={() => void create()} loading={saving}>
          {t("web.common.create")}
        </Button>
      </ActionBar>
    </Stack>
  );
}
