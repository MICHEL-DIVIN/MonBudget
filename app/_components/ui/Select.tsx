"use client";

import Icon from "./Icon";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: SelectProps) {
  const selectId = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={selectId}
        className="text-sm font-medium text-on-surface-variant"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            w-full border border-outline-variant rounded-xl px-4 py-3
            bg-surface-container-high text-on-surface
            appearance-none outline-none transition-colors duration-200
            focus:border-primary focus:ring-1 focus:ring-primary
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
          <Icon name="expand_more" size={20} />
        </div>
      </div>
    </div>
  );
}
