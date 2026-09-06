import { Brand, BrandMark } from "./layout/Brand";
import { ChatIcon, HeartIcon, UsersIcon } from "./icons";

const FEATURES = [
  { Icon: HeartIcon, title: "A feed that's just your people", text: "Only you and friends — no algorithmic noise." },
  { Icon: UsersIcon, title: "Build your circle", text: "Send requests, accept friends, share the good stuff." },
  { Icon: ChatIcon, title: "Real-time chat", text: "DM your friends with typing and read receipts." },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Brand / marketing panel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(30rem 30rem at 80% 10%, rgba(255,255,255,0.25), transparent 60%), radial-gradient(24rem 24rem at 10% 90%, rgba(255,255,255,0.18), transparent 60%)",
          }}
        />
        <div className="relative">
          <Brand tone="light" />
        </div>
        <div className="relative mt-auto">
          <h2 className="max-w-sm text-3xl font-extrabold leading-tight">
            Where your group chat&rsquo;s best memes actually live.
          </h2>
          <ul className="mt-8 space-y-5">
            {FEATURES.map(({ Icon, title: t, text }) => (
              <li key={t} className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur">
                  <Icon className="text-xl" />
                </span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="text-sm text-white/75">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-white/60">
          MemeShare · built with FastAPI + React
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden">
            <BrandMark className="h-11 w-11 text-xl" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 text-sm text-slate-500">{footer}</div>
        </div>
      </main>
    </div>
  );
}
