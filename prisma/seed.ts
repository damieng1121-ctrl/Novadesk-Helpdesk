import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * DfE "digital and technology standards for schools and colleges" catalogue.
 *
 * This reflects the shape and spirit of the standards DfE publishes on
 * GOV.UK (broadband, network, cyber security, filtering & monitoring,
 * cloud, digital leadership, business continuity, accessibility) so the
 * compliance module is useful out of the box. DfE updates these standards
 * periodically — treat this as a working starting point, not a verbatim
 * copy, and confirm current wording/thresholds against
 * https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges
 * before using it for an official compliance return.
 */
const GOV_BASE = "https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges";

const STANDARDS = [
  {
    code: "broadband",
    title: "Broadband",
    description: "Connectivity is fast and reliable enough for whole-school digital teaching and administration.",
    officialUrl: `${GOV_BASE}/broadband-internet-standards-for-schools-and-colleges`,
    items: [
      {
        code: "broadband-capacity",
        title: "Minimum bandwidth",
        description: "The school has enough bandwidth for concurrent use across all teaching spaces and admin systems.",
        guidance: "DfE's indicative minimum for a primary school is a 100Mbps download / 25Mbps upload connection — check the current published figures for your school size.",
        priority: "MEDIUM" as const,
      },
      {
        code: "broadband-resilience",
        title: "Resilient connection",
        description: "There is a backup connection or documented failover plan if the primary line fails.",
        priority: "HIGH" as const,
      },
      {
        code: "broadband-contract",
        title: "Contract reviewed",
        description: "The broadband contract has been reviewed in the last 12 months for value, capacity, and term.",
        priority: "LOW" as const,
      },
    ],
  },
  {
    code: "wireless-network",
    title: "Wireless network",
    description: "Wi-Fi coverage and capacity supports teaching and learning in every space it's needed.",
    officialUrl: `${GOV_BASE}/wireless-network-standards-for-schools-and-colleges`,
    items: [
      {
        code: "wireless-coverage",
        title: "Full coverage",
        description: "Wireless access points provide reliable coverage in all classrooms and teaching spaces.",
        priority: "HIGH" as const,
      },
      {
        code: "wireless-capacity",
        title: "Sufficient capacity",
        description: "Access points can support a full class of concurrent devices without significant slowdown.",
        priority: "MEDIUM" as const,
      },
      {
        code: "wireless-security",
        title: "Secure authentication",
        description: "Staff/pupil Wi-Fi uses WPA2-Enterprise (or stronger) and any guest network is segregated from the main network.",
        priority: "HIGH" as const,
      },
    ],
  },
  {
    code: "network-switches",
    title: "Network switches & cabling",
    description: "The physical network is managed, monitored, and free of single points of failure.",
    items: [
      {
        code: "switches-managed",
        title: "Managed switching",
        description: "Core and edge switches are managed, support VLANs, and are centrally monitored.",
        govLink: `${GOV_BASE}/network-switching-standards-for-schools-and-colleges`,
        priority: "HIGH" as const,
      },
      {
        code: "cabling-standard",
        title: "Structured cabling",
        description: "Cabling meets at least Cat5e (ideally Cat6) to support required network speeds.",
        govLink: `${GOV_BASE}/network-cabling-standards-for-schools-and-colleges`,
        priority: "MEDIUM" as const,
      },
      {
        code: "switches-resilience",
        title: "No single point of failure",
        description: "Core switching has redundancy so one device failing doesn't take down the whole network.",
        govLink: `${GOV_BASE}/network-switching-standards-for-schools-and-colleges`,
        priority: "MEDIUM" as const,
      },
    ],
  },
  {
    code: "servers",
    title: "Servers",
    description: "On-premise and cloud server estate is documented, backed up, and kept within support.",
    officialUrl: `${GOV_BASE}/servers-and-storage-standards-for-schools-and-colleges`,
    items: [
      {
        code: "servers-inventory",
        title: "Documented estate",
        description: "All servers (physical, virtual, cloud) are inventoried with owners and end-of-support dates.",
        priority: "MEDIUM" as const,
      },
      {
        code: "servers-backup",
        title: "Tested backups",
        description: "A 3-2-1 backup strategy is in place and restores are tested at least annually.",
        priority: "HIGH" as const,
      },
    ],
  },
  {
    code: "cyber-security",
    title: "Cyber security",
    description: "Technical and organisational controls protect the school against common cyber threats.",
    officialUrl: `${GOV_BASE}/cyber-security-standards-for-schools-and-colleges`,
    items: [
      {
        code: "cyber-mfa",
        title: "Multi-factor authentication",
        description: "MFA is enforced for all staff accounts with access to school data, finance, or admin systems.",
        priority: "HIGH" as const,
      },
      {
        code: "cyber-patching",
        title: "Patch management",
        description: "Operating systems and key software are patched on a defined schedule.",
        guidance: "DfE's indicative target is critical/high-severity patches applied within 14 days of release.",
        priority: "MEDIUM" as const,
      },
      {
        code: "cyber-policy",
        title: "Cyber security policy",
        description: "A cyber security policy exists, is reviewed annually, and staff receive related training.",
        priority: "MEDIUM" as const,
      },
      {
        code: "cyber-incident-response",
        title: "Incident response plan",
        description: "A documented incident response plan exists and has been tested (e.g. via a tabletop exercise).",
        priority: "HIGH" as const,
      },
      {
        code: "cyber-backup-strategy",
        title: "3-2-1 backup strategy",
        description: "3 copies of critical data, on 2 different media, with 1 copy offsite or immutable.",
        priority: "HIGH" as const,
      },
    ],
  },
  {
    code: "filtering-monitoring",
    title: "Filtering and monitoring",
    description: "Internet filtering and monitoring meet Keeping Children Safe in Education (KCSIE) expectations.",
    officialUrl: `${GOV_BASE}/filtering-and-monitoring-standards-for-schools-and-colleges`,
    items: [
      {
        code: "filtering-illegal-content",
        title: "Illegal content blocked",
        description: "Filtering blocks illegal content using recognised reference lists (e.g. IWF and CTIRU).",
        priority: "HIGH" as const,
      },
      {
        code: "filtering-age-appropriate",
        title: "Age-appropriate categorisation",
        description: "Content is filtered by category appropriate to pupil age (e.g. gambling, pornography, extremism), aligned to UK Safer Internet Centre categorisation.",
        priority: "HIGH" as const,
      },
      {
        code: "monitoring-keyword-logging",
        title: "Keyword logging",
        description: "Monitoring detects harmful language and search terms (e.g. self-harm, radicalisation indicators), not just blocked-site logs.",
        priority: "HIGH" as const,
      },
      {
        code: "monitoring-realtime-alerts",
        title: "Real-time alerts for high-severity terms",
        description: "High-severity keyword matches trigger a same-day alert, not just a report reviewed later.",
        priority: "HIGH" as const,
      },
      {
        code: "monitoring-encrypted-traffic",
        title: "Encrypted traffic visibility",
        description: "Monitoring covers HTTPS traffic where technically and legally possible, not only unencrypted requests.",
        priority: "MEDIUM" as const,
      },
      {
        code: "monitoring-dsl-reporting",
        title: "DSL receives monitoring reports",
        description: "The Designated Safeguarding Lead receives monitoring alerts/reports promptly, with a documented escalation route.",
        priority: "HIGH" as const,
      },
      {
        code: "filtering-review",
        title: "Annual review",
        description: "Filtering and monitoring provision is reviewed at least annually and evidenced (e.g. via a completed self-review checklist).",
        priority: "MEDIUM" as const,
      },
    ],
  },
  {
    code: "cloud-solutions",
    title: "Cloud solutions",
    description: "Cloud platforms used by the school protect data appropriately and are managed with clear ownership.",
    officialUrl: `${GOV_BASE}/cloud-solution-standards-for-schools-and-colleges`,
    items: [
      {
        code: "cloud-data-protection",
        title: "Data protection compliance",
        description: "Cloud providers in use (MIS, Google Workspace, etc.) meet UK GDPR requirements, with data processing agreements in place.",
        priority: "HIGH" as const,
      },
      {
        code: "cloud-access-control",
        title: "Least-privilege access",
        description: "Role-based access control is applied to cloud platforms; leavers are removed promptly.",
        priority: "HIGH" as const,
      },
      {
        code: "cloud-backup-restore",
        title: "Backup and restore capability",
        description: "Cloud services used for critical data have a documented backup/restore capability, not just vendor-assumed durability.",
        priority: "MEDIUM" as const,
      },
    ],
  },
  {
    code: "digital-leadership",
    title: "Digital leadership",
    description: "Someone owns digital strategy, and it's resourced.",
    officialUrl: `${GOV_BASE}/digital-leadership-and-governance-standards`,
    items: [
      {
        code: "leadership-named",
        title: "Named digital lead",
        description: "A named senior leader (or governor) is responsible for digital strategy and technology standards.",
        priority: "HIGH" as const,
      },
      {
        code: "leadership-strategy",
        title: "Digital development plan",
        description: "A documented digital strategy exists, aligned to curriculum, safeguarding, and budget planning.",
        priority: "MEDIUM" as const,
      },
      {
        code: "leadership-budget",
        title: "Dedicated ICT budget",
        description: "A recurring budget line exists for ICT infrastructure, support, and replacement — not ad hoc spending.",
        priority: "MEDIUM" as const,
      },
    ],
  },
  {
    code: "business-continuity",
    title: "Business continuity & disaster recovery",
    description: "The school can keep operating, or recover quickly, if critical systems fail.",
    items: [
      {
        code: "bcdr-plan",
        title: "BCDR plan documented and tested",
        description: "A business continuity / disaster recovery plan exists and has been tested in the last 12 months.",
        priority: "HIGH" as const,
      },
      {
        code: "bcdr-rto",
        title: "Recovery objectives defined",
        description: "Recovery time objectives are defined for critical systems (MIS, safeguarding records, finance).",
        priority: "MEDIUM" as const,
      },
    ],
  },
  {
    code: "digital-accessibility",
    title: "Digital accessibility",
    description: "School websites, platforms, and assistive technology support pupils and staff with additional needs.",
    officialUrl: `${GOV_BASE}/digital-accessibility-standards`,
    items: [
      {
        code: "accessibility-psbar",
        title: "Public Sector Bodies Accessibility Regulations",
        description: "The school website and key online platforms meet WCAG 2.2 AA, with an accessibility statement published.",
        priority: "HIGH" as const,
      },
      {
        code: "accessibility-assistive-tech",
        title: "Assistive technology provision",
        description: "Assistive/adaptive technology needs for SEND pupils are reviewed and provisioned as part of EHCP/SEND support.",
        priority: "MEDIUM" as const,
      },
    ],
  },
  {
    code: "it-support",
    title: "IT support",
    description: "Standards for how IT support is commissioned, delivered, and reviewed — whether in-house, outsourced, or a mix.",
    officialUrl: `${GOV_BASE}/it-support-standards-for-schools-and-colleges`,
    items: [
      {
        code: "itsupport-sla",
        title: "Clear SLAs",
        description: "Response and resolution targets are clearly defined for different priority levels.",
        priority: "MEDIUM" as const,
      },
      {
        code: "itsupport-ticketing",
        title: "Ticketing system in use",
        description: "Incidents and requests are logged and tracked through to resolution, not handled ad hoc.",
        priority: "MEDIUM" as const,
      },
      {
        code: "itsupport-change-management",
        title: "Change management process",
        description: "Significant changes to systems/infrastructure follow a documented approval and rollback process.",
        priority: "LOW" as const,
      },
      {
        code: "itsupport-annual-review",
        title: "Annual performance review",
        description: "IT support performance (response times, satisfaction, recurring issues) is reviewed at least annually.",
        priority: "LOW" as const,
      },
    ],
  },
  {
    code: "devices",
    title: "Laptops, desktops & tablets",
    description: "Standards on device specification, management, and security across the school's device estate.",
    officialUrl: `${GOV_BASE}/laptop-desktop-and-tablet-standards`,
    items: [
      {
        code: "devices-supported-os",
        title: "Supported, patched OS",
        description: "Devices run an operating system still receiving security updates from its vendor.",
        priority: "HIGH" as const,
      },
      {
        code: "devices-performance-spec",
        title: "Fit-for-purpose specification",
        description: "Devices meet minimum performance specs for their role (teaching, admin, exams).",
        priority: "MEDIUM" as const,
      },
      {
        code: "devices-centrally-managed",
        title: "Centrally managed",
        description: "All devices are enrolled in an MDM or domain, allowing remote policy, patching, and wipe.",
        priority: "HIGH" as const,
      },
      {
        code: "devices-encrypted",
        title: "Disk encryption",
        description: "Devices that can hold personal data are encrypted (BitLocker/FileVault/equivalent).",
        priority: "HIGH" as const,
      },
    ],
  },
];

