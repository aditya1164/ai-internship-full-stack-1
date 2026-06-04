"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Terminal,
  Plus,
  Play,
  Settings,
  Trash2,
  Bell,
  LogOut,
  FolderOpen,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Layers,
  DollarSign
} from "lucide-react";

interface Application {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  config: any;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// Visual Templates data configuration
const TEMPLATES = [
  {
    name: "E-Commerce CRM",
    description: "Manage customers and sales. Computes dynamic invoice totals and pushes notifications on purchase.",
    icon: Sparkles,
    color: "from-violet-500 to-fuchsia-500",
    config: {
      name: "E-Commerce CRM",
      description: "Manage customers and sales. Computes dynamic invoice totals.",
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
          { label: "Overview", icon: "LayoutDashboard", view: "dashboard" },
          { label: "Customers", icon: "Users", view: "list", entity: "customers" },
          { label: "Orders", icon: "ShoppingCart", view: "list", entity: "orders" }
        ]
      },
      views: [
        {
          name: "dashboard",
          type: "dashboard",
          widgets: [
            { type: "metric", label: "Total Customers", entity: "customers", operation: "count" },
            { type: "metric", label: "Active Accounts", entity: "customers", operation: "count", filterField: "status", filterValue: "Active" },
            { type: "metric", label: "Total Revenue ($)", entity: "orders", operation: "sum", field: "totalAmount" },
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
            { type: "calculate", targetField: "totalAmount", formula: "baseAmount + tax" },
            { type: "notify", message: "New invoice registered for order {{orderNumber}} totaling ${{totalAmount}}" }
          ]
        },
        {
          trigger: "onUpdate",
          entity: "orders",
          actions: [
            { type: "calculate", targetField: "totalAmount", formula: "baseAmount + tax" }
          ]
        }
      ]
    }
  },
  {
    name: "Project Tracker",
    description: "Coordinate team projects and tasks. Triggers high priority alerts on task updates.",
    icon: Layers,
    color: "from-blue-500 to-cyan-500",
    config: {
      name: "Project Tracker",
      description: "Coordinate team projects and tasks.",
      entities: [
        {
          name: "projects",
          label: "Project",
          fields: [
            { name: "title", label: "Project Title", type: "text", required: true, unique: true },
            { name: "code", label: "Project Code", type: "text", required: true, unique: true },
            { name: "manager", label: "Project Manager", type: "text", required: true },
            { name: "budget", label: "Budget ($)", type: "number", required: false, default: 1000 }
          ]
        },
        {
          name: "tasks",
          label: "Task",
          fields: [
            { name: "title", label: "Task Title", type: "text", required: true },
            { name: "projectCode", label: "Project Code", type: "relation", relatedEntity: "projects", relatedField: "code", required: true },
            { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"], default: "Medium" },
            { name: "status", label: "Status", type: "select", options: ["Todo", "In Progress", "Review", "Done"], default: "Todo" },
            { name: "dueDate", label: "Due Date", type: "date", required: true }
          ]
        }
      ],
      layout: {
        sidebar: [
          { label: "Overview", icon: "LayoutDashboard", view: "dashboard" },
          { label: "Projects", icon: "Folder", view: "list", entity: "projects" },
          { label: "Tasks Board", icon: "CheckSquare", view: "list", entity: "tasks" }
        ]
      },
      views: [
        {
          name: "dashboard",
          type: "dashboard",
          widgets: [
            { type: "metric", label: "Total Projects", entity: "projects", operation: "count" },
            { type: "metric", label: "Total Pending Tasks", entity: "tasks", operation: "count", filterField: "status", filterValue: "Todo" },
            { type: "metric", label: "Tasks in Review", entity: "tasks", operation: "count", filterField: "status", filterValue: "Review" },
            { type: "chart", chartType: "bar", label: "Tasks by Priority", entity: "tasks", groupBy: "priority" }
          ]
        }
      ],
      workflows: [
        {
          trigger: "onCreate",
          entity: "tasks",
          actions: [
            { type: "notify", message: "Task '{{title}}' added under project code '{{projectCode}}' with priority {{priority}}." }
          ]
        }
      ]
    }
  },
  {
    name: "Expense Tracker",
    description: "Log corporate expenses by department. Flags warning notifications on high expenditures.",
    icon: DollarSign,
    color: "from-emerald-500 to-teal-500",
    config: {
      name: "Expense Tracker",
      description: "Log corporate expenses by department.",
      entities: [
        {
          name: "departments",
          label: "Department",
          fields: [
            { name: "name", label: "Department Name", type: "text", required: true, unique: true },
            { name: "lead", label: "Department Lead", type: "text", required: true }
          ]
        },
        {
          name: "expenses",
          label: "Expense",
          fields: [
            { name: "description", label: "Description", type: "text", required: true },
            { name: "department", label: "Department", type: "relation", relatedEntity: "departments", relatedField: "name", required: true },
            { name: "amount", label: "Amount ($)", type: "number", required: true, min: 0 },
            { name: "date", label: "Date", type: "date", required: true }
          ]
        }
      ],
      layout: {
        sidebar: [
          { label: "Analytics", icon: "LayoutDashboard", view: "dashboard" },
          { label: "Departments", icon: "Building", view: "list", entity: "departments" },
          { label: "Expense List", icon: "Receipt", view: "list", entity: "expenses" }
        ]
      },
      views: [
        {
          name: "dashboard",
          type: "dashboard",
          widgets: [
            { type: "metric", label: "Total Departments", entity: "departments", operation: "count" },
            { type: "metric", label: "Total Spending ($)", entity: "expenses", operation: "sum", field: "amount" },
            { type: "chart", chartType: "doughnut", label: "Expenses by Department", entity: "expenses", groupBy: "department" }
          ]
        }
      ],
      workflows: [
        {
          trigger: "onCreate",
          entity: "expenses",
          actions: [
            { type: "notify", message: "WARNING: High spending logged! {{description}} of ${{amount}} was added." }
          ]
        }
      ]
    }
  }
];

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAppName, setNewAppName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [appsRes, notifRes] = await Promise.all([
        fetch("/api/apps"),
        fetch("/api/notifications"),
      ]);

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApps(appsData.applications || []);
      }

      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);
      }
    } catch (e) {
      console.error("Failed to load workspace data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateApp = async (name: string, configObj?: any) => {
    if (!name.trim()) return;
    setLoadingAction(name);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: configObj ? configObj.description : "Blank sandboxed app workspace.",
          config: configObj || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/apps/${data.application.id}/edit`);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create application.");
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred while creating application.");
    } finally {
      setLoadingAction(null);
      setShowCreateModal(false);
      setNewAppName("");
    }
  };

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this application? All dynamic record entries will be lost forever.")) return;

    try {
      const res = await fetch(`/api/apps/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setApps(apps.filter((app) => app.id !== id));
      } else {
        alert("Failed to delete app.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/me", { method: "POST" });
      if (res.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: "all" }),
      });
      if (res.ok) {
        setNotifications(notifications.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen relative flex flex-col bg-[#0a0a0c]">
      <div className="glow-bg top-[-150px] right-[-100px]" />
      <div className="glow-bg-blue bottom-[-150px] left-[-100px]" />

      {/* Header bar */}
      <header className="relative z-10 glass-panel border-b border-white/5 py-4 px-6 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center border border-violet-500/20">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5 font-outfit">
              ZeroCode <span className="text-violet-400 font-normal">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400">Internship Project Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-xs text-slate-300 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 p-6 md:p-8 max-w-[1600px] w-full mx-auto">
        {/* Active Applications list */}
        <div className="lg:col-span-3 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 font-outfit">
                <FolderOpen className="w-5 h-5 text-violet-400" /> Active Workspace Apps
              </h2>
              <p className="text-xs text-slate-400 mt-1">Double click or click the play button to launch the live preview app sandbox.</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 btn-gradient rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Blank App
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-panel p-8 rounded-xl flex items-center justify-center h-48 border border-white/5 animate-pulse">
                <span className="text-xs text-slate-500">Loading workspaces...</span>
              </div>
            </div>
          ) : apps.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center h-64">
              <BookOpen className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-sm font-semibold text-slate-300">No applications created yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Get started by clicking "Create Blank App" or instantiating one of the high-fidelity templates below.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {apps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => router.push(`/apps/${app.id}/edit`)}
                  className="glass-panel glass-panel-hover p-6 rounded-2xl border border-white/5 relative group cursor-pointer flex flex-col justify-between h-48 transition"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-white text-base tracking-tight font-outfit group-hover:text-violet-400 transition">
                        {app.name}
                      </h3>
                      <button
                        onClick={(e) => handleDeleteApp(app.id, e)}
                        className="text-slate-500 hover:text-red-400 p-1 hover:bg-white/5 rounded transition cursor-pointer"
                        title="Delete application"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {app.description || "No description provided."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                    <span className="text-[10px] text-slate-500">
                      Modified {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                    <button className="flex items-center gap-1 text-[11px] font-bold text-violet-400 group-hover:text-white transition">
                      Launch Sandbox <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Templates Section */}
          <div className="space-y-4 pt-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-outfit">
                <Sparkles className="w-4 h-4 text-amber-400" /> Premium Quick-Start Templates
              </h2>
              <p className="text-xs text-slate-400">Initialize a complex metadata application model instantly.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isTemplateLoading = loadingAction === tmpl.name;
                return (
                  <div
                    key={tmpl.name}
                    className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col justify-between h-56 relative overflow-hidden group hover:border-violet-500/30 transition"
                  >
                    {/* Decorative glow */}
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${tmpl.color} opacity-5 blur-2xl group-hover:opacity-15 transition-all`} />

                    <div>
                      <div className={`w-10 h-10 bg-gradient-to-tr ${tmpl.color} rounded-xl flex items-center justify-center mb-3 shadow-md`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-white text-sm font-outfit">{tmpl.name}</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCreateApp(tmpl.name, tmpl.config)}
                      disabled={loadingAction !== null}
                      className="w-full mt-4 py-2 px-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      {isTemplateLoading ? (
                        "Loading..."
                      ) : (
                        <>
                          Instantiate Model <Plus className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notifications / Triggers sidebar panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 h-[calc(100vh-140px)] sticky top-8 flex flex-col justify-between">
            <div className="overflow-hidden flex flex-col flex-1">
              <div className="flex items-center justify-between pb-4 border-b border-white/5">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5 font-outfit">
                  <Bell className="w-4 h-4 text-violet-400" /> Notification Center
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-red-600 text-white font-bold rounded-full px-1.5 py-0.5">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-violet-400 hover:text-white underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-10 flex flex-col items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-xs text-slate-500">All notifications cleared</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-xl border text-xs leading-relaxed transition ${
                        notif.read
                          ? "bg-slate-950/20 border-slate-900/40 text-slate-400"
                          : "bg-violet-950/20 border-violet-900/30 text-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-bold text-white/95">{notif.title}</span>
                        {notif.message.toLowerCase().includes("warning") ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed">{notif.message}</p>
                      <span className="text-[9px] text-slate-600 mt-1 block">
                        {new Date(notif.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <div className="p-3 bg-violet-950/15 border border-violet-900/20 rounded-xl">
                <h4 className="text-xs font-bold text-violet-300 font-outfit">Workflow Monitor</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Triggers execute and post records in real-time as calculations evaluate in the backend.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal for Blank App Creation */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-white/10 relative">
            <h3 className="text-md font-bold text-white mb-4 font-outfit">Create Blank Application</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                  Application Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales Tracker"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs outline-none focus:border-violet-500 transition"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateApp(newAppName)}
                  className="px-4 py-1.5 btn-gradient rounded-lg text-white font-semibold text-xs cursor-pointer shadow-md"
                >
                  Create App
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
