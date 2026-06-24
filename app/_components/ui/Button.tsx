"use client";

import Icon from "./Icon";

interface ButtonProps {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  icon?: string;
}

const variantClasses: Record<string, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary:
    "bg-secondary-container text-on-secondary-container hover:opacity-90",
  outline:
    "border-2 border-primary text-primary bg-transparent hover:bg-primary/5",
  ghost: "text-on-surface-variant hover:bg-surface-container-high",
};

const sizeClasses: Record<string, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export default function Button({
  variant = "primary",
  size = "md",
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
  icon,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-full font-medium
        transition-all duration-200
        active:scale-95
        disabled:opacity-50 disabled:pointer-events-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 18 : size === "lg" ? 24 : 20} />}
      {children}
    </button>
  );
}
