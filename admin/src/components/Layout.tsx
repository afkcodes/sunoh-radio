import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Radio, ArrowLeftRight, ScrollText, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth';
import { cn } from '../lib';
import { Logo } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/stations', label: 'Stations', icon: Radio },
  { to: '/import', label: 'Import / Export', icon: ArrowLeftRight },
  { to: '/audit', label: 'Audit log', icon: ScrollText },
];

function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export default function Layout() {
  const { logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-950 p-4 text-ink-300 md:flex">
        <div className="px-2 py-3">
          <Logo />
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-ink-800 text-white shadow-soft'
                    : 'text-ink-400 hover:bg-ink-900 hover:text-ink-100',
                )
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mono rounded-lg bg-ink-900 px-3 py-2 text-[11px] text-ink-500">
          on-air directory · v1
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col bg-grid">
        <header className="flex h-14 items-center justify-between border-b border-ink-200/70 bg-white/80 px-5 backdrop-blur dark:border-ink-800 dark:bg-ink-900/80">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size={24} />
          </div>
          <div className="hidden text-sm font-semibold text-ink-500 md:block dark:text-ink-400">
            Station management
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-6 pb-28">
          <div className="mx-auto max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
