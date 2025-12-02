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
    } else if (location.startsWith('/templates/edit')) {
      breadcrumbs.push({ label: "Templates", href: "/templates" });
      if (currentShip) {
        breadcrumbs.push({ 
          label: `Edit Templates - ${getShipDisplayName(currentShip)}`,
          isCurrentPage: true 
        });
      } else {
        breadcrumbs.push({ 
          label: "Edit Templates",
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
    } else if (location.startsWith('/spreadsheet/eod/')) {
      breadcrumbs.push({ label: "Spreadsheet View", href: "/spreadsheet" });
      breadcrumbs.push({ 
        label: "EOD Report", 
        isCurrentPage: true 
      });
    } else if (location.startsWith('/spreadsheet/dispatch/')) {
      breadcrumbs.push({ label: "Spreadsheet View", href: "/spreadsheet" });
      breadcrumbs.push({ 
        label: "Dispatch Sheet", 
        isCurrentPage: true 
      });
    } else if (location.startsWith('/spreadsheet')) {
      breadcrumbs.push({ 
        label: "Spreadsheet View", 
        href: "/spreadsheet",
        isCurrentPage: true 
      });
    } else if (location.startsWith('/create-user')) {
      breadcrumbs.push({ label: "Users", href: "/users" });
      breadcrumbs.push({ 
        label: "Create New User", 
        isCurrentPage: true 
      });
    } else if (location.startsWith('/users/') && location.includes('/edit')) {
      breadcrumbs.push({ label: "Users", href: "/users" });
      breadcrumbs.push({ 
        label: "Edit User", 
        isCurrentPage: true 
      });
    } else if (location.startsWith('/users')) {
      breadcrumbs.push({ 
        label: "Users", 
        href: "/users",
        isCurrentPage: true 
      });
    } else if (location.startsWith('/profile/edit')) {
      breadcrumbs.push({ label: "Profile", href: "/profile" });
      breadcrumbs.push({ 
        label: "Edit Profile", 
        isCurrentPage: true 
      });
    } else if (location.startsWith('/profile')) {
      breadcrumbs.push({ 
        label: "Profile", 
        href: "/profile",
        isCurrentPage: true 
      });
    } else if (location.startsWith('/account-management')) {
      breadcrumbs.push({ 
        label: "Account Management", 
        href: "/account-management",
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
      <nav className="py-2 sm:py-3 px-3 sm:px-4 md:px-6 overflow-x-auto" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-1 sm:space-x-2 min-w-max">
          {breadcrumbItems.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === breadcrumbItems.length - 1;

            return (
              <li key={index} className="flex items-center min-w-0 flex-shrink-0">
                {!isFirst && (
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 mx-1 sm:mx-2 flex-shrink-0" />
                )}
                {item.isCurrentPage ? (
                  <span className="text-xs sm:text-sm font-medium text-blue-900 truncate flex items-center min-w-0 max-w-[180px] sm:max-w-none">
                    {isFirst && <Home className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />}
                    {item.label.includes('SHIP') && !isFirst && <Ship className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-blue-600 flex-shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                ) : item.href ? (
                  <Link href={item.href}>
                    <span className="text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 active:text-blue-700 transition-colors duration-200 cursor-pointer truncate flex items-center min-w-0 max-w-[120px] sm:max-w-none touch-manipulation">
                      {isFirst && <Home className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />}
                      {item.label.includes('SHIP') && !isFirst && <Ship className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </span>
                  </Link>
                ) : (
                  <span className="text-xs sm:text-sm font-medium text-gray-600 truncate flex items-center min-w-0 max-w-[120px] sm:max-w-none">
                    {isFirst && <Home className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />}
                    {item.label.includes('SHIP') && !isFirst && <Ship className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}