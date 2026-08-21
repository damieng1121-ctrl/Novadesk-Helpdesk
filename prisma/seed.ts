import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeDueAt } from "../src/lib/sla";

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

async function seedDemoTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "willowbrook" },
    create: {
      name: "Willowbrook Primary School",
      slug: "willowbrook",
      domain: "willowbrook-primary.sch.uk",
      urn: "999999",
      phase: "PRIMARY",
      brandColor: "#2563eb",
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "admin@willowbrook-primary.sch.uk" },
    create: {
      email: "admin@willowbrook-primary.sch.uk",
      name: "Priya Shah",
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
      jobTitle: "School Business Manager",
    },
    update: { tenantId: tenant.id },
  });

  const agent = await prisma.user.upsert({
    where: { email: "it-support@willowbrook-primary.sch.uk" },
    create: {
      email: "it-support@willowbrook-primary.sch.uk",
      name: "Sam Okafor",
      role: "AGENT",
      tenantId: tenant.id,
      jobTitle: "IT Technician",
    },
    update: { tenantId: tenant.id },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "j.taylor@willowbrook-primary.sch.uk" },
    create: {
      email: "j.taylor@willowbrook-primary.sch.uk",
      name: "Jamie Taylor",
      role: "REQUESTER",
      tenantId: tenant.id,
      jobTitle: "Year 3 Teacher",
    },
    update: { tenantId: tenant.id },
  });

  const categoryNames = ["Hardware", "Network", "MIS / Software", "Printing", "Account access", "Classroom AV"];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.category.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name } },
        create: { tenantId: tenant.id, name },
        update: {},
      }),
    ),
  );

  const existingTickets = await prisma.ticket.count({ where: { tenantId: tenant.id } });
  if (existingTickets === 0) {
    const ticket1 = await prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        number: 1,
        subject: "Interactive whiteboard in Year 3 won't turn on",
        description: "The Promethean board in Room 3B has no power. Checked the plug socket and it's fine.",
        status: "IN_PROGRESS",
        priority: "HIGH",
        // Deliberately in the past so the demo data shows an overdue ticket.
        dueAt: new Date(Date.now() - 60 * 60 * 1000),
        categoryId: categories.find((c) => c.name === "Classroom AV")!.id,
        requesterId: teacher.id,
        assigneeId: agent.id,
        aiSummary: "Whiteboard in Room 3B is completely unresponsive despite a working power socket; likely a hardware fault.",
      },
    });
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket1.id,
        authorId: agent.id,
        body: "Thanks Jamie — I'll pop over at lunchtime with a replacement power lead to rule that out first.",
        isInternal: false,
      },
    });
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket1.id,
        authorId: agent.id,
        body: "Power lead wasn't it — looks like the board itself has failed. Raising a claim with the supplier's warranty.",
        isInternal: true,
      },
    });

    await prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        number: 2,
        subject: "Can't log into SIMS this morning",
        description: "Getting 'invalid credentials' on SIMS even though I haven't changed my password.",
        status: "OPEN",
        priority: "MEDIUM",
        dueAt: computeDueAt("MEDIUM"),
        categoryId: categories.find((c) => c.name === "Account access")!.id,
        requesterId: teacher.id,
      },
    });

    await prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        number: 3,
        subject: "Staff room printer jamming constantly",
        description: "The printer in the staff room jams on almost every print job today.",
        status: "RESOLVED",
        priority: "LOW",
        categoryId: categories.find((c) => c.name === "Printing")!.id,
        requesterId: teacher.id,
        assigneeId: agent.id,
        // Explicit createdAt (rather than relying on @default(now())) so
        // resolvedAt is guaranteed to land after it — otherwise the two
        // independently-evaluated "now" values can race by a millisecond
        // and produce a negative resolution time on the reports/dashboard.
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        resolvedAt: new Date(),
      },
    });
  }

  const kbCategory = await prisma.kbCategory.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "getting-started" } },
    create: { tenantId: tenant.id, name: "Getting started", slug: "getting-started" },
    update: {},
  });

  await prisma.kbArticle.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "resetting-your-password" } },
    create: {
      tenantId: tenant.id,
      categoryId: kbCategory.id,
      title: "Resetting your password",
      slug: "resetting-your-password",
      status: "PUBLISHED",
      authorId: agent.id,
      content:
        "# Resetting your password\n\nIf you've forgotten your password:\n\n1. Go to the sign-in page and click **Sign in with Google**.\n2. Use the 'Forgot password' link on the Google sign-in screen — Novadesk uses your school Google account, so there's no separate Novadesk password to remember.\n3. If you still can't get in, ask the IT team to check your Google Workspace account is active.\n\nIf two-factor authentication is asking for a code you don't have, use one of your recovery codes from Account > Security, or ask an admin to reset your 2FA.",
    },
    update: {},
  });

  await prisma.kbArticle.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "connecting-to-the-interactive-whiteboard" } },
    create: {
      tenantId: tenant.id,
      categoryId: kbCategory.id,
      title: "Connecting a laptop to the interactive whiteboard",
      slug: "connecting-to-the-interactive-whiteboard",
      status: "PUBLISHED",
      authorId: agent.id,
      content:
        "# Connecting a laptop to the interactive whiteboard\n\n1. Connect the HDMI cable from the whiteboard to your laptop.\n2. Select the whiteboard's input source (usually HDMI 1) using the remote or front panel buttons.\n3. On Windows, press Windows + P and choose 'Duplicate' or 'Extend'.\n\nIf there's no picture, check the board is powered on and the correct input is selected before raising a ticket.",
    },
    update: {},
  });

  console.log(`Seeded demo tenant '${tenant.name}' (${tenant.slug}) with admin/agent/teacher users, tickets, and KB articles.`);
}

