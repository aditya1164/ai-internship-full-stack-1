import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

// Fetch all applications for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apps = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    // Parse the stored config strings back to objects
    const parsedApps = apps.map((app) => ({
      ...app,
      config: JSON.parse(app.config),
    }));

    return NextResponse.json({ success: true, applications: parsedApps });
  } catch (error) {
    console.error("Fetch apps error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create a new application
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, config } = body;

    if (!name) {
      return NextResponse.json({ error: "Application name is required" }, { status: 400 });
    }

    // Default basic config if not provided
    const defaultConfig = config || {
      name,
      description: description || "",
      entities: [],
      layout: { sidebar: [] },
      views: [],
      workflows: [],
    };

    const newApp = await prisma.application.create({
      data: {
        name,
        description: description || null,
        config: JSON.stringify(defaultConfig),
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      application: {
        ...newApp,
        config: defaultConfig,
      },
    });
  } catch (error) {
    console.error("Create app error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
