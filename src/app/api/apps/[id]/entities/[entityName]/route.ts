import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { validateRecord, runWorkflows, AppConfig } from "@/lib/engine";

// GET /api/apps/[id]/entities/[entityName] - Retrieve list of records with paging, filters, search, and sorting
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityName: string }> }
) {
  try {
    const { id: appId, entityName } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify application ownership
    const app = await prisma.application.findUnique({
      where: { id: appId, userId: user.id },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Fetch records
    const dbRecords = await prisma.record.findMany({
      where: { applicationId: appId, entityName },
      orderBy: { createdAt: "desc" },
    });

    // Parse data field
    let records: Record<string, any>[] = dbRecords.map((r) => {
      let dataObj: Record<string, any> = {};
      try {
        dataObj = JSON.parse(r.data);
      } catch (e) {
        console.error("JSON parse failed for record:", r.id, e);
      }
      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        ...dataObj,
      };
    });

    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("_page") || "1", 10);
    const limit = parseInt(searchParams.get("_limit") || "50", 10);
    const sortField = searchParams.get("_sort");
    const sortOrder = searchParams.get("_order") || "asc";
    const searchQuery = searchParams.get("_q") || "";

    // 1. Filter by search query (text match across all fields)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      records = records.filter((r) =>
        Object.entries(r).some(([key, val]) => {
          if (["id", "createdAt", "updatedAt"].includes(key)) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    // 2. Filter by column values (e.g. ?status=Active)
    searchParams.forEach((val, key) => {
      if (key.startsWith("_")) return; // Skip special options
      if (val === "" || val === null || val === "all") return;
      records = records.filter((r) => {
        const itemVal = r[key];
        if (itemVal === undefined || itemVal === null) return false;
        return String(itemVal).toLowerCase() === val.toLowerCase();
      });
    });

    // 3. Sorting
    if (sortField) {
      records.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "desc" ? valB - valA : valA - valB;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortOrder === "desc" ? 1 : -1;
        if (strA > strB) return sortOrder === "desc" ? -1 : 1;
        return 0;
      });
    }

    // 4. Pagination
    const totalCount = records.length;
    const startIndex = (page - 1) * limit;
    const paginatedRecords = records.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      records: paginatedRecords,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Fetch entity records error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/apps/[id]/entities/[entityName] - Create a new record with validation and workflow rules
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityName: string }> }
) {
  try {
    const { id: appId, entityName } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const app = await prisma.application.findUnique({
      where: { id: appId, userId: user.id },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const appConfig = JSON.parse(app.config) as AppConfig;
    const body = await req.json();

    // 1. Validate fields
    const validation = await validateRecord(appId, entityName, body, appConfig);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Validation Failed", errors: validation.errors },
        { status: 400 }
      );
    }

    // 2. Run workflows (onCreate) e.g. calculations & notify triggers
    const processedData = await runWorkflows(
      appId,
      entityName,
      "onCreate",
      validation.normalizedData,
      user.id,
      appConfig
    );

    // 3. Create the record
    const newRecord = await prisma.record.create({
      data: {
        applicationId: appId,
        entityName,
        userId: user.id,
        data: JSON.stringify(processedData),
      },
    });

    return NextResponse.json({
      success: true,
      record: {
        id: newRecord.id,
        createdAt: newRecord.createdAt,
        updatedAt: newRecord.updatedAt,
        ...processedData,
      },
    });
  } catch (error) {
    console.error("Create entity record error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
