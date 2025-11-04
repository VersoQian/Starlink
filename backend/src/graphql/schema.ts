import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLList,
  GraphQLFloat,
  GraphQLString,
  GraphQLInputObjectType
} from 'graphql'
import GraphQLJSON from 'graphql-type-json'
import {
  CanvasService,
  CanvasAnalysis,
  type CanvasNode,
  type CanvasEdge,
  type CanvasNodeData,
  type AnalysisResult
} from '../services/CanvasService'

const PositionType = new GraphQLObjectType({
  name: 'Position',
  fields: {
    x: { type: new GraphQLNonNull(GraphQLFloat) },
    y: { type: new GraphQLNonNull(GraphQLFloat) }
  }
})

const CanvasNodeType = new GraphQLObjectType<CanvasNode>({
  name: 'CanvasNode',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    position: { type: new GraphQLNonNull(PositionType) },
    data: { type: new GraphQLNonNull(GraphQLJSON) }
  }
})

const CanvasEdgeType = new GraphQLObjectType<CanvasEdge>({
  name: 'CanvasEdge',
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    source: { type: new GraphQLNonNull(GraphQLID) },
    target: { type: new GraphQLNonNull(GraphQLID) },
    label: { type: GraphQLString }
  }
})

const WorkspaceGraphType = new GraphQLObjectType({
  name: 'WorkspaceGraph',
  fields: {
    workspaceId: { type: new GraphQLNonNull(GraphQLID) },
    nodes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CanvasNodeType))) },
    edges: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(CanvasEdgeType))) }
  }
})

const PositionInputType = new GraphQLInputObjectType({
  name: 'PositionInput',
  fields: {
    x: { type: new GraphQLNonNull(GraphQLFloat) },
    y: { type: new GraphQLNonNull(GraphQLFloat) }
  }
})

const NodeInputType = new GraphQLInputObjectType({
  name: 'NodeInput',
  fields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    position: { type: new GraphQLNonNull(PositionInputType) },
    data: { type: new GraphQLNonNull(GraphQLJSON) }
  }
})

const EdgeInputType = new GraphQLInputObjectType({
  name: 'EdgeInput',
  fields: {
    source: { type: new GraphQLNonNull(GraphQLID) },
    target: { type: new GraphQLNonNull(GraphQLID) },
    label: { type: GraphQLString }
  }
})

const AnalysisSubQuestionType = new GraphQLObjectType({
  name: 'AnalysisSubQuestion',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    prompt: { type: new GraphQLNonNull(GraphQLString) }
  }
})

const AnalysisDimensionType = new GraphQLObjectType({
  name: 'AnalysisDimension',
  fields: {
    label: { type: new GraphQLNonNull(GraphQLString) },
    insight: { type: new GraphQLNonNull(GraphQLString) }
  }
})

const AnalysisActionItemType = new GraphQLObjectType({
  name: 'AnalysisActionItem',
  fields: {
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    suggestedOwner: { type: GraphQLString }
  }
})

const AnalysisResultType = new GraphQLObjectType<AnalysisResult>({
  name: 'AnalysisResult',
  fields: {
    question: { type: new GraphQLNonNull(GraphQLString) },
    summary: { type: new GraphQLNonNull(GraphQLString) },
    subQuestions: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AnalysisSubQuestionType))) },
    dimensions: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AnalysisDimensionType))) },
    actionItems: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(AnalysisActionItemType))) }
  }
})

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      workspaceGraph: {
        type: new GraphQLNonNull(WorkspaceGraphType),
        args: {
          workspaceId: { type: new GraphQLNonNull(GraphQLID) }
        },
        resolve: (_root, args: { workspaceId: string }) => {
          return CanvasService.getGraph(args.workspaceId)
        }
      }
    }
  }),
  mutation: new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      addNode: {
        type: new GraphQLNonNull(CanvasNodeType),
        args: {
          workspaceId: { type: new GraphQLNonNull(GraphQLID) },
          input: { type: new GraphQLNonNull(NodeInputType) }
        },
        resolve: (_root, args: { workspaceId: string; input: { type: string; position: { x: number; y: number }; data: CanvasNodeData } }) => {
          const { workspaceId, input } = args
          return CanvasService.addNode(workspaceId, {
            type: input.type as CanvasNode['type'],
            position: input.position,
            data: input.data
          })
        }
      },
      connectNodes: {
        type: new GraphQLNonNull(CanvasEdgeType),
        args: {
          workspaceId: { type: new GraphQLNonNull(GraphQLID) },
          input: { type: new GraphQLNonNull(EdgeInputType) }
        },
        resolve: (_root, args: { workspaceId: string; input: { source: string; target: string; label?: string | null } }) => {
          const { workspaceId, input } = args
          return CanvasService.addEdge(workspaceId, {
            source: input.source,
            target: input.target,
            label: input.label ?? null
          })
        }
      },
      analyzeQuestion: {
        type: new GraphQLNonNull(AnalysisResultType),
        args: {
          workspaceId: { type: new GraphQLNonNull(GraphQLID) },
          question: { type: new GraphQLNonNull(GraphQLString) }
        },
        resolve: (_root, args: { workspaceId: string; question: string }) => {
          return CanvasAnalysis.run(args.workspaceId, args.question)
        }
      }
    }
  })
})
