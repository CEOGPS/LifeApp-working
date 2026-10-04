import AiInsights from "@/pages/dashboard/_components/AiInsights";
import Module from "@/pages/dashboard/_components/Module";
import { Brain } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="p-4 min-h-full">
      <h1 className="text-xl font-semibold mb-4">Analytics</h1>
      <Module title="AI Insights" icon={<Brain size={14} />} className="h-[400px]">
        <AiInsights />
      </Module>
    </div>
  );
}