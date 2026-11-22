import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetricRegistryDialog } from "../MetricRegistryDialog";

const storage = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/workspace-store", () => ({
  loadProjectMetricDefinitions: storage.load,
  saveProjectMetricDefinitions: storage.save,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const schema = {
  columns: [
    { name: "revenue", type: "DOUBLE" },
    { name: "month", type: "DATE" },
  ],
};

function fillValidDefinition() {
  fireEvent.change(screen.getByLabelText("اسم المقياس"), { target: { value: "Gross revenue" } });
  fireEvent.change(screen.getByLabelText("الوحدة"), { target: { value: "USD" } });
  fireEvent.change(screen.getByLabelText("المعنى التجاري / العلمي"), {
    target: { value: "Total recorded revenue." },
  });
  fireEvent.change(screen.getByLabelText("الصيغة (Expression)"), {
    target: { value: "SUM(revenue)" },
  });
  fireEvent.change(screen.getByLabelText("أعمدة المصدر — افصل بفاصلة"), {
    target: { value: "revenue" },
  });
  fireEvent.change(screen.getByLabelText("Grain — مستوى الحبيبية"), {
    target: { value: "month" },
  });
}

describe("MetricRegistryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.load.mockResolvedValue([]);
    storage.save.mockResolvedValue(true);
  });

  it("loads and saves definitions only under the active project key", async () => {
    render(
      <MetricRegistryDialog
        projectId="project-alpha"
        projectName="Alpha"
        schema={schema}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "سجل المقاييس" }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(storage.load).toHaveBeenCalledWith("project-alpha"));

    fillValidDefinition();
    const approve = screen.getByRole("button", { name: "اعتماد التعريف" });
    await waitFor(() => expect(approve).toBeEnabled());
    fireEvent.click(approve);

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1));
    const [projectId, definitions] = storage.save.mock.calls[0]!;
    expect(projectId).toBe("project-alpha");
    expect(definitions[0].status).toBe("approved");
    expect(definitions[0].sourceColumns).toEqual(["revenue"]);
    expect(definitions[0].grain).toEqual(["month"]);
  });

  it("defaults the source dataset identity to the active DuckDB alias, not the project title", async () => {
    render(
      <MetricRegistryDialog
        projectId="project-delta"
        projectName="Quarterly Analytics"
        datasetAlias="orders__sheet1"
        schema={schema}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "سجل المقاييس" }));
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("مجموعة البيانات المصدر")).toHaveValue("orders__sheet1");
    fillValidDefinition();
    fireEvent.click(screen.getByRole("button", { name: "حفظ مسودة" }));
    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1));
    const [, definitions] = storage.save.mock.calls[0]!;
    expect(definitions[0].source.dataset).toBe("orders__sheet1");
  });

  it("blocks approval when a declared source column is absent from the active schema", async () => {
    render(
      <MetricRegistryDialog
        projectId="project-beta"
        projectName="Beta"
        schema={schema}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "سجل المقاييس" }));
    await screen.findByRole("dialog");
    fillValidDefinition();
    fireEvent.change(screen.getByLabelText("أعمدة المصدر — افصل بفاصلة"), {
      target: { value: "unknown_column" },
    });

    expect(screen.getByRole("button", { name: "اعتماد التعريف" })).toBeDisabled();
    expect(await screen.findByText(/عمود المصدر غير موجود/)).toBeInTheDocument();
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("keeps commas inside multiline filter expressions intact", async () => {
    render(
      <MetricRegistryDialog
        projectId="project-gamma"
        projectName="Gamma"
        schema={schema}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "سجل المقاييس" }));
    await screen.findByRole("dialog");
    fillValidDefinition();
    fireEvent.change(screen.getByLabelText("الفلاتر"), {
      target: { value: "region IN ('US','CA')" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ مسودة" }));

    await waitFor(() => expect(storage.save).toHaveBeenCalledTimes(1));
    const [, definitions] = storage.save.mock.calls[0]!;
    expect(definitions[0].filters).toEqual(["region IN ('US','CA')"]);
    expect(definitions[0].status).toBe("draft");
  });
});
