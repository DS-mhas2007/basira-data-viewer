/**
 * إدارة جلسة العمل المحلية: حالة الحفظ التلقائي، تصدير/فتح مشروع .basira، ومسح الجلسة.
 */
import { useRef } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  FolderOpen,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PROJECT_EXT, relativeTime, type WorkspaceSession } from "@/lib/workspace-store";
import { formatBytes } from "@/lib/parse-file";

interface MenuProps {
  hasData: boolean;
  savedAt: number | null;
  saving: boolean;
  onSaveProject: () => void;
  onOpenProject: (file: File) => void;
  onClearSession: () => void;
}

export function SessionMenu(props: MenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={`${PROJECT_EXT},.json,application/json`}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) props.onOpenProject(f);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="clay-press hidden h-10 gap-2 rounded-xl border-white/10 bg-white/[0.03] text-muted-foreground lg:flex"
            aria-label="جلسة العمل"
          >
            {props.saving ? (
              <Loader2 className="size-4 animate-spin text-accent" strokeWidth={2} />
            ) : props.savedAt ? (
              <Check className="size-4 text-primary" strokeWidth={2.25} />
            ) : (
              <Archive className="size-4" strokeWidth={2} />
            )}
            <span className="text-[11px]">
              {props.saving ? "جاري الحفظ" : props.savedAt ? `حُفظت ${relativeTime(props.savedAt)}` : "الجلسة"}
            </span>
            <ChevronDown className="size-3.5 opacity-70" strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground">
            جلسة العمل — محفوظة داخل متصفحك
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!props.hasData}
            onSelect={() => props.onSaveProject()}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Save className="size-3.5 text-accent" strokeWidth={2} />
              حفظ المشروع كملف {PROJECT_EXT}
            </span>
            <span className="text-xs text-muted-foreground">
              ملف واحد يحوي البيانات والتنظيف والاستنتاجات.
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => inputRef.current?.click()}
            className="flex-col items-start gap-0.5 py-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <FolderOpen className="size-3.5 text-accent" strokeWidth={2} />
              فتح مشروع محفوظ
            </span>
            <span className="text-xs text-muted-foreground">استرجاع التحليل من حيث توقّفت.</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!props.savedAt}
            onSelect={() => props.onClearSession()}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
            مسح الجلسة المحفوظة
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

interface RestoreProps {
  session: WorkspaceSession | null;
  busy: boolean;
  onRestore: () => void;
  onDismiss: () => void;
}

/** نافذة «لديك جلسة عمل سابقة» عند فتح الموقع من جديد. */
export function SessionRestoreDialog({ session, busy, onRestore, onDismiss }: RestoreProps) {
  const open = session !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onDismiss()}>
      <DialogContent dir="rtl" className="max-w-md rounded-2xl">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <RotateCcw className="size-4 text-primary" strokeWidth={2.25} />
            لديك جلسة عمل سابقة
          </DialogTitle>
          <DialogDescription className="text-xs">
            استُعيدت من ذاكرة متصفحك — لم تُرفع بياناتك إلى أي خادم.
          </DialogDescription>
        </DialogHeader>

        {session && (
          <div className="clay-inset space-y-2 rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
            <p dir="auto" className="truncate font-display text-sm font-bold">
              {session.file.fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(session.file.fileSize)} · ورقة «{session.sheet}» ·{" "}
              {session.cleanSteps.length} خطوة تنظيف · {session.pinned.length} استنتاج مثبّت
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              آخر حفظ: {relativeTime(session.savedAt)}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="ghost" className="clay-press rounded-xl" disabled={busy} onClick={onDismiss}>
            ابدأ من جديد
          </Button>
          <Button type="button" className="clay-press gap-2 rounded-xl" disabled={busy} onClick={onRestore}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <RotateCcw className="size-4" strokeWidth={2} />
            )}
            {busy ? "جاري الاستعادة..." : "استكمال التحليل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}