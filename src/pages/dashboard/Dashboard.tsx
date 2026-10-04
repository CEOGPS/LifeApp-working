// src/pages/dashboard/Dashboard.tsx — LifeOS HOME
// PATCH (home-page2):
// - Restored the ORIGINAL home panel set (lifeos1.agentzero src/pages/dashboard/Dashboard.tsx,
//   2026-09-20): a later edit had replaced Quick Links, Calendar, Notifications, Music, Browser,
//   AI Insights and the Activity Feed with "unavailable" stubs and dropped Notes, AI Task
//   Monitor, Leads, Social / Marketing Analytics, AI Money Tips and Life Hacks.
// - Layout per Chris's reference: Erebus TALL in the centre column inside a glowing capsule
//   window, modules in the left and right columns, Activity Feed full width underneath.
//   (AppLayout no longer renders the wide AI stage strip on this page.)
// - Dropped the "sm:pr-20" gutter (it squeezed every column); the bottom spacer keeps the
//   dock button clear of the last module.
// PATCH (blue-theme): header accents switched from crimson to the blue/cyan theme; Erebus
//   now sits in a standard rectangular module card (see ErebusHomeStage).
// PATCH (ai-task-monitor): AI Task Monitor moved to a long full-width module ABOVE the
//   Activity Feed; Erebus stage shortened (glow-only, no bounce) in ErebusHomeStage.
// PATCH (tasks-home): Tasks stays a home module, not a sidebar row.
import { motion } from "motion/react";
import Module from "./_components/Module";
import TimeDateWeather from "./_components/TimeDateWeather";
import NotesModule from "./_components/NotesModule";
import TasksModule from "./_components/TasksModule";
import LeadsModule from "./_components/LeadsModule";
import NotificationsModule from "./_components/NotificationsModule";
import AgentMonitor from "./_components/AgentMonitor";
import { YoutubePlayerWithPersistence as YoutubePlayer } from "./_components/YoutubePlayer";
import MusicPlayer from "./_components/MusicPlayer";
import FinancialStats from "./_components/FinancialStats";
import RoiAnalysis from "./_components/RoiAnalysis";
import CreditScore from "./_components/CreditScore";
import BudgetExpenses from "./_components/BudgetExpenses";
import AiMoneyTips from "./_components/AiMoneyTips";
import AiInsights from "./_components/AiInsights";
import LifeHacks from "./_components/LifeHacks";
import SocialAnalytics from "./_components/SocialAnalytics";
import MarketingAnalytics from "./_components/MarketingAnalytics";
import CalendarModule from "./_components/CalendarModule";
import BrowserArea from "./_components/BrowserArea";
import QuickLinks from "./_components/QuickLinks";
import ActivityFeedPanel from "./ActivityFeedPanel";
import ErebusHomeStage from "./_components/ErebusHomeStage";

import {
  Clock,
  FileText,
  CheckSquare,
  UserPlus,
  Bell,
  Bot,
  PlayCircle,
  Music2,
  DollarSign,
  BarChart2,
  Star,
  Receipt,
  Sparkles,
  Brain,
  Lightbulb,
  Share2,
  Megaphone,
  Calendar,
  Globe,
  Link2,
  Activity,
} from "lucide-react";

