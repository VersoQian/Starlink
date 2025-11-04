# 设计文档 - 问题广场

## 概述

问题广场是一个轻量级的社区讨论功能，集成到现有的分支对话应用中。设计目标是保持简洁，不干扰主要的画布编辑体验，同时提供完整的问答和分享功能。

### 设计原则

1. **最小侵入性** - 作为独立的视图层，不影响现有画布功能
2. **简单直观** - 清晰的信息层级，减少用户学习成本
3. **快速响应** - 优化加载和交互性能
4. **数据一致性** - 使用 Cloudflare Durable Objects 保证数据可靠性

## 架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React)                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Canvas     │  │    Forum     │  │   Settings   │  │
│  │   (tldraw)   │  │    View      │  │    Panel     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                            │                             │
│                   ┌────────▼────────┐                    │
│                   │  Forum Context  │                    │
│                   │  (State Mgmt)   │                    │
│                   └────────┬────────┘                    │
└────────────────────────────┼─────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────▼─────────────────────────────┐
│              Cloudflare Worker (Backend)                 │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐   │
│  │              API Routes (itty-router)            │   │
│  │  /forum/questions  │  /forum/replies  │  /user   │   │
│  └──────────────────────────────────────────────────┘   │
│                            │                             │
│  ┌────────────────────────▼──────────────────────────┐  │
│  │         Durable Object: ForumStorage             │  │
│  │  - Questions Store                                │  │
│  │  - Replies Store                                  │  │
│  │  - User Profiles Store                            │  │
│  │  - Likes Store                                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

- **前端**: React + tldraw + TypeScript
- **后端**: Cloudflare Workers + Durable Objects
- **路由**: itty-router
- **状态管理**: React Context + useState/useReducer
- **样式**: CSS Modules / Inline Styles (保持与现有风格一致)

## 组件和接口

### 前端组件结构

```
client/
├── forum/
│   ├── ForumView.tsx              # 主视图容器
│   ├── components/
│   │   ├── QuestionList.tsx       # 问题列表
│   │   ├── QuestionCard.tsx       # 问题卡片
│   │   ├── QuestionDetail.tsx     # 问题详情
│   │   ├── ReplyList.tsx          # 回复列表
│   │   ├── ReplyItem.tsx          # 单条回复
│   │   ├── PublishDialog.tsx      # 发布问题对话框
│   │   ├── FlowPreview.tsx        # 流程预览组件
│   │   ├── SearchBar.tsx          # 搜索栏
│   │   └── UserAvatar.tsx         # 用户头像
│   ├── context/
│   │   └── ForumContext.tsx       # 全局状态管理
│   ├── hooks/
│   │   ├── useQuestions.ts        # 问题数据钩子
│   │   ├── useReplies.ts          # 回复数据钩子
│   │   └── useUser.ts             # 用户数据钩子
│   ├── utils/
│   │   ├── api.ts                 # API 调用封装
│   │   ├── canvas.ts              # 画布数据处理
│   │   └── storage.ts             # 本地存储工具
│   └── types.ts                   # 类型定义
```

### 核心组件设计

#### 1. ForumView (主视图)

```tsx
interface ForumViewProps {
  editor: Editor  // tldraw editor 实例
  onClose: () => void
}

// 状态：
// - currentView: 'list' | 'detail'
// - selectedQuestionId: string | null
// - searchQuery: string
```

#### 2. QuestionCard (问题卡片)

```tsx
interface QuestionCardProps {
  question: Question
  onClick: () => void
}

// 显示：
// - 标题
// - 作者昵称 + 头像
// - 发布时间（相对时间）
// - 回复数
// - 点赞数
// - 流程缩略图（如果有）
```

#### 3. PublishDialog (发布对话框)

```tsx
interface PublishDialogProps {
  editor: Editor
  onClose: () => void
  onPublish: (question: QuestionInput) => Promise<void>
}

// 表单字段：
// - title: string (5-100字符)
// - description: string (10-2000字符)
// - attachCanvas: boolean
// - canvasSnapshot?: CanvasSnapshot
```

