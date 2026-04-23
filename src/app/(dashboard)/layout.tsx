import Sidebar from '@/components/sidebar/Sidebar';
import { MenuButton } from '@/components/sidebar/MenuButton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative">
      <Sidebar />
      <header className="fixed top-0 left-0 right-0 h-16 flex items-center px-4 md:hidden shrink-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <MenuButton />
        </div>
      </header>
      <div className="flex-1 flex flex-col min-w-0 h-full w-full pt-16 md:pt-0">
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
