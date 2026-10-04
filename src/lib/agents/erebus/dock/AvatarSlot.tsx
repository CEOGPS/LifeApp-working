// src/lib/agents/erebus/dock/AvatarSlot.tsx
// A place the single live Erebus avatar can be shown (dock window, center
// stage, floating window). AvatarHost moves the live DOM node into the active
// slot, so the face, voice queue and audio are never re-created on moves.
import { useCallback } from "react";
import { useDockStore, type TargetName } from "./dockStore";

export default function AvatarSlot({
  name,
  size,
  className,
  placeholder,
}: {
  name: TargetName;
  size: number;
  className?: string;
  placeholder?: React.ReactNode;
}) {
  const setTarget = useDockStore((s) => s.setTarget);
  const active = useDockStore((s) => s.activeTarget === name);
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      setTarget(name, el);
    },
    [name, setTarget],
  );
  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={ref} data-avatar-slot={name} data-avatar-size={size} className="flex justify-center" />
      {!active && placeholder}
    </div>
  );
}
