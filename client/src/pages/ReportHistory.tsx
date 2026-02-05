import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Trash2,
  Eye,
  Download,
  Clock,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";

export default function ReportHistory() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // 查询报告列表，每5秒自动刷新（用于显示生成进度）
  const { data: reports, isLoading } = trpc.report.list.useQuery(
    { limit: 50, offset: 0 },
    {
      // 如果有报告正在生成中，每5秒自动刷新
      refetchInterval: (data) => {
        const hasGenerating = data?.state?.data?.some(
          (r) => r.status === "pending" || r.status === "searching" || r.status === "generating"
        );
        return hasGenerating ? 5000 : false;
      },
    }
  );

  const deleteMutation = trpc.report.delete.useMutation({
    onSuccess: () => {
      toast.success("报告已删除");
      utils.report.list.invalidate();
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const exportWordMutation = trpc.report.exportWord.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: (error) => {
      toast.error("导出失败: " + error.message);
    },
  });

  const exportPdfMutation = trpc.report.exportPdf.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
    },
    onError: (error) => {
      toast.error("导出失败: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default">已完成</Badge>;
      case "pending":
        return (
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            等待中
          </Badge>
        );
      case "searching":
        return (
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            搜索中
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="secondary" className="animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            生成中
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">失败</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: Date | string) => {
    // 数据库服务器使用UTC+8时区存储时间
    // 需要减去8小时的偏移量来修正时区问题
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = new Date(date);
    }
    
    // 减去8小时的偏移量
    const correctedDate = new Date(dateObj.getTime() - 8 * 60 * 60 * 1000);
    
    return correctedDate.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <PageLayout>
      <main className="container py-8">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reports && reports.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公司名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>数据来源</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="w-[200px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.companyName}</TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell>
                        {report.dataSource === "web" && "网络公开信息"}
                        {report.dataSource === "tianyancha" && "天眼查API"}
                        {report.dataSource === "qichacha" && "企查查API"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {formatDate(report.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/report/${report.id}`)}
                            title="查看报告"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {report.status === "completed" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => exportWordMutation.mutate({ id: report.id })}
                                disabled={exportWordMutation.isPending}
                                title="下载Word"
                              >
                                {exportWordMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("确定要删除这份报告吗？")) {
                                deleteMutation.mutate({ id: report.id });
                              }
                            }}
                            title="删除报告"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无历史报告</p>
                <Button className="mt-4" onClick={() => setLocation("/")}>
                  生成第一份报告
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </PageLayout>
  );
}