async function seedComplianceCatalogue() {
  for (const [standardOrder, standard] of STANDARDS.entries()) {
    const created = await prisma.complianceStandard.upsert({
      where: { code: standard.code },
      create: {
        code: standard.code,
        title: standard.title,
        description: standard.description,
        officialUrl: standard.officialUrl,
        order: standardOrder,
      },
      update: {
        title: standard.title,
        description: standard.description,
        officialUrl: standard.officialUrl,
        order: standardOrder,
      },
    });

    for (const [itemOrder, item] of standard.items.entries()) {
      await prisma.complianceItem.upsert({
        where: { standardId_code: { standardId: created.id, code: item.code } },
        create: { ...item, standardId: created.id, order: itemOrder },
        update: { ...item, order: itemOrder },
      });
    }
  }
  console.log(`Seeded ${STANDARDS.length} DfE compliance standards.`);
}

/**
 * One helpdesk, one founding admin — no demo companies, tickets, or KB
 * articles. Everything else (technicians, users, companies, tickets) gets
 * added through the real UI once the admin signs in, rather than faked
 * here.
 */
async function seedSingleOrg() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "novadesk" },
    create: {
      name: "Novadesk Helpdesk",
      slug: "novadesk",
      brandColor: "#4f46e5",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "damieng1121@gmail.com" },
    create: {
      email: "damieng1121@gmail.com",
      name: "Damien",
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
    },
    update: { tenantId: tenant.id },
  });

  console.log(`Seeded '${tenant.name}' with one founding admin (damieng1121@gmail.com).`);
}

async function main() {
  await seedComplianceCatalogue();
  await seedSingleOrg();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
