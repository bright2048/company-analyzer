/**
 * 首页组件 (Home.tsx)
 *
 * 功能说明：
 * - 系统首页，提供企业搜索入口
 * - 显示搜索建议（从企查查、园区企业、历史记录获取）
 * - 导航到其他功能页面
 *
 * 主要功能：
 * 1. 企业名称搜索框（带自动补全）
 * 2. 一键生成企业分析报告（使用系统配置的默认模型）
 * 3. 导航菜单（批量查询、任务管理、历史报告等）
 */

// ============================================================
// 导入依赖
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  ArrowRight,
  Layers,
  Building,
  Building2,
  Clock,
  FileText,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";

// ============================================================
// 首页组件
// ============================================================

export default function Home() {
  // ========== 状态定义 ==========

  // 搜索框中的企业名称
  const [companyName, setCompanyName] = useState("");

  // 是否显示搜索建议下拉列表
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 路由跳转函数
  const [, setLocation] = useLocation();

  // 搜索框DOM引用
  const inputRef = useRef<HTMLInputElement>(null);

  // 建议列表DOM引用
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ========== API调用 ==========

  /**
   * 企业名称搜索建议查询
   */
  const { data: suggestions, isLoading: suggestionsLoading } =
    trpc.companySearch.suggest.useQuery(
      { keyword: companyName },
      {
        enabled: companyName.length >= 2,
        staleTime: 30000,
      }
    );

  /**
   * 创建报告的Mutation
   * 不传递llmProvider和llmModel，后端自动使用数据库中配置的默认模型
   */
  const createReportMutation = trpc.report.create.useMutation({
    onSuccess: data => {
      toast.success("报告生成任务已提交", {
        description: "报告正在后台生成中，您可以在历史报告页面查看进度",
        duration: 5000,
      });
      setCompanyName("");
      setLocation("/reports");
    },
    onError: error => {
      toast.error("创建报告失败: " + error.message);
    },
  });

  // ========== 事件处理函数 ==========

  /**
   * 处理搜索按钮点击
   */
  const handleSearch = () => {
    if (!companyName.trim()) {
      toast.error("请输入公司名称");
      return;
    }

    setShowSuggestions(false);

    // 只传递公司名称，后端自动使用默认LLM配置
    createReportMutation.mutate({
      companyName: companyName.trim(),
    });
  };

  /**
   * 处理键盘按键
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  /**
   * 处理选择搜索建议
   */
  const handleSelectSuggestion = (name: string) => {
    setCompanyName(name);
    setShowSuggestions(false);

    setTimeout(() => {
      createReportMutation.mutate({
        companyName: name,
      });
    }, 100);
  };

  /**
   * 点击外部关闭建议列表
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ========== 渲染UI ==========

  return (
    <PageLayout>
      <div className="bg-gradient-to-b from-slate-950/5 via-background to-muted/30">
        {/* 主内容区 */}
        <main className="container py-8 md:py-16">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" />
              <div className="absolute top-16 right-8 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
            </div>

            <div className="relative z-10">
              {/* 标题区域 */}
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-sm mb-5 shadow-sm">
                  <Layers className="h-4 w-4" />
                  <span>深圳湾智能体</span>
                </div>
                <h1 className="text-3xl md:text-6xl font-bold tracking-tight mb-4">
                  一键生成<span className="text-primary">企业分析报告</span>
                </h1>
                <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                  输入公司名称，关键信息自动归集，洞察结论立即呈现
                </p>
              </div>

          {/* 搜索卡片 */}
          <Card className="max-w-2xl mx-auto shadow-xl border-primary/10">
            <CardContent className="pt-6">
            {/* 搜索框 */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    placeholder="输入公司名称，例如：华为技术有限公司"
                    value={companyName}
                    onChange={e => {
                      setCompanyName(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyPress={handleKeyPress}
                    className="pl-10 h-12 bg-background/80"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={createReportMutation.isPending}
                  className="h-12 px-6 shadow-lg shadow-primary/20"
                >
                  {createReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      生成报告
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {/* 搜索建议下拉列表 */}
              {showSuggestions && companyName.length >= 2 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
                >
                  {suggestionsLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      搜索中...
                    </div>
                  ) : suggestions && suggestions.length > 0 ? (
                    <div className="py-2">
                      {suggestions.map((item, index) => (
                        <button
                          key={index}
                          className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-3"
                          onClick={() => handleSelectSuggestion(item.name)}
                        >
                          {/* 来源图标 */}
                          {item.source === "park" ? (
                            <Building className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : item.source === "history" ? (
                            <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          ) : (
                            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {item.name}
                            </div>
                            {item.creditCode && (
                              <div className="text-xs text-muted-foreground truncate">
                                统一社会信用代码: {item.creditCode}
                              </div>
                            )}
                          </div>
                          {/* 来源标签 */}
                          <span
                            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                              item.source === "park"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : item.source === "history"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {item.source === "park"
                              ? "园区企业"
                              : item.source === "history"
                                ? "历史查询"
                                : "企查查"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      未找到匹配的企业
                    </div>
                  )}
                </div>
              )}
            </div>

              {/* 批量查询提示 */}
              <div className="mt-4 text-center text-sm text-muted-foreground">
                批量任务请{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => setLocation("/batch")}
                >
                  上传 CSV
                </Button>
              </div>
            </CardContent>
          </Card>

              {/* 核心能力 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-5xl mx-auto">
            <Card className="text-center border-primary/10 shadow-sm">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">多源信息聚合</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                工商、融资、专利等关键数据一次性汇总
              </CardDescription>
            </CardContent>
          </Card>

            <Card className="text-center border-primary/10 shadow-sm">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">结构化报告</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                发展、财务、风险要点清晰呈现
              </CardDescription>
            </CardContent>
          </Card>

            <Card className="text-center border-primary/10 shadow-sm">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">园区协同分析</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                识别上下游与合作机会
              </CardDescription>
            </CardContent>
          </Card>
              </div>
            </div>
          </div>
        </main>

        {/* 页脚 */}
        <footer className="border-t py-6 mt-auto">
          <div className="container text-center text-sm text-muted-foreground">
            <p>© 2025 鲲鹏产业源头创新中心 - 深圳湾智能体</p>
            <p className="mt-1">企业智能分析平台 v6.0</p>
          </div>
        </footer>
      </div>
    </PageLayout>
  );
}
