#!/bin/bash

# 批量更新页面导航栏的脚本

echo "开始更新页面导航栏..."

# 更新 ReportHistory.tsx
echo "更新 ReportHistory.tsx..."
# 添加导入
sed -i '' 's/import { ArrowLeft, History, Loader2, FileText, Calendar, Building2, TrendingUp } from "lucide-react";/import { History, Loader2, FileText, Calendar, Building2, TrendingUp } from "lucide-react";\nimport { GlobalNavigation } from "@\/components\/GlobalNavigation";/' client/src/pages/ReportHistory.tsx

# 更新 BatchQuery.tsx
echo "更新 BatchQuery.tsx..."
sed -i '' 's/import { ArrowLeft,/import {/' client/src/pages/BatchQuery.tsx
sed -i '' '/^import {$/,/^} from "lucide-react";$/ {
  /^} from "lucide-react";$/a\
import { GlobalNavigation } from "@/components/GlobalNavigation";
}' client/src/pages/BatchQuery.tsx

# 更新 TaskManagement.tsx
echo "更新 TaskManagement.tsx..."
sed -i '' 's/import { ArrowLeft,/import {/' client/src/pages/TaskManagement.tsx
sed -i '' '/^import {$/,/^} from "lucide-react";$/ {
  /^} from "lucide-react";$/a\
import { GlobalNavigation } from "@/components/GlobalNavigation";
}' client/src/pages/TaskManagement.tsx

# 更新 Settings.tsx
echo "更新 Settings.tsx..."
sed -i '' 's/import { ArrowLeft,/import {/' client/src/pages/Settings.tsx
sed -i '' '/^import {$/,/^} from "lucide-react";$/ {
  /^} from "lucide-react";$/a\
import { GlobalNavigation } from "@/components/GlobalNavigation";
}' client/src/pages/Settings.tsx

# 更新 ApiStats.tsx
echo "更新 ApiStats.tsx..."
sed -i '' 's/import { ArrowLeft,/import {/' client/src/pages/ApiStats.tsx
sed -i '' '/^import {$/,/^} from "lucide-react";$/ {
  /^} from "lucide-react";$/a\
import { GlobalNavigation } from "@/components/GlobalNavigation";
}' client/src/pages/ApiStats.tsx

# 更新 UserCenter.tsx
echo "更新 UserCenter.tsx..."
sed -i '' 's/import { ArrowLeft,/import {/' client/src/pages/UserCenter.tsx
sed -i '' '/^import {$/,/^} from "lucide-react";$/ {
  /^} from "lucide-react";$/a\
import { GlobalNavigation } from "@/components/GlobalNavigation";
}' client/src/pages/UserCenter.tsx

echo "导入更新完成！"
echo "请手动替换各页面的 header 部分为 <GlobalNavigation />"
