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
    """
    List runtime events for a workspace (optionally filtered by conversation).

    sinceCursor is a 1-based event-index returned by a previous backfill (the index of
    the last event the client has already seen). Pass it on reconnect to get only events
    emitted after that index — combined with the live conversationProgress subscription
    this gives gap-free delivery across WS disconnects. Omit (or pass 0) for full backfill.
    """
    conversationRuntimeEvents(workspaceId: ID!, conversationId: ID, sinceCursor: Int): [ConversationEvent!]!
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

  # Phase 2.5 F5 · HITL resume payload.
  type ResumeConversationPayload {
    ok: Boolean!
    decisionKind: String!
    message: String
  }

  type Mutation {
    startConversation(workspaceId: ID!, question: String!, kbId: ID): StartConversationPayload!
    approveDecision(conversationId: ID!, decision: String): Boolean!
    # Phase 2.5 F5 · HITL resume; decision must begin with [ACCEPTED] or [EDIT_PLAN]:...
    resumeConversation(conversationId: ID!, decision: String!): ResumeConversationPayload!
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

  # ─── Ideation Coach (Wave F.6 + F.7) ─────────────────────────────────
  # GraphQL surface for the Meflex-style scaffolded coach. Mirrors the
  # existing Next.js REST routes at /api/ideation/{reflect,wizard-step}
  # with the same shared prompt + schema (see packages/shared/src/
  # ideation-coach/). Frontend can pick whichever surface; both call
  # the same DeepSeek prompts under the hood.

  enum IdeationScaffoldKind {
    why
    how
    so_what
    evidence_needed
    meta
  }

  enum IdeationSourceKind {
    llm
    scripted
    error
  }

  input IdeationCanvasNodeInput {
    id: ID!
    kind: String!
    label: String!
    content: String!
  }

  input IdeationCanvasInput {
    nodes: [IdeationCanvasNodeInput!]!
    edgeCount: Int!
    nodeCountByKind: JSON!
  }

  input IdeationChatTurnInput {
    role: String!  # 'ai' | 'user'
    content: String!
  }

  input ReflectOnIdeationEventInput {
    type: String!  # 'node-added' | 'node-linked' | 'meta-check'
    kind: String
    label: String
    fromKind: String
    toKind: String
  }

  input ReflectOnIdeationInput {
    event: ReflectOnIdeationEventInput!
    canvas: IdeationCanvasInput!
    recentChat: [IdeationChatTurnInput!]!
    firedMetaIds: [String!]!
  }

  type IdeationReflection {
    scaffold: IdeationScaffoldKind!
    content: String!
    source: IdeationSourceKind!
    latencyMs: Int
  }

  input IdeationWizardCanvasInput {
    nodes: [IdeationCanvasNodeInput!]!
    edgeCount: Int!
  }

  input ProcessIdeationWizardStepInput {
    step: String!  # one of WIZARD_STEP_ORDER ids
    userAnswer: String!
    canvas: IdeationWizardCanvasInput!
    recentChat: [IdeationChatTurnInput!]!
  }

  type IdeationWizardExtractedNode {
    kind: String!
    label: String!
    content: String!
  }

  type IdeationWizardStepResult {
    extracted: IdeationWizardExtractedNode!
    nextQuestion: String!
    nextStep: String!
    source: IdeationSourceKind!
    latencyMs: Int
  }

  extend type Mutation {
    """
    Generate one Meflex-style reflection prompt against the current
    Ideation canvas snapshot. Mirrors POST /api/ideation/reflect.
    Falls back to a scripted reflection on LLM failure (source returned
    in the response so the client can label the bubble accordingly).
    """
    reflectOnIdeation(input: ReflectOnIdeationInput!): IdeationReflection!

    """
    Process one wizard-step answer: extracts a structured node from
    the user's free-text answer + generates the next contextual question.
    Mirrors POST /api/ideation/wizard-step.
    """
    processIdeationWizardStep(
      input: ProcessIdeationWizardStepInput!
    ): IdeationWizardStepResult!
  }
`
