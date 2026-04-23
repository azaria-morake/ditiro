import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/sidebar/Sidebar';
import { MenuButton } from '@/components/sidebar/MenuButton';
import { DitiroBanner } from '@/components/brand/Logos';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Ditiro - AI Task Organizer',
  description: 'Intelligent, conversational AI organizer',
  icons: {
    icon: '/ditiro-icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex h-screen w-full bg-neutral-950 text-neutral-50 overflow-hidden`}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 relative h-full">
          <header className="h-16 flex items-center justify-between px-4 border-b border-neutral-800 md:hidden bg-neutral-900/50 backdrop-blur-md shrink-0">
            <MenuButton />
            <DitiroBanner className="h-6 w-32 text-[#e05012]" />
          </header>
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
