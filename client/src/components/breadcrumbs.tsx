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
    <div className={`sticky top-0 z-50 bg-white shadow-sm ${className}`}>
      <nav className="py-3 px-6 border-b border-gray-200" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-gray-400 mx-2 flex-shrink-0" />
              )}
              {item.isCurrentPage ? (
                <span className="text-sm font-medium text-gray-900 truncate">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href}>
                  <span className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors duration-200 cursor-pointer truncate">
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-600 truncate">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}