#### 4. FlowPreview (流程预览)

```tsx
interface FlowPreviewProps {
  snapshot: CanvasSnapshot
  mode: 'thumbnail' | 'full'
  onImport?: () => void
}

// thumbnail 模式：小缩略图
// full 模式：模态窗口中的完整预览
```

## 数据模型

### Question (问题)

```typescript
interface Question {
  id: string                    // UUID
  title: string                 // 5-100字符
  description: string           // 10-2000字符
  authorId: string              // 用户ID
  authorName: string            // 用户昵称
  createdAt: number             // 时间戳
  updatedAt: number             // 时间戳
  replyCount: number            // 回复数
  likeCount: number             // 点赞数
  canvasSnapshot?: CanvasSnapshot  // 画布快照
}
```

### Reply (回复)

```typescript
interface Reply {
  id: string                    // UUID
  questionId: string            // 所属问题ID
  content: string               // 1-1000字符
  authorId: string              // 用户ID
  authorName: string            // 用户昵称
  createdAt: number             // 时间戳
  likeCount: number             // 点赞数
}
```

### User (用户)

```typescript
interface User {
  id: string                    // UUID (localStorage生成)
  nickname: string              // 2-15字符
  createdAt: number             // 时间戳
}
```

### CanvasSnapshot (画布快照)

```typescript
interface CanvasSnapshot {
  shapes: TLShape[]             // tldraw shapes
  bindings: TLBinding[]         // tldraw bindings
  thumbnail: string             // Base64 PNG (200x150px)
}
```

### Like (点赞)

```typescript
interface Like {
  userId: string                // 用户ID
  targetId: string              // 问题或回复ID
  targetType: 'question' | 'reply'
  createdAt: number             // 时间戳
}
```

## API 接口设计

### 问题相关

#### GET /forum/questions
获取问题列表

**Query Parameters:**
- `page`: number (默认 1)
- `limit`: number (默认 15)
- `search`: string (可选，搜索关键词)

**Response:**
```json
{
  "questions": Question[],
  "total": number,
  "hasMore": boolean
}
```

#### GET /forum/questions/:id
获取问题详情

**Response:**
```json
{
  "question": Question
}
```

#### POST /forum/questions
发布问题

**Request Body:**
```json
{
  "title": string,
  "description": string,
  "authorId": string,
  "authorName": string,
  "canvasSnapshot": CanvasSnapshot | null
}
```

**Response:**
```json
{
  "question": Question
}
```

### 回复相关

#### GET /forum/questions/:questionId/replies
获取问题的所有回复

**Response:**
```json
{
  "replies": Reply[]
}
```

#### POST /forum/questions/:questionId/replies
发布回复

**Request Body:**
```json
{
  "content": string,
  "authorId": string,
  "authorName": string
}
```

**Response:**
```json
{
  "reply": Reply
}
```

### 点赞相关

#### POST /forum/like
点赞或取消点赞

**Request Body:**
```json
{
  "userId": string,
  "targetId": string,
  "targetType": "question" | "reply",
  "action": "like" | "unlike"
}
```

**Response:**
```json
{
  "success": boolean,
  "likeCount": number
}
```

#### GET /forum/likes/:userId
获取用户的点赞列表

**Response:**
```json
{
  "likes": Like[]
}
```

### 用户相关

#### POST /forum/user
创建或更新用户

**Request Body:**
```json
{
  "id": string,
  "nickname": string
}
```

**Response:**
```json
{
  "user": User
}
```

## 后端实现

### Durable Object: ForumStorage

