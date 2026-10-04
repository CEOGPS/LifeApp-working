import BrowserArea from "@/pages/dashboard/_components/BrowserArea";
import Module from "@/pages/dashboard/_components/Module";
import { Globe } from "lucide-react";

export default function BrowserPage() {
  return (
    <div className="p-4 min-h-full">
      <h1 className="text-xl font-semibold mb-4">Browser</h1>
      <Module title="Browser" icon={<Globe size={14} />} className="h-[500px]">
        <BrowserArea />
      </Module>
    </div>
  );
}