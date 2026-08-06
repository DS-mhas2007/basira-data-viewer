/**
 * ملخص جاهز للصق في واتساب / سلاك بضغطة واحدة.
 */
import { useState } from "react";
import { Check, Copy, MessageCircle, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildShareSummary, type ShareChannel, type ShareInput } from "@/lib/share-summary";
import { playSfx } from "@/lib/sfx";

export function ShareSummaryButton({ input }: { input: ShareInput }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ShareChannel>("whatsapp");
  const [copied, setCopied] = useState(false);
  const text = buildShareSummary(input, channel);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playSfx("success");
      toast.success("تم نسخ الملخص — الصقه في المحادثة مباشرة");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر النسخ إلى الحافظة");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="clay-press rounded-xl border-accent/25 bg-accent/[0.06] text-accent"
      >
        <MessageCircle className="size-4" strokeWidth={2.25} />
        ملخص للواتساب
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg rounded-2xl">
          <DialogHeader className="text-start">
            <DialogTitle className="font-display text-base">ملخص جاهز للمشاركة</DialogTitle>
            <DialogDescription className="text-xs">
              نص منسّق يُلصق مباشرة في واتساب أو سلاك — بلا صور ولا روابط خارجية.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={channel === "whatsapp" ? "default" : "secondary"}
              className="clay-press h-8 rounded-lg text-xs"
              onClick={() => setChannel("whatsapp")}
            >
              <MessageCircle className="size-3.5" strokeWidth={2.25} />
              واتساب
            </Button>
            <Button
              size="sm"
              variant={channel === "slack" ? "default" : "secondary"}
              className="clay-press h-8 rounded-lg text-xs"
              onClick={() => setChannel("slack")}
            >
              <Hash className="size-3.5" strokeWidth={2.25} />
              سلاك / تيمز
            </Button>
          </div>

          <pre className="clay-inset max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-background/60 p-4 text-[13px] leading-relaxed">
            {text}
          </pre>

          <Button onClick={() => void copy()} className="clay-press rounded-xl">
            {copied ? <Check className="size-4" strokeWidth={2.25} /> : <Copy className="size-4" strokeWidth={2.25} />}
            {copied ? "تم النسخ" : "نسخ الملخص"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
