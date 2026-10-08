/**
 * Seed script — populates the database with the forum structure.
 *
 *   1 Admin            admin@consumerforum.gov.in
 *   1 Registrar        registrar@consumerforum.gov.in      (allots cases to benches)
 *   2 Scrutiny clerks  scrutiny1..2@consumerforum.gov.in   (shared intake queue)
 *   3 Benches          Bench 1..3, each with
 *       1 Judge        judge1..3@consumerforum.gov.in
 *       1 Court clerk  courtclerk1..3@consumerforum.gov.in
 *
 * All passwords: Password@123
 * Re-running this script also deletes any complaints/consumers created
 * through the app so you always start from a clean slate.
 */
const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Medical Negligence', defaultPriority: 'HIGH' },
  { name: 'Food Safety', defaultPriority: 'HIGH' },
  { name: 'Banking Services', defaultPriority: 'MEDIUM' },
  { name: 'Insurance', defaultPriority: 'MEDIUM' },
  { name: 'Education', defaultPriority: 'MEDIUM' },
  { name: 'Warranty / Product Defect', defaultPriority: 'LOW' },
  { name: 'Refund Dispute', defaultPriority: 'LOW' },
  { name: 'Delivery Delay', defaultPriority: 'LOW' },
  { name: 'Electronics', defaultPriority: 'MEDIUM' },
  { name: 'Real Estate', defaultPriority: 'MEDIUM' },
];

const PRIORITY_RULES = [
  { keyword: 'medical negligence', priority: 'HIGH' },
  { keyword: 'food safety', priority: 'HIGH' },
  { keyword: 'senior citizen', priority: 'HIGH' },
  { keyword: 'child', priority: 'HIGH' },
  { keyword: 'banking', priority: 'MEDIUM' },
  { keyword: 'insurance', priority: 'MEDIUM' },
  { keyword: 'education', priority: 'MEDIUM' },
  { keyword: 'warranty', priority: 'LOW' },
  { keyword: 'refund', priority: 'LOW' },
  { keyword: 'delivery delay', priority: 'LOW' },
];

const HOLIDAYS_2026 = [
  { date: '2026-01-26', description: 'Republic Day' },
  { date: '2026-03-06', description: 'Holi' },
  { date: '2026-08-15', description: 'Independence Day' },
  { date: '2026-10-02', description: 'Gandhi Jayanti' },
  { date: '2026-11-08', description: 'Diwali' },
  { date: '2026-12-25', description: 'Christmas' },
];

const FIRST_NAMES = ['Arjun', 'Priya', 'Rahul', 'Sneha', 'Vikram'];
const LAST_NAMES = ['Kumar', 'Sharma', 'Reddy', 'Iyer', 'Nair'];

