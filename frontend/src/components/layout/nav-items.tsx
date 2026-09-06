import type { ComponentType, SVGProps } from "react";
import { HomeIcon, UsersIcon, SearchIcon, ChatIcon } from "../icons";

export interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/feed", label: "Feed", Icon: HomeIcon },
  { to: "/friends", label: "Friends", Icon: UsersIcon },
  { to: "/search", label: "Discover", Icon: SearchIcon },
  { to: "/chat", label: "Messages", Icon: ChatIcon },
];
