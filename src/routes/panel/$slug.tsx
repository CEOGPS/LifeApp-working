import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Frame } from "@/components/dash/frame";
import { isPanel } from "@/components/dash/shell";
import { Panel } from "@/components/dash/views";

export const Route = createFileRoute("/panel/$slug")({ component: PanelPage });

function PanelPage() {
  const { slug } = Route.useParams();
  if (!isPanel(slug)) return <Navigate to="/" />;
  return (
    <Frame active={slug}>
      <Panel slug={slug} />
    </Frame>
  );
}
