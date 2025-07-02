import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Plus, 
  FileText, 
  BarChart3, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Create New Record",
    href: "/create-dispatch",
    icon: Plus,
  },
  {
    name: "Templates",
    href: "/templates",
    icon: FileText,
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    name: "Users",
    href: "/users",
    icon: Users,
  },
];

interface SidebarNavigationProps {
  className?: string;
}

export function SidebarNavigation({ className }: SidebarNavigationProps) {
  const { isCollapsed, toggleCollapsed } = useSidebar();
  const [location] = useLocation();

  return (
    <div className={cn(
      "flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 fixed left-0 top-0 z-10",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header with Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className="p-2 hover:bg-gray-100"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                isCollapsed ? "justify-center" : "justify-start"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className={cn(
                "flex-shrink-0",
                isCollapsed ? "h-5 w-5" : "h-4 w-4 mr-3",
                isActive ? "text-blue-700" : "text-gray-400"
              )} />
              {!isCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {!isCollapsed && (
          <div className="text-xs text-gray-500">
            Excel Template Manager
          </div>
        )}
      </div>
    </div>
  );
}

// Mobile Navigation Component
export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/20" onClick={() => setIsOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-2"
              >
                ×
              </Button>
            </div>
            
            <nav className="px-2 py-4 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className={cn(
                      "h-4 w-4 mr-3 flex-shrink-0",
                      isActive ? "text-blue-700" : "text-gray-400"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}