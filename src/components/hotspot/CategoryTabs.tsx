"use client";

import { CATEGORIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function CategoryTabs({
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide px-4 pt-4 bg-white/80 backdrop-blur-md sticky top-0 z-20">
      <button
        onClick={() => onCategoryChange("전체")}
        className={cn(
          "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
          activeCategory === "전체"
            ? "bg-primary text-white"
            : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
        )}
      >
        전체
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onCategoryChange(cat)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
            activeCategory === cat
              ? "bg-primary text-white"
              : "bg-secondary/50 text-secondary-foreground hover:bg-secondary"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
