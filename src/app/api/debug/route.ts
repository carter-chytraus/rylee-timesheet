import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { email: true, name: true, role: true },
    });
    return NextResponse.json({
      status: "ok",
      dbConnected: true,
      userCount,
      users,
      envCheck: {
        hasAuthSecret: !!process.env.AUTH_SECRET,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      dbConnected: false,
      error: String(error),
    }, { status: 500 });
  }
}
