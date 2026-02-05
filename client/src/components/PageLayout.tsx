import { ReactNode } from "react";
import { GlobalNavigation } from "./GlobalNavigation";

interface PageLayoutProps {
  children: ReactNode;
  /** 页面特定的操作栏内容（可选） */
  actionBar?: ReactNode;
}

/**
 * 页面布局组件
 * 包含全局导航栏和可选的页面特定操作栏
 */
export function PageLayout({ children, actionBar }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* 全局导航栏 */}
      <GlobalNavigation />

      {/* 页面特定操作栏（可选） */}
      {actionBar && (
        <div className="border-b bg-muted/30">
          <div className="container flex h-14 items-center justify-between">
            {actionBar}
          </div>
        </div>
      )}

      {/* 页面内容 */}
      {children}
    </div>
  );
}
