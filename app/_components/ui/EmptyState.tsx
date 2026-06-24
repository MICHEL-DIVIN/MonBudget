"use client";

import Icon from "./Icon";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <Icon name={icon} size={48} className="text-outline mb-4" />
      <h3 className="text-lg font-semibold text-on-surface mb-2">
        {title}
      </h3>
      <p className="text-on-surface-variant max-w-xs mb-6">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
