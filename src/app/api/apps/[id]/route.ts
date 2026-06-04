import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

// GET details of a single app
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const app = await prisma.application.findUnique({
      where: { id, userId: user.id },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      application: {
        ...app,
        config: JSON.parse(app.config),
      },
    });
  } catch (error) {
    console.error("Get app detail error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// UPDATE config metadata of an app
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, config } = body;

    const existingApp = await prisma.application.findUnique({
      where: { id, userId: user.id },
    });

    if (!existingApp) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const updatedApp = await prisma.application.update({
      where: { id },
      data: {
        name: name || existingApp.name,
        description: description !== undefined ? description : existingApp.description,
        config: config ? JSON.stringify(config) : existingApp.config,
      },
    });

    return NextResponse.json({
      success: true,
      application: {
        ...updatedApp,
        config: config || JSON.parse(updatedApp.config),
      },
    });
  } catch (error) {
    console.error("Update app error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE an app and all its records
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingApp = await prisma.application.findUnique({
      where: { id, userId: user.id },
    });

    if (!existingApp) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    await prisma.application.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Application deleted successfully" });
  } catch (error) {
    console.error("Delete app error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
