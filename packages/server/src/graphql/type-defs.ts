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
    kbId: ID!
    status: String!
    taskType: String!
    error: String
    updatedAt: String!
    lastEventId: ID!
  }

  type KnowledgeBase {
    id: ID!
    name: String!
    status: String!
    createdAt: String!
    updatedAt: String!
    publishedAt: String
  }

  type KbTask {
    id: ID!
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

  type Query {
    workspaceGraph(workspaceId: ID!): CanvasGraph!
    conversation(id: ID!): StartConversationPayload
    kbTaskStatus(kbId: ID!): [KbTaskStatus!]!
    knowledgeBases: [KnowledgeBase!]!
    knowledgeBaseStatus(kbId: ID!): KnowledgeBaseStatus!
  }

  type Mutation {
    startConversation(workspaceId: ID!, question: String!): StartConversationPayload!
    approveDecision(conversationId: ID!, decision: String): Boolean!
    addNode(workspaceId: ID!, input: NodeInput!): CanvasNode!
    connectNodes(workspaceId: ID!, input: EdgeInput!): CanvasEdge!
    createKnowledgeBase: KnowledgeBase!
    publishKnowledgeBase(kbId: ID!): KnowledgeBase!
    addKnowledgeSeed(kbId: ID!, text: String!): KbTask!
    importKnowledgeUrl(kbId: ID!, url: String!): KbTask!
  }

  type Subscription {
    conversationProgress: ConversationEvent!
  }
`
