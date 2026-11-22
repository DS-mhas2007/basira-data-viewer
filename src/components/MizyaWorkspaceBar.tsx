import { useEffect, useState } from "react";
import { FolderKanban, Plus, RefreshCw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createProject, createProjectManifest, type MizyaProject } from "@/lib/mizya-project";
import { saveProjectAndQueueSync } from "@/lib/mizya-sync-queue";
import { ensurePersonalWorkspace, PERSONAL_WORKSPACE_ID } from "@/lib/mizya-workspace";
import { MetricRegistryDialog } from "@/components/MetricRegistryDialog";
import type { MetricSchema } from "@/lib/metric-definition-registry";

interface MizyaWorkspaceBarProps {
  onProjectChange?: (project: MizyaProject) => void;
  disabled?: boolean;
  sourceCount?: number | undefined;
  schema?: MetricSchema | null;
  datasetAlias?: string | null;
  contentFingerprint?: string | null;
}

export function MizyaWorkspaceBar({ onProjectChange, disabled = false, sourceCount, schema = null, datasetAlias = null, contentFingerprint = null }: MizyaWorkspaceBarProps) {
  const [projects, setProjects] = useState<MizyaProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh(preferredId?: string) {
    setLoading(true);
    try {
      const next = await ensurePersonalWorkspace();
      setProjects(next);
      const selected = next.find((project) => project.id === (preferredId ?? activeId)) ?? next[0];
      if (selected) {
        setActiveId(selected.id);
        onProjectChange?.(selected);
      }
    } catch {
      toast.error("تعذّر تحميل مساحة مشاريع MIZYA");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // Initial bootstrap only; project changes are handled by the select control.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createNewProject() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const project = createProject(PERSONAL_WORKSPACE_ID, name);
      await saveProjectAndQueueSync(createProjectManifest(project));
      setNewName("");
      await refresh(project.id);
      toast.success("تم إنشاء المشروع");
    } catch {
      toast.error("تعذّر إنشاء المشروع");
    } finally {
      setCreating(false);
    }
  }

  const active = projects.find((project) => project.id === activeId);

  return (
    <section dir="rtl" className="mz-glass-card mz-glass-card--dual mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <FolderKanban className="size-4 shrink-0 text-primary" />
        <span className="shrink-0 font-medium">مشاريع MIZYA</span>
      </div>
      <select
        aria-label="المشروع النشط"
        value={activeId}
        disabled={disabled || loading || projects.length === 0}
        onChange={(event) => {
          const project = projects.find((item) => item.id === event.target.value);
          if (!project) return;
          setActiveId(project.id);
          onProjectChange?.(project);
        }}
        className="mz-glass-inset h-9 min-w-[150px] flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
      <form
        className="flex min-w-[190px] flex-1 items-center gap-2"
        onSubmit={(event) => { event.preventDefault(); void createNewProject(); }}
      >
        <Input
          aria-label="اسم المشروع الجديد"
          value={newName}
          disabled={disabled || creating}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="اسم مشروع جديد"
          maxLength={80}
          className="h-9"
        />
        <Button type="submit" size="sm" variant="outline" disabled={disabled || !newName.trim() || creating}>
          {creating ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />}
          <span>إنشاء</span>
        </Button>
      </form>
      {active ? <div className="flex w-full flex-wrap items-center justify-between gap-2"><span className="truncate text-[11px] text-muted-foreground">المصادر المسجلة: {sourceCount ?? active.sourceIds.length}</span><MetricRegistryDialog projectId={active.id} projectName={active.name} datasetAlias={datasetAlias} schema={schema} contentFingerprint={contentFingerprint} disabled={disabled || loading} /></div> : null}
    </section>
  );
}
