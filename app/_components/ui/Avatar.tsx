"use client";

interface AvatarProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<string, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-20 h-20 text-2xl",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({
  src,
  name,
  size = "md",
}: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizeClasses[size]}`}
      />
    );
  }

  return (
    <div
      className={`
        rounded-full bg-primary/15 text-primary
        flex items-center justify-center font-medium
        ${sizeClasses[size]}
      `}
      suppressHydrationWarning
    >
      {getInitials(name)}
    </div>
  );
}
