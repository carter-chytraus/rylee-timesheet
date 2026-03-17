import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { calculateDuration } from "@/lib/utils";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const search = searchParams.get("search");
  const tags = searchParams.get("tags");

  const where: Prisma.TimeEntryWhereInput = {};

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      where.date.lt = end;
    }
  } else if (month && year) {
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

  if (tags) {
    const tagList = tags.split(",").filter(Boolean);
    if (tagList.length > 0) {
      where.tags = { hasSome: tagList };
    }
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
