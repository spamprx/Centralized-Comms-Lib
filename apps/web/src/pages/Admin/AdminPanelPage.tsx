import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Activity, LayoutDashboard, ChevronLeft, Radio } from 'lucide-react';
import UserManagementTab from '../../components/admin/UserManagementTab';
import RolesAndGroupsTab from '../../components/admin/RolesAndGroupsTab';
import MonitoringTab from '../../components/admin/MonitoringTab';
import ChannelManagementTab from '../../components/admin/ChannelManagementTab';

export type AdminTab = 'users' | 'roles' | 'channels' | 'monitoring';

const ADMIN_TABS: AdminTab[] = ['users', 'roles', 'channels', 'monitoring'];

const TAB_META: Record<AdminTab, { label: string; subtitle: string; icon: React.ElementType }> = {
  users: { label: 'Users', subtitle: 'Accounts and access', icon: Users },
  roles: { label: 'Roles & groups', subtitle: 'Permissions and groups', icon: Shield },
  channels: { label: 'Channels', subtitle: 'Compatibility and restrictions', icon: Radio },
  monitoring: { label: 'Monitoring', subtitle: 'Health and activity', icon: Activity },
};

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const renderTab = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagementTab />;
      case 'roles':
        return <RolesAndGroupsTab />;
      case 'monitoring':
        return <MonitoringTab />;
      case 'channels':
        return <ChannelManagementTab />;
    }
  };

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-app-bg font-sans text-app-text app-main-canvas md:h-[100dvh]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-32 top-0 h-[26rem] w-[26rem] rounded-full bg-app-accent/12 blur-[110px]" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-app-accent-2/10 blur-[95px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-app-accent/6 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-20 shrink-0 border-b border-white/[0.08] bg-app-bg/70 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl supports-backdrop-filter:bg-app-bg/45">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-app-page py-3 md:flex-row md:items-center md:justify-between md:gap-4 md:px-app-page-lg md:py-3.5">
          <div className="flex min-w-0 items-center justify-between gap-3 md:justify-start">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-app-lg border border-white/[0.1] bg-gradient-to-br from-white/[0.1] to-white/[0.02] shadow-app-lift backdrop-blur-xl">
                <span
                  className="absolute inset-0 bg-gradient-to-t from-app-accent/15 to-transparent"
                  aria-hidden
                />
                <LayoutDashboard size={18} className="relative text-app-accent" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold tracking-tight text-app-text">
                  Admin panel
                </h1>
                <p className="truncate text-[12px] text-app-muted">
                  {TAB_META[activeTab].subtitle}
                </p>
              </div>
            </div>
            <Link
              to="/dashboard"
              className="flex shrink-0 items-center gap-1 rounded-app-md border border-transparent px-2.5 py-1.5 text-[13px] text-app-muted no-underline transition-[border-color,background-color,color] duration-200 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-app-text md:hidden"
            >
              <ChevronLeft size={16} aria-hidden />
              Dashboard
            </Link>
          </div>

          <nav
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin] md:justify-center md:pb-0"
            aria-label="Admin sections"
          >
            {ADMIN_TABS.map((tab) => {
              const { label, icon: Icon } = TAB_META[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex shrink-0 items-center gap-2 rounded-app-lg border px-3 py-2 text-left text-[13px] font-medium transition-[border-color,background-color,box-shadow,color,transform] duration-200 ease-out active:scale-[0.98] motion-reduce:active:scale-100 ${
                    isActive
                      ? 'border-app-accent/35 bg-gradient-to-b from-app-accent-muted to-app-accent-muted/50 text-app-accent-hover shadow-[0_0_0_1px_rgba(147,124,248,0.12),0_12px_40px_-16px_rgba(147,124,248,0.25)]'
                      : 'border-transparent bg-transparent text-app-muted hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-app-text'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-app-md border transition-colors duration-200 ${
                      isActive
                        ? 'border-app-accent/25 bg-app-accent/15 text-app-accent-hover'
                        : 'border-transparent bg-white/[0.04] text-app-muted'
                    }`}
                  >
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </nav>

          <Link
            to="/dashboard"
            className="hidden shrink-0 items-center gap-1.5 rounded-app-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-app-muted no-underline shadow-sm backdrop-blur-md transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-app-accent/25 hover:bg-white/[0.07] hover:text-app-text md:inline-flex"
          >
            <ChevronLeft size={16} aria-hidden />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="chat-premium-scroll relative z-[1] min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-app-page py-app-page md:px-app-page-lg md:py-app-page-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
