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
    """
    Session lifecycle status:
      - running: stream actively producing output (heartbeat fresh)
      - completed: stream finished normally
      - failed: stream errored or was reaped (see failureReason)
      - archived: user removed from active list
    """
    status: String!
    latestQuestion: String
    contextSnapshot: JSON!
    createdAt: String!
    updatedAt: String!
    completedAt: String
    """
    Last time the gateway running this session updated its heartbeat.
    NULL on freshly created sessions until the first 30s tick fires.
    Used by clients to surface "⚠ may have lost connection" when
    status='running' but heartbeat is stale.
    """
    heartbeatAt: String
    """
    PID of the gateway that owns this session. Useful for debugging
    cross-process crashes — when set but heartbeatAt is stale, the
    owning process likely died.
    """
    ownerPid: String
    """
    Populated by the reaper when status was forced to 'failed'.
    Examples: "heartbeat-lost (last 92s ago)", "no-heartbeat (created 75s ago)".
    """
    failureReason: String
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

  """
  P2 · A single citation reference reverse-looked-up from a memory
  item's metadata.knowledgeEvidence array. Lets the frontend show
  "AI cited THIS KB chunk in THIS memory at THIS time".
  """
  type KnowledgeEvidenceRef {
    memoryItemId: ID!
    workspaceId: ID!
    docId: String!
    snippet: String
    score: Float
    citedAt: String!
    """
    Title of the source memory item — usually a session summary like
    "Workspace insight 2026-05-05 14:30". Helps users recognise the
    conversation that produced this citation.
    """
    sourceTitle: String!
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
    """
    F1 · Owner user id. NULL for legacy KBs created before per-user
    visibility was wired (such rows behave as workspace-shared).
    """
    ownerUserId: ID
    """
    F1 · Access scope:
      - 'private'   only the owner can search this KB
      - 'workspace' any workspace member can search (default)
      - 'global'    every authenticated user across all workspaces
    """
    visibility: String!
  }

  type KbDocument {
    id: ID!
    workspaceId: ID!
    kbId: ID!
    title: String!
    contentType: String!
    sourceUrl: String
    """ Full original content (may be large — clients should decide whether to fetch). """
    content: String
    metadata: JSON!
    createdAt: String!
    updatedAt: String!
  }

  type KbDocument {
    id: ID!
    workspaceId: ID!
    kbId: ID!
    title: String!
    contentType: String!
    sourceUrl: String
    metadata: JSON!
    createdAt: String!
    updatedAt: String!
    """
    F7 · Character length of the stored prose (NOT the original
    binary file size — that's in metadata.originalSizeBytes when
    the document came from a PDF/DOCX/XLSX upload).
    """
    sizeChars: Int!
  }

  type KbAgentBinding {
    id: ID!
    workspaceId: ID!
    kbId: ID!
    agentId: String!
    boundByUserId: ID!
    createdAt: String!
    """
    When true, the agent auto-searches this KB on every invocation
    (top-3 chunks per query). When false, the binding is "available"
    but the agent only pulls when explicitly directed by a tool call.
    """
    autoSearch: Boolean!
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

  input CorrectMemoryItemInput {
    itemId: ID!
    """
    New content for the memory row. If null + archive=false, the
    mutation is a no-op (returns row unchanged).
    """
    newContent: String
    """
    Soft-delete the row. Future extractor runs will see this and
    decay confidence on similar rows.
    """
    archive: Boolean
    """
    Optional explanation from the user — stored in metadata.userFeedback
    for the next user-skill-extractor LLM pass. e.g. "I'm not actually
    a B2B PM, I do consumer apps."
    """
    feedback: String
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
    """
    P2 · Memory UI · user-scoped memory list. Returns ONLY rows owned by
    the authenticated caller (ctx.userId). Use this in front-end memory
    drawer; workspaceMemories above is workspace-scoped and may include
    other members' rows.

    Args:
      - workspaceId: optional. Omit to get cross-workspace personal
        memory (e.g. global user-skill rows with scope='user').
      - kind: filter by 'user-skill' / 'summary' / etc.
      - query: substring match against title + content
      - limit: 1-200, default 50
    """
    myMemories(workspaceId: ID, kind: String, query: String, limit: Int): [MemoryItem!]!

    """
    P2 · Memory UI · KB evidence reverse-lookup. For the authenticated
    user, returns "where in my conversations did the AI cite which KB
    chunks". Built by scanning memory_items.metadata.knowledgeEvidence
    JSONB written by writeConversationSummary when KB chunks were used
    during the stream.
    """
    myKnowledgeEvidence(workspaceId: ID, limit: Int): [KnowledgeEvidenceRef!]!

    """
    F6 · GDPR / PIPL data portability. Returns the entire user-owned
    data set as a JSON blob:
      - all conversation_sessions / conversation_messages
      - all memory_items (including archived for full audit)
      - all kb_definitions + kb_documents the user owns

    Excludes: embedding vectors (regeneratable from chunk content),
    other users' data even when shared in the same workspace.

    Auth: caller userId is enforced server-side; cannot export
    another user's data.

    Schema is versioned (current: schemaVersion=1). Frontend serves
    this as a downloadable .json file via the Memory drawer.
    """
    exportMyData: JSON!
    workspaceContextSnapshot(workspaceId: ID!, conversationId: ID, query: String!, kbId: ID): WorkspaceContextSnapshot!
    kbTaskStatus(workspaceId: ID!, kbId: ID!): [KbTaskStatus!]!
    knowledgeBases(workspaceId: ID!): [KnowledgeBase!]!
    """
    F4 · List agents bound to a specific KB in a workspace. UI uses
    this to show "this KB is wired to N agents" + bind/unbind buttons.
    """
    knowledgeBaseAgentBindings(workspaceId: ID!, kbId: ID!): [KbAgentBinding!]!
    """
    F7 · List documents inside a KB. Returns metadata + size hints
    for the UI list (does NOT return full content — clients fetch
    individual docs as needed). Documents inherit the KB's visibility
    so workspace.read is sufficient authorization.
    """
    knowledgeBaseDocuments(workspaceId: ID!, kbId: ID!): [KbDocument!]!
    """
    F7 · List documents in a KB. Used by the KB management UI to show
    what's been ingested and offer per-document delete. Content is
    omitted from the list (call kbDocument(id) for full content).
    """
    kbDocuments(workspaceId: ID!, kbId: ID!): [KbDocument!]!
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

  # ── Agent Mention System (2026-05-04) ─────────────────────────────────
  input MentionAgentInput {
    workspaceId: ID!
    conversationId: ID
    agentId: String!
    message: String!
  }

  type MentionAgentPayload {
    agentId: String!
    reply: String!
    refused: Boolean!
    refusalReason: String
    appendedNodes: [CanvasNode!]!
    appendedEdges: [CanvasEdge!]!
  }

  type Mutation {
    startConversation(workspaceId: ID!, question: String!, kbId: ID): StartConversationPayload!
    approveDecision(conversationId: ID!, decision: String): Boolean!
    # Phase 2.5 F5 · HITL resume; decision must begin with [ACCEPTED] or [EDIT_PLAN]:...
    resumeConversation(conversationId: ID!, decision: String!): ResumeConversationPayload!
    appendConversationMessage(input: AppendConversationMessageInput!): ConversationMessage!
    createMemoryItem(input: CreateMemoryItemInput!): MemoryItem!
    extractConversationMemory(conversationId: ID!): [MemoryItem!]!

    """
    P3 · Demand-mode user-skill extraction. Forces the
    UserSkillExtractor to run immediately for the calling user,
    bypassing throttle and tier selection. Used by the Memory drawer
    "立即更新画像" button.

    Returns the count of changes applied (creates + updates + refines
    + decays + cross-workspace promotes). 0 means no new traits
    detected from recent conversations.

    Workspace-id is required so the extractor knows which workspace
    to record any new scope='workspace' rows in (cross-workspace
    promotion happens automatically afterwards).
    """
    refreshUserSkills(workspaceId: ID!): Int!

    """
    P2 · Memory UI · user-driven correction of an inferred memory row.
    Three actions:
      - newContent != null  → update content (and refresh updatedAt);
                              extractor will treat the row as user-corrected
                              and not auto-decay it next round
      - archive == true     → soft-delete (archived_at = now()); user-skill
                              extractor downgrades confidence on related
                              rows in next pass
      - feedback            → reinforcement signal stored in metadata for
                              the user-skill-extractor LLM ("user said
                              this trait was wrong because ...")

    Authorization: caller must own the memory row (userId match enforced
    server-side). Returns the updated row, or throws FORBIDDEN.
    """
    correctMemoryItem(input: CorrectMemoryItemInput!): MemoryItem!
    addNode(workspaceId: ID!, input: NodeInput!): CanvasNode!
    connectNodes(workspaceId: ID!, input: EdgeInput!): CanvasEdge!
    """
    Create a new KB. F1 · Visibility defaults to 'workspace' (shared
    with all workspace members). Pass 'private' for personal documents
    only the caller should see, 'global' for curated cross-workspace
    knowledge (admin-only by convention).
    """
    createKnowledgeBase(workspaceId: ID!, name: String, visibility: String): KnowledgeBase!
    publishKnowledgeBase(workspaceId: ID!, kbId: ID!): KnowledgeBase!
    """
    F1 · Change a KB's visibility. Only the KB owner may invoke this.
    Cascades the new visibility into kb_chunks so vector search RLS
    + WHERE filters stay aligned.
    """
    updateKnowledgeBaseVisibility(kbId: ID!, visibility: String!): KnowledgeBase!

    """
    F4 · Bind a KB to an agent so the agent auto-searches it on every
    invocation. Idempotent: re-binding the same (workspace, kb, agent)
    triple just updates auto_search.

    Authorization: caller needs workspace.write; for 'private' KBs
    additionally must be the KB owner. Returns the binding row.
    """
    bindKbToAgent(
      workspaceId: ID!
      kbId: ID!
      agentId: String!
      autoSearch: Boolean
    ): KbAgentBinding!

    """
    F4 · Remove a KB ↔ agent binding. Returns true when a row was
    deleted, false when the binding didn't exist (no-op).
    """
    unbindKbFromAgent(
      workspaceId: ID!
      kbId: ID!
      agentId: String!
    ): Boolean!

    """
    F7 · Delete a single document from a KB. Cascades to its chunks
    via kb_chunks.doc_id ON DELETE CASCADE. Authorization: caller
    needs workspace.write AND must be the KB owner for 'private' KBs
    (workspace + global KBs only require workspace.write).
    Returns true when a row was removed.
    """
    deleteKnowledgeBaseDocument(
      workspaceId: ID!
      kbId: ID!
      docId: ID!
    ): Boolean!
    """
    F7 · Delete a document from a KB. Cascades to all chunks of that
    document via FK ON DELETE CASCADE. Authorization: caller must have
    workspace.write AND own the KB (for private) or own the document.
    Returns true when deleted, false when not found.
    """
    deleteKbDocument(workspaceId: ID!, kbId: ID!, docId: ID!): Boolean!
    addKnowledgeSeed(workspaceId: ID!, kbId: ID!, text: String!): KbTask!
    importKnowledgeUrl(workspaceId: ID!, kbId: ID!, url: String!): KbTask!
    """
    F4 · In-process file import. Replaces the broken kb-proxy route that
    expected an external task service at port 4001.

    Two transport modes:
      - text mode (isBase64=false): content is UTF-8 string. Used for
        text/plain, text/markdown, text/html, application/json.
      - binary mode (isBase64=true): content is base64-encoded bytes.
        Used for application/pdf,
        application/vnd.openxmlformats-officedocument.wordprocessingml.document
        (DOCX), application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
        (XLSX).

    The server decodes base64 → Buffer → routes through the matching
    binary extractor (pdf-parse / mammoth / xlsx). Chunking + embedding
    + visibility + agent-binding all propagate identically.

    Frontend should:
      - Use FileReader.readAsText for text formats (smaller payload)
      - Use FileReader.readAsArrayBuffer + btoa for binary formats
    """
    addKnowledgeFile(
      workspaceId: ID!
      kbId: ID!
      fileName: String!
      contentType: String!
      content: String!
      """When true, content is base64-encoded bytes. Default false."""
      isBase64: Boolean
    ): KbTask!
    saveCommunityPost(input: CommunityPostInput!): WorkspaceAsset!
    savePracticeSession(input: SavePracticeSessionInput!): WorkspaceAsset!
    updateWorkspaceMetadata(input: UpdateWorkspaceMetadataInput!): WorkspaceDirectoryItem!
    # @-mention: invoke a specific agent for a single-shot response.
    # Routes via callability class to BMC generators / advisors / debate path.
    mentionAgent(input: MentionAgentInput!): MentionAgentPayload!
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
    """
    Optional. When provided, the resolver fetches the user's durable
    user-skill memories scoped to (userId, workspaceId) and renders them
    into the coach prompt as a "## 用户长期画像" block. Empty/missing →
    no block (current behaviour preserved).
    """
    workspaceId: ID
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
    """
    Optional. Same semantics as ReflectOnIdeationInput.workspaceId — when
    set, the resolver injects the user-skill block into the wizard prompt.
    """
    workspaceId: ID
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

    """
    Cancel a stale 'running' conversation session. Used by the frontend
    when a user sees a session marked as stale (heartbeat lost) and
    wants to clear it from the active list so they can start a new one
    in the same workspace. The session's status is set to 'failed'
    with a user-supplied or default reason.

    Authorization: caller must own the session (userId match enforced).
    Returns the updated session, or null if not found / not owned.
    """
    cancelStaleSession(sessionId: ID!, reason: String): ConversationSession
  }
`
