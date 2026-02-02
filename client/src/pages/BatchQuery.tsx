import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  Upload, FileText, Building2, Settings, History, Loader2, 
  ArrowLeft, Download, CheckCircle2, XCircle, Clock, Layers,
  RefreshCw, AlertCircle
} from "lucide-react";

export default function BatchQuery() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取批量任务列表
  const { data: tasks, refetch: refetchTasks } = trpc.batchTask.list.useQuery(
    { limit: 20, offset: 0 },
    { refetchInterval: 5000 } // 每5秒刷新一次
  );

  // 创建批量任务
  const createBatchMutation = trpc.batchTask.create.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      refetchTasks();
    },
    onError: (error) => {
      toast.error("创建批量任务失败: " + error.message);
    },
  });

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        toast.error("请选择CSV文件");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("请先选择CSV文件");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const base64 = btoa(unescape(encodeURIComponent(content)));
        createBatchMutation.mutate({
          fileContent: base64,
          fileName: selectedFile.name,
        });
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast.error("文件读取失败");
        setIsUploading(false);
      };
      reader.readAsText(selectedFile);
    } catch (error) {
      toast.error("文件处理失败");
      setIsUploading(false);
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
            <Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")}>
              <FileText className="h-4 w-4 mr-2" />
              任务管理
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
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl font-bold">批量查询</h1>
            <p className="text-muted-foreground mt-2">
              上传CSV文件，一次性生成多个企业的分析报告（每次最多50个）
            </p>
          </div>

          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                上传企业列表
              </CardTitle>
              <CardDescription>
                CSV文件格式：第一列为企业名称，可包含表头（企业名称/公司名称/companyName）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                {selectedFile ? (
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">点击重新选择文件</p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium">点击选择CSV文件</p>
                    <p className="text-sm text-muted-foreground">或将文件拖拽到此处</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>CSV文件示例：</p>
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    企业名称<br/>
                    华为技术有限公司<br/>
                    腾讯科技（深圳）有限公司<br/>
                    阿里巴巴集团控股有限公司
                  </code>
                </div>
                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || isUploading || createBatchMutation.isPending}
                >
                  {isUploading || createBatchMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      开始批量生成
                    </>
                  )}
                </Button>
              </div>

              {/* Warning Notice */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">注意事项</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>每次最多支持50个企业</li>
                    <li>报告将在后台自动生成，无需等待</li>
                    <li>如果企业信息无法确认，系统会标记为失败，不会胡编乱造</li>
                    <li>生成完成后可打包下载所有报告</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  批量任务列表
                </CardTitle>
                <CardDescription>
                  查看所有批量查询任务的进度和结果
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchTasks()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </CardHeader>
            <CardContent>
              {!tasks || tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无批量任务</p>
                  <p className="text-sm">上传CSV文件开始批量生成报告</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div key={task.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">任务 #{task.id}</span>
                          {getStatusBadge(task.status)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(new Date(task.createdAt).getTime() - 8 * 60 * 60 * 1000).toLocaleString("zh-CN")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>进度：{task.completedCount + task.failedCount} / {task.totalCount}</span>
                          <span className="text-muted-foreground">
                            成功 {task.completedCount} | 失败 {task.failedCount}
                          </span>
                        </div>
                        <Progress 
                          value={((task.completedCount + task.failedCount) / task.totalCount) * 100} 
                          className="h-2"
                        />
                      </div>

                      {task.status === "completed" && (
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4 inline mr-1" />
                            任务已完成
                          </span>
                          <Button 
                            size="sm" 
                            onClick={() => downloadMutation.mutate({ id: task.id })}
                            disabled={downloadMutation.isPending}
                          >
                            {downloadMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            打包下载
                          </Button>
                        </div>
                      )}

                      {task.status === "failed" && task.errorMessage && (
                        <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-600">
                          <XCircle className="h-4 w-4 inline mr-1" />
                          {task.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
