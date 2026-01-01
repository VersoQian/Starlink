# Starlink 架构重构迁移计划

## 目标架构

```
starlink/
├── apps/
│   └── web/                          # 主应用（Next.js）
│       ├── app/
│       │   ├── (auth)/               # 认证页面
│       │   ├── (platform)/           # 主平台
│       │   │   ├── workspace/        # 🎨 工作台
│       │   │   ├── practice/         # 🎭 模拟平台（新）
│       │   │   └── community/        # 👥 社群（预留）
│       │   ├── api/                  # API Routes
│       │   └── layout.tsx
│       ├── features/                 # 功能域
│       │   ├── workspace/            # 工作台领域
│       │   ├── practice/             # 模拟平台领域
│       │   └── knowledge/            # 知识库领域
│       ├── shared/                   # 跨功能共享
│       │   ├── components/
│       │   ├── hooks/
│       │   └── lib/
│       └── package.json
└── packages/
    ├── ui/                           # 已有UI包
    ├── shared/                       # 共享类型/schema
    └── config/                       # 配置工具
```

## 迁移步骤（渐进式，不破坏现有功能）

### Phase 1: 创建新结构 ✅
- [x] 创建 apps/web 目录
- [x] 设置 pnpm workspace 配置
- [x] 复制现有 frontend 到 apps/web
- [x] 测试：确保现有功能正常

### Phase 2: 重构内部结构 🔄
- [ ] 在 apps/web 创建 features/ 目录
- [ ] 迁移 workspace 组件到 features/workspace/
- [ ] 迁移 knowledge 组件到 features/knowledge/
- [ ] 迁移 translation 组件到 features/ (可选)
- [ ] 创建 shared/ 目录，移动公共代码
- [ ] 测试：确保功能正常

### Phase 3: 实现 Practice 模拟平台 🆕
- [ ] 创建 features/practice/ 目录结构
- [ ] 实现三栏布局组件
- [ ] 创建 app/(platform)/practice 路由
- [ ] 集成现有 simulation API
- [ ] 测试：Practice 功能完整

### Phase 4: 优化和清理 🧹
- [ ] 更新所有 import 路径
- [ ] 统一配置文件
- [ ] 删除旧 frontend 目录
- [ ] 更新文档

## 功能迁移映射

### Workspace 功能
```
现有位置 → 新位置

components/workspace/
  ├── canvas-viewport.tsx     → features/workspace/components/canvas-viewport.tsx
  ├── assistant-panel.tsx     → features/workspace/components/assistant-panel.tsx
  ├── canvas-toolbar.tsx      → features/workspace/components/canvas-toolbar.tsx
  ├── node-palette.tsx        → features/workspace/components/node-palette.tsx
  └── document-drawer.tsx     → features/workspace/components/document-drawer.tsx

store/canvas-store.ts         → features/workspace/store/canvas-store.ts
hooks/use-canvas-mutations.ts → features/workspace/hooks/use-canvas-mutations.ts

app/(app)/workspace/          → app/(platform)/workspace/
```

### Knowledge Base 功能
```
components/knowledge/         → features/knowledge/components/
app/(app)/workspace/[id]/knowledge/ → app/(platform)/workspace/[id]/knowledge/
```

### Practice 功能（新建）
```
（新建）
features/practice/
  ├── components/
  │   ├── scenario-list.tsx
  │   ├── chat-interface.tsx
  │   ├── context-assistant.tsx
  │   └── message-bubble.tsx
  ├── hooks/
  │   └── use-simulation.ts
  ├── store/
  │   └── practice-store.ts
  └── types/
      └── simulation.types.ts

app/(platform)/practice/
  ├── page.tsx                # 场景列表
  └── [scenarioId]/
      └── page.tsx            # 对话界面

（保留）
app/api/cultural/simulations/ → 保持不变
```

## 配置文件更新

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### apps/web/package.json
```json
{
  "name": "@starlink/web",
  "dependencies": {
    "@starlink/ui": "workspace:*",
    "@starlink/shared": "workspace:*",
    "@starlink/config": "workspace:*"
  }
}
```

### apps/web/tsconfig.json
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./"],
      "@/features/*": ["./features/*"],
      "@/shared/*": ["./shared/*"]
    }
  }
}
```

## 风险控制

1. **每个Phase独立测试** - 确保不破坏现有功能
2. **保留旧代码** - 迁移完成前不删除原文件
3. **路径别名** - 使用 @ 别名简化 import
4. **Git分支** - 在 `refactor/monorepo` 分支进行

## 验收标准

### Phase 1 ✅
- [ ] pnpm dev 启动成功
- [ ] 所有页面正常访问
- [ ] Workspace Canvas 功能正常

### Phase 2 ✅
- [ ] 所有功能正常
- [ ] 代码组织清晰
- [ ] Import 路径正确

### Phase 3 ✅
- [ ] Practice 页面可访问
- [ ] 场景列表展示正确
- [ ] 对话功能正常
- [ ] 上下文助手正常

### Phase 4 ✅
- [ ] 无冗余代码
- [ ] 文档更新完整
- [ ] CI/CD 正常

## 时间估算

- Phase 1: 1-2小时
- Phase 2: 2-3小时
- Phase 3: 4-6小时
- Phase 4: 1-2小时

**总计: 8-13小时**
