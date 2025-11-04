# 实施计划 - 问题广场

- [x] 1. 创建类型定义和工具函数
  - 创建 `client/forum/types.ts` 定义所有数据类型（Question、Reply、User、CanvasSnapshot、Like）
  - 创建 `client/forum/utils/storage.ts` 实现本地存储工具（用户ID、昵称、点赞状态）
  - 创建 `client/forum/utils/canvas.ts` 实现画布快照捕获和导入功能
  - 编写单元测试验证工具函数正确性
  - _需求: 1, 2, 4, 6, 7_

- [x] 2. 实现后端数据存储
  - [x] 2.1 创建 Durable Object 类
    - 创建 `worker/forum/ForumStorage.ts` 实现 Durable Object
    - 实现数据结构初始化（questions、replies、likes、users 的 Map）
    - 实现数据持久化方法（使用 storage API）
    - _需求: 7_
  
  - [x] 2.2 实现问题相关方法
    - 实现 `getQuestions(page, limit, search)` 方法，支持分页和搜索
    - 实现 `getQuestion(id)` 方法
    - 实现 `createQuestion(data)` 方法，生成 UUID 和时间戳
    - 编写测试验证问题 CRUD 操作
    - _需求: 1, 2, 8_
  
  - [x] 2.3 实现回复相关方法
    - 实现 `getReplies(questionId)` 方法
    - 实现 `createReply(questionId, data)` 方法
    - 实现回复计数更新逻辑
    - 编写测试验证回复 CRUD 操作
    - _需求: 3_
  
  - [x] 2.4 实现点赞和用户方法
    - 实现 `toggleLike(data)` 方法，支持点赞和取消点赞
    - 实现 `getUserLikes(userId)` 方法
    - 实现 `createOrUpdateUser(data)` 方法
    - 编写测试验证点赞和用户操作
    - _需求: 5, 6_

- [x] 3. 实现后端 API 路由
  - [x] 3.1 创建路由文件和基础结构
    - 创建 `worker/forum/routes.ts` 文件
    - 使用 itty-router 定义所有路由端点
    - 实现错误处理中间件
    - _需求: 7_
  
  - [x] 3.2 实现问题相关路由处理器
    - 实现 `handleGetQuestions` 处理器（GET /forum/questions）
    - 实现 `handleGetQuestion` 处理器（GET /forum/questions/:id）
    - 实现 `handleCreateQuestion` 处理器（POST /forum/questions）
    - 添加输入验证（使用 Zod）
    - _需求: 1, 2, 8_
  
  - [x] 3.3 实现回复和互动路由处理器
    - 实现 `handleGetReplies` 处理器（GET /forum/questions/:id/replies）
    - 实现 `handleCreateReply` 处理器（POST /forum/questions/:id/replies）
    - 实现 `handleToggleLike` 处理器（POST /forum/like）
    - 实现 `handleGetUserLikes` 处理器（GET /forum/likes/:userId）
    - 实现 `handleCreateOrUpdateUser` 处理器（POST /forum/user）
    - _需求: 3, 5, 6_
  
  - [x] 3.4 集成路由到主 Worker
    - 修改 `worker/worker.ts` 添加 forum 路由
    - 配置 Durable Object 绑定
    - 更新 `worker/types.ts` 添加 FORUM_STORAGE 绑定类型
    - 测试所有 API 端点
    - _需求: 7_

- [x] 4. 实现前端 API 客户端
  - 创建 `client/forum/utils/api.ts` 封装所有 API 调用
  - 实现 `fetchQuestions(page, limit, search)` 函数
  - 实现 `fetchQuestion(id)` 函数
  - 实现 `createQuestion(data)` 函数
  - 实现 `fetchReplies(questionId)` 函数
  - 实现 `createReply(questionId, data)` 函数
  - 实现 `toggleLike(data)` 函数
  - 实现 `fetchUserLikes(userId)` 函数
  - 实现 `createOrUpdateUser(data)` 函数
  - 添加错误处理和重试逻辑
  - _需求: 1, 2, 3, 5, 6, 7, 8_

- [x] 5. 实现状态管理
  - 创建 `client/forum/context/ForumContext.tsx` 实现全局状态
  - 定义状态结构（questions、currentQuestion、replies、user、likes）
  - 实现 actions（loadQuestions、loadQuestion、publishQuestion、publishReply、toggleLike）
  - 实现 useReducer 管理状态更新
  - 创建自定义 hooks（useForumContext）
  - _需求: 1, 2, 3, 5, 6_

- [x] 6. 实现基础 UI 组件
  - [x] 6.1 创建用户相关组件
    - 创建 `client/forum/components/UserAvatar.tsx` 显示用户头像（首字母圆形）
    - 实现头像颜色生成算法（基于昵称哈希）
    - 编写组件测试
    - _需求: 6_
  
  - [x] 6.2 创建搜索和工具组件
    - 创建 `client/forum/components/SearchBar.tsx` 实现搜索输入框
    - 实现防抖逻辑（300ms）
    - 添加清空按钮
    - _需求: 8_

