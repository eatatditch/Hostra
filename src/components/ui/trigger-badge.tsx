import { cn } from "@/lib/utils";
import { TriggerType, TriggerSeverity } from "@/types";
import {
  Cake,
  Heart,
  Star,
  UserPlus,
  Clock,
  AlertTriangle,
  Armchair,
  ShieldAlert,
  Trophy,
  Users,
  MessageSquare,
  Zap,
} from "lucide-react";

const triggerIcons: Record<string, React.ElementType> = {
  [TriggerType.BIRTHDAY]: Cake,
  [TriggerType.ANNIVERSARY]: Heart,
  [TriggerType.FIRST_VISIT]: UserPlus,
  [TriggerType.RETURNING_AFTER_ABSENCE]: Clock,
  [TriggerType.VIP]: Star,
  [TriggerType.HIGH_FREQUENCY]: Zap,
  [TriggerType.NO_SHOW_RISK]: AlertTriangle,
  [TriggerType.PREFERRED_SEATING]: Armchair,
  [TriggerType.PRIOR_ISSUE]: ShieldAlert,
  [TriggerType.MILESTONE_VISIT]: Trophy,
  [TriggerType.LARGE_PARTY]: Users,
  [TriggerType.SPECIAL_REQUEST]: MessageSquare,
};

const triggerLabels: Record<string, string> = {
  [TriggerType.BIRTHDAY]: "Birthday",
  [TriggerType.ANNIVERSARY]: "Anniversary",
  [TriggerType.FIRST_VISIT]: "First Visit",
  [TriggerType.RETURNING_AFTER_ABSENCE]: "Welcome Back",
  [TriggerType.VIP]: "VIP",
  [TriggerType.HIGH_FREQUENCY]: "Frequent",
  [TriggerType.NO_SHOW_RISK]: "No-Show Risk",
  [TriggerType.PREFERRED_SEATING]: "Seat Pref",
  [TriggerType.PRIOR_ISSUE]: "Prior Issue",
  [TriggerType.MILESTONE_VISIT]: "Milestone",
  [TriggerType.LARGE_PARTY]: "Large Party",
  [TriggerType.SPECIAL_REQUEST]: "Special Req",
};

const severityStyles: Record<string, string> = {
  [TriggerSeverity.INFO]: "bg-ditch-blue/10 text-ditch-blue border-ditch-blue/20",
  [TriggerSeverity.ACTION]:
    "bg-ditch-orange/10 text-ditch-orange-dark border-ditch-orange/20",
  [TriggerSeverity.CRITICAL]:
    "bg-status-error/10 text-status-error border-status-error/20",
};

interface TriggerBadgeProps {
  type: string;
  severity: string;
  compact?: boolean;
  className?: string;
}

export function TriggerBadge({
  type,
  severity,
  compact = false,
  className,
}: TriggerBadgeProps) {
  const Icon = triggerIcons[type] || Zap;
  const label = triggerLabels[type] || type;
  const style = severityStyles[severity] || severityStyles.info;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        style,
        className
      )}
      title={label}
    >
      <Icon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {!compact && label}
    </span>
  );
}
