"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

const variantClasses: Record<string, string> = {
  text: "h-4 w-full rounded",
  circular: "rounded-full",
  rectangular: "rounded-xl",
};

export default function Skeleton({
  className = "",
  variant = "text",
}: SkeletonProps) {
  return (
    <div
      className={`
        bg-surface-container-high animate-pulse
        ${variantClasses[variant]}
        ${className}
      `}
    />
  );
}
