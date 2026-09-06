import { useLocation } from "react-router-dom";
import { useCompose } from "../../lib/compose";
import { UploadForm } from "../UploadForm";
import { Sidebar } from "./Sidebar";
import { RightRail } from "./RightRail";
import { MobileNav, MobileTopBar } from "./MobileNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const compose = useCompose();
  const { pathname } = useLocation();
  // Chat wants the full width and its own scroll region — drop the right rail there.
  const wide = pathname.startsWith("/chat");

  return (
    <div className="min-h-screen">
      <MobileTopBar />

      <div className="mx-auto flex w-full max-w-[1200px] gap-6 px-0 sm:px-5">
        <Sidebar />

        <main
          className={`min-w-0 flex-1 pb-24 lg:pb-10 ${
            wide ? "" : "border-slate-200/70 sm:border-x sm:bg-white/45"
          }`}
        >
          {children}
        </main>

        {!wide && <RightRail />}
      </div>

      <MobileNav />

      {compose.isOpen && <UploadForm onDone={compose.close} />}
    </div>
  );
}
