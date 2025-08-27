import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ShipProvider } from "@/contexts/ship-context";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import TemplateUpload from "@/pages/template-upload";
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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/">
            <ProtectedRoute>
              <TemplateUpload />
            </ProtectedRoute>
          </Route>
          <Route path="/create-dispatch">
            <ProtectedRoute>
              <CreateDispatch />
            </ProtectedRoute>
          </Route>
          <Route path="/create-dispatch/:ship">
            <ProtectedRoute>
              <CreateDispatch />
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
          <Route path="/users">
            <ProtectedRoute>
              <Users />
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
          <Route path="/profile">
            <ProtectedRoute>
              <UserProfile />
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
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </SidebarProvider>
        </ShipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
