/** Small inline icons (no icon library needed). Swap for lucide-react later if you like. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function SparkIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="currentColor" />
    </svg>
  );
}
export function CheckIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
export function CrossIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
export function DownloadIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16" />
    </svg>
  );
}
export function ShareIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14" />
    </svg>
  );
}
export function CopyIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </svg>
  );
}
export function RefreshIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" />
    </svg>
  );
}
export function ClockIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
export function LayersIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2l10 6-10 6L2 8z" />
      <path d="M2 16l10 6 10-6" />
    </svg>
  );
}
export function ArrowUpIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
export function StopIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}
