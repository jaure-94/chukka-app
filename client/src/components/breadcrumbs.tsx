import React from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Home, Ship } from "lucide-react";
import { useShipContext } from "@/contexts/ship-context";

interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  autoGenerate?: boolean;
}

export function Breadcrumbs({ items, className = "", autoGenerate = true }: BreadcrumbsProps) {
  const [location] = useLocation();
  const { currentShip, getShipDisplayName, getSelectedShipName } = useShipContext();

  // Generate breadcrumb items based on current location
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { label: "Home", href: "/" }
    ];

    // Parse the current location to determine page context
    if (location.startsWith('/create-dispatch')) {
      breadcrumbs.push({ label: "Dispatch Records", href: "/create-dispatch" });
      if (currentShip) {
        const shipName = getSelectedShipName(currentShip);
        breadcrumbs.push({ 
          label: `${getShipDisplayName(currentShip)} (${shipName})`,
          isCurrentPage: true 
        });
      }
    } else if (location.startsWith('/templates')) {
      breadcrumbs.push({ label: "Templates", href: "/templates" });
      if (currentShip) {
        const shipName = getSelectedShipName(currentShip);
        breadcrumbs.push({ 
          label: `${getShipDisplayName(currentShip)} (${shipName})`,
          isCurrentPage: true 
        });
      }
    } else if (location.startsWith('/reports')) {
      breadcrumbs.push({ label: "Reports", href: "/reports" });
      if (currentShip) {
        const shipName = getSelectedShipName(currentShip);
        breadcrumbs.push({ 
          label: `${getShipDisplayName(currentShip)} (${shipName})`,
          isCurrentPage: true 
        });
      }
    } else if (location.startsWith('/consolidated-pax-reports')) {
      breadcrumbs.push({ 
        label: "Consolidated PAX Reports", 
        href: "/consolidated-pax-reports",
        isCurrentPage: true 
      });
    } else if (location.startsWith('/spreadsheet')) {
      breadcrumbs.push({ 
        label: "Spreadsheet View", 
        href: "/spreadsheet",
        isCurrentPage: true 
      });
    } else if (location.startsWith('/users')) {
      breadcrumbs.push({ 
        label: "Users", 
        href: "/users",
        isCurrentPage: true 
      });
    } else if (location.startsWith('/sharing')) {
      breadcrumbs.push({ 
        label: "Share Reports", 
        href: "/sharing",
        isCurrentPage: true 
      });
    }

    return breadcrumbs;
  };

  const breadcrumbItems = autoGenerate && !items ? generateBreadcrumbs() : items || [];

  return (
    <div className={`flex-shrink-0 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-gray-200 ${className}`}>
      <nav className="py-3 px-6" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          {breadcrumbItems.map((item, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-gray-400 mx-2 flex-shrink-0" />
              )}
              {item.isCurrentPage ? (
                <span className="text-sm font-medium text-blue-900 truncate flex items-center">
                  {index === 0 && <Home className="w-4 h-4 mr-1" />}
                  {item.label.includes('SHIP') && <Ship className="w-4 h-4 mr-1 text-blue-600" />}
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href}>
                  <span className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors duration-200 cursor-pointer truncate flex items-center">
                    {index === 0 && <Home className="w-4 h-4 mr-1" />}
                    {item.label.includes('SHIP') && <Ship className="w-4 h-4 mr-1" />}
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span className="text-sm font-medium text-gray-600 truncate flex items-center">
                  {index === 0 && <Home className="w-4 h-4 mr-1" />}
                  {item.label.includes('SHIP') && <Ship className="w-4 h-4 mr-1" />}
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