import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Plus, 
  FileText, 
  BarChart3, 
  Users, 
  Table,
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Ship,
  Menu,
  User,
  LogOut,
  Crown,
  Shield,
  Clipboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const navigationItems: NavigationItem[] = [
  {
    name: "Home",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Create New Record",
    icon: Plus,
    subItems: [
      {
        name: "Ship A",
        href: "/create-dispatch/ship-a",
        icon: Ship,
      },
      {
        name: "Ship B", 
        href: "/create-dispatch/ship-b",
        icon: Ship,
      },
      {
        name: "Ship C",
        href: "/create-dispatch/ship-c", 
        icon: Ship,
      },
    ],
  },
  {
    name: "Templates",
    icon: FileText,
    subItems: [
      {
        name: "Ship A",
        href: "/templates/ship-a",
        icon: Ship,
      },
      {
        name: "Ship B",
        href: "/templates/ship-b",
        icon: Ship,
      },
      {
        name: "Ship C",
        href: "/templates/ship-c",
        icon: Ship,
      },
    ],
  },
  {
    name: "Reports",
    icon: BarChart3,
    subItems: [
      {
        name: "Ship A",
        href: "/reports/ship-a",
        icon: Ship,
      },
      {
        name: "Ship B",
        href: "/reports/ship-b", 
        icon: Ship,
      },
      {
        name: "Ship C",
        href: "/reports/ship-c",
        icon: Ship,
      },
    ],
  },
  {
    name: "Spreadsheet View",
    href: "/spreadsheet",
    icon: Table,
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
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { user, logoutMutation } = useAuth();

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemExpanded = (itemName: string) => expandedItems.includes(itemName);
  const isSubItemActive = (subItems: { href: string }[] | undefined) => 
    subItems?.some(subItem => location === subItem.href) || false;

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
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isActive = item.href ? location === item.href : false;
          const isExpanded = isItemExpanded(item.name);
          const hasActiveSubItem = isSubItemActive(item.subItems);
          
          return (
            <div key={item.name}>
              {/* Main Navigation Item */}
              {item.href ? (
                // Regular navigation item with direct link
                <Link
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
              ) : (
                // Expandable navigation item
                <button
                  onClick={() => !isCollapsed && toggleExpanded(item.name)}
                  className={cn(
                    "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    hasActiveSubItem
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                    isCollapsed ? "justify-center" : "justify-between"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <div className="flex items-center">
                    <Icon className={cn(
                      "flex-shrink-0",
                      isCollapsed ? "h-5 w-5" : "h-4 w-4 mr-3",
                      hasActiveSubItem ? "text-blue-700" : "text-gray-400"
                    )} />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </div>
                  {!isCollapsed && hasSubItems && (
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </div>
                  )}
                </button>
              )}

              {/* Sub Items */}
              {hasSubItems && !isCollapsed && isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.subItems!.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = location === subItem.href;
                    
                    return (
                      <Link
                        key={subItem.name}
                        href={subItem.href}
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          isSubActive
                            ? "bg-blue-100 text-blue-800 border-l-2 border-blue-800"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        )}
                      >
                        <SubIcon className={cn(
                          "h-3 w-3 mr-3 flex-shrink-0",
                          isSubActive ? "text-blue-800" : "text-gray-400"
                        )} />
                        <span className="truncate">{subItem.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Info Section */}
      {user && (
        <div className="p-3 border-t border-gray-200">
          {!isCollapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full">
                <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                      {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <div className="flex items-center space-x-1">
                      <Badge 
                        variant={
                          user.role === 'superuser' ? 'default' : 
                          user.role === 'admin' ? 'secondary' : 
                          user.role === 'dispatcher' ? 'outline' : 'outline'
                        }
                        className="text-xs"
                      >
                        {user.role === 'superuser' && <Crown className="w-3 h-3 mr-1" />}
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role === 'dispatcher' && <Clipboard className="w-3 h-3 mr-1" />}
                        {user.role === 'general' && <User className="w-3 h-3 mr-1" />}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <Link href="/profile">
                  <DropdownMenuItem>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                </Link>
                <Link href="/account-management">
                  <DropdownMenuItem>
                    <Users className="w-4 h-4 mr-2" />
                    Account Management
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    logoutMutation.mutate(undefined, {
                      onSuccess: () => {
                        window.location.href = '/login';
                      }
                    });
                  }}
                  className="text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center justify-center">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                  {user.firstName?.charAt(0) || 'U'}{user.lastName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      )}

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
  const [mobileExpandedItems, setMobileExpandedItems] = useState<string[]>([]);

  const toggleMobileExpanded = (itemName: string) => {
    setMobileExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isMobileItemExpanded = (itemName: string) => mobileExpandedItems.includes(itemName);
  const isMobileSubItemActive = (subItems: { href: string }[] | undefined) => 
    subItems?.some(subItem => location === subItem.href) || false;

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
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isActive = item.href ? location === item.href : false;
                const isExpanded = isMobileItemExpanded(item.name);
                const hasActiveSubItem = isMobileSubItemActive(item.subItems);
                
                return (
                  <div key={item.name}>
                    {/* Main Mobile Navigation Item */}
                    {item.href ? (
                      // Regular mobile navigation item with direct link
                      <Link
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
                    ) : (
                      // Expandable mobile navigation item
                      <button
                        onClick={() => toggleMobileExpanded(item.name)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          hasActiveSubItem
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        <div className="flex items-center">
                          <Icon className={cn(
                            "h-4 w-4 mr-3 flex-shrink-0",
                            hasActiveSubItem ? "text-blue-700" : "text-gray-400"
                          )} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {hasSubItems && (
                          <div className="ml-2">
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </div>
                        )}
                      </button>
                    )}

                    {/* Mobile Sub Items */}
                    {hasSubItems && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.subItems!.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = location === subItem.href;
                          
                          return (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                isSubActive
                                  ? "bg-blue-100 text-blue-800 border-l-2 border-blue-800"
                                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                              )}
                            >
                              <SubIcon className={cn(
                                "h-3 w-3 mr-3 flex-shrink-0",
                                isSubActive ? "text-blue-800" : "text-gray-400"
                              )} />
                              <span className="truncate">{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

export default SidebarNavigation;