import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });

    // Create a default app for the user so they have a template to play with immediately!
    const defaultAppConfig = {
      name: "E-Commerce CRM",
      description: "Manage customers, dynamic orders, and customer tiers.",
      entities: [
        {
          name: "customers",
          label: "Customer",
          fields: [
            { name: "name", label: "Full Name", type: "text", required: true },
            { name: "email", label: "Email Address", type: "email", required: true, unique: true },
            { name: "phone", label: "Phone Number", type: "text", required: false },
            { name: "status", label: "Status", type: "select", options: ["Lead", "Active", "Inactive"], default: "Lead" },
            { name: "tier", label: "Tier", type: "select", options: ["Bronze", "Silver", "Gold", "Platinum"], default: "Bronze" }
          ]
        },
        {
          name: "orders",
          label: "Order",
          fields: [
            { name: "orderNumber", label: "Order Number", type: "text", required: true },
            { name: "customerEmail", label: "Customer Email", type: "relation", relatedEntity: "customers", relatedField: "email", required: true },
            { name: "baseAmount", label: "Base Amount", type: "number", required: true, min: 0 },
            { name: "tax", label: "Tax", type: "number", required: false, min: 0, default: 0 },
            { name: "totalAmount", label: "Total Amount", type: "number", required: false, min: 0 },
            { name: "status", label: "Order Status", type: "select", options: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"], default: "Pending" }
          ]
        }
      ],
      layout: {
        sidebar: [
          { label: "Dashboard", icon: "LayoutDashboard", view: "dashboard" },
          { label: "Customers Table", icon: "Users", view: "list", entity: "customers" },
          { label: "Orders Table", icon: "ShoppingCart", view: "list", entity: "orders" }
        ]
      },
      views: [
        {
          name: "dashboard",
          type: "dashboard",
          widgets: [
            { type: "metric", label: "Total Customers", entity: "customers", operation: "count" },
            { type: "metric", label: "Active Customers", entity: "customers", operation: "count", filterField: "status", filterValue: "Active" },
            { type: "metric", label: "Total Sales", entity: "orders", operation: "sum", field: "totalAmount" },
            { type: "chart", chartType: "bar", label: "Customers by Tier", entity: "customers", groupBy: "tier" },
            { type: "chart", chartType: "doughnut", label: "Orders by Status", entity: "orders", groupBy: "status" }
          ]
        }
      ],
      workflows: [
        {
          trigger: "onCreate",
          entity: "orders",
          actions: [
            {
              type: "calculate",
              targetField: "totalAmount",
              formula: "baseAmount + tax"
            },
            {
              type: "notify",
              message: "Order {{orderNumber}} registered with amount ${{totalAmount}}"
            }
          ]
        },
        {
          trigger: "onUpdate",
          entity: "orders",
          actions: [
            {
              type: "calculate",
              targetField: "totalAmount",
              formula: "baseAmount + tax"
            }
          ]
        }
      ]
    };

    await prisma.application.create({
      data: {
        name: defaultAppConfig.name,
        description: defaultAppConfig.description,
        config: JSON.stringify(defaultAppConfig),
        userId: user.id,
      },
    });

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );

    // Set HTTP-only cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
