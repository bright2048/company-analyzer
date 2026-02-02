import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ReportDetail from "./pages/ReportDetail";
import ReportHistory from "./pages/ReportHistory";
import ParkCompanies from "./pages/ParkCompanies";
import Settings from "./pages/Settings";
import BatchQuery from "./pages/BatchQuery";
import TaskManagement from "./pages/TaskManagement";
import ApiStats from "./pages/ApiStats";
import About from "./pages/About";
import UserManagement from "./pages/UserManagement";
import Login from "./pages/Login";
import UserCenter from "./pages/UserCenter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/report/:id" component={ReportDetail} />
      <Route path="/reports" component={ReportHistory} />
      <Route path="/park" component={ParkCompanies} />
      <Route path="/settings" component={Settings} />
      <Route path="/batch" component={BatchQuery} />
      <Route path="/tasks" component={TaskManagement} />
      <Route path="/api-stats" component={ApiStats} />
      <Route path="/about" component={About} />
      <Route path="/users" component={UserManagement} />
      <Route path="/login" component={Login} />
      <Route path="/user-center" component={UserCenter} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
