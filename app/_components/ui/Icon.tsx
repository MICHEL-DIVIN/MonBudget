"use client";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  filled?: boolean;
}

export default function Icon({
  name,
  className = "",
  size = 24,
  filled = false,
}: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? "filled" : ""} ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}
