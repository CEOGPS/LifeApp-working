import SocialAnalytics from "@/pages/dashboard/_components/SocialAnalytics";
import Module from "@/pages/dashboard/_components/Module";
import { Share2 } from "lucide-react";

export default function SocialPage() {
  return (
    <div className="p-4 min-h-full">
      <h1 className="text-xl font-semibold mb-4">Social Analytics</h1>
      <Module title="Social Analytics" icon={<Share2 size={14} />} className="h-[600px]">
        <SocialAnalytics />
      </Module>
    </div>
  );
}