import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-100"
  }`;

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-2">
        <Link to="/feed" className="mr-2 text-lg font-bold text-indigo-600">
          MemeShare
        </Link>
        <NavLink to="/feed" className={linkCls}>
          Feed
        </NavLink>
        <NavLink to="/friends" className={linkCls}>
          Friends
        </NavLink>
        <NavLink to="/search" className={linkCls}>
          Search
        </NavLink>
        <NavLink to="/chat" className={linkCls}>
          Chat
        </NavLink>
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <Link to={`/users/${user.id}`} className="flex items-center gap-2">
              <img
                src={user.profile_picture_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="text-sm font-medium">{user.username}</span>
            </Link>
          )}
          <button
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}
