import React from "react";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav 
      className={`sticky top-0 z-40 bg-white border-b border-gray-100 py-4 -mx-6 px-6 ${className}`} 
      aria-label="Breadcrumb"
    >
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {items.map((item, index) => (
          <li key={index} className={index === 0 ? "inline-flex items-center" : ""}>
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-gray-400 mx-1" />
            )}
            {item.isCurrentPage ? (
              <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2">
                {item.label}
              </span>
            ) : item.href ? (
              <Link href={item.href} className={`${index === 0 ? "" : "ml-1 md:ml-2"} text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors`}>
                {item.label}
              </Link>
            ) : (
              <span className={`${index === 0 ? "" : "ml-1 md:ml-2"} text-sm font-medium text-gray-700`}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}