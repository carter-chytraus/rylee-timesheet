import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.monthlySettings.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { year, month, payRate, isPaid } = body;

  // Only ADMIN can change pay rate
  const updateData: Record<string, unknown> = {};
  if (typeof isPaid === "boolean") updateData.isPaid = isPaid;
  if (typeof payRate === "number" && session.user.role === "ADMIN") {
    updateData.payRate = payRate;
  }

  const setting = await prisma.monthlySettings.upsert({
    where: { year_month: { year: parseInt(year), month: parseInt(month) } },
    update: updateData,
    create: {
      year: parseInt(year),
      month: parseInt(month),
      payRate: typeof payRate === "number" ? payRate : 20,
      isPaid: typeof isPaid === "boolean" ? isPaid : false,
    },
  });

  return NextResponse.json(setting);
}