```typescript
export class ForumStorage extends DurableObject {
  // 存储结构
  private questions: Map<string, Question>
  private replies: Map<string, Reply[]>  // questionId -> Reply[]
  private likes: Map<string, Like[]>     // userId -> Like[]
  private users: Map<string, User>
  
  // 方法
  async getQuestions(page: number, limit: number, search?: string)
  async getQuestion(id: string)
  async createQuestion(data: QuestionInput)
  async getReplies(questionId: string)
  async createReply(questionId: string, data: ReplyInput)
  async toggleLike(data: LikeInput)
  async getUserLikes(userId: string)
  async createOrUpdateUser(data: User)
}
```

### Worker 路由

```typescript
// worker/forum/routes.ts
export const forumRoutes = AutoRouter()
  .get('/forum/questions', handleGetQuestions)
  .get('/forum/questions/:id', handleGetQuestion)
  .post('/forum/questions', handleCreateQuestion)
  .get('/forum/questions/:id/replies', handleGetReplies)
  .post('/forum/questions/:id/replies', handleCreateReply)
  .post('/forum/like', handleToggleLike)
  .get('/forum/likes/:userId', handleGetUserLikes)
  .post('/forum/user', handleCreateOrUpdateUser)
```

## 用户界面设计

### 布局

```
┌─────────────────────────────────────────────────────────┐
│  [← 返回画布]  问题广场           [发布问题] [设置]      │
├─────────────────────────────────────────────────────────┤
│  [搜索框: 搜索问题...]                                   │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │ 问题卡片 1                                        │  │
│  │ ┌─────┐ 如何创建复杂的对话流程？                  │  │
│  │ │头像 │ 用户123 · 2小时前 · 5回复 · 12赞         │  │
│  │ └─────┘ [流程缩略图]                              │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 问题卡片 2                                        │  │
│  │ ...                                               │  │
│  └───────────────────────────────────────────────────┘  │
│  [加载更多...]                                          │
└─────────────────────────────────────────────────────────┘
```

### 问题详情页

```
┌─────────────────────────────────────────────────────────┐
│  [← 返回列表]                                           │
├─────────────────────────────────────────────────────────┤
│  如何创建复杂的对话流程？                                │
│  ┌─────┐ 用户123 · 2小时前 · ❤️ 12                     │
│  │头像 │                                                │
│  └─────┘                                                │
│                                                          │
│  我想创建一个包含多个分支的对话流程，但不知道如何...     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [流程预览图]                                    │   │
│  │                                                  │   │
│  │  [导入到我的画布]                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  5 条回复                                               │
│                                                          │
│  ┌─────┐ 用户456 · 1小时前 · ❤️ 3                      │
│  │头像 │ 你可以尝试使用...                              │
│  └─────┘                                                │
│                                                          │
│  [回复框]                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 写下你的回复...                                  │   │
│  │                                                  │   │
│  │                                    [发布回复]    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 错误处理

### 客户端错误处理

1. **网络错误**
   - 显示 Toast 提示："网络连接失败，请检查网络"
   - 提供重试按钮

2. **验证错误**
   - 表单字段实时验证
   - 显示红色错误提示文本

3. **加载失败**
   - 显示错误状态组件
   - 提供刷新按钮

### 服务端错误处理

1. **400 Bad Request**
   - 返回具体的验证错误信息
   - 客户端显示在表单字段下方

2. **404 Not Found**
   - 返回 "资源不存在"
   - 客户端重定向到列表页

3. **500 Internal Server Error**
   - 记录错误日志
   - 返回通用错误消息
   - 客户端显示友好提示

## 测试策略

### 单元测试

1. **工具函数测试**
   - `canvas.ts` 中的快照生成和导入
   - `storage.ts` 中的本地存储操作
   - 数据验证函数

2. **组件测试**
   - QuestionCard 渲染测试
   - PublishDialog 表单验证测试
   - SearchBar 搜索逻辑测试

### 集成测试

1. **API 测试**
   - 问题 CRUD 操作
   - 回复 CRUD 操作
   - 点赞功能
   - 搜索功能

2. **端到端测试**
   - 发布问题流程
   - 查看和回复问题流程
   - 导入画布流程

### 性能测试

1. **加载性能**
   - 问题列表首屏加载时间 < 1s
   - 分页加载时间 < 500ms

2. **交互性能**
   - 点赞响应时间 < 200ms
   - 搜索响应时间 < 300ms

## 画布快照实现

### 快照生成

```typescript
function captureCanvasSnapshot(editor: Editor): CanvasSnapshot {
  // 1. 获取所有 shapes 和 bindings
  const shapes = editor.getCurrentPageShapes()
  const bindings = editor.getCurrentPageBindings()
  
  // 2. 生成缩略图
  const thumbnail = generateThumbnail(editor, 200, 150)
  
  return {
    shapes: shapes.map(s => s.toJSON()),
    bindings: bindings.map(b => b.toJSON()),
    thumbnail
  }
}

