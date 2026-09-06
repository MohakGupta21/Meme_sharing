import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useCompose } from "../../lib/compose";
import { Brand } from "./Brand";
import { NAV_ITEMS } from "./nav-items";
import { LogoutIcon, PlusIcon } from "../icons";

/** Slim top bar shown only below lg. */
export function MobileTopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md lg:hidden">
      <Brand />
      <div className="flex items-center gap-2">
        {user && (
          <NavLink to={`/users/${user.id}`}>
            <img
              src={user.profile_picture_url}
              alt="Profile"
              className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
            />
          </NavLink>
        )}
        <button
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
          title="Log out"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
        >
          <LogoutIcon className="text-lg" />
        </button>
      </div>
    </header>
  );
}

const tabCls = (active: boolean) =>
  `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold transition ${
    active ? "text-brand-600" : "text-slate-400"
  }`;

/** Bottom tab bar shown only below lg, with a centre compose FAB. */
export function MobileNav() {
  const compose = useCompose();
  const [feed, friends, discover, chat] = NAV_ITEMS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-slate-200/70 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {[feed, friends].map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => tabCls(isActive)}>
          {({ isActive }) => (
            <>
              <Icon className={`text-[1.55rem] ${isActive ? "" : "opacity-90"}`} />
              {label}
            </>
          )}
        </NavLink>
      ))}

      <div className="flex w-16 shrink-0 items-center justify-center">
        <button
          onClick={compose.open}
          aria-label="New meme"
          className="btn btn-primary -mt-6 h-14 w-14 rounded-2xl p-0 shadow-lift"
        >
          <PlusIcon className="text-2xl" />
        </button>
      </div>

      {[discover, chat].map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => tabCls(isActive)}>
          {({ isActive }) => (
            <>
              <Icon className={`text-[1.55rem] ${isActive ? "" : "opacity-90"}`} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
