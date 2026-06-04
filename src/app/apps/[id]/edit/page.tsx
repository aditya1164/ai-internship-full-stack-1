"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";
import {
  Terminal,
  Play,
  Save,
  Code,
  Sliders,
  Download,
  AlertCircle,
  Plus,
  Trash2,
  List,
  FormInput,
  FolderSync,
  ChevronRight,
  Search,
  Filter,
  ArrowUpDown,
  Upload,
  User,
  Users,
  ShoppingCart,
  LayoutDashboard,
  Folder,
  CheckSquare,
  Building,
  Receipt,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  ArrowLeft,
  X,
  Loader2,
  CheckCircle,
  Database
} from "lucide-react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

// Map string icons to Lucide components
const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Folder,
  CheckSquare,
  Building,
  Receipt,
  FileText,
  Calendar,
  Layers
};

function getIcon(name: string) {
  return ICON_MAP[name] || FileText;
}

export default function AppDesignerPage() {
  const { id: appId } = useParams();
  const router = useRouter();

  // Workspace configuration state
  const [app, setApp] = useState<any>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "visual">("visual");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Live Runtime state of the previewed application
  const [previewConfig, setPreviewConfig] = useState<any>(null);
  const [activeView, setActiveView] = useState("dashboard"); // dashboard, list, form, detail
  const [activeEntity, setActiveEntity] = useState<string | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | "view">("create");

  // Grid/List state
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchText, setSearchText] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Dynamic aggregates for dashboard
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [chartsData, setChartsData] = useState<Record<string, any>>({});

  // CSV Import Wizard state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({}); // Entity Field -> CSV Column
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  // Detail view nested relation records
  const [nestedRelationRecords, setNestedRelationRecords] = useState<Record<string, any[]>>({});

  // Visual Builder form helper states
  const [selectedEntityIdx, setSelectedEntityIdx] = useState<number | null>(null);

  // Load app configuration from backend
  const loadApp = async () => {
    try {
      const res = await fetch(`/api/apps/${appId}`);
      if (!res.ok) {
        if (res.status === 401) router.push("/login");
        else router.push("/dashboard");
        return;
      }
      const data = await res.json();
      setApp(data.application);
      setJsonText(JSON.stringify(data.application.config, null, 2));
      setPreviewConfig(data.application.config);
      
      // Auto-set first entity
      if (data.application.config.entities && data.application.config.entities.length > 0) {
        setActiveEntity(data.application.config.entities[0].name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadApp();
  }, [appId]);

  // Sync JSON text to preview when user edits code
  const handleJsonChange = (val: string) => {
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      setJsonError(null);
      setPreviewConfig(parsed);
    } catch (err: any) {
      setJsonError(err.message || "Invalid JSON syntax.");
    }
  };

  // Visual builder schema saving wrapper
  const saveVisualConfig = (newConfig: any) => {
    setPreviewConfig(newConfig);
    setJsonText(JSON.stringify(newConfig, null, 2));
    handleSaveAppConfig(newConfig);
  };

  // Push updated config schema to backend
  const handleSaveAppConfig = async (configToSave = previewConfig) => {
    if (jsonError) {
      alert("Please fix JSON errors before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: configToSave.name,
          description: configToSave.description || "",
          config: configToSave,
        }),
      });
      if (res.ok) {
        // Reload settings
        const data = await res.json();
        setApp(data.application);
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Run dynamic metrics calculation for dashboard widgets
  const fetchDashboardData = async () => {
    if (!previewConfig || activeView !== "dashboard") return;
    const views = previewConfig.views || [];
    const dashboardView = views.find((v: any) => v.type === "dashboard");
    if (!dashboardView) return;

    const widgets = dashboardView.widgets || [];
    const loadedMetrics: Record<string, number> = {};
    const loadedCharts: Record<string, any> = {};

    for (let idx = 0; idx < widgets.length; idx++) {
      const widget = widgets[idx];
      const widgetId = `${widget.type}-${idx}`;

      if (widget.type === "metric") {
        // Query generic endpoint to aggregate
        let url = `/api/apps/${appId}/entities/${widget.entity}?_limit=10000`;
        if (widget.filterField && widget.filterValue) {
          url += `&${widget.filterField}=${widget.filterValue}`;
        }

        try {
          const res = await fetch(url);
          const data = await res.json();
          const rows = data.records || [];

          if (widget.operation === "count") {
            loadedMetrics[widgetId] = rows.length;
          } else if (widget.operation === "sum" && widget.field) {
            const sum = rows.reduce((acc: number, r: any) => acc + (Number(r[widget.field]) || 0), 0);
            loadedMetrics[widgetId] = sum;
          } else if (widget.operation === "avg" && widget.field) {
            const sum = rows.reduce((acc: number, r: any) => acc + (Number(r[widget.field]) || 0), 0);
            loadedMetrics[widgetId] = rows.length > 0 ? parseFloat((sum / rows.length).toFixed(2)) : 0;
          }
        } catch (e) {
          console.error(e);
          loadedMetrics[widgetId] = 0;
        }
      } else if (widget.type === "chart" && widget.groupBy) {
        try {
          const res = await fetch(`/api/apps/${appId}/entities/${widget.entity}?_limit=10000`);
          const data = await res.json();
          const rows = data.records || [];

          // Group calculations
          const counts: Record<string, number> = {};
          rows.forEach((r: any) => {
            const key = String(r[widget.groupBy] || "Unassigned");
            counts[key] = (counts[key] || 0) + 1;
          });

          const labels = Object.keys(counts);
          const values = Object.values(counts);

          // Configure charts variables
          loadedCharts[widgetId] = {
            labels,
            datasets: [
              {
                label: widget.label || "Count",
                data: values,
                backgroundColor: [
                  "rgba(139, 92, 246, 0.6)",
                  "rgba(59, 130, 246, 0.6)",
                  "rgba(16, 185, 129, 0.6)",
                  "rgba(245, 158, 11, 0.6)",
                  "rgba(239, 68, 68, 0.6)",
                  "rgba(236, 72, 153, 0.6)"
                ],
                borderColor: [
                  "rgb(139, 92, 246)",
                  "rgb(59, 130, 246)",
                  "rgb(16, 185, 129)",
                  "rgb(245, 158, 11)",
                  "rgb(239, 68, 68)",
                  "rgb(236, 72, 153)"
                ],
                borderWidth: 1,
              }
            ]
          };
        } catch (e) {
          console.error(e);
        }
      }
    }

    setMetrics(loadedMetrics);
    setChartsData(loadedCharts);
  };

  // Run dynamic listing data loader
  const fetchRecords = async () => {
    if (!previewConfig || !activeEntity || ["dashboard", "form"].includes(activeView)) return;
    setLoadingRecords(true);

    let url = `/api/apps/${appId}/entities/${activeEntity}?_page=${currentPage}&_limit=${pageSize}`;
    if (sortField) {
      url += `&_sort=${sortField}&_order=${sortOrder}`;
    }
    if (searchText) {
      url += `&_q=${encodeURIComponent(searchText)}`;
    }
    // Append search filters
    Object.entries(filterValues).forEach(([key, val]) => {
      if (val) url += `&${key}=${encodeURIComponent(val)}`;
    });

    try {
      const res = await fetch(url);
      const data = await res.json();
      setRecords(data.records || []);
      setTotalRecords(data.pagination?.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [previewConfig, activeView]);

  useEffect(() => {
    fetchRecords();
  }, [appId, activeEntity, activeView, currentPage, sortField, sortOrder, searchText, filterValues]);

  // Handle codebase zip exporter trigger
  const handleExportCode = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/apps/${appId}/export-code`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${previewConfig.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-codebase.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Failed to export standalone project zip.");
      }
    } catch (err) {
      console.error(err);
      alert("Error exporting standalone project codebase.");
    } finally {
      setExporting(false);
    }
  };

  // CSV Dynamic Columns Mapper UI Loader
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setImportSummary(null);

    Papa.parse(file, {
      header: true,
      preview: 5,
      complete: (results) => {
        setCsvHeaders(results.meta.fields || []);
        setCsvPreviewRows(results.data || []);
        
        // Auto-match headers to entity fields if names are similar
        const currentEntity = previewConfig.entities.find((ent: any) => ent.name === activeEntity);
        if (currentEntity) {
          const initMapping: Record<string, string> = {};
          currentEntity.fields.forEach((f: any) => {
            const match = (results.meta.fields || []).find(
              (h) => h.toLowerCase().trim() === f.name.toLowerCase().trim() ||
                     h.toLowerCase().trim() === f.label.toLowerCase().trim()
            );
            if (match) initMapping[f.name] = match;
          });
          setCsvMapping(initMapping);
        }
      }
    });
  };

  // POST mapped CSV records to bulk endpoint
  const handleImportCsvSubmit = async () => {
    if (!csvFile || !activeEntity) return;
    setImportingCsv(true);
    setImportSummary(null);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        // Map raw CSV row columns to entity fields based on schema map
        const mappedRows = results.data.map((csvRow: any) => {
          const rowObj: Record<string, any> = {};
          Object.entries(csvMapping).forEach(([fieldKey, csvHeader]) => {
            if (csvHeader) rowObj[fieldKey] = csvRow[csvHeader];
          });
          return rowObj;
        });

        try {
          const res = await fetch(`/api/apps/${appId}/import-csv`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityName: activeEntity,
              rows: mappedRows,
            }),
          });

          const data = await res.json();
          if (res.ok) {
            setImportSummary(data.summary);
            fetchRecords(); // Refresh list grid
          } else {
            alert(data.error || "Failed to process bulk import.");
          }
        } catch (err) {
          console.error(err);
          alert("Error during dynamic records import.");
        } finally {
          setImportingCsv(false);
        }
      }
    });
  };

  // Detailed Record Loader (includes scanning relationships)
  const [selectedRecordData, setSelectedRecordData] = useState<any>(null);
  const [loadingRecordDetail, setLoadingRecordDetail] = useState(false);

  const fetchRecordDetail = async (recId: string) => {
    if (!activeEntity) return;
    setLoadingRecordDetail(true);
    try {
      const res = await fetch(`/api/apps/${appId}/entities/${activeEntity}/${recId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedRecordData(data.record);
        
        // Scan for related listings: Find other entities in config that reference this entity!
        // e.g. If current entity is 'customers', check if 'orders' contains a relation back to 'customers'
        const currentEntity = previewConfig.entities.find((e: any) => e.name === activeEntity);
        if (currentEntity) {
          const relationshipLookups: Record<string, any[]> = {};
          const relationFields = currentEntity.fields.filter((f: any) => f.type === "relation"); // outgoing relations

          // Fetch relations
          for (const otherEntity of previewConfig.entities) {
            const matchingRelations = otherEntity.fields.filter(
              (f: any) => f.type === "relation" && f.relatedEntity === activeEntity
            );

            if (matchingRelations.length > 0) {
              // Find related records for this parent ID or parent unique matching value
              // Query otherEntity API
              const otherRes = await fetch(`/api/apps/${appId}/entities/${otherEntity.name}?_limit=100`);
              const otherData = await otherRes.json();
              const otherRows = otherData.records || [];

              // Filter rows referencing this parent
              matchingRelations.forEach((rField: any) => {
                const searchVal = rField.relatedField === "id" ? recId : data.record[rField.relatedField || "id"];
                const filtered = otherRows.filter((row: any) => String(row[rField.name]).toLowerCase() === String(searchVal).toLowerCase());
                relationshipLookups[otherEntity.name] = filtered;
              });
            }
          }
          setNestedRelationRecords(relationshipLookups);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecordDetail(false);
    }
  };

  // Handle record creation submission
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmittingForm(true);

    try {
      const isEdit = formMode === "edit";
      const url = isEdit
        ? `/api/apps/${appId}/entities/${activeEntity}/${activeRecordId}`
        : `/api/apps/[id]/entities/${activeEntity}`; // Fallback placeholder
      
      const realUrl = isEdit 
        ? `/api/apps/${appId}/entities/${activeEntity}/${activeRecordId}`
        : `/api/apps/${appId}/entities/${activeEntity}`;

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(realUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        // Success
        setActiveView("list");
        fetchRecords();
      } else {
        if (data.errors) {
          setFormErrors(data.errors);
        } else {
          alert(data.error || "Form submission failed.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred submitting record.");
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleCreateRecordClick = () => {
    setFormErrors({});
    // Setup default values based on schema
    const currentEntity = previewConfig.entities.find((ent: any) => ent.name === activeEntity);
    const defaults: Record<string, any> = {};
    if (currentEntity) {
      currentEntity.fields.forEach((f: any) => {
        if (f.default !== undefined) defaults[f.name] = f.default;
        else if (f.type === "number") defaults[f.name] = 0;
        else if (f.type === "boolean") defaults[f.name] = false;
        else defaults[f.name] = "";
      });
    }
    setFormData(defaults);
    setFormMode("create");
    setActiveView("form");
  };

  const handleEditRecordClick = (rec: any) => {
    setFormErrors({});
    setFormData(rec);
    setFormMode("edit");
    setActiveRecordId(rec.id);
    setActiveView("form");
  };

  const handleRecordDetailClick = (recId: string) => {
    setActiveRecordId(recId);
    fetchRecordDetail(recId);
    setActiveView("detail");
  };

  const handleDeleteRecord = async (recId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      const res = await fetch(`/api/apps/${appId}/entities/${activeEntity}/${recId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchRecords();
      } else {
        alert("Failed to delete record.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!app || !previewConfig) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // Visual schema configuration handlers
  const handleAddEntity = () => {
    const config = { ...previewConfig };
    const entName = `entity_${Date.now().toString().slice(-4)}`;
    config.entities = config.entities || [];
    config.entities.push({
      name: entName,
      label: `Custom Entity ${config.entities.length + 1}`,
      fields: [
        { name: "name", label: "Name", type: "text", required: true }
      ]
    });
    // Add sidebar layout navigation option if layout exists
    config.layout = config.layout || { sidebar: [] };
    config.layout.sidebar.push({
      label: `Custom Entity ${config.entities.length}`,
      icon: "FileText",
      view: "list",
      entity: entName
    });

    saveVisualConfig(config);
    setSelectedEntityIdx(config.entities.length - 1);
    setActiveEntity(entName);
  };

  const handleRemoveEntity = (idx: number) => {
    if (!confirm("Are you sure you want to remove this entity? This deletes its layout links too.")) return;
    const config = { ...previewConfig };
    const entity = config.entities[idx];
    config.entities.splice(idx, 1);
    
    // Clean layout references
    config.layout = config.layout || { sidebar: [] };
    config.layout.sidebar = config.layout.sidebar.filter((s: any) => s.entity !== entity.name);

    saveVisualConfig(config);
    setSelectedEntityIdx(null);
    if (config.entities.length > 0) {
      setActiveEntity(config.entities[0].name);
    } else {
      setActiveEntity(null);
    }
  };

  const handleAddField = (entityIdx: number) => {
    const config = { ...previewConfig };
    config.entities[entityIdx].fields = config.entities[entityIdx].fields || [];
    config.entities[entityIdx].fields.push({
      name: `field_${Date.now().toString().slice(-4)}`,
      label: "Custom Field",
      type: "text",
      required: false,
    });
    saveVisualConfig(config);
  };

  const handleRemoveField = (entityIdx: number, fieldIdx: number) => {
    const config = { ...previewConfig };
    config.entities[entityIdx].fields.splice(fieldIdx, 1);
    saveVisualConfig(config);
  };

  const handleFieldChange = (entityIdx: number, fieldIdx: number, key: string, val: any) => {
    const config = { ...previewConfig };
    config.entities[entityIdx].fields[fieldIdx][key] = val;
    saveVisualConfig(config);
  };

  const handleEntityLabelChange = (entityIdx: number, newLabel: string) => {
    const config = { ...previewConfig };
    const entity = config.entities[entityIdx];
    entity.label = newLabel;
    
    // Update layout links matching label
    config.layout = config.layout || { sidebar: [] };
    const layoutLink = config.layout.sidebar.find((s: any) => s.entity === entity.name);
    if (layoutLink) {
      layoutLink.label = `${newLabel}s`;
    }
    
    saveVisualConfig(config);
  };

  return (
    <div className="h-screen bg-[#070709] flex flex-col overflow-hidden relative">
      {/* Dynamic light blur in background */}
      <div className="glow-bg-blue top-0 left-1/4 scale-75 opacity-10 pointer-events-none" />

      {/* Control bar */}
      <header className="h-14 border-b border-white/5 bg-slate-950/80 backdrop-blur px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <h2 className="text-sm font-bold text-white font-outfit">{app.name}</h2>
            <p className="text-[10px] text-slate-400">Application Sandbox Runtime Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 flex gap-0.5">
            <button
              onClick={() => setActiveTab("visual")}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                activeTab === "visual" ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Visual Builder
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition ${
                activeTab === "code" ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              <Code className="w-3.5 h-3.5" /> JSON Code
            </button>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Action buttons */}
          <button
            onClick={() => handleSaveAppConfig()}
            disabled={saving || jsonError !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-xs font-semibold text-slate-300 transition cursor-pointer disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Schema
          </button>

          <button
            onClick={handleExportCode}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 btn-gradient rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer disabled:opacity-40"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                Export Codebase <Download className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </header>

      {/* Editor & Preview Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: CONFIG EDITOR */}
        <div className="w-1/2 border-r border-white/5 flex flex-col bg-slate-950/60 overflow-hidden relative">
          {activeTab === "code" ? (
            // Tab 1: Code editor
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-slate-950 border-b border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5 text-violet-400" /> app.config.json</span>
                {jsonError && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Broken syntax
                  </span>
                )}
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="flex-1 p-6 bg-[#040406] text-emerald-400 font-mono text-xs outline-none border-none resize-none overflow-y-auto leading-relaxed"
                spellCheck={false}
              />
              {jsonError && (
                <div className="p-3 bg-red-950/40 border-t border-red-500/20 text-red-200 text-xs font-mono leading-normal">
                  <span className="font-semibold">JSON Error:</span> {jsonError}
                </div>
              )}
            </div>
          ) : (
            // Tab 2: Visual Schema Builder
            <div className="flex-1 flex overflow-hidden">
              {/* Entities sidebar selector */}
              <div className="w-1/3 border-r border-white/5 p-4 space-y-4 overflow-y-auto bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entities</h3>
                  <button
                    onClick={handleAddEntity}
                    className="p-1 hover:bg-white/5 rounded text-violet-400 hover:text-white transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {previewConfig.entities.map((ent: any, idx: number) => (
                    <div
                      key={ent.name}
                      onClick={() => {
                        setSelectedEntityIdx(idx);
                        setActiveEntity(ent.name);
                        setActiveView("list");
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between group cursor-pointer transition ${
                        selectedEntityIdx === idx
                          ? "bg-violet-950/30 border border-violet-900/40 text-violet-300"
                          : "bg-slate-900/40 border border-transparent text-slate-300 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Database className="w-3.5 h-3.5 opacity-60" /> {ent.label}s
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveEntity(idx);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded hover:bg-white/5 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entity Fields configurator */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {selectedEntityIdx === null ? (
                  <div className="text-center py-20 flex flex-col items-center justify-center text-slate-500">
                    <Sliders className="w-10 h-10 text-slate-700 mb-3 animate-pulse" />
                    <p className="text-xs">Select or add an entity to configure its database structure.</p>
                  </div>
                ) : (
                  <>
                    <div className="pb-4 border-b border-white/5 space-y-3">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold">Entity Label</label>
                        <input
                          type="text"
                          value={previewConfig.entities[selectedEntityIdx].label}
                          onChange={(e) => handleEntityLabelChange(selectedEntityIdx, e.target.value)}
                          className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500 transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-300">Fields & Constraints</h4>
                        <button
                          onClick={() => handleAddField(selectedEntityIdx)}
                          className="flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-white transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Field
                        </button>
                      </div>

                      <div className="space-y-3">
                        {previewConfig.entities[selectedEntityIdx].fields.map((field: any, fIdx: number) => (
                          <div
                            key={field.name}
                            className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl space-y-3 relative group"
                          >
                            <button
                              onClick={() => handleRemoveField(selectedEntityIdx, fIdx)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 hover:bg-white/5 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase font-semibold">Field ID</label>
                                <input
                                  type="text"
                                  value={field.name}
                                  onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "name", e.target.value)}
                                  className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase font-semibold">Display Label</label>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "label", e.target.value)}
                                  className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase font-semibold">Data Type</label>
                                <select
                                  value={field.type}
                                  onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "type", e.target.value)}
                                  className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 outline-none"
                                >
                                  <option value="text">Text String</option>
                                  <option value="email">Email</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="select">Dropdown Select</option>
                                  <option value="date">Date</option>
                                  <option value="relation">Relation (Lookup)</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-4 mt-4">
                                <label className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.required || false}
                                    onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "required", e.target.checked)}
                                    className="rounded border-slate-800 text-violet-600 focus:ring-0"
                                  />
                                  Required
                                </label>
                                <label className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={field.unique || false}
                                    onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "unique", e.target.checked)}
                                    className="rounded border-slate-800 text-violet-600 focus:ring-0"
                                  />
                                  Unique
                                </label>
                              </div>
                            </div>

                            {/* Conditional options rendering */}
                            {field.type === "select" && (
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase font-semibold">
                                  Options (Comma separated)
                                </label>
                                <input
                                  type="text"
                                  value={(field.options || []).join(", ")}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      selectedEntityIdx,
                                      fIdx,
                                      "options",
                                      e.target.value.split(",").map((s) => s.trim())
                                    )
                                  }
                                  placeholder="Lead, Active, Inactive"
                                  className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none"
                                />
                              </div>
                            )}

                            {field.type === "relation" && (
                              <div className="grid grid-cols-2 gap-3 p-2 bg-slate-950/40 rounded-lg border border-slate-900/60">
                                <div>
                                  <label className="block text-[8px] text-slate-500 uppercase font-semibold">Target Entity</label>
                                  <select
                                    value={field.relatedEntity || ""}
                                    onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "relatedEntity", e.target.value)}
                                    className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-300 outline-none"
                                  >
                                    <option value="">Select Entity...</option>
                                    {previewConfig.entities
                                      .filter((ent: any) => ent.name !== previewConfig.entities[selectedEntityIdx].name)
                                      .map((ent: any) => (
                                        <option key={ent.name} value={ent.name}>{ent.label}</option>
                                      ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[8px] text-slate-500 uppercase font-semibold">Match Key</label>
                                  <select
                                    value={field.relatedField || "id"}
                                    onChange={(e) => handleFieldChange(selectedEntityIdx, fIdx, "relatedField", e.target.value)}
                                    className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-300 outline-none"
                                  >
                                    <option value="id">Record ID</option>
                                    {/* Try to display other unique fields of targeted entity */}
                                    {(() => {
                                      const targetEnt = previewConfig.entities.find((e: any) => e.name === field.relatedEntity);
                                      if (!targetEnt) return null;
                                      return targetEnt.fields
                                        .filter((f: any) => f.name !== "id")
                                        .map((f: any) => (
                                          <option key={f.name} value={f.name}>{f.label} ({f.name})</option>
                                        ));
                                    })()}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: LIVE RUNTIME PREVIEW */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-slate-900/10">
          <div className="p-3 bg-slate-950/60 border-b border-white/5 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5 text-emerald-400 fill-current" /> Live Preview Runtime</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950/30 text-emerald-400 rounded-full border border-emerald-900/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Synchronized
            </span>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Dynamic Application Container */}
            <div className="flex-1 flex bg-[#0c0c0e] overflow-hidden">
              {/* Dynamic Sidebar Navigation */}
              <aside className="w-48 bg-slate-950 border-r border-white/5 p-3 flex flex-col justify-between shrink-0">
                <div className="space-y-4">
                  <div className="px-2 py-1.5 bg-slate-900/60 rounded-xl border border-slate-800/40">
                    <span className="text-[11px] font-bold text-white block truncate">{previewConfig.name}</span>
                    <span className="text-[9px] text-slate-500 block truncate">Dynamic Sandbox</span>
                  </div>

                  <nav className="space-y-1">
                    {/* Render Navigation Links dynamically */}
                    {previewConfig.layout?.sidebar?.map((navItem: any) => {
                      const IconComponent = getIcon(navItem.icon);
                      const isSelected = activeView === navItem.view && (navItem.view === "dashboard" || activeEntity === navItem.entity);
                      return (
                        <button
                          key={navItem.label}
                          onClick={() => {
                            setActiveView(navItem.view);
                            if (navItem.entity) {
                              setActiveEntity(navItem.entity);
                            }
                            setCurrentPage(1);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                            isSelected
                              ? "bg-violet-600 text-white font-bold"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          <span className="truncate">{navItem.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                <div className="p-2 border-t border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                    <User className="w-3.5 h-3.5" /> User scoped workspace
                  </div>
                </div>
              </aside>

              {/* Dynamic Screen View Renderer */}
              <div className="flex-1 overflow-y-auto p-6 relative">
                {/* 1. DASHBOARD VIEW RENDERER */}
                {activeView === "dashboard" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-white font-outfit">Overview Analytics</h3>
                      <p className="text-[11px] text-slate-400 mt-1">Aggregating record data collections in real-time.</p>
                    </div>

                    {/* Metric Widgets Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {previewConfig.views
                        ?.find((v: any) => v.type === "dashboard")
                        ?.widgets?.filter((w: any) => w.type === "metric")
                        .map((widget: any, idx: number) => {
                          const widgetId = `${widget.type}-${idx}`;
                          const val = metrics[widgetId] ?? 0;
                          return (
                            <div key={widgetId} className="bg-slate-900/30 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{widget.label}</span>
                              <span className="text-2xl font-black text-white mt-2 font-outfit">{val}</span>
                            </div>
                          );
                        })}
                    </div>

                    {/* Charts Widgets Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {previewConfig.views
                        ?.find((v: any) => v.type === "dashboard")
                        ?.widgets?.filter((w: any) => w.type === "chart")
                        .map((widget: any, idx: number) => {
                          const widgetId = `${widget.type}-${idx}`;
                          const chartData = chartsData[widgetId];

                          return (
                            <div key={widgetId} className="bg-slate-900/20 border border-slate-900/80 p-5 rounded-2xl">
                              <h4 className="text-xs font-bold text-slate-300 mb-4">{widget.label || "Chart Analytics"}</h4>
                              {chartData ? (
                                <div className="h-48 flex items-center justify-center">
                                  {widget.chartType === "doughnut" || widget.chartType === "pie" ? (
                                    <Doughnut
                                      data={chartData}
                                      options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { labels: { color: "rgb(150,150,160)", font: { size: 9 } } } }
                                      }}
                                    />
                                  ) : (
                                    <Bar
                                      data={chartData}
                                      options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: { legend: { display: false } },
                                        scales: {
                                          x: { ticks: { color: "rgb(120,120,130)", font: { size: 9 } }, grid: { display: false } },
                                          y: { ticks: { color: "rgb(120,120,130)", font: { size: 9 } }, grid: { color: "rgba(255,255,255,0.03)" } }
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="h-48 flex items-center justify-center text-[10px] text-slate-500">
                                  Loading chart statistics...
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 2. LIST/GRID VIEW RENDERER */}
                {activeView === "list" && activeEntity && (() => {
                  const currentEntity = previewConfig.entities.find((e: any) => e.name === activeEntity);
                  if (!currentEntity) return <p className="text-xs text-red-400">Entity configuration missing.</p>;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-white font-outfit">{currentEntity.label} Dataset</h3>
                          <p className="text-[11px] text-slate-400 mt-1">Manage, filter, search, and dynamic CSV imports.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowCsvModal(true)}
                            className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" /> CSV Import
                          </button>
                          <button
                            onClick={handleCreateRecordClick}
                            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 btn-gradient text-white rounded-xl shadow cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add {currentEntity.label}
                          </button>
                        </div>
                      </div>

                      {/* Filter, sort & search controls */}
                      <div className="flex flex-wrap items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-900/60">
                        {/* Text Search */}
                        <div className="relative flex-1 min-w-[150px]">
                          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Search records..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            className="w-full bg-slate-900 pl-8 pr-3 py-1.5 text-[11px] text-slate-200 rounded-lg outline-none border border-slate-800 focus:border-violet-600 transition"
                          />
                        </div>

                        {/* Custom filters dropdowns for select types */}
                        {currentEntity.fields.filter((f: any) => f.type === "select").map((field: any) => (
                          <div key={field.name} className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-semibold">{field.label}:</span>
                            <select
                              value={filterValues[field.name] || "all"}
                              onChange={(e) =>
                                setFilterValues({ ...filterValues, [field.name]: e.target.value })
                              }
                              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300 outline-none"
                            >
                              <option value="all">All</option>
                              {field.options?.map((o: string) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>

                      {/* Table / Grid */}
                      <div className="bg-slate-950/40 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-900 bg-slate-950/80">
                                {currentEntity.fields.map((f: any) => (
                                  <th
                                    key={f.name}
                                    onClick={() => {
                                      const order = sortField === f.name && sortOrder === "asc" ? "desc" : "asc";
                                      setSortField(f.name);
                                      setSortOrder(order);
                                    }}
                                    className="px-4 py-3 font-bold uppercase text-slate-400 tracking-wider text-[10px] cursor-pointer hover:text-slate-200 transition"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {f.label} <ArrowUpDown className="w-3 h-3 opacity-40" />
                                    </div>
                                  </th>
                                ))}
                                <th className="px-4 py-3 font-bold uppercase text-slate-400 tracking-wider text-[10px] text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/60 bg-[#0a0a0c]">
                              {loadingRecords ? (
                                <tr>
                                  <td colSpan={currentEntity.fields.length + 1} className="text-center py-10 text-slate-500 animate-pulse">
                                    Scanning database...
                                  </td>
                                </tr>
                              ) : records.length === 0 ? (
                                <tr>
                                  <td colSpan={currentEntity.fields.length + 1} className="text-center py-10 text-slate-500">
                                    No records matching constraints.
                                  </td>
                                </tr>
                              ) : (
                                records.map((rec) => (
                                  <tr
                                    key={rec.id}
                                    onClick={() => handleRecordDetailClick(rec.id)}
                                    className="hover:bg-slate-900/20 cursor-pointer transition"
                                  >
                                    {currentEntity.fields.map((f: any) => {
                                      const val = rec[f.name];
                                      return (
                                        <td key={f.name} className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap truncate max-w-[150px]">
                                          {f.type === "boolean" ? (
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${val ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900/30" : "bg-red-950/20 text-red-400 border border-red-900/30"}`}>
                                              {val ? "Yes" : "No"}
                                            </span>
                                          ) : f.type === "select" ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800">
                                              {val || ""}
                                            </span>
                                          ) : (
                                            String(val ?? "")
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          onClick={() => handleEditRecordClick(rec)}
                                          className="text-slate-500 hover:text-violet-400 p-1 hover:bg-slate-900 rounded transition cursor-pointer"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => handleDeleteRecord(rec.id, e)}
                                          className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-900 rounded transition cursor-pointer"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination Footer */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 shrink-0">
                        <span>Total Records: {totalRecords}</span>
                        <div className="flex gap-2">
                          <button
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage(currentPage - 1)}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-30 cursor-pointer"
                          >
                            Prev
                          </button>
                          <span className="px-3 py-1 bg-slate-950 rounded border border-slate-900 text-slate-300">
                            Page {currentPage} of {Math.max(1, Math.ceil(totalRecords / pageSize))}
                          </span>
                          <button
                            disabled={currentPage * pageSize >= totalRecords}
                            onClick={() => setCurrentPage(currentPage + 1)}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 rounded disabled:opacity-30 cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. DYNAMIC FORM RENDERER (Create / Edit) */}
                {activeView === "form" && activeEntity && (() => {
                  const currentEntity = previewConfig.entities.find((e: any) => e.name === activeEntity);
                  if (!currentEntity) return <p>Entity configuration missing.</p>;

                  return (
                    <div className="space-y-6 max-w-lg mx-auto bg-slate-950/30 p-6 rounded-2xl border border-slate-900">
                      <div>
                        <h3 className="text-base font-bold text-white font-outfit">
                          {formMode === "edit" ? "Edit Entry" : `New ${currentEntity.label}`}
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Inputs are validated dynamically against fields constraints.
                        </p>
                      </div>

                      <form onSubmit={handleFormSubmit} className="space-y-4">
                        {currentEntity.fields.map((field: any) => {
                          const hasErr = formErrors[field.name];
                          return (
                            <div key={field.name} className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-slate-300">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                              </label>

                              {/* Input render types */}
                              {field.type === "select" ? (
                                <select
                                  value={formData[field.name] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-600 transition"
                                >
                                  <option value="">Select option...</option>
                                  {field.options?.map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : field.type === "boolean" ? (
                                <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={formData[field.name] || false}
                                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
                                    className="rounded border-slate-800 text-violet-600 focus:ring-0"
                                  />
                                  {field.label} status active
                                </label>
                              ) : field.type === "date" ? (
                                <input
                                  type="date"
                                  value={formData[field.name] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-600 transition"
                                />
                              ) : field.type === "relation" ? (
                                // Relational lookup inputs
                                <input
                                  type="text"
                                  placeholder={`Enter unique matching ${field.relatedField || "id"} in ${field.relatedEntity}...`}
                                  value={formData[field.name] || ""}
                                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-600 transition"
                                />
                              ) : (
                                <input
                                  type={field.type === "number" ? "number" : "text"}
                                  step="any"
                                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                                  value={formData[field.name] ?? ""}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      [field.name]: field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value,
                                    })
                                  }
                                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-600 transition"
                                />
                              )}

                              {hasErr && (
                                <p className="text-[10px] text-red-400 font-medium mt-1">{hasErr}</p>
                              )}
                            </div>
                          );
                        })}

                        <div className="flex gap-2 justify-end pt-4 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => setActiveView("list")}
                            className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submittingForm}
                            className="px-4 py-1.5 btn-gradient rounded-lg text-white font-bold text-xs cursor-pointer shadow-md"
                          >
                            {submittingForm ? "Saving..." : "Save Record"}
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                })()}

                {/* 4. DYNAMIC DETAIL VIEW SHEETS */}
                {activeView === "detail" && selectedRecordData && (() => {
                  const currentEntity = previewConfig.entities.find((e: any) => e.name === activeEntity);
                  if (!currentEntity) return <p>Entity configuration missing.</p>;

                  return (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div>
                          <button
                            onClick={() => setActiveView("list")}
                            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition font-semibold"
                          >
                            <ArrowLeft className="w-3 h-3" /> Back to table
                          </button>
                          <h3 className="text-base font-bold text-white font-outfit mt-1.5">
                            {currentEntity.label} Details
                          </h3>
                        </div>
                        <button
                          onClick={() => handleEditRecordClick(selectedRecordData)}
                          className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          Modify Entry
                        </button>
                      </div>

                      {loadingRecordDetail ? (
                        <p className="text-xs text-slate-500 animate-pulse">Reading fields from records...</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/30 p-6 rounded-2xl border border-slate-900">
                          {currentEntity.fields.map((field: any) => {
                            const val = selectedRecordData[field.name];
                            return (
                              <div key={field.name} className="space-y-1">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{field.label}</span>
                                <p className="text-xs text-slate-200 font-medium">
                                  {field.type === "boolean" ? (val ? "Active / Yes" : "Inactive / No") : String(val ?? "—")}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Display outgoing relation sheets, nested sub-tables */}
                      {!loadingRecordDetail && Object.entries(nestedRelationRecords).map(([relatedEntityName, relRecords]) => {
                        const relEntity = previewConfig.entities.find((e: any) => e.name === relatedEntityName);
                        if (!relEntity || relRecords.length === 0) return null;

                        return (
                          <div key={relatedEntityName} className="space-y-3">
                            <h4 className="text-xs font-bold text-violet-300 flex items-center gap-1">
                              <ChevronRight className="w-3.5 h-3.5" /> Associated {relEntity.label}s ({relRecords.length})
                            </h4>

                            <div className="bg-slate-950/30 border border-slate-900/60 rounded-xl overflow-hidden">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead className="bg-slate-900/30">
                                  <tr className="border-b border-slate-900">
                                    {relEntity.fields.slice(0, 4).map((f: any) => (
                                      <th key={f.name} className="px-3 py-2 text-slate-400 font-semibold">{f.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {relRecords.map((relRec: any) => (
                                    <tr key={relRec.id} className="border-b border-slate-900/40 hover:bg-slate-900/10">
                                      {relEntity.fields.slice(0, 4).map((f: any) => (
                                        <td key={f.name} className="px-3 py-2 text-slate-300">
                                          {String(relRec[f.name] ?? "")}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSV IMPORT DIALOG MODAL */}
      {showCsvModal && activeEntity && (() => {
        const currentEntity = previewConfig.entities.find((e: any) => e.name === activeEntity);
        if (!currentEntity) return null;

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-white/10 relative flex flex-col max-h-[85vh] overflow-hidden">
              <button
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvFile(null);
                  setImportSummary(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-md font-bold text-white mb-1.5 font-outfit">CSV Bulk Data Import</h3>
              <p className="text-[10px] text-slate-400 mb-4">
                Map columns from your spreadsheet to the database schema fields.
              </p>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* File picker */}
                {!csvFile ? (
                  <div className="border border-dashed border-slate-800 hover:border-violet-500/50 bg-slate-950/20 p-8 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition">
                    <Upload className="w-8 h-8 text-slate-600 mb-2" />
                    <span className="text-xs text-slate-300 font-semibold mb-1">Select CSV file to scan</span>
                    <span className="text-[10px] text-slate-500">Only .csv spreadsheets are supported</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCsvFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                      <span className="font-semibold text-slate-200 truncate">{csvFile.name}</span>
                      <button
                        onClick={() => {
                          setCsvFile(null);
                          setImportSummary(null);
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300 font-semibold underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    {/* Mapping UI */}
                    {!importSummary && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-300">Map Schema Fields</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {currentEntity.fields.map((f: any) => (
                            <div key={f.name} className="flex items-center justify-between gap-4 p-2 bg-slate-950/30 border border-slate-900 rounded-lg">
                              <span className="text-xs text-slate-300 font-semibold">
                                {f.label} {f.required && <span className="text-red-500">*</span>}
                              </span>
                              <select
                                value={csvMapping[f.name] || ""}
                                onChange={(e) => setCsvMapping({ ...csvMapping, [f.name]: e.target.value })}
                                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 max-w-[180px] outline-none"
                              >
                                <option value="">Do not import</option>
                                {csvHeaders.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Import Summary */}
                    {importSummary && (
                      <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-400" /> Import Summary
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold py-2">
                          <div className="p-3 bg-slate-950/40 rounded-lg">
                            <span className="text-slate-500">Successfully Imported</span>
                            <p className="text-lg text-emerald-400 font-bold mt-1">{importSummary.imported} rows</p>
                          </div>
                          <div className="p-3 bg-slate-950/40 rounded-lg">
                            <span className="text-slate-500">Failed / Rejected</span>
                            <p className="text-lg text-red-400 font-bold mt-1">{importSummary.failed} rows</p>
                          </div>
                        </div>

                        {importSummary.errors.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-red-400 font-bold uppercase">Error Log:</span>
                            <div className="max-h-28 overflow-y-auto bg-[#040406] p-2.5 rounded-lg border border-slate-900 text-[10px] font-mono space-y-1">
                              {importSummary.errors.map((e: any, idx: number) => (
                                <div key={idx} className="text-slate-400 leading-relaxed border-b border-white/5 pb-1 mb-1 last:border-0">
                                  <span className="text-red-400 font-semibold">Row {e.rowIndex}:</span>
                                  {Object.entries(e.errors).map(([f, err]) => (
                                    <div key={f} className="pl-2.5">— {String(err)}</div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-white/5 mt-4">
                <button
                  onClick={() => {
                    setShowCsvModal(false);
                    setCsvFile(null);
                    setImportSummary(null);
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  Close
                </button>
                {csvFile && !importSummary && (
                  <button
                    onClick={handleImportCsvSubmit}
                    disabled={importingCsv}
                    className="px-4 py-1.5 btn-gradient rounded-lg text-white font-bold text-xs cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {importingCsv ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        Import Spreadsheet <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
