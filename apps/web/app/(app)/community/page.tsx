'use client'

import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&display=swap"
        />
        <style>{`
          .material-symbols-outlined {
            font-family: 'Material Symbols Outlined';
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            display: inline-block;
            line-height: 1;
          }
        `}</style>
      </Head>
      <div className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6">
        {/* Top nav */}
        <header className={`sticky top-4 z-10 flex items-center justify-between rounded-xl ${card} ${border} border px-4 py-3 shadow-sm`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-[#062ff9]">hub</span>
            <h2 className={`text-lg font-bold ${text}`}>Starlink 社区中心</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-inner dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
              <span className="material-symbols-outlined text-xl text-[#5f668c] dark:text-gray-400">search</span>
              <input className="bg-transparent text-sm outline-none placeholder:text-[#5f668c] dark:placeholder:text-gray-400" placeholder="搜索" />
            </div>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#111218] transition hover:border-blue-500 hover:text-blue-600 dark:border-gray-800 dark:text-gray-100"
            >
              <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
              {isDark ? '浅色' : '深色'}
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[#111218] dark:bg-gray-800 dark:text-white">
              <span className="material-symbols-outlined text-xl">notifications</span>
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
                    { label: '项目', icon: 'business_center' },
                    { label: '消息', icon: 'mail' },
                    { label: '通知', icon: 'notifications' }
                  ].map((item) => (
                    <button
                      key={item.label}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition ${
                        item.active
                          ? 'bg-[#062ff9]/10 text-[#062ff9] dark:bg-[#062ff9]/20'
                          : `${text} ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`
                      }`}
                    >
                      <span className={`material-symbols-outlined ${item.active ? 'fill' : ''}`}>{item.icon}</span>
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
                        { icon: 'attach_file', label: '附件' },
                        { icon: 'link', label: '链接' },
                        { icon: 'insert_chart', label: '投票' }
                      ].map((item) => (
                        <button key={item.icon} className="flex items-center gap-1 rounded-full p-1.5 hover:text-[#062ff9]">
                          <span className="material-symbols-outlined text-xl">{item.icon}</span>
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
                        <span className="material-symbols-outlined text-xl">thumb_up</span>
                        {post.likes}
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-[#062ff9]">
                        <span className="material-symbols-outlined text-xl">chat_bubble</span>
                        {post.comments}
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-[#062ff9]">
                        <span className="material-symbols-outlined text-xl">share</span>
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
                      <span className="material-symbols-outlined">{project.icon}</span>
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
                      <span className="material-symbols-outlined text-xl text-[#5f668c] dark:text-gray-300">add</span>
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
