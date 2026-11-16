import { createFileRoute } from "@tanstack/react-router";
import { MIZYAiIconGallery } from "@/components/MIZYAiIconGallery";

export const Route = createFileRoute("/design-tokens")({
  head: () => ({
    meta: [
      { title: "MIZYAi — Glass Icon Gallery" },
      {
        name: "description",
        content: "معرض تفاعلي لمكتبة أيقونات MIZYAi الأصلية ومعاينة ألوان الهوية البصرية.",
      },
    ],
  }),
  component: DesignTokensPreview,
});

function DesignTokensPreview() {
  return <MIZYAiIconGallery />;
}
