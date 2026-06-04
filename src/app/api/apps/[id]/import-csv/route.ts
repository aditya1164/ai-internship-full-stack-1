import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { validateRecord, runWorkflows, AppConfig } from "@/lib/engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appId } = await params;
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
    const { entityName, rows } = body; // rows is an array of records to import

    if (!entityName || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Missing entityName or rows list" },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as Array<{ rowIndex: number; errors: Record<string, string>; rowData: any }>,
    };

    // Process rows sequentially or in parallel. Sequentially is safer for unique checks.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // 1. Validate fields
        const validation = await validateRecord(appId, entityName, row, appConfig);
        
        if (!validation.isValid) {
          results.failed++;
          results.errors.push({
            rowIndex: i + 1,
            errors: validation.errors,
            rowData: row,
          });
          continue;
        }

        // 2. Run workflows (onCreate calculations, etc.)
        const processedData = await runWorkflows(
          appId,
          entityName,
          "onCreate",
          validation.normalizedData,
          user.id,
          appConfig
        );

        // 3. Insert record
        await prisma.record.create({
          data: {
            applicationId: appId,
            entityName,
            userId: user.id,
            data: JSON.stringify(processedData),
          },
        });

        results.imported++;
      } catch (err: any) {
        console.error(`Error importing row ${i}:`, err);
        results.failed++;
        results.errors.push({
          rowIndex: i + 1,
          errors: { _system: err.message || "Unknown error during database insert" },
          rowData: row,
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: results,
    });
  } catch (error) {
    console.error("Bulk CSV import error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
