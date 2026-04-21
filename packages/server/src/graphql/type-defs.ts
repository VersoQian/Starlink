import { gql } from 'graphql-tag'

export const typeDefs = gql`
  scalar JSON

  type CanvasPosition {
    x: Float!
    y: Float!
  }

  type CanvasNode {
    id: ID!
    type: String!
    position: CanvasPosition!
    data: JSON!
  }

  type CanvasEdge {
    id: ID!
    source: ID!
    target: ID!
    label: String
  }

  type CanvasGraph {
    workspaceId: ID!
    nodes: [CanvasNode!]!
    edges: [CanvasEdge!]!
  }

  type ConversationMetadata {
    id: ID!
    status: String!
    createdAt: String!
    updatedAt: String!
    latestQuestion: String
  }

  type ConversationEvent {
    type: String!
    conversationId: ID!
    status: String
    message: String
    payload: JSON
  }

  type KnowledgeEvidence {
    docId: ID!
    snippet: String!
    score: Float!
    metadata: JSON
  }

  type EvidenceRef {
    evidenceId: ID!
    docId: ID!
    snippetId: String!
  }

  type CitationSpan {
    textStart: Int!
    textEnd: Int!
    refs: [EvidenceRef!]!
  }

  type CardCitation {
    cardId: ID!
    fieldName: String!
    spans: [CitationSpan!]!
  }

  type StartConversationPayload {
    metadata: ConversationMetadata!
    graph: CanvasGraph!
    knowledgeEvidence: [KnowledgeEvidence!]!
    citations: [CardCitation!]!
  }

  type ConversationSession {
    id: ID!
    workspaceId: ID!
    userId: ID!
    title: String!
    status: String!
    latestQuestion: String
    contextSnapshot: JSON!
    createdAt: String!
    updatedAt: String!
    completedAt: String
  }

  type ConversationMessage {
    id: ID!
    conversationId: ID!
    workspaceId: ID!
    userId: ID
    role: String!
    content: String!
    metadata: JSON!
    createdAt: String!
  }

  type MemoryItem {
    id: ID!
    workspaceId: ID!
    userId: ID
    scope: String!
    kind: String!
    title: String!
    content: String!
    sourceType: String!
    sourceId: String
    importance: Float!
    confidence: Float!
    tags: [String!]!
    metadata: JSON!
    createdAt: String!
    updatedAt: String!
    lastUsedAt: String
    archivedAt: String
  }

  type CanvasContextSummary {
    nodeCount: Int!
    edgeCount: Int!
    highlights: [String!]!
  }

  type WorkspaceContextSnapshot {
    workspaceId: ID!
    conversationId: ID
    query: String!
    builtAt: String!
    canvasSummary: CanvasContextSummary!
    recentMessages: [ConversationMessage!]!
    memories: [MemoryItem!]!
    knowledgeEvidence: [KnowledgeEvidence!]!
    promptBlock: String!
  }

  type KbTaskStatus {
    taskId: ID!
    workspaceId: ID!
    kbId: ID!
    status: String!
    taskType: String!
    error: String
    updatedAt: String!
    lastEventId: ID!
  }

  type KnowledgeBase {
    id: ID!
    workspaceId: ID!
    name: String!
    status: String!
    createdAt: String!
    updatedAt: String!
    publishedAt: String
  }

  type KbTask {
    id: ID!
    workspaceId: ID!
    kbId: ID!
    type: String!
    status: String!
    payload: JSON!
    error: String
    createdAt: String!
    updatedAt: String!
  }

  type KnowledgeBaseStatus {
    knowledgeBase: KnowledgeBase!
    tasks: [KbTask!]!
  }

  type WorkspaceDirectoryItem {
    workspaceId: ID!
    name: String!
    type: String!
    focus: String!
    ownerId: ID!
    ownerName: String!
    members: [WorkspaceMember!]!
    viewerPermissions: [String!]!
    canManage: Boolean!
    status: String!
    updatedAt: String!
  }

  type WorkspaceMember {
    id: ID!
    name: String!
    role: String
    permissions: [String!]!
  }

  type WorkspaceMetadataHistoryEntry {
    historyId: ID!
    workspaceId: ID!
    changedBy: String!
    changedAt: String!
    summary: String!
    version: Int!
  }

  type WorkspaceAsset {
    assetId: ID!
    workspaceId: ID!
    assetType: String!
    title: String!
    sourceModule: String!
    sourceTaskId: String
    metadata: JSON!
    content: JSON!
    version: Int!
    status: String!
    createdBy: String!
    createdAt: String!
    updatedAt: String!
  }

  input CanvasPositionInput {
    x: Float!
    y: Float!
  }

  input NodeInput {
    id: ID
    type: String!
    position: CanvasPositionInput!
    data: JSON!
  }

  input EdgeInput {
    id: ID
    source: ID!
    target: ID!
    label: String
  }

  input AppendConversationMessageInput {
    conversationId: ID!
    workspaceId: ID!
    role: String!
    content: String!
    metadata: JSON
  }

  input CreateMemoryItemInput {
    workspaceId: ID!
    scope: String
    kind: String
    title: String!
    content: String!
    sourceType: String
    sourceId: String
    importance: Float
    confidence: Float
    tags: [String!]
    metadata: JSON
  }

  input CommunityPostInput {
    workspaceId: ID!
    title: String!
    body: String!
    tags: [String!]!
    authorName: String!
    authorRole: String
  }

  input PracticeMessageInput {
    id: ID!
    role: String!
    content: String!
    timestamp: Float!
    feedback: String
  }

  input PracticeInsightInput {
    title: String!
    detail: String!
  }

  input PracticeResourceInput {
    title: String!
    url: String
  }

  input WorkspaceMemberInput {
    id: ID!
    name: String!
    role: String
    permissions: [String!]!
  }

  input SavePracticeSessionInput {
    workspaceId: ID!
    scenarioId: ID!
    scenarioTitle: String
    messages: [PracticeMessageInput!]!
    insights: [PracticeInsightInput!]!
    resources: [PracticeResourceInput!]!
    quickReplies: [String!]!
    lastUpdated: String
  }

  input UpdateWorkspaceMetadataInput {
    workspaceId: ID!
    name: String!
    type: String!
    focus: String!
    ownerId: ID!
    ownerName: String!
    members: [WorkspaceMemberInput!]!
  }

  type Query {
    workspaceGraph(workspaceId: ID!): CanvasGraph!
    conversation(id: ID!): StartConversationPayload
    conversationSessions(workspaceId: ID!, limit: Int): [ConversationSession!]!
    conversationMessages(workspaceId: ID!, conversationId: ID!, limit: Int): [ConversationMessage!]!
    conversationRuntimeEvents(workspaceId: ID!, conversationId: ID): [ConversationEvent!]!
    cardsReferencingEvidence(conversationId: ID!, evidenceId: ID!): [ID!]!
    workspaceMemories(workspaceId: ID!, query: String, scope: String, kind: String, limit: Int): [MemoryItem!]!
    workspaceContextSnapshot(workspaceId: ID!, conversationId: ID, query: String!, kbId: ID): WorkspaceContextSnapshot!
    kbTaskStatus(workspaceId: ID!, kbId: ID!): [KbTaskStatus!]!
    knowledgeBases(workspaceId: ID!): [KnowledgeBase!]!
    knowledgeBaseStatus(workspaceId: ID!, kbId: ID!): KnowledgeBaseStatus!
    knowledgeBaseSearch(workspaceId: ID!, kbId: ID!, query: String!, topK: Int): [KnowledgeEvidence!]!
    workspaces: [WorkspaceDirectoryItem!]!
    workspaceAssets(workspaceId: ID!): [WorkspaceAsset!]!
    workspaceMetadataHistory(workspaceId: ID!): [WorkspaceMetadataHistoryEntry!]!
  }

  type Mutation {
    startConversation(workspaceId: ID!, question: String!, kbId: ID): StartConversationPayload!
    approveDecision(conversationId: ID!, decision: String): Boolean!
    appendConversationMessage(input: AppendConversationMessageInput!): ConversationMessage!
    createMemoryItem(input: CreateMemoryItemInput!): MemoryItem!
    extractConversationMemory(conversationId: ID!): [MemoryItem!]!
    addNode(workspaceId: ID!, input: NodeInput!): CanvasNode!
    connectNodes(workspaceId: ID!, input: EdgeInput!): CanvasEdge!
    createKnowledgeBase(workspaceId: ID!): KnowledgeBase!
    publishKnowledgeBase(workspaceId: ID!, kbId: ID!): KnowledgeBase!
    addKnowledgeSeed(workspaceId: ID!, kbId: ID!, text: String!): KbTask!
    importKnowledgeUrl(workspaceId: ID!, kbId: ID!, url: String!): KbTask!
    saveCommunityPost(input: CommunityPostInput!): WorkspaceAsset!
    savePracticeSession(input: SavePracticeSessionInput!): WorkspaceAsset!
    updateWorkspaceMetadata(input: UpdateWorkspaceMetadataInput!): WorkspaceDirectoryItem!
  }

  # ── Flow / Tool Registry Types ──────────────────────────

  type ToolRuntimeConfig {
    timeout: Int!
    retries: Int!
    cacheable: Boolean!
    streamable: Boolean!
    parallel: Boolean!
  }

  type ToolPort {
    name: String!
    type: String!
    description: String!
    required: Boolean
  }

  type ToolDef {
    name: String!
    label: String!
    description: String!
    category: String!
    icon: String!
    color: String!
    inputSchema: JSON!
    outputSchema: JSON!
    inputPorts: [ToolPort!]!
    outputPorts: [ToolPort!]!
    runtime: ToolRuntimeConfig!
  }

  type Flow {
    id: ID!
    workspaceId: ID!
    name: String!
    description: String
    definition: JSON!
    isTemplate: Boolean!
    version: Int!
    createdAt: String!
    updatedAt: String!
  }

  type FlowExecution {
    id: ID!
    flowId: ID!
    status: String!
    inputs: JSON
    state: JSON
    error: String
    startedAt: String!
    completedAt: String
    nodeStates: [FlowNodeState!]!
  }

  type FlowNodeState {
    nodeId: String!
    status: String!
    output: JSON
    error: String
    duration: Int
  }

  type FlowExecutionEvent {
    executionId: ID!
    type: String!
    nodeId: String
    nodeIds: [String!]
    toolName: String
    percent: Float
    message: String
    output: JSON
    error: String
    duration: Int
    finalState: JSON
  }

  extend type Query {
    availableTools: [ToolDef!]!
    toolByName(name: String!): ToolDef
    flows(workspaceId: ID!): [Flow!]!
    flow(id: ID!): Flow
    flowTemplates: [Flow!]!
    flowExecution(id: ID!): FlowExecution
    flowExecutions(flowId: ID!): [FlowExecution!]!
  }

  extend type Mutation {
    createFlow(workspaceId: ID!, name: String!, definition: JSON!): Flow!
    updateFlow(id: ID!, name: String, definition: JSON): Flow!
    deleteFlow(id: ID!): Boolean!
    saveAsTemplate(flowId: ID!, name: String!): Flow!
    executeFlow(flowId: ID!, inputs: JSON): FlowExecution!
    cancelExecution(executionId: ID!): Boolean!
  }

  type Subscription {
    conversationProgress(workspaceId: ID!, conversationId: ID): ConversationEvent!
    flowExecutionProgress(executionId: ID!): FlowExecutionEvent!
  }
`
