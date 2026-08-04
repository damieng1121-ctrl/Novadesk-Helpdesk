import { PrismaClient } from "@prisma/client";
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
const STANDARDS = [
  {
    code: "broadband",
    title: "Broadband",
    description: "Connectivity is fast and reliable enough for whole-school digital teaching and administration.",
    officialUrl: "https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges",
    items: [
      {
        code: "broadband-capacity",
        title: "Minimum bandwidth",
        description: "The school has enough bandwidth for concurrent use across all teaching spaces and admin systems.",
        guidance: "DfE's indicative minimum for a primary school is a 100Mbps download / 25Mbps upload connection — check the current published figures for your school size.",
      },
      {
        code: "broadband-resilience",
        title: "Resilient connection",
        description: "There is a backup connection or documented failover plan if the primary line fails.",
      },
      {
        code: "broadband-contract",
        title: "Contract reviewed",
        description: "The broadband contract has been reviewed in the last 12 months for value, capacity, and term.",
      },
    ],
  },
  {
    code: "wireless-network",
    title: "Wireless network",
    description: "Wi-Fi coverage and capacity supports teaching and learning in every space it's needed.",
    items: [
      {
        code: "wireless-coverage",
        title: "Full coverage",
        description: "Wireless access points provide reliable coverage in all classrooms and teaching spaces.",
      },
      {
        code: "wireless-capacity",
        title: "Sufficient capacity",
        description: "Access points can support a full class of concurrent devices without significant slowdown.",
      },
      {
        code: "wireless-security",
        title: "Secure authentication",
        description: "Staff/pupil Wi-Fi uses WPA2-Enterprise (or stronger) and any guest network is segregated from the main network.",
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
      },
      {
        code: "cabling-standard",
        title: "Structured cabling",
        description: "Cabling meets at least Cat5e (ideally Cat6) to support required network speeds.",
      },
      {
        code: "switches-resilience",
        title: "No single point of failure",
        description: "Core switching has redundancy so one device failing doesn't take down the whole network.",
      },
    ],
  },
  {
    code: "servers",
    title: "Servers",
    description: "On-premise and cloud server estate is documented, backed up, and kept within support.",
    items: [
      {
        code: "servers-inventory",
        title: "Documented estate",
        description: "All servers (physical, virtual, cloud) are inventoried with owners and end-of-support dates.",
      },
      {
        code: "servers-backup",
        title: "Tested backups",
        description: "A 3-2-1 backup strategy is in place and restores are tested at least annually.",
      },
    ],
  },
  {
    code: "cyber-security",
    title: "Cyber security",
    description: "Technical and organisational controls protect the school against common cyber threats.",
    items: [
      {
        code: "cyber-mfa",
        title: "Multi-factor authentication",
        description: "MFA is enforced for all staff accounts with access to school data, finance, or admin systems.",
      },
      {
        code: "cyber-patching",
        title: "Patch management",
        description: "Operating systems and key software are patched on a defined schedule.",
      },
      {
        code: "cyber-policy",
        title: "Cyber security policy",
        description: "A cyber security policy exists, is reviewed annually, and staff receive related training.",
      },
      {
        code: "cyber-incident-response",
        title: "Incident response plan",
        description: "A documented incident response plan exists and has been tested (e.g. via a tabletop exercise).",
      },
    ],
  },
  {
    code: "filtering-monitoring",
    title: "Filtering and monitoring",
    description: "Internet filtering and monitoring meet Keeping Children Safe in Education (KCSIE) expectations.",
    items: [
      {
        code: "filtering-appropriate",
        title: "Appropriate filtering",
        description: "Internet filtering blocks illegal content and content inappropriate for pupils, aligned to UK Safer Internet Centre categorisation.",
      },
      {
        code: "monitoring-appropriate",
        title: "Appropriate monitoring",
        description: "Monitoring is in place, logs are reviewed, and alerts reach the Designated Safeguarding Lead promptly.",
      },
      {
        code: "filtering-review",
        title: "Annual review",
        description: "Filtering and monitoring provision is reviewed at least annually and evidenced (e.g. via a completed self-review checklist).",
      },
    ],
  },
  {
    code: "cloud-solutions",
    title: "Cloud solutions",
    description: "Cloud platforms used by the school protect data appropriately and are managed with clear ownership.",
    items: [
      {
        code: "cloud-data-protection",
        title: "Data protection compliance",
        description: "Cloud providers in use (MIS, Google Workspace, etc.) meet UK GDPR requirements, with data processing agreements in place.",
      },
      {
        code: "cloud-access-control",
        title: "Least-privilege access",
        description: "Role-based access control is applied to cloud platforms; leavers are removed promptly.",
      },
    ],
  },
  {
    code: "digital-leadership",
    title: "Digital leadership",
    description: "Someone owns digital strategy, and it's resourced.",
    items: [
      {
        code: "leadership-named",
        title: "Named digital lead",
        description: "A named senior leader (or governor) is responsible for digital strategy and technology standards.",
      },
      {
        code: "leadership-strategy",
        title: "Digital development plan",
        description: "A documented digital strategy exists, aligned to curriculum, safeguarding, and budget planning.",
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
      },
      {
        code: "bcdr-rto",
        title: "Recovery objectives defined",
        description: "Recovery time objectives are defined for critical systems (MIS, safeguarding records, finance).",
      },
    ],
  },
  {
    code: "digital-accessibility",
    title: "Digital accessibility",
    description: "School websites, platforms, and assistive technology support pupils and staff with additional needs.",
    items: [
      {
        code: "accessibility-psbar",
        title: "Public Sector Bodies Accessibility Regulations",
        description: "The school website and key online platforms meet WCAG 2.2 AA, with an accessibility statement published.",
      },
      {
        code: "accessibility-assistive-tech",
        title: "Assistive technology provision",
        description: "Assistive/adaptive technology needs for SEND pupils are reviewed and provisioned as part of EHCP/SEND support.",
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

async function main() {
  await seedComplianceCatalogue();
  await seedDemoTenant();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
