"use client";

import React from "react";

interface MonthSelectorProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

const monthNames = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export default function MonthSelector({
  month,
  year,
  onChange,
}: MonthSelectorProps) {
  function prev() {
    if (month === 0) {
      onChange(11, year - 1);
    } else {
      onChange(month - 1, year);
    }
  }

  function next() {
    if (month === 11) {
      onChange(0, year + 1);
    } else {
      onChange(month + 1, year);
    }
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={prev}
        className="w-8 h-8 rounded-xl hover:bg-surface-container-high flex items-center justify-center transition-colors"
      >
        <span className="material-symbols-outlined text-on-surface">chevron_left</span>
      </button>
      <span className="text-base font-medium text-on-surface min-w-[140px] text-center">
        {monthNames[month]} {year}
      </span>
      <button
        onClick={next}
        className="w-8 h-8 rounded-xl hover:bg-surface-container-high flex items-center justify-center transition-colors"
      >
        <span className="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  );
}
