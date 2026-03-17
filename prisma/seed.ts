import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

function excelDateToJSDate(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function excelTimeToString(fraction: number): string {
  const totalMinutes = Math.round(fraction * 24 * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function calculateDurationMin(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

async function main() {
  console.log("Seeding database...");

  // Create default admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "carter@admin.com" },
    update: {},
    create: {
      email: "carter@admin.com",
      name: "Carter",
      passwordHash: adminHash,
      role: Role.ADMIN,
    },
  });

  // Create employee user (Rylee)
  const employeeHash = await bcrypt.hash("rylee123", 10);
  const employee = await prisma.user.upsert({
    where: { email: "rylee@employee.com" },
    update: {},
    create: {
      email: "rylee@employee.com",
      name: "Rylee",
      passwordHash: employeeHash,
      role: Role.EMPLOYEE,
    },
  });

  // Create a viewer user
  const viewerHash = await bcrypt.hash("viewer123", 10);
  await prisma.user.upsert({
    where: { email: "viewer@viewer.com" },
    update: {},
    create: {
      email: "viewer@viewer.com",
      name: "Viewer",
      passwordHash: viewerHash,
      role: Role.VIEWER,
    },
  });

  console.log("Users created.");

  // Try to import spreadsheet data
  const xlsxPath = path.resolve(
    process.env.XLSX_PATH ||
      "C:/Users/CarterChytraus/Downloads/Rylee_Beeston Time Sheet.xlsx"
  );

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.readFile(xlsxPath);
    console.log("Spreadsheet found, importing data...");
  } catch {
    console.log("Spreadsheet not found at", xlsxPath, "- skipping data import.");
    console.log("Seeding monthly settings with defaults...");
    // Create default monthly settings for 2024-2026
    for (let year = 2024; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        await prisma.monthlySettings.upsert({
          where: { year_month: { year, month } },
          update: {},
          create: { year, month, payRate: 20, isPaid: false },
        });
      }
    }
    console.log("Seed complete (no spreadsheet data).");
    return;
  }

  // Import time entries
  const timeSheet = wb.Sheets["Detailed Time Sheet"];
  const timeData = XLSX.utils.sheet_to_json<any[]>(timeSheet, {
    header: 1,
    defval: "",
  });

  let timeCount = 0;
  for (let i = 3; i < timeData.length; i++) {
    const row = timeData[i] as any[];
    const dateSerial = row[0];
    const startFrac = row[2];
    const endFrac = row[3];
    const desc = row[5];

    if (!dateSerial || typeof dateSerial !== "number" || dateSerial === 0) continue;
    if (typeof startFrac !== "number" || typeof endFrac !== "number") continue;

    const date = excelDateToJSDate(dateSerial);
    const startTime = excelTimeToString(startFrac);
    const endTime = excelTimeToString(endFrac);
    const durationMin = calculateDurationMin(startTime, endTime);

    const description = typeof desc === "string" ? desc.trim() : "";

    // Auto-tag based on description
    const tags: string[] = [];
    const descLower = description.toLowerCase();
    if (descLower.includes("daily task")) tags.push("Daily Tasks");
    if (descLower.includes("beeston")) tags.push("Beeston Day");
    if (descLower.includes("comment")) tags.push("Commenting");
    if (descLower.includes("dm")) tags.push("DMs");
    if (descLower.includes("post") || descLower.includes("posting")) tags.push("Posting");
    if (descLower.includes("return")) tags.push("Returns");
    if (descLower.includes("snap")) tags.push("Snapchat");
    if (descLower.includes("link")) tags.push("Links");
    if (descLower.includes("brainstorm")) tags.push("Brainstorming");
    if (descLower.includes("amazon")) tags.push("Amazon Storefront");
    if (descLower.includes("youtube")) tags.push("YouTube");
    if (descLower.includes("short")) tags.push("Shorts");
    if (descLower.includes("ltk")) tags.push("LTK");
    if (descLower.includes("shopmy")) tags.push("ShopMy");
    if (descLower.includes("edit")) tags.push("Editing Video");
    if (descLower.includes("meeting")) tags.push("Meeting");
    if (descLower.includes("brief")) tags.push("Briefs");
    if (descLower.includes("analytic") || descLower.includes("insight")) tags.push("Analytics");
    if (descLower.includes("donat")) tags.push("Donations");
    if (descLower.includes("task day")) tags.push("Task Day");
    if (descLower.includes("email")) tags.push("Emails");
    if (descLower.includes("clean")) tags.push("Cleaning");

    await prisma.timeEntry.create({
      data: {
        userId: employee.id,
        date,
        startTime,
        endTime,
        durationMin,
        description,
        tags,
      },
    });
    timeCount++;
  }
  console.log(`Imported ${timeCount} time entries.`);

  // Import reimbursements
  const reimbSheet = wb.Sheets["Reimbursements"];
  const reimbData = XLSX.utils.sheet_to_json<any[]>(reimbSheet, {
    header: 1,
    defval: "",
  });

  let reimbCount = 0;
  for (let i = 2; i < reimbData.length; i++) {
    const row = reimbData[i] as any[];
    const dateSerial = row[0];
    const amount = row[1];
    const desc = row[2];

    if (!dateSerial || typeof dateSerial !== "number") continue;
    if (typeof amount !== "number" || amount === 0) continue;

    const date = excelDateToJSDate(dateSerial);
    const description = typeof desc === "string" ? desc.trim() : "";

    // Auto-tag reimbursements
    const tags: string[] = [];
    const descLower = description.toLowerCase();
    if (
      descLower.includes("food") ||
      descLower.includes("lunch") ||
      descLower.includes("grub") ||
      descLower.includes("din")
    )
      tags.push("Food/Lunch");
    if (
      descLower.includes("coffee") ||
      descLower.includes("starbucks") ||
      descLower.includes("dutch") ||
      descLower.includes("latte") ||
      descLower.includes("matcha") ||
      descLower.includes("energy") ||
      descLower.includes("drank") ||
      descLower.includes("drink")
    )
      tags.push("Coffee/Drinks");
    if (descLower.includes("return")) tags.push("Return Package");
    if (descLower.includes("car wash") || descLower.includes("quick quack"))
      tags.push("Car Wash");
    if (descLower.includes("lightroom")) tags.push("Lightroom");
    if (
      descLower.includes("jiffy") ||
      descLower.includes("oil") ||
      descLower.includes("registration") ||
      descLower.includes("safelite") ||
      descLower.includes("windshield")
    )
      tags.push("Gas/Car Maintenance");
    if (descLower.includes("giveaway")) tags.push("Giveaway Items");
    if (descLower.includes("subscription") || descLower.includes("tezza") || descLower.includes("inshot"))
      tags.push("Subscriptions");
    if (
      descLower.includes("supplies") ||
      descLower.includes("fertilizer") ||
      descLower.includes("sprinkl") ||
      descLower.includes("salt") ||
      descLower.includes("hook") ||
      descLower.includes("bin")
    )
      tags.push("Supplies");
    if (descLower.includes("decoration")) tags.push("Decorations");
    if (descLower.includes("dairy boy") || descLower.includes("sketcher") || descLower.includes("scheels"))
      tags.push("Clothing/Merchandise");

    await prisma.reimbursement.create({
      data: {
        userId: employee.id,
        date,
        amount,
        description,
        tags,
      },
    });
    reimbCount++;
  }
  console.log(`Imported ${reimbCount} reimbursements.`);

  // Import monthly settings from Summary sheet
  const summarySheet = wb.Sheets["Summary"];
  const summaryData = XLSX.utils.sheet_to_json<any[]>(summarySheet, {
    header: 1,
    defval: "",
  });

  // Row 1 has month date serials, Row 4 has pay rates, Row 7 has paid status
  const monthSerials = summaryData[1] as any[];
  const payRates = summaryData[4] as any[];
  const paidRow = summaryData[7] as any[];

  for (let col = 1; col < monthSerials.length; col++) {
    const serial = monthSerials[col];
    if (typeof serial !== "number" || serial === 0) continue;

    const date = excelDateToJSDate(serial);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const payRate = typeof payRates[col] === "number" ? payRates[col] : 20;
    const isPaid = paidRow[col] === true;

    await prisma.monthlySettings.upsert({
      where: { year_month: { year, month } },
      update: { payRate, isPaid },
      create: { year, month, payRate, isPaid },
    });
  }
  console.log("Monthly settings imported.");
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
