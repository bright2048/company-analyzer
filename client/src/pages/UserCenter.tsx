import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Loader2,
  FileText,
  Bot,
  LogOut,
  Settings,
  Key,
  History,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function UserCenter() {
  const [, setLocation] = useLocation();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 获取当前用户信息
  const { data: user, isLoading: userLoading, refetch: refetchUser } = trpc.auth.me.useQuery();

  // 获取额度信息
  const { data: quota, isLoading: quotaLoading, refetch: refetchQuota } = trpc.auth.getQuota.useQuery(undefined, {
    enabled: !!user,
  });

  // 获取登录历史
  const { data: loginHistory, isLoading: historyLoading, refetch: refetchHistory } = trpc.auth.getLoginHistory.useQuery(
    { limit: 20 },
    { enabled: historyDialogOpen && !!user }
  );

  // 更新偏好的LLM
  const updateLlmMutation = trpc.auth.updatePreferredLlm.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetchUser();
      refetchQuota();
    },
    onError: (error) => {
      toast.error("更新失败: " + error.message);
    },
  });

  // 修改密码
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("密码修改成功");
      setPasswordDialogOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error("密码修改失败: " + error.message);
    },
  });

  // 登出
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("已退出登录");
      setLocation("/login");
    },
    onError: (error) => {
      toast.error("退出失败: " + error.message);
    },
  });

  // 检查登录状态
  useEffect(() => {
    if (!userLoading && !user) {
      setLocation("/login");
    }
  }, [user, userLoading, setLocation]);

  const handleLlmChange = (value: string) => {
    updateLlmMutation.mutate({ preferredLlm: value as 'qwen' | 'zhipu' | 'wenxin' });
  };

  const handleLogout = () => {
    if (confirm("确定要退出登录吗？")) {
      logoutMutation.mutate();
    }
  };

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少6位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    changePasswordMutation.mutate({ oldPassword, newPassword });
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const usagePercent = quota ? (quota.used / quota.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                用户中心
              </h1>
              <p className="text-sm text-muted-foreground">管理您的账户和偏好设置</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <Button variant="outline" onClick={() => setLocation("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                系统设置
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-3xl">
        <div className="space-y-6">
          {/* 用户信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                账户信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">手机号</Label>
                  <p className="font-medium font-mono">{user.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">姓名</Label>
                  <p className="font-medium">{user.name || '未设置'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">角色</Label>
                  <p>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">注册时间</Label>
                  <p className="text-sm">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 安全设置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                安全设置
              </CardTitle>
              <CardDescription>
                管理您的账户安全
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">登录密码</p>
                  <p className="text-sm text-muted-foreground">定期修改密码可以提高账户安全性</p>
                </div>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">修改密码</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>修改密码</DialogTitle>
                      <DialogDescription>
                        请输入旧密码和新密码，新密码至少6位
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="oldPassword">旧密码</Label>
                        <Input
                          id="oldPassword"
                          type="password"
                          placeholder="请输入旧密码"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">新密码</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          placeholder="请输入新密码（至少6位）"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">确认新密码</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="请再次输入新密码"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                        取消
                      </Button>
                      <Button 
                        onClick={handleChangePassword}
                        disabled={changePasswordMutation.isPending}
                      >
                        {changePasswordMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        确认修改
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <p className="font-medium">登录历史</p>
                  <p className="text-sm text-muted-foreground">查看最近的登录记录</p>
                </div>
                <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <History className="h-4 w-4 mr-2" />
                      查看历史
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle>登录历史</DialogTitle>
                      <DialogDescription>
                        最近20次登录记录
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : loginHistory && loginHistory.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>状态</TableHead>
                              <TableHead>登录时间</TableHead>
                              <TableHead>IP地址</TableHead>
                              <TableHead className="hidden md:table-cell">设备信息</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loginHistory.map((log: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>
                                  {log.status === 'success' ? (
                                    <Badge variant="default" className="bg-green-500">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      成功
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      失败
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {new Date(log.loginTime).toLocaleString('zh-CN')}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {log.ipAddress || '-'}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                                  {log.userAgent || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">暂无登录记录</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* 额度信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                报告额度
              </CardTitle>
              <CardDescription>
                您的报告生成额度使用情况
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {quotaLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : quota ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span>已使用 {quota.used} / {quota.total} 份</span>
                    <span className={usagePercent >= 90 ? 'text-destructive' : 'text-muted-foreground'}>
                      剩余 {quota.remaining} 份
                    </span>
                  </div>
                  <Progress 
                    value={usagePercent} 
                    className={usagePercent >= 90 ? '[&>div]:bg-destructive' : ''}
                  />
                  {usagePercent >= 90 && (
                    <p className="text-sm text-destructive">
                      您的额度即将用尽，请联系管理员增加额度
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">无法获取额度信息</p>
              )}
            </CardContent>
          </Card>

          {/* 大模型偏好设置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                大模型设置
              </CardTitle>
              <CardDescription>
                选择生成报告时使用的AI大模型
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>默认大模型</Label>
                <Select
                  value={quota?.preferredLlm || user.preferredLlm || 'zhipu'}
                  onValueChange={handleLlmChange}
                  disabled={updateLlmMutation.isPending}
                >
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="选择大模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zhipu">
                      <div className="flex items-center gap-2">
                        <span>智谱AI (GLM-4)</span>
                        <Badge variant="secondary" className="text-xs">推荐</Badge>
                      </div>
                    </SelectItem>
                    <SelectItem value="qwen">通义千问 (Qwen)</SelectItem>
                    <SelectItem value="wenxin">文心一言 (ERNIE)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  不同大模型可能产生不同风格的分析报告，您可以根据需要切换
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快捷操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setLocation("/")}>
                  <FileText className="h-6 w-6 mb-2" />
                  <span>生成报告</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setLocation("/reports")}>
                  <FileText className="h-6 w-6 mb-2" />
                  <span>历史报告</span>
                </Button>
                {user.role === 'admin' && (
                  <Button variant="outline" className="h-auto py-4 flex-col" onClick={() => setLocation("/users")}>
                    <User className="h-6 w-6 mb-2" />
                    <span>用户管理</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
