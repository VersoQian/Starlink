import type { WorkspaceMember } from '@starlink/shared'

export type WorkspaceMetadataRecord = {
  workspaceId: string
  name: string
  type: string
  focus: string
  ownerId: string
  ownerName: string
  members: WorkspaceMember[]
}

export function getViewerPermissions(userId: string, members: WorkspaceMember[]) {
  const member = members.find((item) => item.id === userId)
  return member?.permissions ?? []
}

export function requireWorkspacePermission(
  userId: string,
  metadata: WorkspaceMetadataRecord,
  requiredPermission: 'workspace.read' | 'workspace.write' | 'workspace.publish' | 'workspace.manage'
) {
  const viewerPermissions = getViewerPermissions(userId, metadata.members)
  if (hasPermission(viewerPermissions, requiredPermission)) {
    return viewerPermissions
  }

  throw new Error('FORBIDDEN_WORKSPACE')
}

const permissionClosure: Record<string, string[]> = {
  'workspace.read': ['workspace.read', 'workspace.write', 'workspace.publish', 'workspace.manage'],
  'workspace.write': ['workspace.write', 'workspace.publish', 'workspace.manage'],
  'workspace.publish': ['workspace.publish', 'workspace.manage'],
  'workspace.manage': ['workspace.manage']
}

function hasPermission(permissions: readonly string[], requiredPermission: string) {
  const allowed = permissionClosure[requiredPermission] ?? [requiredPermission]
  return permissions.some((permission) => allowed.includes(permission))
}
