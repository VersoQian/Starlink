'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRightIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons'
import {
  useUpdateWorkspaceMetadataMutation,
  useWorkspaceEntity,
  useWorkspaceMetadataHistoryQuery,
  type WorkspaceMember
} from '@/entities'
import { getCurrentViewerId, setCurrentViewerId } from '@/shared/lib/viewer-identity'

type WorkspaceSettingsPageProps = {
  params: { workspaceId: string }
}

const DEFAULT_MEMBER_PERMISSIONS = ['workspace.read', 'workspace.write']

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

export default function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
  const { workspace } = useWorkspaceEntity(params.workspaceId)
  const historyQuery = useWorkspaceMetadataHistoryQuery(params.workspaceId)
  const updateWorkspaceMutation = useUpdateWorkspaceMetadataMutation()
  const [viewerId, setViewerId] = useState('lead-alex')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [focus, setFocus] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [members, setMembers] = useState<WorkspaceMember[]>([])

  useEffect(() => {
    setViewerId(getCurrentViewerId())
    setName(workspace.name)
    setType(workspace.type)
    setFocus(workspace.focus)
    setOwnerName(workspace.ownerName)
    setOwnerId(workspace.ownerId)
    setMembers(
      workspace.members.map((member) => ({
        ...member,
        permissions: [...member.permissions]
      }))
    )
  }, [workspace])

  const isDirty = useMemo(() => {
    const sameMembers = JSON.stringify(members) === JSON.stringify(workspace.members)
    return !(
      name === workspace.name &&
      type === workspace.type &&
      focus === workspace.focus &&
      ownerName === workspace.ownerName &&
      ownerId === workspace.ownerId &&
      sameMembers
    )
  }, [focus, members, name, ownerId, ownerName, type, workspace])

  function updateMember(index: number, patch: Partial<WorkspaceMember>) {
    setMembers((current) =>
      current.map((member, memberIndex) =>
        memberIndex === index ? { ...member, ...patch } : member
      )
    )
  }

  function addMember() {
    const nextIndex = members.length + 1
    setMembers((current) => [
      ...current,
      {
        id: `member-${nextIndex}`,
        name: `New Member ${nextIndex}`,
        role: 'contributor',
        permissions: [...DEFAULT_MEMBER_PERMISSIONS]
      }
    ])
  }

  function removeMember(index: number) {
    setMembers((current) => current.filter((_, memberIndex) => memberIndex !== index))
  }

  async function handleSave() {
    const trimmedName = name.trim()
    const trimmedType = type.trim()
    const trimmedFocus = focus.trim()
    const trimmedOwnerName = ownerName.trim()
    const resolvedOwnerId = ownerId.trim() || slugify(trimmedOwnerName) || 'workspace-owner'
    const normalizedMembers = members
      .map((member, index) => ({
        id: member.id.trim() || slugify(member.name) || `member-${index + 1}`,
        name: member.name.trim(),
        role: member.role?.trim() || 'contributor',
        permissions:
          member.permissions.length > 0 ? member.permissions : [...DEFAULT_MEMBER_PERMISSIONS]
      }))
      .filter((member) => member.name.length > 0)

    const ownerMemberIndex = normalizedMembers.findIndex((member) => member.id === resolvedOwnerId)
    if (ownerMemberIndex >= 0) {
      normalizedMembers[ownerMemberIndex] = {
        ...normalizedMembers[ownerMemberIndex],
        name: trimmedOwnerName,
        role: 'owner',
        permissions: ['workspace.read', 'workspace.write', 'workspace.publish', 'workspace.manage']
      }
    } else {
      normalizedMembers.unshift({
        id: resolvedOwnerId,
        name: trimmedOwnerName,
        role: 'owner',
        permissions: ['workspace.read', 'workspace.write', 'workspace.publish', 'workspace.manage']
      })
    }

    if (
      !trimmedName ||
      !trimmedType ||
      !trimmedFocus ||
      !trimmedOwnerName ||
      normalizedMembers.length === 0
    ) {
      return
    }

    await updateWorkspaceMutation.mutateAsync({
      workspaceId: params.workspaceId,
      name: trimmedName,
      type: trimmedType,
      focus: trimmedFocus,
      ownerId: resolvedOwnerId,
      ownerName: trimmedOwnerName,
      members: normalizedMembers
    })
  }

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#F8F6FF] px-8 py-8 text-[#2E2350]">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[36px] border border-[#E6DFFF] bg-[radial-gradient(circle_at_top_left,_rgba(139,124,255,0.16),_transparent_34%),linear-gradient(180deg,_#FFFFFF,_#F7F4FF)] p-8 shadow-[0_30px_60px_-40px_rgba(110,91,255,0.28)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7C70B8]">Workspace Settings</p>
              <h1 className="mt-3 font-['Outfit'] text-4xl font-semibold tracking-tight text-[#2E2350]">
                管理工作区元数据
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#6F6792]">
                这里负责名称、定位、Owner 和成员结构。改动会直接影响 dashboard、workspace 首页和系统级切换器。
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 font-semibold text-[#6B5FB0]">
                  {workspace.workspaceId}
                </span>
                <span className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 text-[#6B5FB0]">
                  当前类型 · {workspace.type}
                </span>
                <span className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 text-[#6B5FB0]">
                  成员 {workspace.members.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={viewerId}
                onChange={(event) => {
                  const nextViewerId = event.target.value
                  setViewerId(nextViewerId)
                  setCurrentViewerId(nextViewerId)
                }}
                className="h-10 rounded-full border border-[#DDD2FF] bg-white px-4 text-sm text-[#5E548E] outline-none transition focus:border-[#B9A9FF]"
              >
                {workspace.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <Link
                href={`/workspace/${params.workspaceId}` as Route}
                className="rounded-full border border-[#DDD2FF] bg-white px-5 py-2.5 text-sm text-[#5E548E] transition hover:bg-[#F3EFFF]"
              >
                返回项目主页
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={!workspace.canManage || !isDirty || updateWorkspaceMutation.isPending}
                className="rounded-full bg-[#8B7CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6E5BFF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateWorkspaceMutation.isPending ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">Identity</p>
              {!workspace.canManage && (
                <div className="mt-4 rounded-[22px] border border-[#F0D6E0] bg-[#FFF4F8] p-4 text-sm leading-6 text-[#7A4A63]">
                  当前身份没有 `workspace.manage` 权限，设置页处于只读模式。请切换到拥有管理权限的成员。
                </div>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Workspace Name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={!workspace.canManage}
                    className="h-12 w-full rounded-[18px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                    placeholder="例如：亚太市场进入研究"
                  />
                </Field>
                <Field label="Workspace Type">
                  <input
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    disabled={!workspace.canManage}
                    className="h-12 w-full rounded-[18px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                    placeholder="例如：market-study"
                  />
                </Field>
              </div>
              <Field label="Focus" className="mt-4">
                <textarea
                  value={focus}
                  onChange={(event) => setFocus(event.target.value)}
                  disabled={!workspace.canManage}
                  rows={4}
                  className="w-full rounded-[24px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 py-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                  placeholder="一句话说明这个工作区要解决什么问题。"
                />
              </Field>
            </div>

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">Members</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#2E2350]">成员结构</h2>
                </div>
                <button
                  type="button"
                  onClick={addMember}
                  disabled={!workspace.canManage}
                  className="inline-flex items-center gap-2 rounded-full border border-[#DDD2FF] bg-[#F7F3FF] px-4 py-2 text-sm font-semibold text-[#5E548E] transition hover:bg-[#EEE8FF]"
                >
                  <PlusIcon />
                  添加成员
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {members.map((member, index) => (
                  <div key={`${member.id}-${index}`} className="rounded-[24px] border border-[#ECE6FF] bg-[#FCFBFF] p-4">
                    <div className="grid gap-4 md:grid-cols-[1fr_0.7fr_0.5fr_auto]">
                      <input
                        value={member.name}
                        onChange={(event) => {
                          const nextName = event.target.value
                          updateMember(index, {
                            name: nextName,
                            id: member.id.startsWith('member-') ? slugify(nextName) || member.id : member.id
                          })
                        }}
                        disabled={!workspace.canManage}
                        className="h-11 rounded-[16px] border border-[#E6DFFF] bg-white px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                        placeholder="成员姓名"
                      />
                      <input
                        value={member.role ?? ''}
                        onChange={(event) => updateMember(index, { role: event.target.value })}
                        disabled={!workspace.canManage}
                        className="h-11 rounded-[16px] border border-[#E6DFFF] bg-white px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                        placeholder="角色"
                      />
                      <select
                        value={member.permissions.includes('workspace.manage') ? 'owner' : member.permissions.includes('workspace.publish') ? 'editor' : 'member'}
                        onChange={(event) => {
                          const value = event.target.value
                          const permissions =
                            value === 'owner'
                              ? ['workspace.read', 'workspace.write', 'workspace.publish', 'workspace.manage']
                              : value === 'editor'
                                ? ['workspace.read', 'workspace.write', 'workspace.publish']
                                : ['workspace.read', 'workspace.write']
                          updateMember(index, { permissions })
                        }}
                        disabled={!workspace.canManage}
                        className="h-11 rounded-[16px] border border-[#E6DFFF] bg-white px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                      >
                        <option value="member">Member</option>
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        disabled={!workspace.canManage || members.length <= 1}
                        className="inline-flex h-11 items-center justify-center rounded-[16px] border border-[#F0D6E0] bg-[#FFF4F8] px-4 text-[#7A4A63] transition hover:bg-[#FEEAF1] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">Owner</p>
              <div className="mt-4 space-y-4">
                <Field label="Owner Name">
                  <input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    disabled={!workspace.canManage}
                    className="h-12 w-full rounded-[18px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                    placeholder="负责人姓名"
                  />
                </Field>
                <Field label="Owner ID">
                  <input
                    value={ownerId}
                    onChange={(event) => setOwnerId(event.target.value)}
                    disabled={!workspace.canManage}
                    className="h-12 w-full rounded-[18px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 text-sm outline-none transition focus:border-[#B9A9FF]"
                    placeholder="lead-alex"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">Effects</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[#6F6792]">
                <p>保存后会直接影响 dashboard 工作区列表、项目主页头图、侧栏成员区和系统级切换器。</p>
                <p>工作流阶段、资产和任务统计不会被这个页面改写，它只负责元数据层。</p>
                <p>当前身份：{viewerId} · 权限 {workspace.viewerPermissions.join(' / ') || 'none'}</p>
              </div>
              <Link
                href={`/workspace/${params.workspaceId}` as Route}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#DDD2FF] bg-[#F7F3FF] px-4 py-2 text-sm font-semibold text-[#5E548E] transition hover:bg-[#EEE8FF]"
              >
                回到项目主页
                <ArrowRightIcon />
              </Link>
            </div>

            {updateWorkspaceMutation.isSuccess && (
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
                工作区元数据已更新。导航、主页和切换器会在下一次查询后显示新信息。
              </div>
            )}

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">Save History</p>
              <div className="mt-4 space-y-3">
                {(historyQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-[#6F6792]">还没有元数据更新记录。</p>
                ) : (
                  (historyQuery.data ?? []).map((entry) => (
                    <div key={entry.historyId} className="rounded-[22px] border border-[#ECE6FF] bg-[#FCFBFF] p-4">
                      <p className="text-sm font-semibold text-[#2E2350]">{entry.summary}</p>
                      <p className="mt-2 text-xs text-[#6F6792]">
                        v{entry.version} · {entry.changedBy} · {new Intl.DateTimeFormat('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(new Date(entry.changedAt))}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

function Field({
  label,
  children,
  className = ''
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8D84B8]">
        {label}
      </span>
      {children}
    </label>
  )
}
