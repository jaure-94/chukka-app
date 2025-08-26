import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ShipProvider } from "@/contexts/ship-context";
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
          <Route path="/" component={TemplateUpload} />
          <Route path="/create-dispatch" component={CreateDispatch} />
          <Route path="/create-dispatch/:ship" component={CreateDispatch} />
          <Route path="/templates" component={Templates} />
          <Route path="/templates/:ship" component={Templates} />
          <Route path="/templates/edit" component={EditTemplates} />
          <Route path="/templates/edit/:ship" component={EditTemplates} />
          <Route path="/reports" component={Reports} />
          <Route path="/reports/:ship" component={Reports} />
          <Route path="/users" component={Users} />
          <Route path="/spreadsheet" component={SpreadsheetView} />
          <Route path="/spreadsheet/eod/:filename" component={SpreadsheetEodView} />
          <Route path="/spreadsheet/dispatch/:filename" component={SpreadsheetDispatchView} />
          <Route path="/manual" component={ManualDispatch} />
          <Route path="/login" component={LoginPage} />
          <Route path="/account-management" component={AccountManagement} />
          <Route path="/profile" component={UserProfile} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ShipProvider>
        <SidebarProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </SidebarProvider>
      </ShipProvider>
    </QueryClientProvider>
  );
}

export default App;
