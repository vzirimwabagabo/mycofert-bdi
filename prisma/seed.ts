/**
 * Prisma database seed — populates the database with initial CMS content
 * so the site looks reasonable right after a fresh deploy.
 *
 * Run with: npx prisma db seed
 * (configured in package.json under "prisma.seed")
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert the default site settings so the CMS has a baseline to edit.
  await db.siteSetting.upsert({
    where: { key: 'home' },
    update: {},
    create: {
      key: 'home',
      value: JSON.stringify({
        heroTitle: 'MYCOFERT Burundi',
        heroSubtitle: 'Solutions biologiques pour une agriculture durable',
        heroImage: null,
      }),
    },
  });

  await db.siteSetting.upsert({
    where: { key: 'about' },
    update: {},
    create: {
      key: 'about',
      value: JSON.stringify({
        mission: 'Améliorer la productivité agricole au Burundi grâce à des biostimulants naturels.',
      }),
    },
  });

  console.log('✅ Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
