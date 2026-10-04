import type { LucideIcon } from "lucide-react";

type IconProps = {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

const iconMap: Record<string, LucideIcon> = {};

export default function Icon({ name, size = 16, className = "", style }: IconProps) {
  const Component = iconMap[name];
  if (!Component) {
    return <span style={{ ...style, fontSize: size }}>{name}</span>;
  }
  return <Component size={size} className={className} style={style} />;
}