function randomName(i) {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
}

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // Preserve registered consumers & filed complaints unless RESET_DATA=true is explicitly set
  if (process.env.RESET_DATA === 'true') {
    console.log('RESET_DATA=true set. Wiping existing complaints & consumer accounts...');
    await prisma.complaint.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({ where: { role: Role.CONSUMER } });
  }

  // -------------------- Forum settings --------------------
  await prisma.forumSettings.upsert({
    where: { id: 'default-settings' },
    update: {},
    create: {
      id: 'default-settings',
      forumName: 'State Consumer Disputes Redressal Forum',
      contactEmail: 'contact@consumerforum.gov.in',
      contactPhone: '1800-11-4000',
      maxHearingsPerDayDefault: 8,
      workingDays: [1, 2, 3, 4, 5],
      overdueThresholdDays: 30,
    },
  });

  // -------------------- Holidays --------------------
  for (const h of HOLIDAYS_2026) {
    await prisma.holiday.upsert({
      where: { date: new Date(h.date) },
      update: {},
      create: { date: new Date(h.date), description: h.description, isRecurringAnnual: true },
    });
  }

  // -------------------- Categories --------------------
  for (const c of CATEGORIES) {
    await prisma.complaintCategory.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, defaultPriority: c.defaultPriority, description: `${c.name} related consumer complaints.` },
    });
  }

  // -------------------- Priority rules --------------------
  for (const r of PRIORITY_RULES) {
    const existing = await prisma.priorityRule.findFirst({ where: { keyword: r.keyword } });
    if (!existing) {
      await prisma.priorityRule.create({ data: { keyword: r.keyword, priority: r.priority } });
    }
  }

  // -------------------- Admin --------------------
  await prisma.user.upsert({
    where: { email: 'admin@consumerforum.gov.in' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@consumerforum.gov.in',
      password: passwordHash,
      role: Role.ADMIN,
      isEmailVerified: true,
      phone: '9000000000',
    },
  });

  // -------------------- Registrar --------------------
  await prisma.user.upsert({
    where: { email: 'registrar@consumerforum.gov.in' },
    update: { isActive: true, role: Role.REGISTRAR },
    create: {
      name: 'Meenakshi Sundaram (Registrar)',
      email: 'registrar@consumerforum.gov.in',
      password: passwordHash,
      role: Role.REGISTRAR,
      isEmailVerified: true,
      phone: '9000000001',
    },
  });

  // -------------------- Benches --------------------
  const BENCH_COUNT = 3;
  const benches = [];
  for (let i = 0; i < BENCH_COUNT; i++) {
    const bench = await prisma.bench.upsert({
      where: { name: `Bench ${i + 1}` },
      update: { isActive: true, courtRoom: `Room ${101 + i}` },
      create: { name: `Bench ${i + 1}`, courtRoom: `Room ${101 + i}` },
    });
    benches.push(bench);
  }

  // -------------------- Scrutiny clerks (shared intake pool) --------------------
  const scrutinyEmails = [];
  for (let i = 0; i < 2; i++) {
    const email = `scrutiny${i + 1}@consumerforum.gov.in`;
    scrutinyEmails.push(email);
    await prisma.user.upsert({
      where: { email },
      update: { isActive: true, role: Role.CLERK, clerkType: 'SCRUTINY', benchId: null },
      create: {
        name: `${randomName(i)} (Scrutiny Clerk)`,
        email,
        password: passwordHash,
        role: Role.CLERK,
        clerkType: 'SCRUTINY',
        isEmailVerified: true,
        phone: `900000${2000 + i}`,
      },
    });
  }

  // -------------------- Judges + court clerks, one pair per bench --------------------
  const judgeEmails = [];
  const courtClerkEmails = [];
  for (let i = 0; i < BENCH_COUNT; i++) {
    const bench = benches[i];

    const judgeEmail = `judge${i + 1}@consumerforum.gov.in`;
    judgeEmails.push(judgeEmail);
    const judgeUser = await prisma.user.upsert({
      where: { email: judgeEmail },
      update: { isActive: true },
      create: {
        name: `Justice ${randomName(i)}`,
        email: judgeEmail,
        password: passwordHash,
        role: Role.JUDGE,
        isEmailVerified: true,
        phone: `900001${1000 + i}`,
      },
    });
    let profile = await prisma.judgeProfile.findUnique({ where: { userId: judgeUser.id } });
    if (!profile) {
      profile = await prisma.judgeProfile.create({
        data: {
          userId: judgeUser.id,
          designation: i === 0 ? 'President' : 'Member',
          courtRoom: bench.courtRoom,
          maxHearingsPerDay: 6 + (i % 3),
          benchId: bench.id,
        },
      });
      for (let d = 1; d <= 5; d++) {
        await prisma.judgeAvailability.create({
          data: { judgeId: profile.id, dayOfWeek: d, isAvailable: true, maxHearingsPerDay: profile.maxHearingsPerDay },
        });
      }
    } else {
      await prisma.judgeProfile.update({ where: { id: profile.id }, data: { benchId: bench.id, courtRoom: bench.courtRoom } });
    }

    const clerkEmail = `courtclerk${i + 1}@consumerforum.gov.in`;
    courtClerkEmails.push(clerkEmail);
    await prisma.user.upsert({
      where: { email: clerkEmail },
      update: { isActive: true, role: Role.CLERK, clerkType: 'COURT', benchId: bench.id },
      create: {
        name: `${randomName(i + 2)} (Court Clerk)`,
        email: clerkEmail,
        password: passwordHash,
        role: Role.CLERK,
        clerkType: 'COURT',
        benchId: bench.id,
        isEmailVerified: true,
        phone: `900000${3000 + i}`,
      },
    });
  }

  // Deactivate any leftover staff from older seeds so only this structure is live.
  const keep = [...scrutinyEmails, ...courtClerkEmails, ...judgeEmails, 'admin@consumerforum.gov.in', 'registrar@consumerforum.gov.in'];
  await prisma.user.updateMany({
    where: { role: { in: [Role.CLERK, Role.JUDGE, Role.REGISTRAR] }, email: { notIn: keep } },
    data: { isActive: false },
  });

  console.log('Seeding complete.');
  console.log('All passwords: Password@123');
  console.log('  Admin      admin@consumerforum.gov.in');
  console.log('  Registrar  registrar@consumerforum.gov.in');
  console.log('  Scrutiny   scrutiny1@ / scrutiny2@consumerforum.gov.in');
  console.log('  Bench 1-3  judge1..3@ and courtclerk1..3@consumerforum.gov.in');
  console.log('Complaints and consumers have been cleared.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
