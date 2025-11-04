import { gql } from 'graphql-tag';
export const typeDefs = gql `
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

  type StartConversationPayload {
    metadata: ConversationMetadata!
    graph: CanvasGraph!
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
  }

  type Mutation {
    startConversation(workspaceId: ID!, question: String!): StartConversationPayload!
    addNode(workspaceId: ID!, input: NodeInput!): CanvasNode!
    connectNodes(workspaceId: ID!, input: EdgeInput!): CanvasEdge!
  }

  type Subscription {
    conversationProgress: ConversationEvent!
  }
`;
