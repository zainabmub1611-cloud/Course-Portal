"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-10 text-center border-dashed",
        className
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div>
        <p className="font-heading font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
        )}
      </div>
      {action}
    </Card>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
