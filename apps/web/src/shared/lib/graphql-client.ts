import { GraphQLClient } from 'graphql-request'

let client: GraphQLClient | null = null

export function getGraphQLClient() {
  if (!client) {
    const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql'
    client = new GraphQLClient(endpoint, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
  return client
}

