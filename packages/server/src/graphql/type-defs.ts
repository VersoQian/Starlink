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

  type StartConversationPayload {
    metadata: ConversationMetadata!
    graph: CanvasGraph!
    knowledgeEvidence: [KnowledgeEvidence!]!
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
    kbTaskStatus(workspaceId: ID!, kbId: ID!): [KbTaskStatus!]!
    knowledgeBases(workspaceId: ID!): [KnowledgeBase!]!
    knowledgeBaseStatus(workspaceId: ID!, kbId: ID!): KnowledgeBaseStatus!
    workspaces: [WorkspaceDirectoryItem!]!
    workspaceAssets(workspaceId: ID!): [WorkspaceAsset!]!
    workspaceMetadataHistory(workspaceId: ID!): [WorkspaceMetadataHistoryEntry!]!
  }

  type Mutation {
    startConversation(workspaceId: ID!, question: String!): StartConversationPayload!
    approveDecision(conversationId: ID!, decision: String): Boolean!
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

  type Subscription {
    conversationProgress: ConversationEvent!
  }
`
