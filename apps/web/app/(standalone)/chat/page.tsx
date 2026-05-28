import { ChatHomePage } from '@/features/chat/components/chat-home-page'

export default function ChatHomeRoute() {
  // ChatHomePage owns the single-workspace defaults internally until
  // multi-workspace switching is wired.
  return <ChatHomePage />
}
