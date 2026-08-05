import type { AgentOs } from "@prisma/client";

export interface AgentToolCommandDefault {
  title: string;
  command: string;
  description: string;
}

/**
 * Sensible defaults ship as app-level constants rather than seeded rows —
 * every school gets the same starting toolkit for free, and the
 * AgentToolCommand/AgentToolLink models are only for a tenant's own
 * additions on top of these.
 */
export const DEFAULT_AGENT_COMMANDS: Record<AgentOs, AgentToolCommandDefault[]> = {
  WINDOWS: [
    { title: "Refresh group policy", command: "gpupdate /force", description: "Re-applies GPOs without a reboot." },
    { title: "Flush DNS cache", command: "ipconfig /flushdns", description: "Clears stale DNS entries after a network change." },
    { title: "Repair system files", command: "sfc /scannow", description: "Scans and repairs corrupted Windows system files." },
    { title: "Restart print spooler", command: "net stop spooler && net start spooler", description: "Fixes stuck print jobs and unresponsive printers." },
    { title: "Reset Windows Update", command: "wuauclt /resetauthorization /detectnow", description: "Kicks a stalled Windows Update check back into life." },
    { title: "Check disk for errors", command: "chkdsk C: /f /r", description: "Schedules a disk check and repair on next restart." },
  ],
  MAC: [
    { title: "Flush DNS cache", command: "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder", description: "Clears stale DNS entries after a network change." },
    { title: "Run maintenance scripts", command: "sudo periodic daily weekly monthly", description: "Runs the built-in cleanup/maintenance scripts." },
    { title: "Repair disk permissions", command: "diskutil verifyVolume /", description: "Checks the startup disk for permission/filesystem issues." },
    { title: "Reset printing system", command: "sudo lpadmin -x $(lpstat -p | awk '{print $2}')", description: "Removes all configured printers so they can be re-added." },
    { title: "Rebuild Spotlight index", command: "sudo mdutil -E /", description: "Fixes broken or slow Spotlight search results." },
  ],
  CHROMEBOOK: [
    { title: "Reload enterprise policy", command: "chrome://policy → Reload policies", description: "Pulls the latest managed policy from the Admin console." },
    { title: "Clear cached network state", command: "chrome://net-internals/#dns → Clear host cache", description: "Fixes connectivity issues caused by stale network state." },
    { title: "Check enrollment status", command: "chrome://management", description: "Confirms the device is enrolled and shows applied policies." },
    { title: "Powerwash (factory reset)", command: "chrome://settings/reset → Powerwash", description: "Last resort — wipes local data and re-enrolls on next boot." },
  ],
};

export interface AgentConsoleLinkDefault {
  title: string;
  url: string;
}

export const DEFAULT_AGENT_CONSOLE_LINKS: AgentConsoleLinkDefault[] = [
  { title: "Google Admin console", url: "https://admin.google.com" },
  { title: "Google Workspace status dashboard", url: "https://www.google.com/appsstatus/dashboard/" },
  { title: "Chrome Education admin console", url: "https://admin.google.com/ac/chrome" },
  { title: "Microsoft 365 admin center", url: "https://admin.microsoft.com" },
];

export const AGENT_OS_LABELS: Record<AgentOs, string> = {
  WINDOWS: "Windows",
  MAC: "Mac",
  CHROMEBOOK: "Chromebook",
};
