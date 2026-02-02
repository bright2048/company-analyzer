import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  FileText, Building2, Settings, History, Loader2, 
  ArrowLeft, Download, CheckCircle2, XCircle, Clock, Layers,
  RefreshCw, AlertCircle, Upload, Eye, ListTodo, ChevronRight, Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TaskReport {
  id: number;
  companyName: string;
  status: string;
  reportContent: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

interface BatchTask {
  id: number;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  status: string;
  companyNames: string | null;
  zipFileUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  reports?: TaskReport[];
}

// 时间格式化函数：修正时区偏移问题
const formatDate = (date: Date | string) => {
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = new Date(date);
  }
  
  // 数据库服务器使用UTC+8时区存储时间
  // 需要减去8小时的偏移量来修正时区问题
  const correctedDate = new Date(dateObj.getTime() - 8 * 60 * 60 * 1000);
  
  return correctedDate.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function TaskManagement() {
  const [, setLocation] = useLocation();
  const [selectedTask, setSelectedTask] = useState<BatchTask | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<BatchTask | null>(null);

  // 获取批量任务列表
  const { data: tasks, refetch: refetchTasks, isLoading } = trpc.batchTask.list.useQuery(
    { limit: 50, offset: 0 },
    { refetchInterval: 5000 }
  );

  // 获取任务详情
  const { data: taskDetail, refetch: refetchDetail } = trpc.batchTask.getById.useQuery(
    { id: selectedTask?.id || 0 },
    { enabled: !!selectedTask && detailDialogOpen, refetchInterval: selectedTask?.status === "processing" ? 3000 : false }
  );

  // 下载批量报告
  const downloadMutation = trpc.batchTask.downloadAll.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success("报告已准备好，正在下载...");
    },
    onError: (error) => {
      toast.error("下载失败: " + error.message);
    },
  });

  // 删除批量任务
  const deleteMutation = trpc.batchTask.delete.useMutation({
    onSuccess: () => {
      toast.success("任务已删除");
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      refetchTasks();
    },
    onError: (error) => {
      toast.error("删除失败: " + error.message);
    },
  });

  const handleDeleteClick = (task: BatchTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteMutation.mutate({ id: taskToDelete.id });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />等待中</Badge>;
      case "processing":
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />处理中</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />已完成</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失败</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReportStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-gray-500"><Clock className="h-3 w-3 mr-1" />等待</Badge>;
      case "searching":
        return <Badge variant="outline" className="text-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />搜索中</Badge>;
      case "generating":
        return <Badge variant="outline" className="text-purple-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />生成中</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />成功</Badge>;
      case "failed":
        return <Badge variant="outline" className="text-red-500"><XCircle className="h-3 w-3 mr-1" />失败</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleViewDetail = (task: BatchTask) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  const handleViewReport = (reportId: number) => {
    setDetailDialogOpen(false);
    setLocation(`/report/${reportId}`);
  };

  // 统计数据
  const stats = {
    total: tasks?.length || 0,
    processing: tasks?.filter(t => t.status === "processing").length || 0,
    completed: tasks?.filter(t => t.status === "completed").length || 0,
    failed: tasks?.filter(t => t.status === "failed").length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground leading-none">鲲鹏产业源头创新中心</span>
                <span className="font-semibold text-lg leading-tight">鲲灵智谱</span>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/batch")}>
              <Upload className="h-4 w-4 mr-2" />
              批量查询
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/reports")}>
              <History className="h-4 w-4 mr-2" />
              历史报告
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/park")}>
              <Building2 className="h-4 w-4 mr-2" />
              园区企业
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              设置
            </Button>
          </nav>
        </div>
      </header>

      <main className="container py-8">
        <div className="space-y-8">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ListTodo className="h-8 w-8" />
                任务管理
              </h1>
              <p className="text-muted-foreground mt-2">
                查看所有批量查询任务的进度和历史记录
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => refetchTasks()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button onClick={() => setLocation("/batch")}>
                <Upload className="h-4 w-4 mr-2" />
                新建任务
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">总任务数</p>
                    <p className="text-3xl font-bold">{stats.total}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">处理中</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.processing}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">已完成</p>
                    <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">失败</p>
                    <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Task List */}
          <Card>
            <CardHeader>
              <CardTitle>任务列表</CardTitle>
              <CardDescription>
                点击任务查看详细进度和每个企业的报告状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !tasks || tasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">暂无批量任务</p>
                  <p className="text-sm mt-2">点击"新建任务"上传CSV文件开始批量生成报告</p>
                  <Button className="mt-4" onClick={() => setLocation("/batch")}>
                    <Upload className="h-4 w-4 mr-2" />
                    新建任务
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">任务ID</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>进度</TableHead>
                      <TableHead className="text-center">企业数</TableHead>
                      <TableHead className="text-center">成功</TableHead>
                      <TableHead className="text-center">失败</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const progress = task.totalCount > 0 
                        ? ((task.completedCount + task.failedCount) / task.totalCount) * 100 
                        : 0;
                      return (
                        <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetail(task)}>
                          <TableCell className="font-medium">#{task.id}</TableCell>
                          <TableCell>{getStatusBadge(task.status)}</TableCell>
                          <TableCell className="w-40">
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{task.totalCount}</TableCell>
                          <TableCell className="text-center text-green-600">{task.completedCount}</TableCell>
                          <TableCell className="text-center text-red-600">{task.failedCount}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(task.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {task.status === "completed" && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadMutation.mutate({ id: task.id });
                                  }}
                                  disabled={downloadMutation.isPending}
                                >
                                  {downloadMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetail(task);
                              }}>
                                <Eye className="h-4 w-4 mr-1" />
                                详情
                              </Button>
                              {task.status !== "processing" && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={(e) => handleDeleteClick(task, e)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Task Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              任务 #{selectedTask?.id} 详情
              {selectedTask && getStatusBadge(selectedTask.status)}
            </DialogTitle>
            <DialogDescription>
              查看任务中每个企业的报告生成状态
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-6">
              {/* Task Summary */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">总企业数</p>
                  <p className="text-2xl font-bold">{selectedTask.totalCount}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600">成功</p>
                  <p className="text-2xl font-bold text-green-600">{selectedTask.completedCount}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-600">失败</p>
                  <p className="text-2xl font-bold text-red-600">{selectedTask.failedCount}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600">进度</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedTask.totalCount > 0 
                      ? Math.round(((selectedTask.completedCount + selectedTask.failedCount) / selectedTask.totalCount) * 100) 
                      : 0}%
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>整体进度</span>
                  <span>{selectedTask.completedCount + selectedTask.failedCount} / {selectedTask.totalCount}</span>
                </div>
                <Progress 
                  value={selectedTask.totalCount > 0 
                    ? ((selectedTask.completedCount + selectedTask.failedCount) / selectedTask.totalCount) * 100 
                    : 0} 
                  className="h-3"
                />
              </div>

              {/* Reports List */}
              <div>
                <h4 className="font-medium mb-3">企业报告列表</h4>
                {taskDetail?.reports ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>企业名称</TableHead>
                          <TableHead className="w-32">状态</TableHead>
                          <TableHead className="w-40">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taskDetail.reports.map((report) => (
                          <TableRow key={report.id}>
                            <TableCell className="font-medium">{report.companyName}</TableCell>
                            <TableCell>
                              {getReportStatusBadge(report.status)}
                              {report.status === "failed" && report.errorMessage && (
                                <p className="text-xs text-red-500 mt-1 truncate max-w-xs" title={report.errorMessage}>
                                  {report.errorMessage}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              {report.status === "completed" && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleViewReport(report.id)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  查看报告
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedTask.status === "completed" && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    onClick={() => downloadMutation.mutate({ id: selectedTask.id })}
                    disabled={downloadMutation.isPending}
                  >
                    {downloadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    打包下载所有报告
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除任务 #{taskToDelete?.id} 吗？此操作将同时删除该任务下的所有报告记录，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
