"use client";

interface BadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<string, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/15 text-error",
  info: "bg-primary/15 text-primary",
  neutral: "bg-on-surface-variant/10 text-on-surface-variant",
};

export default function Badge({
  variant = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        px-3 py-1 rounded-full text-xs font-medium
        inline-flex items-center
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
