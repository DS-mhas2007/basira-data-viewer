import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetricRegistryDialog } from "../MetricRegistryDialog";
import { duckdb } from "@/lib/duckdb-service";

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

const contentFingerprint = `content-v1:sha256:${"a".repeat(64)}`;
const outputFingerprint = `output-v1:sha256:${"b".repeat(64)}`;

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
    vi.spyOn(duckdb, "computeOutputFingerprint").mockResolvedValue(outputFingerprint);
  });

  it("loads and saves definitions only under the active project key", async () => {
    render(
      <MetricRegistryDialog
        projectId="project-alpha"
        projectName="Alpha"
        schema={schema}
        contentFingerprint={contentFingerprint}
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
    expect(definitions[0].source.schemaFingerprint).toMatch(/^schema-v1:fnv1a64:[0-9a-f]{16}$/);
    expect(definitions[0].source.contentFingerprint).toBe(contentFingerprint);
    expect(definitions[0].source.outputFingerprint).toBe(outputFingerprint);
  });

  it("refuses approval without a complete active content fingerprint", async () => {
    render(
      <MetricRegistryDialog projectId="project-no-content" projectName="No content" schema={schema} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "سجل المقاييس" }));
    await screen.findByRole("dialog");
    fillValidDefinition();
    expect(screen.getByRole("button", { name: "اعتماد التعريف" })).toBeDisabled();
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("refuses approval when the active schema cannot produce a complete fingerprint", async () => {
    render(
      <MetricRegistryDialog
        projectId="project-incomplete-schema"
        projectName="Incomplete Schema"
        schema={{ columns: [{ name: "revenue" }, { name: "month", type: "DATE" }] }}
        contentFingerprint={contentFingerprint}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "سجل المقاييس" }));
    await screen.findByRole("dialog");
    fillValidDefinition();
    const approve = screen.getByRole("button", { name: "اعتماد التعريف" });
    await waitFor(() => expect(approve).toBeEnabled());
    fireEvent.click(approve);

    await waitFor(() => expect(storage.save).not.toHaveBeenCalled());
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
