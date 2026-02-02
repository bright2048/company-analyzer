import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  ArrowLeft,
  FileText,
  FileCheck,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  TrendingUp,
  Users,
  AlertCircle,
  AlertTriangle,
  Shield,
  RefreshCw,
  Database,
  GitBranch,
} from "lucide-react";
import { EquityChart } from "@/components/EquityChart";
import { SummaryVisuals } from "@/components/SummaryVisuals";
import { RiskScanInfo } from "@/components/RiskScanInfo";

function parseCompanyInfo(companyInfoStr: string | null) {
  if (!companyInfoStr) return null;
  try {
    return JSON.parse(companyInfoStr);
  } catch {
    return null;
  }
}
// 风险分析组件 - 从报告内容中提取风险章节
function RiskAnalysisSection({ reportContent }: { reportContent: string }) {
  // 尝试从报告内容中提取风险提示章节
  const extractRiskSection = (content: string): string | null => {
    // 匹配“风险提示”相关章节
    const patterns = [
      /##\s*(?:七、)?\s*风险提示[\s\S]*?(?=##\s*(?:八、)?|$)/i,
      /##\s*风险分析[\s\S]*?(?=##|$)/i,
      /##\s*潜在风险[\s\S]*?(?=##|$)/i,
      /###\s*风险提示[\s\S]*?(?=###|##|$)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  };

  const riskSection = extractRiskSection(reportContent);

  if (!riskSection) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">报告中未找到独立的风险分析章节</p>
        <p className="text-sm text-muted-foreground mt-2">
          请在“分析报告”页面查看完整内容，风险分析已包含在报告中
        </p>
      </div>
    );
  }

  // 解析风险类型
  const riskTypes = [
    { key: "经营风险", icon: TrendingUp, color: "text-orange-500" },
    { key: "财务风险", icon: AlertTriangle, color: "text-red-500" },
    { key: "法律", icon: Shield, color: "text-purple-500" },
    { key: "合规风险", icon: Shield, color: "text-purple-500" },
    { key: "技术风险", icon: AlertCircle, color: "text-blue-500" },
    { key: "管理风险", icon: Users, color: "text-green-500" },
    { key: "行业风险", icon: Building2, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* 风险类型标签 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {riskTypes.map(({ key, icon: Icon, color }) => {
          const hasRisk = riskSection.includes(key);
          if (!hasRisk) return null;
          return (
            <Badge
              key={key}
              variant="outline"
              className="flex items-center gap-1"
            >
              <Icon className={`h-3 w-3 ${color}`} />
              {key}
            </Badge>
          );
        })}
      </div>

      {/* 风险内容 */}
      <div className="prose prose-slate max-w-none">
        <Streamdown>{riskSection}</Streamdown>
      </div>

      {/* 风险警示 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">风险提示</p>
            <p className="text-sm text-amber-700 mt-1">
              以上风险分析基于公开信息整理，仅供参考。建议在做出重要决策前，进行更深入的尽调和专业咨询。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ParkAnalysis {
  matchScore: number;
  matchReason: string;
  entryPossibility: string;
  entryReason: string;
  upstreamCompanies: string[];
  downstreamCompanies: string[];
  expansionNeed: string;
  expansionReason: string;
  recommendations: string[];
}

export default function ReportDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const reportId = parseInt(params.id || "0");

  const {
    data: report,
    refetch,
    isLoading,
  } = trpc.report.getById.useQuery(
    { id: reportId },
    {
      enabled: reportId > 0,
      refetchInterval: query => {
        // 如果报告还在生成中，每3秒刷新一次
        const data = query.state.data;
        if (
          data?.status === "pending" ||
          data?.status === "searching" ||
          data?.status === "generating"
        ) {
          return 3000;
        }
        return false;
      },
    }
  );

  const generateMutation = trpc.report.generate.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("报告生成完成");
    },
    onError: error => {
      toast.error("报告生成失败: " + error.message);
      refetch();
    },
  });

  const exportWordMutation = trpc.report.exportWord.useMutation({
    onSuccess: data => {
      window.open(data.url, "_blank");
      toast.success("Word文档已生成");
    },
    onError: error => {
      toast.error("导出失败: " + error.message);
    },
  });

  const exportPdfMutation = trpc.report.exportPdf.useMutation({
    onSuccess: data => {
      window.open(data.url, "_blank");
      toast.success("PDF文档已生成");
    },
    onError: error => {
      toast.error("导出失败: " + error.message);
    },
  });

  // 缩略版导出mutation
  const exportSummaryWordMutation = trpc.report.exportSummaryWord.useMutation({
    onSuccess: data => {
      window.open(data.url, "_blank");
      toast.success("缩略版Word文档已生成");
    },
    onError: error => {
      toast.error("导出失败: " + error.message);
    },
  });

  const exportSummaryPdfMutation = trpc.report.exportSummaryPdf.useMutation({
    onSuccess: data => {
      window.open(data.url, "_blank");
      toast.success("缩略版PDF文档已生成");
    },
    onError: error => {
      toast.error("导出失败: " + error.message);
    },
  });

  // 缓存刷新mutation
  const refreshCacheMutation = trpc.qichachaCache.refresh.useMutation({
    onSuccess: data => {
      toast.success(`${data.companyName} 的缓存已刷新`);
    },
    onError: error => {
      toast.error("刷新缓存失败: " + error.message);
    },
  });

  // 从报告中提取信用代码
  const getCreditCodeFromReport = (): string | null => {
    if (!report?.companyInfo) return null;
    try {
      const info = JSON.parse(report.companyInfo);
      return info.creditCode || null;
    } catch {
      return null;
    }
  };

  const creditCode = getCreditCodeFromReport();

  // 自动开始生成
  useEffect(() => {
    if (report?.status === "pending" && !generateMutation.isPending) {
      generateMutation.mutate({ id: reportId });
    }
  }, [report?.status, reportId]);

  const parkAnalysis: ParkAnalysis | null = report?.parkAnalysis
    ? JSON.parse(report.parkAnalysis)
    : null;

  const getStatusInfo = () => {
    switch (report?.status) {
      case "pending":
        return { label: "等待中", color: "secondary", progress: 10 };
      case "searching":
        return { label: "搜索信息中", color: "secondary", progress: 30 };
      case "generating":
        return { label: "生成报告中", color: "secondary", progress: 70 };
      case "completed":
        return { label: "已完成", color: "default", progress: 100 };
      case "failed":
        return { label: "生成失败", color: "destructive", progress: 0 };
      default:
        return { label: "未知", color: "secondary", progress: 0 };
    }
  };

  const statusInfo = getStatusInfo();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">报告不存在</p>
        <Button onClick={() => setLocation("/")}>返回首页</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{report.companyName}</h1>
              <p className="text-sm text-muted-foreground">企业分析报告</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={
                statusInfo.color as "default" | "secondary" | "destructive"
              }
            >
              {statusInfo.label}
            </Badge>
            {report.status === "completed" && (
              <>
                {creditCode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshCacheMutation.mutate({ creditCode })}
                    disabled={refreshCacheMutation.isPending}
                    title="刷新企查查数据缓存"
                  >
                    {refreshCacheMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        刷新数据
                      </>
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportWordMutation.mutate({ id: reportId })}
                  disabled={exportWordMutation.isPending}
                >
                  {exportWordMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      完整版Word
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportPdfMutation.mutate({ id: reportId })}
                  disabled={exportPdfMutation.isPending}
                >
                  {exportPdfMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      完整版PDF
                    </>
                  )}
                </Button>
                {report.summaryContent && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportSummaryWordMutation.mutate({ id: reportId })
                      }
                      disabled={exportSummaryWordMutation.isPending}
                    >
                      {exportSummaryWordMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <FileCheck className="h-4 w-4 mr-2" />
                          摘要Word
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        exportSummaryPdfMutation.mutate({ id: reportId })
                      }
                      disabled={exportSummaryPdfMutation.isPending}
                    >
                      {exportSummaryPdfMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <FileCheck className="h-4 w-4 mr-2" />
                          摘要PDF
                        </>
                      )}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* 生成中状态 */}
        {(report.status === "pending" ||
          report.status === "searching" ||
          report.status === "generating") && (
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <CardTitle>正在生成报告</CardTitle>
              <CardDescription>
                {report.status === "searching" && "正在搜索公司公开信息..."}
                {report.status === "generating" && "正在使用AI生成分析报告..."}
                {report.status === "pending" && "准备开始生成..."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={statusInfo.progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground mt-4">
                预计需要1-3分钟，请耐心等待
              </p>
            </CardContent>
          </Card>
        )}

        {/* 失败状态 */}
        {report.status === "failed" && (
          <Card className="max-w-xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {report.errorMessage?.includes("未找到") ? (
                  <AlertCircle className="h-12 w-12 text-amber-500" />
                ) : (
                  <XCircle className="h-12 w-12 text-destructive" />
                )}
              </div>
              <CardTitle>
                {report.errorMessage?.includes("未找到")
                  ? "企业信息未找到"
                  : "报告生成失败"}
              </CardTitle>
              <CardDescription className="mt-2">
                {report.errorMessage || "未知错误"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.errorMessage?.includes("未找到") && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">温馨提示</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>请检查企业名称是否正确完整</li>
                        <li>尝试使用企业的全称或工商注册名称</li>
                        <li>系统不会编造不存在的企业信息</li>
                        <li>如需帮助，请联系管理员</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => setLocation("/")}>
                  返回首页
                </Button>
                <Button
                  onClick={() => generateMutation.mutate({ id: reportId })}
                >
                  重新生成
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 完成状态 - 显示报告内容 */}
        {report.status === "completed" && report.reportContent && (
          <Tabs defaultValue="summary" className="space-y-6">
            <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-5">
              <TabsTrigger value="summary">
                <FileCheck className="h-4 w-4 mr-2" />
                缩略版
              </TabsTrigger>
              <TabsTrigger value="report">
                <FileText className="h-4 w-4 mr-2" />
                完整版
              </TabsTrigger>
              <TabsTrigger value="equity">
                <GitBranch className="h-4 w-4 mr-2" />
                企业族谱
              </TabsTrigger>
              {/* <TabsTrigger value="riskScan">
                <AlertTriangle className="h-4 w-4 mr-2" />
                风险扫描
              </TabsTrigger> */}
              <TabsTrigger value="park">
                <Building2 className="h-4 w-4 mr-2" />
                园区匹配
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <div className="space-y-6">
                {/* 可视化图表区域 */}
                <SummaryVisuals
                  companyInfo={report.companyInfo}
                  summaryContent={report.summaryContent}
                />

                {/* 文字摘要区域 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      企业分析摘要
                    </CardTitle>
                    <CardDescription>
                      精简版报告，供领导快速查阅（约500字）
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-slate max-w-none">
                    {report.summaryContent ? (
                      <Streamdown>{report.summaryContent}</Streamdown>
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          缩略版报告暂未生成
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          该报告可能是在功能上线前生成的，请重新生成报告以获取缩略版
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="report">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    完整分析报告
                  </CardTitle>
                  <CardDescription>
                    详细的企业分析报告，包含全部章节
                  </CardDescription>
                </CardHeader>
                <CardContent className="prose prose-slate max-w-none">
                  <Streamdown>{report.reportContent}</Streamdown>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equity">
              <EquityChart
                equityThrough={
                  report.equityThrough ? JSON.parse(report.equityThrough) : null
                }
                investmentThrough={
                  report.investmentThrough
                    ? JSON.parse(report.investmentThrough)
                    : null
                }
                companyName={report.companyName}
              />
            </TabsContent>

            <TabsContent value="riskScan">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    风险提示与规避建议
                  </CardTitle>
                  <CardDescription>
                    基于公开信息分析的潜在风险及应对策略
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskScanInfo
                    riskData={parseCompanyInfo(report.companyInfo)?.riskScan}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="park">
              {parkAnalysis ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {/* 匹配度评分 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        匹配度评分
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-5xl font-bold text-primary mb-2">
                          {parkAnalysis.matchScore}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          满分100分
                        </p>
                      </div>
                      <Progress
                        value={parkAnalysis.matchScore}
                        className="mt-4 h-2"
                      />
                      <p className="mt-4 text-sm">{parkAnalysis.matchReason}</p>
                    </CardContent>
                  </Card>

                  {/* 入驻可能性 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        入驻可能性
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant={
                          parkAnalysis.entryPossibility === "高"
                            ? "default"
                            : "secondary"
                        }
                        className="text-lg px-4 py-1 mb-4"
                      >
                        {parkAnalysis.entryPossibility}
                      </Badge>
                      <p className="text-sm">{parkAnalysis.entryReason}</p>
                    </CardContent>
                  </Card>

                  {/* 上下游企业 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        园区内关联企业
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">上游企业</p>
                        <div className="flex flex-wrap gap-2">
                          {parkAnalysis.upstreamCompanies.length > 0 ? (
                            parkAnalysis.upstreamCompanies.map((name, i) => (
                              <Badge key={i} variant="outline">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              暂无匹配
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">下游企业</p>
                        <div className="flex flex-wrap gap-2">
                          {parkAnalysis.downstreamCompanies.length > 0 ? (
                            parkAnalysis.downstreamCompanies.map((name, i) => (
                              <Badge key={i} variant="outline">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              暂无匹配
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 扩租需求 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        扩租需求预测
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge
                        variant={
                          parkAnalysis.expansionNeed === "高"
                            ? "default"
                            : "secondary"
                        }
                        className="text-lg px-4 py-1 mb-4"
                      >
                        {parkAnalysis.expansionNeed}
                      </Badge>
                      <p className="text-sm">{parkAnalysis.expansionReason}</p>
                    </CardContent>
                  </Card>

                  {/* 招商建议 */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-base">招商建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {parkAnalysis.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      暂无园区匹配分析数据
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      请先在"园区企业"页面导入园区企业数据
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
