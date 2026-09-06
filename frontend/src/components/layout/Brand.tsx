import { Link } from "react-router-dom";
import { SparkleIcon } from "../icons";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`grid place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-600 text-white shadow-sm shadow-brand-600/30 ${className}`}
    >
      <SparkleIcon className="text-[1.1em]" />
    </span>
  );
}

export function Brand({
  to = "/feed",
  showWordmark = true,
  tone = "dark",
}: {
  to?: string;
  showWordmark?: boolean;
  /** "dark" text for light backgrounds, "light" for coloured/gradient panels. */
  tone?: "dark" | "light";
}) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5">
      <BrandMark className="h-9 w-9 text-lg" />
      {showWordmark && (
        <span
          className={`text-lg font-extrabold tracking-tight ${
            tone === "light" ? "text-white" : "text-slate-900"
          }`}
        >
          Meme
          <span className={tone === "light" ? "text-white/80" : "text-gradient"}>Share</span>
        </span>
      )}
    </Link>
  );
}
