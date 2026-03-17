import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [entries, reimbursements, settings] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, durationMin: true },
    }),
    prisma.reimbursement.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, amount: true },
    }),
    prisma.monthlySettings.findMany({
      where: { year },
    }),
  ]);

  // Aggregate by month
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const setting = settings.find((s) => s.month === month);

    const monthEntries = entries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === month;
    });

    const monthReimb = reimbursements.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() + 1 === month;
    });

    const totalMinutes = monthEntries.reduce((sum, e) => sum + e.durationMin, 0);
    const totalHours = totalMinutes / 60;
    const payRate = setting?.payRate ?? 20;
    const wages = totalHours * payRate;
    const reimbTotal = monthReimb.reduce((sum, r) => sum + r.amount, 0);

    return {
      month,
      year,
      totalHours: Math.round(totalHours * 100) / 100,
      payRate,
      wages: Math.round(wages * 100) / 100,
      reimbursements: Math.round(reimbTotal * 100) / 100,
      total: Math.round((wages + reimbTotal) * 100) / 100,
      isPaid: setting?.isPaid ?? false,
      settingId: setting?.id,
    };
  });

  return NextResponse.json(months);
}
