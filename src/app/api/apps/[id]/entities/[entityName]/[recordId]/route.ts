import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { validateRecord, runWorkflows, AppConfig } from "@/lib/engine";

// GET /api/apps/[id]/entities/[entityName]/[recordId] - Fetch single record details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityName: string; recordId: string }> }
) {
  try {
    const { id: appId, entityName, recordId } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await prisma.record.findUnique({
      where: { id: recordId, applicationId: appId, entityName, userId: user.id },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    let recordData = {};
    try {
      recordData = JSON.parse(record.data);
    } catch (e) {
      console.error("JSON parse failed for record:", recordId, e);
    }

    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...recordData,
      },
    });
  } catch (error) {
    console.error("Get record detail error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/apps/[id]/entities/[entityName]/[recordId] - Update specific record with validation and workflow calculations
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityName: string; recordId: string }> }
) {
  try {
    const { id: appId, entityName, recordId } = await params;
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

    const existingRecord = await prisma.record.findUnique({
      where: { id: recordId, applicationId: appId, entityName, userId: user.id },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const appConfig = JSON.parse(app.config) as AppConfig;
    const body = await req.json();

    // 1. Validate fields (pass currentRecordId to skip unique match on itself)
    const validation = await validateRecord(appId, entityName, body, appConfig, recordId);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Validation Failed", errors: validation.errors },
        { status: 400 }
      );
    }

    // 2. Run workflows (onUpdate) e.g. calculations & notify triggers
    const processedData = await runWorkflows(
      appId,
      entityName,
      "onUpdate",
      validation.normalizedData,
      user.id,
      appConfig
    );

    // 3. Update the record data
    const updatedRecord = await prisma.record.update({
      where: { id: recordId },
      data: {
        data: JSON.stringify(processedData),
      },
    });

    return NextResponse.json({
      success: true,
      record: {
        id: updatedRecord.id,
        createdAt: updatedRecord.createdAt,
        updatedAt: updatedRecord.updatedAt,
        ...processedData,
      },
    });
  } catch (error) {
    console.error("Update entity record error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/apps/[id]/entities/[entityName]/[recordId] - Delete single record
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityName: string; recordId: string }> }
) {
  try {
    const { id: appId, entityName, recordId } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const record = await prisma.record.findUnique({
      where: { id: recordId, applicationId: appId, entityName, userId: user.id },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await prisma.record.delete({
      where: { id: recordId },
    });

    return NextResponse.json({ success: true, message: "Record deleted successfully" });
  } catch (error) {
    console.error("Delete record error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
