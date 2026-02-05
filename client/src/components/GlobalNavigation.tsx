import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  FileSearch,
  ListChecks,
  History,
  Building2,
  BarChart3,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LogoPng from "@/assets/images/logo.png";
import { useAuth } from "@/contexts/AuthContext";

export function GlobalNavigation() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const navItems = [
    {
      label: "批量查询",
      icon: FileSearch,
      path: "/batch",
    },
    {
      label: "任务管理",
      icon: ListChecks,
      path: "/tasks",
    },
    {
      label: "历史报告",
      icon: History,
      path: "/reports",
    },
    {
      label: "园区企业",
      icon: Building2,
      path: "/park",
    },
    {
      label: "API统计",
      icon: BarChart3,
      path: "/api-stats",
      adminOnly: true,
    },
    {
      label: "设置",
      icon: Settings,
      path: "/settings",
    },
    {
      label: "用户",
      icon: User,
      path: "/user-center",
    },
  ];

  const visibleNavItems = navItems.filter(item => !item.adminOnly || user?.role === "admin");

  return (
    <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo和标题 */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src={LogoPng}
              alt="Logo"
              className="h-10 w-10 rounded-lg object-contain"
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              鲲鹏产业源头创新中心
            </h1>
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex items-center gap-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Button
                key={item.path}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setLocation(item.path)}
                className={cn(
                  "gap-2 transition-all duration-200",
                  isActive && "shadow-md"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
