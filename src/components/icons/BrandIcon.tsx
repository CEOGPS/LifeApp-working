import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes, CSSProperties } from "react";

interface BrandIconProps {
  slug?: string;
  size?: number;
  color?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const brandIcons: Record<string, ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>> = {};

export default function BrandIcon({ 
  slug, 
  size = 16, 
  color = "currentColor", 
  title,
  className = "",
  style
}: BrandIconProps) {
  if (slug && brandIcons[slug]) {
    const Icon = brandIcons[slug];
    return <Icon size={size} color={color} className={className} style={style} aria-label={title} />;
  }
  
  // Fallback - render initials or generic icon
  const initials = slug?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'CG';
  
  return (
    <div
      className={`inline-flex items-center justify-center rounded ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5, color, ...style }}
      title={title}
      aria-label={title}
    >
      {initials}
    </div>
  );
}