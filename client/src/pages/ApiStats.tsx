import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { 
  BarChart3, TrendingUp, DollarSign, Activity,
  RefreshCw, Calendar, Clock, CheckCircle2, XCircle,
  Search, Bot, HardDrive, Zap
} from "lucide-react";

interface ApiCallRecord {
  id: number;
  apiType: string;
  apiName: string;
  status: 'success' | 'failed';
  cost: string | null;
  companyName: string | null;
  reportId: number | null;
  requestParams: string | null;
  responseSummary: string | null;
  errorMessage: string | null;
  calledAt: Date;
}

export default function ApiStats() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (isLoading) return;
    if (user && user.role !== "admin") {
      toast.error("仅管理员可访问此页面");
      setLocation("/");
    }
  }, [isLoading, setLocation, user]);

  // 获取今日统计
  const { data: todayStats, refetch: refetchToday, isLoading: loadingToday } = trpc.apiStats.today.useQuery(undefined, {
    enabled: isAdmin,
  });
  
  // 获取月度统计
  const { data: monthlyStats, refetch: refetchMonthly, isLoading: loadingMonthly } = trpc.apiStats.monthly.useQuery(
    { year: selectedYear, month: selectedMonth },
    { enabled: isAdmin }
  );
  
  // 获取最近调用记录
  const { data: recentCalls, refetch: refetchRecent, isLoading: loadingRecent } = trpc.apiStats.recent.useQuery(
    { limit: 100 },
    { enabled: isAdmin }
  );
  
  // 获取统计汇总
  const { data: summary, refetch: refetchSummary } = trpc.apiStats.summary.useQuery(undefined, {
    enabled: isAdmin,
  });
  
  // 获取缓存统计
  const { data: cacheStats, refetch: refetchCache } = trpc.qichachaCache.stats.useQuery(undefined, {
    enabled: isAdmin,
  });

  const handleRefresh = () => {
    refetchToday();
    refetchMonthly();
    refetchRecent();
    refetchSummary();
    refetchCache();
  };

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />成功</Badge>;
    } else {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失败</Badge>;
    }
  };

  const getApiTypeBadge = (apiType: string) => {
    if (apiType === 'qichacha_cache_hit') {
      return <Badge variant="outline" className="text-green-600 border-green-300"><Zap className="h-3 w-3 mr-1" />缓存命中</Badge>;
    } else if (apiType.startsWith('qichacha')) {
      return <Badge variant="outline" className="text-blue-600 border-blue-300"><Search className="h-3 w-3 mr-1" />企查查</Badge>;
    } else if (apiType.startsWith('llm')) {
      return <Badge variant="outline" className="text-purple-600 border-purple-300"><Bot className="h-3 w-3 mr-1" />通义千问</Badge>;
    }
    return <Badge variant="outline">{apiType}</Badge>;
  };

  const formatCost = (cost: string | null) => {
    if (!cost) return '-';
    const num = parseFloat(cost);
    return `¥${num.toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    // 数据库服务器使用UTC+8时区存储时间
    // Drizzle返回的Date对象会被浏览器再次按UTC+8解释
    // 导致时间多加8小时，需要减去8小时的偏移量
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = new Date(date);
    }
    
    // 减去8小时的偏移量来修正时区问题
    const correctedDate = new Date(dateObj.getTime() - 8 * 60 * 60 * 1000);
    
    return correctedDate.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 生成年份选项（最近3年）
  const yearOptions = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);
  
  // 月份选项
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <main className="container py-8">
          <div className="space-y-8">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                API调用统计
              </h1>
              <p className="text-muted-foreground mt-2">
                监控企查查和阿里通义千问的API调用情况和成本
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新数据
            </Button>
          </div>

          {/* Cache Stats Card */}
          {cacheStats && cacheStats.totalCount > 0 && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <HardDrive className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-green-700 font-medium">企查查数据缓存</p>
                      <p className="text-xs text-green-600">缓存有效期 {cacheStats.cacheDays} 天</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-6 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-700">{cacheStats.totalCount}</p>
                      <p className="text-xs text-green-600">已缓存企业</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-700">{cacheStats.totalHits}</p>
                      <p className="text-xs text-green-600">缓存命中</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-700">{cacheStats.avgHitCount}</p>
                      <p className="text-xs text-green-600">平均命中率</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600">¥{cacheStats.estimatedSavings}</p>
                      <p className="text-xs text-green-600">预估节省</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">今日调用总数</p>
                    <p className="text-3xl font-bold">{todayStats?.total || 0}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">今日成功率</p>
                    <p className="text-3xl font-bold text-green-600">
                      {todayStats?.total ? Math.round((todayStats.success / todayStats.total) * 100) : 0}%
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">今日费用</p>
                    <p className="text-3xl font-bold text-orange-600">
                      ¥{parseFloat(String(todayStats?.totalCost || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">累计总费用</p>
                    <p className="text-3xl font-bold text-purple-600">
                      ¥{parseFloat(String(summary?.totalCost || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="monthly">月度统计</TabsTrigger>
              <TabsTrigger value="records">调用记录</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                {/* 企查查统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-blue-600" />
                      企查查API
                    </CardTitle>
                    <CardDescription>企业信息查询服务</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">今日调用</span>
                        <span className="font-semibold">{todayStats?.byType?.find((t: any) => t.apiType?.startsWith('qichacha'))?.count || 0} 次</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">今日费用</span>
                        <span className="font-semibold text-orange-600">
                          ¥{parseFloat(String(todayStats?.byType?.find((t: any) => t.apiType?.startsWith('qichacha'))?.cost || 0)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">累计调用</span>
                        <span className="font-semibold">{summary?.byType?.find((t: any) => t.apiType?.startsWith('qichacha'))?.count || 0} 次</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">累计费用</span>
                        <span className="font-semibold text-orange-600">
                          ¥{parseFloat(String(summary?.byType?.find((t: any) => t.apiType?.startsWith('qichacha'))?.cost || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>计费说明：</strong>企业模糊搜索 ¥0.10/次，企业详情 ¥0.20/次，股东信息 ¥0.15/次，高管信息 ¥0.15/次
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 通义千问统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-purple-600" />
                      阿里通义千问
                    </CardTitle>
                    <CardDescription>AI报告生成服务</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">今日调用</span>
                        <span className="font-semibold">{todayStats?.byType?.find((t: any) => t.apiType?.startsWith('llm'))?.count || 0} 次</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">今日费用</span>
                        <span className="font-semibold text-orange-600">
                          ¥{parseFloat(String(todayStats?.byType?.find((t: any) => t.apiType?.startsWith('llm'))?.cost || 0)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">累计调用</span>
                        <span className="font-semibold">{summary?.byType?.find((t: any) => t.apiType?.startsWith('llm'))?.count || 0} 次</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">累计费用</span>
                        <span className="font-semibold text-orange-600">
                          ¥{parseFloat(String(summary?.byType?.find((t: any) => t.apiType?.startsWith('llm'))?.cost || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-700">
                        <strong>计费说明：</strong>qwen-plus模型按token计费，输入约¥0.004/千token，输出约¥0.012/千token
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Monthly Tab */}
            <TabsContent value="monthly" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        月度统计
                      </CardTitle>
                      <CardDescription>查看指定月份的API调用统计</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map(year => (
                            <SelectItem key={year} value={year.toString()}>{year}年</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {monthOptions.map(month => (
                            <SelectItem key={month} value={month.toString()}>{month}月</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingMonthly ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* 月度汇总 */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">总调用次数</p>
                          <p className="text-2xl font-bold">{monthlyStats?.total || 0}</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">成功次数</p>
                          <p className="text-2xl font-bold text-green-600">{monthlyStats?.success || 0}</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">失败次数</p>
                          <p className="text-2xl font-bold text-red-600">{monthlyStats?.failed || 0}</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">总费用</p>
                          <p className="text-2xl font-bold text-orange-600">¥{parseFloat(String(monthlyStats?.totalCost || 0)).toFixed(2)}</p>
                        </div>
                      </div>

                      {/* 按类型统计 */}
                      <div>
                        <h4 className="font-semibold mb-3">按API类型统计</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>API类型</TableHead>
                              <TableHead className="text-right">调用次数</TableHead>
                              <TableHead className="text-right">成功次数</TableHead>
                              <TableHead className="text-right">失败次数</TableHead>
                              <TableHead className="text-right">费用</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {monthlyStats?.byType?.length ? (
                              monthlyStats.byType.map((item: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    {getApiTypeBadge(item.apiType)}
                                    <span className="ml-2 text-sm text-muted-foreground">{item.apiName || item.apiType}</span>
                                  </TableCell>
                                  <TableCell className="text-right">{item.count}</TableCell>
                                  <TableCell className="text-right text-green-600">{item.success}</TableCell>
                                  <TableCell className="text-right text-red-600">{item.failed}</TableCell>
                                  <TableCell className="text-right font-semibold">¥{parseFloat(String(item.cost || 0)).toFixed(2)}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                  本月暂无调用记录
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Records Tab */}
            <TabsContent value="records" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    最近调用记录
                  </CardTitle>
                  <CardDescription>显示最近100条API调用记录</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRecent ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>时间</TableHead>
                          <TableHead>API类型</TableHead>
                          <TableHead>接口名称</TableHead>
                          <TableHead>企业名称</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">费用</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentCalls?.length ? (
                          recentCalls.map((call: ApiCallRecord) => (
                            <TableRow key={call.id}>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(call.calledAt)}
                              </TableCell>
                              <TableCell>{getApiTypeBadge(call.apiType)}</TableCell>
                              <TableCell>{call.apiName}</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {call.companyName || '-'}
                              </TableCell>
                              <TableCell>{getStatusBadge(call.status)}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCost(call.cost)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              暂无调用记录
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>
        </main>
      </div>
    </PageLayout>
  );
}
