import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ShipProvider } from "@/contexts/ship-context";
import { AuthProvider } from "@/hooks/use-auth";
import { DispatchSessionProvider } from "@/contexts/dispatch-session-context";
import { ProtectedRoute } from "@/lib/protected-route";
import { RoleProtectedRoute } from "@/lib/role-protected-route";
import Home from "@/pages/home";
import CreateDispatch from "@/pages/create-dispatch";
import Templates from "@/pages/templates";
import EditTemplates from "@/pages/edit-templates";
import Reports from "@/pages/reports";
import Users from "@/pages/users";
import SpreadsheetView from "@/pages/spreadsheet-view";
import SpreadsheetEodView from "@/pages/spreadsheet-eod";
import SpreadsheetDispatchView from "@/pages/spreadsheet-dispatch";
import { ManualDispatch } from "@/pages/ManualDispatch";
import LoginPage from "@/pages/login";
import AccountManagement from "@/pages/account-management";
import UserProfile from "@/pages/user-profile";
import EditProfile from "@/pages/edit-profile";
import CreateUser from "@/pages/create-user";
import EditUser from "@/pages/edit-user";
import SharingPage from "@/pages/sharing-page";
import ConsolidatedPaxReports from "@/pages/consolidated-pax-reports";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/">
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          </Route>
          <Route path="/create-dispatch">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin', 'dispatcher']}>
                <CreateDispatch />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/create-dispatch/:ship">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin', 'dispatcher']}>
                <CreateDispatch />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/create-dispatch/:ship/:sessionId">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin', 'dispatcher']}>
                <CreateDispatch />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/templates">
            <ProtectedRoute>
              <Templates />
            </ProtectedRoute>
          </Route>
          <Route path="/templates/:ship">
            <ProtectedRoute>
              <Templates />
            </ProtectedRoute>
          </Route>
          <Route path="/templates/edit">
            <ProtectedRoute>
              <EditTemplates />
            </ProtectedRoute>
          </Route>
          <Route path="/templates/edit/:ship">
            <ProtectedRoute>
              <EditTemplates />
            </ProtectedRoute>
          </Route>
          <Route path="/reports">
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          </Route>
          <Route path="/reports/:ship">
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          </Route>
          <Route path="/consolidated-pax-reports">
            <ProtectedRoute>
              <ConsolidatedPaxReports />
            </ProtectedRoute>
          </Route>
          <Route path="/users">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin']}>
                <Users />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/create-user">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin']}>
                <CreateUser />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/spreadsheet">
            <ProtectedRoute>
              <SpreadsheetView />
            </ProtectedRoute>
          </Route>
          <Route path="/spreadsheet/eod/:filename">
            <ProtectedRoute>
              <SpreadsheetEodView />
            </ProtectedRoute>
          </Route>
          <Route path="/spreadsheet/dispatch/:filename">
            <ProtectedRoute>
              <SpreadsheetDispatchView />
            </ProtectedRoute>
          </Route>
          <Route path="/manual">
            <ProtectedRoute>
              <ManualDispatch />
            </ProtectedRoute>
          </Route>
          <Route path="/account-management">
            <ProtectedRoute>
              <AccountManagement />
            </ProtectedRoute>
          </Route>
          <Route path="/users/:id/edit">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin']}>
                <EditUser />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/users/:id">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin']}>
                <UserProfile />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route path="/profile">
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          </Route>
          <Route path="/profile/edit">
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          </Route>
          <Route path="/sharing">
            <ProtectedRoute>
              <RoleProtectedRoute allowedRoles={['superuser', 'admin', 'dispatcher']}>
                <SharingPage />
              </RoleProtectedRoute>
            </ProtectedRoute>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ShipProvider>
          <SidebarProvider>
            <DispatchSessionProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </DispatchSessionProvider>
          </SidebarProvider>
        </ShipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
