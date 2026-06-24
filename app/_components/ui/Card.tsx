"use client";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const paddingMap = { sm: "p-3", md: "p-4 md:p-5", lg: "p-5 md:p-6" };

export default function Card({ children, className = "", padding = "md", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl bg-surface-container
        ${paddingMap[padding]}
        ${onClick ? "hover:shadow-card-hover cursor-pointer active:scale-[0.98] transition-all" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
