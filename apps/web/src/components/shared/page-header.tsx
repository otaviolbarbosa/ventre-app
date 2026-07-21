import { cn } from "@ventre/ui/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title?: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  splitted?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  splitted,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center space-x-1 text-muted-foreground text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.label} className="flex items-center">
              {index > 0 && <ChevronRight className="mx-1 h-4 w-4" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}
      {/* Title and actions */}
      {(title || description || children) && (
        <div
          className={cn(
            "flex justify-between gap-2 sm:flex-row",
            splitted && "flex-col sm:flex-row",
          )}
        >
          {(title || description) && (
            <div>
              {title && <h1 className="font-bold text-2xl tracking-tight">{title}</h1>}
              {description && <p className="mt-1 text-muted-foreground">{description}</p>}
            </div>
          )}
          {children && (
            <div className={cn("flex items-center gap-2", splitted && "justify-end")}>
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