export default function Dashboard() {
  return (
    <div className="p-4 min-h-full">
      {/* Welcome strip */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-5"
      >
        <div>
          <h1 className="font-display text-xl tracking-[0.12em] text-white-95">
            <span
              style={{
                color: "oklch(0.82 0.13 220)",
                textShadow: "0 0 14px oklch(0.72 0.15 225 / 80%)",
              }}
            >
              Cagednreality
            </span>
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 glass-crimson rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-green" />
          <span
            className="text-xs font-display tracking-widest"
            style={{ color: "oklch(0.85 0.12 215)" }}
          >
            LIFEOS ONLINE
          </span>
        </div>
      </motion.div>

      {/* Left modules | Erebus | right modules (stacks on smaller screens) */}
      <div
        className="grid gap-4 items-start grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)_minmax(0,1fr)]"
        data-testid="home-grid"
      >
        {/* Centre: Erebus (first on small screens) */}
        <div className="order-1 xl:order-2 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-2">
          <ErebusHomeStage />
        </div>

        {/* Left column */}
        <div className="order-2 xl:order-1 flex flex-col gap-4 min-w-0" data-testid="home-col-left">
          <Module title="Time & Weather" icon={<Clock size={13} />} accent>
            <TimeDateWeather />
          </Module>

          <Module title="Quick Links" icon={<Link2 size={13} />} className="h-[280px]">
            <QuickLinks />
          </Module>

          <Module title="Notes" icon={<FileText size={13} />} className="h-[300px]">
            <NotesModule />
          </Module>

          <Module title="Tasks" icon={<CheckSquare size={13} />} className="h-[300px]">
            <TasksModule />
          </Module>

          <Module title="Calendar" icon={<Calendar size={13} />} className="min-h-[340px]">
            <CalendarModule />
          </Module>

          <Module title="Budget & Expenses" icon={<Receipt size={13} />} className="h-[340px]">
            <BudgetExpenses />
          </Module>

          <Module title="AI Money Tips" icon={<Sparkles size={13} />} accent className="h-[300px]">
            <AiMoneyTips />
          </Module>

          <Module title="Life Hacks" icon={<Lightbulb size={13} />} className="h-[290px]">
            <LifeHacks />
          </Module>

          <Module title="Leads" icon={<UserPlus size={13} />} className="h-[320px]">
            <LeadsModule />
          </Module>

          <Module title="Social Analytics" icon={<Share2 size={13} />} className="h-[320px]">
            <SocialAnalytics />
          </Module>
        </div>

        {/* Right column */}
        <div className="order-3 flex flex-col gap-4 min-w-0" data-testid="home-col-right">
          <Module
            title="Notifications"
            icon={<Bell size={13} />}
            accent
            className="h-[300px]"
            headerRight={
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-green" />
                <span
                  className="text-[9px] font-display"
                  style={{ color: "oklch(0.75 0.15 175)" }}
                >
                  LIVE
                </span>
              </div>
            }
          >
            <NotificationsModule />
          </Module>

          <Module title="YouTube Player" icon={<PlayCircle size={13} />} className="h-[520px]">
            <YoutubePlayer />
          </Module>

          <Module title="AI Insights" icon={<Brain size={13} />} accent className="h-[260px]">
            <AiInsights />
          </Module>

          <Module title="Music Player" icon={<Music2 size={13} />} accent className="min-h-[320px]">
            <MusicPlayer />
          </Module>

          <Module title="Financial Stats" icon={<DollarSign size={13} />} accent className="min-h-[300px]">
            <FinancialStats />
          </Module>

          <Module title="ROI & Volume" icon={<BarChart2 size={13} />} className="min-h-[300px]">
            <RoiAnalysis />
          </Module>

          <Module title="Credit Scores" icon={<Star size={13} />} accent>
            <CreditScore />
          </Module>

          <Module title="Marketing & Web Analytics" icon={<Megaphone size={13} />} className="min-h-[260px]">
            <MarketingAnalytics />
          </Module>

          <Module title="Browser" icon={<Globe size={13} />} className="min-h-[240px]">
            <BrowserArea />
          </Module>
        </div>
      </div>

      {/* Long AI Task Monitor ABOVE the activity feed */}
      <div className="mt-4 w-full" data-testid="home-ai-task-monitor">
        <Module
          title="AI Task Monitor"
          icon={<Bot size={13} />}
          accent
          className="w-full"
          headerRight={
            <span className="text-[9px] font-display tracking-widest text-white/40 uppercase">
              Agents · Tasks · Progress
            </span>
          }
        >
          <div className="h-[320px] overflow-hidden">
            <AgentMonitor />
          </div>
        </Module>
      </div>

      {/* Full-width activity feed — shows all actions across the dashboard */}
      <div className="mt-4 w-full">
        <Module
          title="Activity Feed"
          icon={<Activity size={13} />}
          accent
          className="w-full"
        >
          <div className="h-[460px] overflow-hidden">
            <ActivityFeedPanel />
          </div>
        </Module>
      </div>

      {/* Bottom spacer for Erebus dock */}
      <div className="h-24" />
    </div>
  );
}
