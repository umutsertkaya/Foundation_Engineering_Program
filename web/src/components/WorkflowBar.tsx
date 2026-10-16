import { Badge, Button, Group } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

export interface WorkflowStepDef {
  key: string;
  path: string;
  labelKey: string;
  index: number;
}

export const WORKFLOW_STEPS: WorkflowStepDef[] = [
  { key: "project", path: "/project", labelKey: "web.nav.project", index: 1 },
  { key: "site_data", path: "/site-data", labelKey: "web.nav.site_data", index: 2 },
  { key: "soil_models", path: "/soil-models", labelKey: "web.nav.soil_models", index: 3 },
  { key: "structures", path: "/structures", labelKey: "web.nav.structures", index: 4 },
  { key: "report", path: "/report", labelKey: "web.nav.report", index: 5 },
];

function isStepActive(pathname: string, stepPath: string): boolean {
  if (stepPath === "/project" && (pathname === "/" || pathname === "/project")) {
    return true;
  }
  return pathname === stepPath || pathname.startsWith(`${stepPath}/`);
}

export function WorkflowBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav aria-label={t("web.nav.workflow_aria")}>
      <Group gap={4} wrap="nowrap">
        {WORKFLOW_STEPS.map((step, idx) => {
          const active = isStepActive(location.pathname, step.path);
          return (
            <Group key={step.key} gap={4} wrap="nowrap">
              <Button
                size="compact-sm"
                variant={active ? "filled" : "subtle"}
                color={active ? "blue" : "gray"}
                aria-current={active ? "step" : undefined}
                data-active={active || undefined}
                data-testid={`workflow-step-${step.path.slice(1)}`}
                onClick={() => navigate(step.path)}
                leftSection={
                  <Badge
                    size="xs"
                    circle
                    variant={active ? "white" : "light"}
                    color={active ? "blue" : "gray"}
                  >
                    {step.index}
                  </Badge>
                }
              >
                {t(step.labelKey)}
              </Button>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
              )}
            </Group>
          );
        })}
      </Group>
    </nav>
  );
}
