import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateDuration } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 1);
    where.date = { gte: start, lt: end };
  } else if (year) {
    const start = new Date(parseInt(year), 0, 1);
    const end = new Date(parseInt(year) + 1, 0, 1);
    where.date = { gte: start, lt: end };
  }

  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { date, startTime, endTime, description, tags } = body;

  const durationMin = calculateDuration(startTime, endTime);

  const entry = await prisma.timeEntry.create({
    data: {
      userId: session.user.id,
      date: new Date(date),
      startTime,
      endTime,
      durationMin,
      description: description || "",
      tags: tags || [],
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
