import { Suspense } from "react";
import ChatClient from "@/components/chat/ChatClient";

export default function Home() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-neutral-500 text-sm">Loading Chat...</div>}>
      <ChatClient />
    </Suspense>
  );
}
