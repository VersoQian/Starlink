# Practice Feature

模拟平台功能域 - 负责跨文化商业沟通模拟对话相关功能。

## 目录结构

```
practice/
├── components/      # Practice专属组件
│   ├── scenario-list.tsx
│   ├── chat-interface.tsx
│   ├── context-assistant.tsx
│   └── message-bubble.tsx
├── hooks/          # Practice专属hooks
│   └── use-simulation.ts
├── store/          # Practice专属状态管理
│   └── practice-store.ts
├── services/       # Practice专属服务
│   └── SimulationService.ts
└── types/          # Practice专属类型定义
    └── simulation.types.ts
```

## API集成

使用现有的API：
- `app/api/cultural/simulations/route.ts` - 场景列表和对话接口

## 参考设计

参考Starlink Assistant的三栏布局：
- 左侧：场景列表（320px）
- 中间：对话界面（flex-1）
- 右侧：上下文助手（360px）
