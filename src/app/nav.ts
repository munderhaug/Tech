import {
  Calendar,
  Cloud,
  LayoutDashboard,
  MessageSquare,
  Mic2,
  Package,
  Radio,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Show in the mobile bottom bar (max 5). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { to: "/artists", label: "Artists", icon: Mic2, primary: true },
  { to: "/schedule", label: "Schedule", icon: Calendar, primary: true },
  { to: "/chat", label: "Chat", icon: MessageSquare, primary: true },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/crew", label: "Crew & Time", icon: Users },
  { to: "/power", label: "Power", icon: Zap },
  { to: "/comms", label: "Comms", icon: Radio },
  { to: "/weather", label: "Weather", icon: Cloud },
];
