import { readEnv } from '../lib/env'

export type R2AssetVersion = {
  version: string
  assets: Record<string, string>
}

const FALLBACK_VERSION = 'v1'

const ASSET_VERSIONS: R2AssetVersion[] = [
  {
    version: 'v1',
    assets: {
      lessonCover: readEnv('R2_LESSON_COVER_V1_URL'),
      defaultAvatar: readEnv('R2_DEFAULT_AVATAR_V1_URL'),
      placeholderVideo: readEnv('R2_PLACEHOLDER_VIDEO_V1_URL')
    }
  },
  {
    version: 'v2',
    assets: {
      lessonCover: readEnv('R2_LESSON_COVER_V2_URL'),
      defaultAvatar: readEnv('R2_DEFAULT_AVATAR_V2_URL'),
      placeholderVideo: readEnv('R2_PLACEHOLDER_VIDEO_V2_URL')
    }
  }
]

const R2_VERSION_REGISTRY = new Map(ASSET_VERSIONS.map((item) => [item.version, item]))

export const ACTIVE_R2_VERSION =
  readEnv('R2_ACTIVE_VERSION', { defaultValue: FALLBACK_VERSION }) ||
  FALLBACK_VERSION

export function getR2Asset(path: keyof R2AssetVersion['assets'], version = ACTIVE_R2_VERSION) {
  const bucket = R2_VERSION_REGISTRY.get(version) ?? R2_VERSION_REGISTRY.get(FALLBACK_VERSION)
  return bucket?.assets[path] ?? ''
}

export function listR2Versions(): R2AssetVersion[] {
  return ASSET_VERSIONS
}
