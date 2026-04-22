import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { Header } from './header'
import { AuroraBackground } from '@/components/ui/aurora-background'

export function RootLayout() {
  return (
    <AuroraBackground>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen bg-transparent">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in z-10 relative">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </AuroraBackground>
  )
}