- [x] 7. 实现问题列表功能
  - [x] 7.1 创建问题卡片组件
    - 创建 `client/forum/components/QuestionCard.tsx` 显示问题卡片
    - 显示标题、作者、时间、回复数、点赞数
    - 显示流程缩略图（如果有）
    - 实现相对时间显示（如"2小时前"）
    - _需求: 1_
  
  - [x] 7.2 创建问题列表组件
    - 创建 `client/forum/components/QuestionList.tsx` 显示问题列表
    - 实现无限滚动加载（使用 IntersectionObserver）
    - 实现加载状态和空状态显示
    - 集成搜索功能
    - _需求: 1, 8_

- [x] 8. 实现发布问题功能
  - 创建 `client/forum/components/PublishDialog.tsx` 发布对话框
  - 实现表单字段（标题、描述、附加画布选项）
  - 实现表单验证（长度限制、实时错误提示）
  - 实现画布快照捕获（调用 canvas.ts 工具）
  - 实现提交逻辑和错误处理
  - 实现昵称设置提示（首次发布时）
  - _需求: 2, 6_

- [x] 9. 实现问题详情功能
  - [x] 9.1 创建流程预览组件
    - 创建 `client/forum/components/FlowPreview.tsx` 显示流程预览
    - 实现缩略图模式（小图）
    - 实现完整预览模式（模态窗口）
    - 实现导入按钮和确认对话框
    - _需求: 4_
  
  - [x] 9.2 创建回复组件
    - 创建 `client/forum/components/ReplyItem.tsx` 显示单条回复
    - 显示作者、时间、内容、点赞数
    - 实现点赞按钮交互
    - _需求: 3, 5_
  
  - [x] 9.3 创建回复列表组件
    - 创建 `client/forum/components/ReplyList.tsx` 显示回复列表
    - 实现空状态显示
    - 实现回复输入框
    - 实现回复提交逻辑
    - _需求: 3_
  
  - [x] 9.4 创建问题详情组件
    - 创建 `client/forum/components/QuestionDetail.tsx` 显示问题详情
    - 显示完整问题内容
    - 集成流程预览组件
    - 集成回复列表组件
    - 实现点赞功能
    - 实现返回按钮
    - _需求: 1, 3, 4, 5_

- [x] 10. 实现主视图容器
  - 创建 `client/forum/ForumView.tsx` 主视图组件
  - 实现视图切换逻辑（列表 ↔ 详情）
  - 实现顶部导航栏（返回画布、标题、发布按钮）
  - 集成 ForumContext Provider
  - 实现路由状态管理（使用 URL hash 或状态）
  - _需求: 1, 2_

- [x] 11. 集成到主应用
  - 修改 `client/App.tsx` 添加论坛入口
  - 在工具栏添加"问题广场"按钮
  - 实现视图切换逻辑（画布 ↔ 论坛）
  - 传递 editor 实例到 ForumView
  - 测试视图切换流程
  - _需求: 1, 2, 4_

- [x] 12. 实现画布导入功能
  - 在 `client/forum/utils/canvas.ts` 实现 `importCanvasSnapshot` 函数
  - 实现替换模式（清空当前画布）
  - 实现确认对话框逻辑
  - 实现导入后自动缩放到合适视图
  - 测试导入功能与现有画布的兼容性
  - _需求: 4_

- [x] 13. 实现点赞功能
  - 在 `client/forum/components/QuestionCard.tsx` 添加点赞按钮
  - 在 `client/forum/components/QuestionDetail.tsx` 添加点赞按钮
  - 在 `client/forum/components/ReplyItem.tsx` 添加点赞按钮
  - 实现点赞状态本地存储和同步
  - 实现点赞动画效果
  - 测试点赞计数更新
  - _需求: 5_

- [x] 14. 添加样式和响应式设计
  - 创建 `client/forum/forum.css` 样式文件
  - 实现卡片样式（边框、阴影、悬停效果）
  - 实现布局样式（网格、间距、对齐）
  - 实现响应式设计（移动端适配）
  - 实现加载动画和过渡效果
  - 确保与现有 tldraw 样式一致
  - _需求: 1, 2, 3_

- [x] 15. 错误处理和用户反馈
  - 实现 Toast 通知组件（成功、错误、警告）
  - 在所有 API 调用中添加错误处理
  - 实现网络错误重试逻辑
  - 实现加载状态指示器
  - 实现表单验证错误提示
  - 测试各种错误场景
  - _需求: 2, 3, 7_

- [x] 16. 性能优化
  - 实现问题列表虚拟滚动（可选，如果列表很长）
  - 实现图片懒加载（流程缩略图）
  - 优化搜索防抖时间
  - 添加数据缓存逻辑（内存缓存已加载的问题）
  - 优化画布快照生成性能
  - 进行性能测试和优化
  - _需求: 1, 8_

- [x] 17. 配置和部署
  - 更新 `wrangler.toml` 添加 Durable Object 配置
  - 创建数据库迁移脚本（如果需要）
  - 更新 README 添加论坛功能说明
  - 测试本地开发环境
  - 测试生产部署流程
  - _需求: 7_

- [x] 18. 端到端测试
  - 测试完整的发布问题流程
  - 测试完整的查看和回复流程
  - 测试画布导入流程
  - 测试搜索功能
  - 测试点赞功能
  - 测试错误处理和边界情况
  - 进行用户验收测试
  - _需求: 1, 2, 3, 4, 5, 6, 7, 8_
