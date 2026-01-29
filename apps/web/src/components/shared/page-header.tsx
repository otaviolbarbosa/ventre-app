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
  children?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, children }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex items-center space-x-1 text-sm text-muted-foreground">
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
        <div className="flex justify-between gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
            {description && <p className="mt-1 text-muted-foreground">{description}</p>}
          </div>
          {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
      )}
    </div>
  );
}
