import React from "react";
import { CATEGORIES, CATEGORY_ICONS } from "@/lib/integrationCatalog";
import {
  LayoutGrid, Sparkles, Mail, MessageSquare, CreditCard, Globe,
  Palette, Code2, Share2, Megaphone, Users, Monitor, Search, FolderTree
} from "lucide-react";

const ICONS = {
  LayoutGrid, Sparkles, Mail, MessageSquare, CreditCard, Globe,
  Palette, Code2, Share2, Megaphone, Users, Monitor, Search, FolderTree,
};

const Icon = ({ name, className }) => {
  const Lucide = ICONS[name] || LayoutGrid;
  return <Lucide className={className} />;
};

export default function CategorySidebar({ activeCategory, onSelect, counts }) {
  return (
    <nav className="flex flex-col gap-1">
      <button
        onClick={() => onSelect("All")}
        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          activeCategory === "All"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <Icon name="LayoutGrid" className="h-4 w-4" />
          All Integrations
        </span>
        {counts?.all > 0 && <span className="text-xs opacity-70">{counts.all}</span>}
      </button>
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Icon name={CATEGORY_ICONS[cat]} className="h-4 w-4" />
              {cat}
            </span>
            {counts?.[cat] > 0 && (
              <span className="text-xs opacity-70">{counts[cat]}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}