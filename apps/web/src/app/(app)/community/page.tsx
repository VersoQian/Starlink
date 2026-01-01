'use client'

import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

type IconName =
  | 'hub'
  | 'search'
  | 'light'
  | 'dark'
  | 'notifications'
  | 'home'
  | 'projects'
  | 'mail'
  | 'attach'
  | 'link'
  | 'chart'
  | 'like'
  | 'comment'
  | 'share'
  | 'rocket'
  | 'language'
  | 'add'
  | 'bell'

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

const projects = [
  { id: 'orion', name: 'Project Orion', tag: 'Market Expansion', icon: 'rocket_launch', tint: 'bg-blue-100 text-blue-600' },
  { id: 'phoenix', name: 'Project Phoenix', tag: 'Policy Interpretation', icon: 'language', tint: 'bg-green-100 text-green-600' }
]

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
      "Just uploaded the V2 of the business canvas for Project Orion. Looking for feedback on the 'Key Partners' and 'Revenue Streams' sections specifically. The new market data from the LATAM region has been incorporated. Link to document attached.",
    image: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=OrionCanvas&backgroundColor=ffe6a7&size=800',
    tags: ['#Orion', '#Strategy'],
    likes: 8,
    comments: 3
  }
]

export default function CommunityPage() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="min-h-screen bg-[#0f1323]" />
  }

  const bg = isDark ? 'bg-[#0f1323]' : 'bg-[#f5f6f8]'
  const card = isDark ? 'bg-gray-900' : 'bg-white'
  const border = isDark ? 'border-gray-800' : 'border-gray-200'
  const text = isDark ? 'text-white' : 'text-[#111218]'
  const muted = isDark ? 'text-gray-400' : 'text-[#5f668c]'

  return (
    <div className={`${bg} min-h-screen`}>
      <Head>
        <style>{`svg.icon { width: 20px; height: 20px; }`}</style>
      </Head>
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
        {/* Top nav */}
        <header className={`sticky top-4 z-10 flex items-center justify-between rounded-xl ${card} ${border} border px-4 py-3 shadow-sm`}>
          <div className="flex items-center gap-2">
            <Icon name="hub" className="text-[#062ff9]" size={28} />
            <h2 className={`text-lg font-bold ${text}`}>Starlink 社区中心</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-inner dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <Icon name="search" className="text-[#5f668c] dark:text-gray-400" />
              <input className="bg-transparent text-sm outline-none placeholder:text-[#5f668c] dark:placeholder:text-gray-400" placeholder="搜索" />
            </div>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#111218] transition hover:border-blue-500 hover:text-blue-600 dark:border-gray-800 dark:text-gray-100"
            >
              <Icon name={isDark ? 'light' : 'dark'} />
              {isDark ? '浅色' : '深色'}
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[#111218] dark:bg-gray-800 dark:text-white">
              <Icon name="notifications" />
            </button>
            <div
              className="h-10 w-10 overflow-hidden rounded-full bg-center bg-cover"
              style={{ backgroundImage: 'url(https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=c0aede&size=160)' }}
            />
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          {/* Left rail */}
          <aside className="col-span-12 lg:col-span-3">
            <div className={`sticky top-24 flex h-fit min-h-[640px] flex-col justify-between rounded-xl ${card} ${border} border p-4`}>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="h-12 w-12 overflow-hidden rounded-full bg-center bg-cover"
                    style={{ backgroundImage: 'url(https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=c0aede&size=160)' }}
                  />
                  <div>
                    <p className={`text-base font-medium ${text}`}>Alex Chen</p>
                    <p className={`text-sm ${muted}`}>欧盟政策专家</p>
                  </div>
                </div>
                <div className="mt-2 space-y-2 text-sm font-medium">
                  {[
                    { label: '首页', icon: 'home', active: true },
                    { label: '项目', icon: 'projects' },
                    { label: '消息', icon: 'mail' },
                    { label: '通知', icon: 'bell' }
                  ].map((item) => (
                    <button
                      key={item.label}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition ${
                        item.active
                          ? 'bg-[#062ff9]/10 text-[#062ff9] dark:bg-[#062ff9]/20'
                          : `${text} ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`
                      }`}
                    >
                      <Icon name={item.icon as IconName} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="mt-6 w-full rounded-lg bg-[#062ff9] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#1242ff]">
                发布帖子
              </button>
            </div>
          </aside>

          {/* Center feed */}
          <main className="col-span-12 space-y-5 lg:col-span-6">
            <div className={`rounded-xl ${card} ${border} border p-4`}>
              <div className="flex items-start gap-3">
                <div
                  className="h-10 w-10 overflow-hidden rounded-full bg-center bg-cover"
                  style={{ backgroundImage: 'url(https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=c0aede&size=160)' }}
                />
                <div className="flex-1">
                  <textarea
                    className={`w-full resize-none rounded-lg border px-3 py-2 text-base outline-none ${
                      isDark ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-200 bg-white text-[#111218]'
                    }`}
                    placeholder="分享你的想法或提出问题..."
                    rows={3}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <div className={`flex items-center gap-3 ${muted}`}>
                      {[
                        { icon: 'attach', label: '附件' },
                        { icon: 'link', label: '链接' },
                        { icon: 'chart', label: '投票' }
                      ].map((item) => (
                        <button key={item.icon} className="flex items-center gap-1 rounded-full p-1.5 hover:text-[#062ff9]">
                          <Icon name={item.icon as IconName} />
                          <span className="text-xs font-medium">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <button className="rounded-lg bg-[#062ff9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1242ff]">发布</button>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex h-12 items-center gap-2 rounded-xl ${card} ${border} border p-1 text-sm font-medium`}>
              {['最新动态', '趋势', '我的帖子'].map((tab, idx) => (
                <button
                  key={tab}
                  className={`flex-1 rounded-lg px-3 py-2 transition whitespace-nowrap ${
                    idx === 0 ? 'bg-white text-[#062ff9] shadow-sm dark:bg-gray-900' : `${muted} ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {posts.map((post) => (
              <article key={post.id} className={`rounded-xl ${card} ${border} border p-4 shadow-sm`}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-center bg-cover" style={{ backgroundImage: `url(${post.author.avatar})` }} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${text}`}>{post.author.name}</p>
                    <p className={`text-xs ${muted}`}>{post.author.time}</p>
                  </div>
                  <button className={`rounded-full px-2 py-1 text-sm ${muted}`}>•••</button>
                </div>
                {post.image && (
                  <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                    <Image alt={post.title} width={1200} height={600} src={post.image} className="h-64 w-full object-cover" />
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  <h3 className={`text-lg font-bold ${text}`}>{post.title}</h3>
                  <p className={`text-base leading-relaxed ${isDark ? 'text-gray-300' : 'text-[#5f668c]'}`}>{post.body}</p>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#062ff9]/10 px-3 py-1 text-xs font-medium text-[#062ff9] dark:bg-[#062ff9]/20 dark:text-blue-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-sm dark:border-gray-800">
                    <div className={`flex items-center gap-4 ${muted}`}>
                      <button className="flex items-center gap-1.5 hover:text-[#062ff9]">
                        <Icon name="like" />
                        {post.likes}
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-[#062ff9]">
                        <Icon name="comment" />
                        {post.comments}
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-[#062ff9]">
                        <Icon name="share" />
                      </button>
                    </div>
                    <button className="rounded-lg bg-[#062ff9] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1242ff]">评论</button>
                  </div>
                </div>
              </article>
            ))}
          </main>

          {/* Right rail */}
          <aside className="col-span-12 space-y-5 lg:col-span-3">
            <div className={`rounded-xl ${card} ${border} border p-4`}>
              <h3 className={`mb-3 text-base font-bold ${text}`}>我的项目</h3>
              <div className="space-y-3">
                {projects.map((project) => (
                  <div key={project.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${border} ${card} transition hover:border-blue-500`}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${project.tint}`}>
                      <Icon name={project.icon as IconName} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${text}`}>{project.name}</p>
                      <p className={`text-xs ${muted}`}>{project.tag}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-xl ${card} ${border} border p-4`}>
              <h3 className={`mb-3 text-base font-bold ${text}`}>推荐联系人</h3>
              <div className="space-y-3">
                {suggested.map((person) => (
                  <div key={person.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-center bg-cover" style={{ backgroundImage: `url(${person.avatar})` }} />
                      <div>
                        <p className={`text-sm font-medium ${text}`}>{person.name}</p>
                        <p className={`text-xs ${muted}`}>{person.title}</p>
                      </div>
                    </div>
                    <button className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
                      <Icon name="add" className="text-[#5f668c] dark:text-gray-300" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-xl ${card} ${border} border p-4`}>
              <h3 className={`mb-3 text-base font-bold ${text}`}>热门话题</h3>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-[#062ff9]/10 px-3 py-1 text-sm font-semibold text-[#062ff9] dark:bg-[#062ff9]/20 dark:text-blue-200"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Icon({ name, className, size = 20 }: { name: IconName; className?: string; size?: number }) {
  const shared = `icon ${className ?? ''}`
  switch (name) {
    case 'hub':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 3a5 5 0 0 1 4.9 4.07 4 4 0 0 1 2.83 4.9A4.5 4.5 0 0 1 21 20h-4a4.5 4.5 0 0 1-4-2.32A4.5 4.5 0 0 1 9 20H5a4.5 4.5 0 0 1-1.73-8.63A4 4 0 0 1 6.1 7.07 5 5 0 0 1 11 3h2Z" />
        </svg>
      )
    case 'search':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.65" y1="16.65" x2="21" y2="21" />
        </svg>
      )
    case 'light':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4m0-14.2 1.4-1.4M4.2 19.8l1.4-1.4" />
        </svg>
      )
    case 'dark':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )
    case 'notifications':
    case 'bell':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 1 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z" />
        </svg>
      )
    case 'home':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10Z" />
        </svg>
      )
    case 'projects':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h16v6H4V4Zm0 8h16v8H4v-8Zm4 2v4h8v-4H8Z" />
        </svg>
      )
    case 'mail':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h16a2 2 0 0 1 2 2v1.2l-10 5-10-5V6a2 2 0 0 1 2-2Zm-2 6.8 8.8 4.4a4 4 0 0 0 3.4 0L23 10.8V18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7.2Z" />
        </svg>
      )
    case 'attach':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12.5 6.75v7a3.75 3.75 0 1 1-7.5 0v-5a5 5 0 0 1 10 0v8a6.25 6.25 0 1 1-12.5 0v-9" />
        </svg>
      )
    case 'link':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 0 0 1 7 0l1.5 1.5a5 5 0 1 1-7 7l-1.5-1.5" />
          <path d="M14 11a5 5 0 0 1-7 0L5.5 9.5a5 5 0 0 1 7-7L14 4" />
        </svg>
      )
    case 'chart':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3h4v18H5V3Zm5 6h4v12h-4V9Zm5-4h4v16h-4V5Z" />
        </svg>
      )
    case 'like':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 21H6a2 2 0 0 1-2-2v-7h5V5a3 3 0 0 1 3-3 3 3 0 0 1 3 3l-1 5h5.28a2 2 0 0 1 1.92 2.56l-2 7A2 2 0 0 1 17.28 21H9Z" />
        </svg>
      )
    case 'comment':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2Z" />
        </svg>
      )
    case 'share':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8a3 3 0 1 0-2.83-4H10a2 2 0 0 0-2 2v3h2V6h5.17A3 3 0 0 0 18 8Zm-8 8a3 3 0 1 0 0 2H14a2 2 0 0 0 2-2v-3h-2v3h-4Zm9-5-3-3v2h-4a3 3 0 0 0-3 3v1h2v-1a1 1 0 0 1 1-1h4v2l3-3Z" />
        </svg>
      )
    case 'rocket':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2c3 0 6 2 7 6l-4 4-3-3-3 3-4-4c1-4 4-6 7-6Zm-2 10.5 2-2 2 2-2 2-2-2Zm-1 1.5v2l-2 2H5v-2l2-2h2Zm10 0v2l-2 2h-2v-2l2-2h2Z" />
        </svg>
      )
    case 'language':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4h16v4H4V4Zm0 6h16v10H4V10Zm4 3H6v2h2v-2Zm0 4H6v2h2v-2Zm4-4h-2v2h2v-2Zm0 4h-2v2h2v-2Zm4-4h-2v2h2v-2Zm0 4h-2v2h2v-2Z" />
        </svg>
      )
    case 'add':
      return (
        <svg className={shared} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z" />
        </svg>
      )
    default:
      return <span className={shared}>•</span>
  }
}