function generateThumbnail(
  editor: Editor, 
  width: number, 
  height: number
): string {
  // 使用 tldraw 的 exportAs 功能生成 PNG
  const svg = editor.getSvg(editor.getCurrentPageShapes())
  // 转换为 base64 PNG
  return svgToBase64Png(svg, width, height)
}
```

### 快照导入

```typescript
function importCanvasSnapshot(
  editor: Editor, 
  snapshot: CanvasSnapshot,
  mode: 'replace' | 'append'
) {
  if (mode === 'replace') {
    // 清空当前画布
    editor.deleteShapes(editor.getCurrentPageShapeIds())
  }
  
  // 导入 shapes
  const shapeIds = snapshot.shapes.map(s => s.id)
  editor.createShapes(snapshot.shapes)
  
  // 导入 bindings
  editor.createBindings(snapshot.bindings)
  
  // 居中显示
  editor.zoomToFit()
}
```

## 性能优化

### 前端优化

1. **虚拟滚动**
   - 问题列表使用虚拟滚动，只渲染可见区域

2. **图片懒加载**
   - 流程缩略图使用懒加载

3. **防抖和节流**
   - 搜索输入使用防抖（300ms）
   - 滚动加载使用节流（200ms）

4. **缓存策略**
   - 已加载的问题数据缓存在内存中
   - 用户信息缓存在 localStorage

### 后端优化

1. **数据分页**
   - 问题列表分页加载，每页15条

2. **索引优化**
   - 问题按创建时间索引
   - 回复按问题ID索引

3. **缓存策略**
   - Durable Object 内存缓存热点数据

## 安全考虑

### 输入验证

1. **长度限制**
   - 标题: 5-100字符
   - 描述: 10-2000字符
   - 回复: 1-1000字符
   - 昵称: 2-15字符

2. **内容过滤**
   - XSS 防护：转义 HTML 标签
   - 敏感词过滤（基础版本）

### 速率限制

1. **发布限制**
   - 每个用户每分钟最多发布 3 个问题
   - 每个用户每分钟最多发布 10 条回复

2. **点赞限制**
   - 每个用户每秒最多 5 次点赞操作

### 数据验证

1. **服务端验证**
   - 所有输入在服务端重新验证
   - 使用 Zod 进行类型验证

2. **权限检查**
   - 用户只能编辑/删除自己的内容（预留功能）

## 部署和配置

### 环境变量

```toml
# wrangler.toml
[durable_objects]
bindings = [
  { name = "FORUM_STORAGE", class_name = "ForumStorage" }
]

[[migrations]]
tag = "v1"
new_classes = ["ForumStorage"]
```

### 数据迁移

初始版本无需迁移，Durable Object 自动初始化空数据结构。

## 未来扩展

### 第一阶段（当前）
- 基础问答功能
- 画布分享和导入
- 简单点赞

### 第二阶段（未来）
- 标签系统
- 用户主页
- 通知系统
- 最佳答案标记

### 第三阶段（未来）
- 评论嵌套回复
- 收藏功能
- 内容举报
- 管理后台
