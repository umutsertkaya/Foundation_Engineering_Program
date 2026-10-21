import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../../app/i18n";
import { HomePage } from "../pages/HomePage";

afterEach(cleanup);

describe("anchored_wall home", () => {
  it("renders the translated placeholder heading", () => {
    render(<MantineProvider><HomePage /></MantineProvider>);
    expect(screen.getByRole("heading", {
      name: i18n.t("anchored_wall.home.heading"),
    })).toBeInTheDocument();
  });
});
