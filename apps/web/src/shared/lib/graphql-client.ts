import { GraphQLClient } from 'graphql-request'

let client: GraphQLClient | null = null
const DEFAULT_GRAPHQL_URL = 'http://localhost:4000/graphql'

export function getGraphQLHttpUrl() {
  return process.env.NEXT_PUBLIC_GRAPHQL_URL ?? DEFAULT_GRAPHQL_URL
}

export function getGraphQLWsUrl() {
  const endpoint = getGraphQLHttpUrl()
  if (endpoint.startsWith('https')) return endpoint.replace(/^https/, 'wss')
  if (endpoint.startsWith('http')) return endpoint.replace(/^http/, 'ws')
  return endpoint
}

export function getGraphQLClient() {
  if (!client) {
    client = new GraphQLClient(getGraphQLHttpUrl(), {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
  return client
}

export function getGatewayBaseUrl() {
  const graphqlUrl = getGraphQLHttpUrl()
  if (graphqlUrl.endsWith('/graphql')) {
    return graphqlUrl.slice(0, -'/graphql'.length)
  }
  return graphqlUrl
}
