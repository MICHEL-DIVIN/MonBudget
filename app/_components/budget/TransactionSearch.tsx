"use client";
import { useState } from "react";
import Icon from "@/app/_components/ui/Icon";

interface TransactionSearchProps {
  onSearch: (query: string) => void;
  onFilterCategory?: (category: string | null) => void;
  categories?: { value: string; label: string }[];
}

export default function TransactionSearch({ onSearch, onFilterCategory, categories }: TransactionSearchProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative">
        <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); }}
          placeholder="Rechercher une transaction..."
          className="w-full pl-10 pr-10 py-2.5 bg-surface-container border border-outline-variant/10 rounded-xl text-sm text-on-surface placeholder:text-outline outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
        />
        {categories && (
          <button onClick={() => setShowFilters(!showFilters)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${showFilters ? 'text-primary' : 'text-outline'}`}>
            <Icon name="tune" size={20} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && categories && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveCategory(null); onFilterCategory?.(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === null ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}
          >Tout</button>
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setActiveCategory(cat.value); onFilterCategory?.(cat.value); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeCategory === cat.value ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}
            >{cat.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
