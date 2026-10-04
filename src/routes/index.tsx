import { createFileRoute } from "@tanstack/react-router";
import { Frame } from "@/components/dash/frame";
import { Dashboard } from "@/components/dash/views";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Frame active="dashboard">
      <Dashboard />
    </Frame>
  );
}
