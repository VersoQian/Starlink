'use client'

import Link from 'next/link'
import type { Route } from 'next'
import Image from 'next/image'
import { nanoid } from 'nanoid'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightIcon,
  ChatBubbleIcon,
  GlobeIcon,
  HeartIcon,
  HomeIcon,
  LightningBoltIcon,
  MixerHorizontalIcon,
  PersonIcon,
  RocketIcon
} from '@radix-ui/react-icons'
import { ThemeToggle } from '@/components/theme-toggle'
import { useSaveCommunityPostMutation, useWorkspaceDirectory, useWorkspacePersistedAssets } from '@/entities'
import {
  getPracticeActiveWorkspaceId,
  saveCommunityPost as saveCommunityPostLocal,
  setPracticeActiveWorkspaceId
} from '@/entities/asset/local-source'

type Post = {
  id: string
  author: { name: string; role: string; avatar: string; time: string }
  title: string
  body: string
  image?: string
  tags: string[]
  likes: number
  comments: number
}

const suggested = [
  { name: 'Maria Garcia', title: 'APAC Market Analyst', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Maria&backgroundColor=b6e3f4&size=160' },
  { name: 'Chen Wei', title: 'Logistics Specialist', avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Chen&backgroundColor=ffd5dc&size=160' }
]

const topics = ['#APAC', '#DataPrivacy', '#Logistics', '#EU_Policy']

const posts: Post[] = [
  {
    id: '1',
    author: {
      name: 'Sarah Lee',
      role: 'APAC Market Analyst',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Sarah&backgroundColor=b6e3f4&size=160',
      time: '2 hours ago'
    },
    title: 'Cross-cultural marketing challenges in APAC region',
    body:
      "We're seeing a significant shift in consumer behavior in Southeast Asia. Has anyone else encountered issues with the new data privacy regulations affecting campaign targeting? Let's discuss strategies.",
    image: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=CrossCultural&backgroundColor=E0E7FF&size=800',
    tags: ['#APAC', '#DataPrivacy', '#Logistics'],
    likes: 12,
    comments: 5
  },
  {
    id: '2',
    author: {
      name: 'Marcus Reid',
      role: 'Product Strategist',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Marcus&backgroundColor=ffd5dc&size=160',
      time: '5 hours ago'
    },
    title: 'New Business Canvas Analysis for Project Orion',
    body:
      "Just uploaded the V2 of the business canvas for Project Orion. Looking for feedback on the Key Partners and Revenue Streams sections specifically. The new market data from the LATAM region has been incorporated.",
    image: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=OrionCanvas&backgroundColor=ffe6a7&size=800',
    tags: ['#Orion', '#Strategy'],
    likes: 8,
    comments: 3
  }
]

const navigationLinks = [
  { label: '主界面', href: '/dashboard', icon: HomeIcon },
  { label: '页面监控台', href: '/monitor?workspace=proj-001', icon: MixerHorizontalIcon },
  { label: '跨文化练习', href: '/practice', icon: LightningBoltIcon }
] as const

export default function CommunityPage() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('proj-001')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [draftTags, setDraftTags] = useState('#Strategy')
  const workspaceDirectory = useWorkspaceDirectory({ activeWorkspaceId })
  const persistedAssets = useWorkspacePersistedAssets(activeWorkspaceId)
  const saveCommunityPostMutation = useSaveCommunityPostMutation()

  useEffect(() => {
    setActiveWorkspaceId(getPracticeActiveWorkspaceId())
  }, [])

  const communityPosts = useMemo(() => {
    const persistedPosts = persistedAssets
      .filter((asset) => asset.assetType === 'community-post')
      .map<Post>((asset) => {
        const content = (asset.content ?? {}) as {
          body?: string
          tags?: string[]
          authorName?: string
          authorRole?: string | null
          createdAt?: string
        }
        return {
          id: asset.assetId,
          author: {
            name: content.authorName ?? String(asset.metadata.authorName ?? asset.createdBy),
            role: content.authorRole ?? String(asset.metadata.authorRole ?? 'Community Contributor'),
            avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=Community&backgroundColor=c0aede&size=160',
            time: new Intl.DateTimeFormat('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(content.createdAt ?? asset.createdAt))
          },
          title: asset.title,
          body: content.body ?? '',
          tags: content.tags ?? (asset.metadata.tags as string[] | undefined) ?? [],
          likes: 0,
          comments: 0
        }
      })

    return [...persistedPosts, ...posts]
  }, [persistedAssets])

  const activeWorkspaceName = useMemo(
    () => workspaceDirectory.find((workspace) => workspace.workspaceId === activeWorkspaceId)?.name ?? activeWorkspaceId,
    [activeWorkspaceId, workspaceDirectory]
  )

  async function handlePublishPost() {
    const title = draftTitle.trim()
    const body = draftBody.trim()
    if (!title || !body) return

    const record = {
      id: nanoid(),
      workspaceId: activeWorkspaceId,
      title,
      body,
      tags: draftTags
        .split(/[\s,]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      authorName: 'Alex Chen',
      authorRole: 'Workspace Lead',
      createdAt: new Date().toISOString()
    }

    try {
      await saveCommunityPostMutation.mutateAsync({
        workspaceId: record.workspaceId,
        title: record.title,
        body: record.body,
        tags: record.tags,
        authorName: record.authorName,
        authorRole: record.authorRole
      })
    } catch {
      saveCommunityPostLocal(record)
    }

    setDraftTitle('')
    setDraftBody('')
    setDraftTags('#Strategy')
  }

  return (
    <main className="min-h-screen bg-[#F8F6FF] text-[#2E2350] dark:bg-[#08111f] dark:text-white">
      <div className="relative overflow-hidden border-b border-[#E7E0FF] bg-[radial-gradient(circle_at_top_left,_rgba(139,124,255,0.16),_transparent_34%),radial-gradient(circle_at_82%_18%,_rgba(255,255,255,0.96),_transparent_22%),linear-gradient(180deg,_#FCFBFF,_#F5F1FF)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_30%),radial-gradient(circle_at_82%_18%,_rgba(251,191,36,0.12),_transparent_22%),linear-gradient(180deg,_rgba(8,17,31,0.94),_rgba(8,17,31,1))]">
        <div className="mx-auto max-w-[1540px] px-6 py-8 lg:px-10">
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#7C70B8] dark:text-cyan-300/70">Community Layer</p>
              <h1 className="mt-3 font-['Outfit'] text-4xl font-semibold tracking-tight text-[#2E2350] dark:text-white">
                社区中心现在是系统页，不再是独立产品
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#6F6792] dark:text-slate-300/80">
                这里负责案例流转、观点交换和项目反馈。它和 dashboard、monitor、practice 处在同一套导航系统里，而不是另一套孤立界面。
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.26em] text-[#8D84B8] dark:text-slate-400">
                当前发布目标工作区 · {activeWorkspaceName}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <Link
                href={'/dashboard' as Route}
                className="rounded-full border border-[#DDD2FF] bg-white px-5 py-2.5 text-sm text-[#5E548E] transition hover:bg-[#F3EFFF] dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10"
              >
                回到主界面
              </Link>
              <Link
                href={'/practice' as Route}
                className="rounded-full bg-[#8B7CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6E5BFF] dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
              >
                打开练习
              </Link>
            </div>
          </header>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="社区帖子" value={`${communityPosts.length}`} detail="当前展示的精选案例与讨论" />
            <StatCard label="推荐联系人" value={`${suggested.length}`} detail="可以直接扩展为项目协作节点" />
            <StatCard label="工作区" value={`${workspaceDirectory.length}`} detail="来自实体快照目录，不再只靠静态卡片" />
            <StatCard label="热门话题" value={`${topics.length}`} detail="用于连接练习、研讨和社区反馈" />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1540px] gap-6 px-6 py-8 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:px-10">
        <aside className="space-y-5">
          <section className="rounded-[30px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">系统导航</p>
            <div className="mt-4 space-y-3">
              {navigationLinks.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    href={item.href as Route}
                    className="flex items-center gap-3 rounded-[22px] border border-[#ECE6FF] bg-[#FCFBFF] px-4 py-3 text-sm font-medium text-[#4A3F74] transition hover:border-[#B9A9FF] hover:bg-[#F6F2FF] dark:border-white/10 dark:bg-black/10 dark:text-slate-100 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/[0.05]"
                  >
                    <span className="rounded-2xl border border-[#E6DFFF] bg-white p-2 dark:border-white/10 dark:bg-white/5">
                      <Icon className="h-4 w-4 text-[#8B7CFF] dark:text-cyan-200" />
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div className="flex items-center gap-2">
              <RocketIcon className="text-[#8B7CFF] dark:text-cyan-200" />
              <h2 className="text-lg font-semibold">活跃工作区</h2>
            </div>
            <div className="mt-4 space-y-3">
              {workspaceDirectory.slice(0, 4).map((workspace) => (
                <Link
                  key={workspace.workspaceId}
                  href={`/workspace/${workspace.workspaceId}` as Route}
                  className="block rounded-[22px] border border-[#ECE6FF] bg-[#FCFBFF] p-4 transition hover:border-[#B9A9FF] hover:bg-[#F6F2FF] dark:border-white/10 dark:bg-black/10 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/[0.05]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#2E2350] dark:text-white">{workspace.name}</p>
                    <ArrowRightIcon className="text-[#8B7CFF] dark:text-cyan-200" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#6F6792] dark:text-slate-400">{workspace.focus}</p>
                </Link>
              ))}
            </div>
          </section>
        </aside>

        <section className="space-y-5">
          <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 overflow-hidden rounded-full bg-[#F3EEFF]">
                <Image alt="Alex Chen" width={44} height={44} src="https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=c0aede&size=160" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1">
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className="mb-3 h-12 w-full rounded-[18px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 text-sm text-[#2E2350] outline-none transition placeholder:text-[#8D84B8] focus:border-[#B9A9FF] dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
                  placeholder="帖子标题"
                />
                <textarea
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  className="min-h-[110px] w-full resize-none rounded-[24px] border border-[#E6DFFF] bg-[#FBFAFF] px-4 py-4 text-sm text-[#2E2350] outline-none transition placeholder:text-[#8D84B8] focus:border-[#B9A9FF] dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
                  placeholder="分享一个案例、提一个问题，或者把你的工作区结论抛到社区里。"
                  rows={4}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6F6792] dark:text-slate-400">
                    <select
                      value={activeWorkspaceId}
                      onChange={(event) => {
                        setActiveWorkspaceId(event.target.value)
                        setPracticeActiveWorkspaceId(event.target.value)
                      }}
                      className="h-10 rounded-full border border-[#E6DFFF] bg-white px-4 text-sm text-[#4A3F74] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      {workspaceDirectory.map((workspace) => (
                        <option key={workspace.workspaceId} value={workspace.workspaceId}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draftTags}
                      onChange={(event) => setDraftTags(event.target.value)}
                      className="h-10 rounded-full border border-[#E6DFFF] bg-white px-4 text-sm text-[#4A3F74] outline-none placeholder:text-[#8D84B8] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
                      placeholder="#Strategy #APAC"
                    />
                  </div>
                  <button
                    onClick={handlePublishPost}
                    disabled={saveCommunityPostMutation.isPending}
                    className="rounded-full bg-[#8B7CFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6E5BFF] dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
                  >
                    {saveCommunityPostMutation.isPending ? '发布中...' : '发布到社区'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-12 items-center gap-2 rounded-[24px] border border-[#E6DFFF] bg-white p-1 shadow-[0_18px_40px_-30px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            {['最新动态', '案例精选', '我的收藏'].map((tab, index) => (
              <button
                key={tab}
                className={`flex-1 rounded-[18px] px-3 py-2 text-sm font-medium transition ${
                  index === 0
                    ? 'bg-[#F3EEFF] text-[#5C48D9] dark:bg-cyan-300/10 dark:text-cyan-100'
                    : 'text-[#6F6792] hover:bg-[#F8F4FF] dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {communityPosts.map((post) => (
            <article key={post.id} className="rounded-[32px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-full bg-[#F3EEFF]">
                  <Image alt={post.author.name} width={44} height={44} src={post.author.avatar} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#2E2350] dark:text-white">{post.author.name}</p>
                      <p className="text-xs text-[#8D84B8] dark:text-slate-400">{post.author.role} · {post.author.time}</p>
                    </div>
                    <button className="rounded-full border border-[#E6DFFF] px-3 py-1 text-xs text-[#6F6792] dark:border-white/10 dark:text-slate-300">
                      关注
                    </button>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-[#2E2350] dark:text-white">{post.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#5F587F] dark:text-slate-300">{post.body}</p>
                  {post.image && (
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-[#E6DFFF] dark:border-white/10">
                      <Image alt={post.title} width={1200} height={600} src={post.image} className="h-72 w-full object-cover" />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[#D6CCFF] bg-[#F3EEFF] px-3 py-1 text-xs font-semibold text-[#5C48D9] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE8FF] pt-4 dark:border-white/10">
                    <div className="flex items-center gap-4 text-sm text-[#6F6792] dark:text-slate-300">
                      <button className="inline-flex items-center gap-1.5 transition hover:text-[#5C48D9] dark:hover:text-cyan-100">
                        <HeartIcon />
                        {post.likes}
                      </button>
                      <button className="inline-flex items-center gap-1.5 transition hover:text-[#5C48D9] dark:hover:text-cyan-100">
                        <ChatBubbleIcon />
                        {post.comments}
                      </button>
                      <button className="inline-flex items-center gap-1.5 transition hover:text-[#5C48D9] dark:hover:text-cyan-100">
                        <GlobeIcon />
                        分享
                      </button>
                    </div>
                    <button className="rounded-full border border-[#DDD2FF] bg-[#F5F1FF] px-4 py-2 text-sm font-medium text-[#5E548E] transition hover:bg-[#EEE8FF] dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10">
                      参与讨论
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-5">
          <section className="rounded-[30px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div className="flex items-center gap-2">
              <PersonIcon className="text-[#8B7CFF] dark:text-cyan-200" />
              <h2 className="text-lg font-semibold">推荐联系人</h2>
            </div>
            <div className="mt-4 space-y-3">
              {suggested.map((person) => (
                <div key={person.name} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#ECE6FF] bg-[#FCFBFF] p-3 dark:border-white/10 dark:bg-black/10">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-[#F3EEFF]">
                      <Image alt={person.name} width={40} height={40} src={person.avatar} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2E2350] dark:text-white">{person.name}</p>
                      <p className="text-xs text-[#6F6792] dark:text-slate-400">{person.title}</p>
                    </div>
                  </div>
                  <button className="rounded-full border border-[#DDD2FF] px-3 py-1 text-xs text-[#5E548E] dark:border-white/10 dark:text-slate-300">
                    连接
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <h2 className="text-lg font-semibold">热门话题</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span key={topic} className="rounded-full border border-[#D6CCFF] bg-[#F3EEFF] px-3 py-1.5 text-xs font-semibold text-[#5C48D9] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100">
                  {topic}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[30px] border border-[#E6DFFF] bg-white/90 p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur dark:border-white/10 dark:bg-black/20 dark:shadow-none">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#2E2350] dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-[#6F6792] dark:text-slate-400">{detail}</p>
    </div>
  )
}