/** Weekdays only, working backwards from today — good enough for demo attendance/meal data. */
function lastNWeekdays(n: number): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dates.length < n) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates.reverse();
}

/**
 * Populates the School MIS side of the demo tenant: academic year, form
 * groups, pupils, guardians (parent portal accounts), and a slice of
 * attendance/behaviour/SEND/assessment/ops/parents'-evening/messaging data
 * across every new module, so the demo tenant showcases the whole platform.
 * Guarded by a single "any pupils already exist?" check for idempotency,
 * same pattern as seedDemoTenant's ticket guard.
 */
async function seedSchoolMis() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "willowbrook" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@willowbrook-primary.sch.uk" } });
  const agent = await prisma.user.findUniqueOrThrow({ where: { email: "it-support@willowbrook-primary.sch.uk" } });
  const teacher = await prisma.user.update({
    where: { email: "j.taylor@willowbrook-primary.sch.uk" },
    data: { isTeacher: true },
  });

  const existingPupils = await prisma.pupil.count({ where: { tenantId: tenant.id } });
  if (existingPupils > 0) {
    console.log("School MIS demo data already seeded — skipping.");
    return;
  }

  const academicYear = await prisma.academicYear.create({
    data: {
      tenantId: tenant.id,
      name: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-21"),
      isCurrent: true,
    },
  });

  const formGroup3W = await prisma.formGroup.create({
    data: { tenantId: tenant.id, academicYearId: academicYear.id, name: "3W", yearGroup: "YEAR_3", staffLeadId: teacher.id },
  });
  const formGroup1G = await prisma.formGroup.create({
    data: { tenantId: tenant.id, academicYearId: academicYear.id, name: "1G", yearGroup: "YEAR_1" },
  });

  const pupilDefs = [
    { first: "Amelia", last: "Clarke", dob: "2016-09-14", gender: "FEMALE" as const, yearGroup: "YEAR_3" as const, formGroupId: formGroup3W.id, ethnicity: "White British", homeLanguage: "English", postcode: "WB1 2AB" },
    { first: "Oliver", last: "Bennett", dob: "2016-11-02", gender: "MALE" as const, yearGroup: "YEAR_3" as const, formGroupId: formGroup3W.id, ethnicity: "Black British - African", homeLanguage: "English", postcode: "WB2 4CD", sendStatus: "SEND_SUPPORT" as const, pupilPremium: true },
    { first: "Isla", last: "Robinson", dob: "2017-01-20", gender: "FEMALE" as const, yearGroup: "YEAR_3" as const, formGroupId: formGroup3W.id, ethnicity: "White British", homeLanguage: "English", postcode: "WB1 6EF" },
    { first: "Noah", last: "Whitfield", dob: "2016-08-05", gender: "MALE" as const, yearGroup: "YEAR_3" as const, formGroupId: formGroup3W.id, ethnicity: "Mixed - White and Black Caribbean", homeLanguage: "English", postcode: "WB3 1GH", freeSchoolMeals: true },
    { first: "Freya", last: "Ahmed", dob: "2016-12-11", gender: "FEMALE" as const, yearGroup: "YEAR_3" as const, formGroupId: formGroup3W.id, ethnicity: "Asian British - Pakistani", homeLanguage: "Urdu", postcode: "WB2 8JK" },
    { first: "George", last: "Patel", dob: "2019-03-02", gender: "MALE" as const, yearGroup: "YEAR_1" as const, formGroupId: formGroup1G.id, ethnicity: "Asian British - Indian", homeLanguage: "Gujarati", postcode: "WB4 3LM" },
    { first: "Lily", last: "Osei", dob: "2019-05-19", gender: "FEMALE" as const, yearGroup: "YEAR_1" as const, formGroupId: formGroup1G.id, ethnicity: "Black British - African", homeLanguage: "English", postcode: "WB1 9NP", sendStatus: "EHCP" as const, pupilPremium: true, freeSchoolMeals: true },
    { first: "Harry", last: "Novak", dob: "2018-10-30", gender: "MALE" as const, yearGroup: "YEAR_1" as const, formGroupId: formGroup1G.id, ethnicity: "White Other", homeLanguage: "Polish", postcode: "WB3 5QR" },
    { first: "Sophie", last: "Grant", dob: "2019-02-14", gender: "FEMALE" as const, yearGroup: "YEAR_1" as const, formGroupId: formGroup1G.id, ethnicity: "White British", homeLanguage: "English", postcode: "WB2 7ST" },
    { first: "Mohammed", last: "Iqbal", dob: "2018-09-09", gender: "MALE" as const, yearGroup: "YEAR_1" as const, formGroupId: formGroup1G.id, ethnicity: "Asian British - Pakistani", homeLanguage: "Urdu", postcode: "WB4 2UV" },
  ];

  const pupils = await Promise.all(
    pupilDefs.map((p, i) =>
      prisma.pupil.create({
        data: {
          tenantId: tenant.id,
          upn: `A80100000${String(i + 1).padStart(4, "0")}`,
          admissionNumber: `${1000 + i}`,
          firstName: p.first,
          lastName: p.last,
          dob: new Date(p.dob),
          gender: p.gender,
          yearGroup: p.yearGroup,
          formGroupId: p.formGroupId,
          ethnicity: p.ethnicity,
          homeLanguage: p.homeLanguage,
          addressLine1: `${i + 1} School Lane`,
          city: "Willowbrook",
          postcode: p.postcode,
          sendStatus: p.sendStatus ?? "NONE",
          pupilPremium: p.pupilPremium ?? false,
          freeSchoolMeals: p.freeSchoolMeals ?? false,
          admissionDate: new Date("2022-09-01"),
        },
      }),
    ),
  );
  const [amelia, oliver, isla, noah, freya] = pupils;

  // --- Attendance: 10 school days for the 3W form group, Oliver dips below the 90% persistent-absence threshold ---
  const days = lastNWeekdays(10);
  const form3wPupils = [amelia, oliver, isla, noah, freya];
  for (const pupil of form3wPupils) {
    for (const [i, date] of days.entries()) {
      const isOliver = pupil.id === oliver.id;
      const mark = isOliver && i % 3 === 0 ? "AUTHORISED_ABSENCE" : i === 2 && pupil.id === isla.id ? "LATE" : "PRESENT";
      const code = mark === "AUTHORISED_ABSENCE" ? "I" : mark === "LATE" ? "L" : "/";
      for (const session of ["AM", "PM"] as const) {
        await prisma.attendanceRecord.create({
          data: { tenantId: tenant.id, pupilId: pupil.id, date, session, mark, statutoryCode: code, recordedById: teacher.id },
        });
      }
    }
  }

  // --- Behaviour & welfare ---
  await prisma.behaviourIncident.create({
    data: { tenantId: tenant.id, pupilId: amelia.id, date: new Date(), category: "ACHIEVEMENT", points: 5, description: "Excellent teamwork leading her maths group.", recordedById: teacher.id },
  });
  await prisma.behaviourIncident.create({
    data: { tenantId: tenant.id, pupilId: oliver.id, date: new Date(), category: "CONCERN", points: -2, description: "Struggled to stay on task during literacy.", followUpRequired: true, followUpNotes: "Discuss a visual timer with SENCO.", recordedById: teacher.id },
  });
  await prisma.behaviourIncident.create({
    data: { tenantId: tenant.id, pupilId: noah.id, date: new Date(), category: "BULLYING", points: -5, description: "Reported unkind comments toward another pupil at lunch — following up with both families.", isConfidential: true, followUpRequired: true, recordedById: admin.id },
  });
  await prisma.accidentReport.create({
    data: { tenantId: tenant.id, pupilId: isla.id, date: new Date(), time: "10:45", location: "Playground", description: "Grazed knee falling during a chasing game.", actionTaken: "Cleaned and dressed the graze; pupil returned to class.", severity: "MINOR", parentNotified: true, parentNotifiedAt: new Date(), reportedById: teacher.id, firstAidGivenById: agent.id },
  });
  await prisma.sendPlan.create({
    data: {
      tenantId: tenant.id,
      pupilId: oliver.id,
      status: "SEND_SUPPORT",
      primaryNeed: "COGNITION",
      description: "Additional support needed to maintain focus and process multi-step instructions.",
      targets: [{ target: "Complete a 3-step task independently", progress: "Emerging", reviewDate: "2026-01-15" }],
      externalAgencies: "Educational psychologist (termly review)",
      reviewDate: new Date("2026-01-15"),
      createdById: teacher.id,
    },
  });
  await prisma.sendPlan.create({
    data: {
      tenantId: tenant.id,
      pupilId: pupils.find((p) => p.lastName === "Osei")!.id,
      status: "EHCP",
      primaryNeed: "COMMUNICATION",
      description: "EHCP in place — 1:1 TA support for communication and language development.",
      targets: [{ target: "Use a 3-word phrase to request help", progress: "In progress", reviewDate: "2026-02-01" }],
      reviewDate: new Date("2026-02-01"),
      createdById: teacher.id,
    },
  });

  // --- Assessment ---
  const subjects = await Promise.all(
    ["Reading", "Writing", "Maths"].map((name, order) => prisma.assessmentSubject.create({ data: { tenantId: tenant.id, name, order } })),
  );
  const [reading] = subjects;
  for (const pupil of form3wPupils) {
    for (const subject of subjects) {
      await prisma.assessmentResult.create({
        data: {
          tenantId: tenant.id,
          pupilId: pupil.id,
          subjectId: subject.id,
          academicYearId: academicYear.id,
          term: "Autumn 1",
          attainment: pupil.id === oliver.id ? "Working Towards" : "Expected",
          teacherId: teacher.id,
          date: new Date(),
        },
      });
    }
  }
  await prisma.pupilTarget.create({
    data: {
      tenantId: tenant.id,
      pupilId: oliver.id,
      subjectId: reading.id,
      title: "Improve reading fluency",
      description: "Move from Working Towards to Expected by reading a wider range of decodable texts.",
      targetDate: new Date("2026-02-01"),
      status: "IN_PROGRESS",
      createdById: teacher.id,
    },
  });

  // --- School operations ---
  for (const pupil of form3wPupils) {
    await prisma.mealRecord.create({
      data: { tenantId: tenant.id, pupilId: pupil.id, date: days[days.length - 1], mealType: pupil.freeSchoolMeals ? "FSM" : "SCHOOL_MEAL", recordedById: teacher.id },
    });
  }
  const club = await prisma.club.create({
    data: { tenantId: tenant.id, academicYearId: academicYear.id, name: "Football Club", description: "After-school football for KS2.", dayOfWeek: 2, startTime: "15:30", endTime: "16:30", capacity: 16, staffLeadId: teacher.id },
  });
  for (const pupil of [amelia, oliver, noah]) {
    await prisma.clubMembership.create({ data: { tenantId: tenant.id, clubId: club.id, pupilId: pupil.id, status: "ACTIVE" } });
  }
  await Promise.all([
    prisma.staffProfile.create({ data: { tenantId: tenant.id, userId: teacher.id, staffType: "TEACHING", safeguardingTrainingDate: new Date("2025-09-01"), contractType: "Permanent, full-time" } }),
    prisma.staffProfile.create({ data: { tenantId: tenant.id, userId: agent.id, staffType: "OTHER", dbsCheckDate: new Date("2024-06-01"), safeguardingTrainingDate: new Date("2025-09-01"), contractType: "Permanent, full-time" } }),
    prisma.staffProfile.create({ data: { tenantId: tenant.id, userId: admin.id, staffType: "ADMIN", dbsCheckDate: new Date("2024-06-01"), safeguardingTrainingDate: new Date("2025-09-01"), contractType: "Permanent, full-time" } }),
  ]);
  const intervention = await prisma.intervention.create({
    data: { tenantId: tenant.id, pupilId: oliver.id, title: "Phonics booster group", subjectArea: "Reading", providerId: teacher.id, groupSize: 4, startDate: new Date("2025-11-01"), targetOutcome: "Close phonics gap to age-related expectation.", status: "ACTIVE" },
  });
  await prisma.interventionNote.create({
    data: { tenantId: tenant.id, interventionId: intervention.id, authorId: teacher.id, note: "Good progress on Phase 5 sounds this week." },
  });

  // --- Guardians / parent portal ---
  const demoPassword = await bcrypt.hash("Password123!", 10);
  const chinelo = await prisma.user.create({
    data: { email: "chinelo.bennett@example.com", name: "Chinelo Bennett", role: "PARENT", tenantId: tenant.id, passwordHash: demoPassword, phone: "07700 900123" },
  });
  const tom = await prisma.user.create({
    data: { email: "tom.whitfield@example.com", name: "Tom Whitfield", role: "PARENT", tenantId: tenant.id, passwordHash: demoPassword, phone: "07700 900456" },
  });
  await prisma.pupilGuardian.create({
    data: { tenantId: tenant.id, pupilId: oliver.id, guardianId: chinelo.id, relationship: "MOTHER", parentalResponsibility: true, isPrimaryContact: true, isEmergencyContact: true, canCollect: true },
  });
  await prisma.pupilGuardian.create({
    data: { tenantId: tenant.id, pupilId: noah.id, guardianId: tom.id, relationship: "FATHER", parentalResponsibility: true, isPrimaryContact: true, isEmergencyContact: true, canCollect: true },
  });

  // --- Parents' evening ---
  const eveningDate = new Date();
  eveningDate.setDate(eveningDate.getDate() + 14);
  const evening = await prisma.parentsEveningEvent.create({
    data: {
      tenantId: tenant.id,
      title: "Autumn Term Parents' Evening",
      date: eveningDate,
      startTime: "15:30",
      endTime: "18:00",
      slotMinutes: 10,
      formGroupIds: [formGroup3W.id],
      bookingOpensAt: new Date(),
      locationNote: "School hall",
      createdById: admin.id,
    },
  });
  const slotStart = new Date(eveningDate);
  slotStart.setHours(15, 30, 0, 0);
  for (let i = 0; i < 6; i++) {
    const start = new Date(slotStart.getTime() + i * 10 * 60 * 1000);
    const end = new Date(start.getTime() + 10 * 60 * 1000);
    const isBooked = i === 0;
    await prisma.appointmentSlot.create({
      data: {
        tenantId: tenant.id,
        eventId: evening.id,
        teacherId: teacher.id,
        startTime: start,
        endTime: end,
        status: isBooked ? "BOOKED" : "AVAILABLE",
        pupilId: isBooked ? oliver.id : null,
        guardianId: isBooked ? chinelo.id : null,
      },
    });
  }

  // --- Parent messaging ---
  const welcomeMessage = await prisma.parentMessage.create({
    data: { tenantId: tenant.id, senderId: admin.id, subject: "Welcome to the Willowbrook parent portal", body: "You can now check attendance, messages, and book parents' evening slots online. Let the office know if you have any questions.", audience: "ALL_PARENTS" },
  });
  await prisma.parentMessageRecipient.create({ data: { tenantId: tenant.id, messageId: welcomeMessage.id, guardianId: chinelo.id } });
  await prisma.parentMessageRecipient.create({ data: { tenantId: tenant.id, messageId: welcomeMessage.id, guardianId: tom.id, readAt: new Date() } });

  console.log(`Seeded School MIS demo data for '${tenant.name}': ${pupils.length} pupils across 2 form groups, plus attendance, behaviour, SEND, assessment, ops, parents' evening, and messaging.`);
  console.log(`Demo parent logins: chinelo.bennett@example.com / tom.whitfield@example.com, password: Password123!`);
}

/**
 * A platform-wide super admin, not tied to any school. Only usable if its
 * email is also listed in NOVADESK_SUPER_ADMIN_EMAILS — that env var is
 * what actually grants the role on sign-in (see resolveTenantAndRole in
 * src/lib/auth.ts); this row just gives the "Dev login" button on /login
 * something to sign into locally, without needing real Google OAuth.
 */
async function seedPlatformSuperAdmin() {
  await prisma.user.upsert({
    where: { email: "superadmin@novadesk.dev" },
    create: {
      email: "superadmin@novadesk.dev",
      name: "Novadesk Platform Admin",
      role: "SUPER_ADMIN",
      tenantId: null,
    },
    update: {},
  });
  console.log("Seeded platform super admin (superadmin@novadesk.dev).");
}

async function main() {
  await seedComplianceCatalogue();
  await seedDemoTenant();
  await seedSchoolMis();
  await seedPlatformSuperAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
