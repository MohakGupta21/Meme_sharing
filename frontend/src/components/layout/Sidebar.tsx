import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useCompose } from "../../lib/compose";
import { Brand } from "./Brand";
import { NAV_ITEMS } from "./nav-items";
import { LogoutIcon, PlusIcon, SettingsIcon } from "../icons";

const rowCls = (active: boolean) =>
  [
    "flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition",
    active
      ? "bg-brand-50 text-brand-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  ].join(" ");

const iconCls = (active: boolean) =>
  `text-[1.4rem] transition ${active ? "text-brand-600" : "text-slate-400"}`;

/** Desktop-only left rail (lg+). Mobile uses <MobileNav />. */
export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const compose = useCompose();

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1 py-5 lg:flex xl:w-[264px]">
      <div className="px-3.5 pb-3">
        <Brand />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => rowCls(isActive)}>
            {({ isActive }) => (
              <>
                <Icon className={iconCls(isActive)} />
                {label}
              </>
            )}
          </NavLink>
        ))}
        {user && (
          <NavLink
            to={`/users/${user.id}`}
            className={({ isActive }) => rowCls(isActive)}
          >
            <img
              src={user.profile_picture_url}
              alt=""
              className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
            />
            Profile
          </NavLink>
        )}
        <NavLink
          to="/settings/profile"
          className={({ isActive }) => rowCls(isActive)}
        >
          {({ isActive }) => (
            <>
              <SettingsIcon className={iconCls(isActive)} />
              Settings
            </>
          )}
        </NavLink>
      </nav>

      <button onClick={compose.open} className="btn btn-primary mx-1 mt-4 shadow-lift">
        <PlusIcon className="text-lg" />
        New meme
      </button>

      <div className="mt-auto px-1">
        {user && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-2.5">
            <img
              src={user.profile_picture_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user.display_name || user.username}
              </p>
              <p className="truncate text-xs text-slate-400">@{user.username}</p>
            </div>
            <button
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              title="Log out"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
            >
              <LogoutIcon className="text-lg" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
