"use client";

interface InputProps {
  label: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  min?: string;
  step?: string;
  autoComplete?: string;
}

export default function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  disabled = false,
  id,
  name,
  min,
  step,
  autoComplete,
}: InputProps) {
  const inputId = id || name || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-on-surface-variant"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        step={step}
        autoComplete={autoComplete}
        className={`
          w-full border rounded-xl px-4 py-3
          bg-surface-container-high text-on-surface
          outline-none transition-colors duration-200
          placeholder:text-on-surface-variant
          disabled:opacity-50 disabled:cursor-not-allowed
          ${
            error
              ? "border-error text-error-container focus:border-error focus:ring-1 focus:ring-error"
              : "border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary"
          }
        `}
      />
      {error && (
        <span className="text-xs text-error mt-0.5">{error}</span>
      )}
    </div>
  );
}
