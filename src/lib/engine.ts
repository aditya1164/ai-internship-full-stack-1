import { prisma } from "./prisma";

export interface FieldSchema {
  name: string;
  label: string;
  type: "text" | "email" | "number" | "boolean" | "select" | "date" | "relation";
  required?: boolean;
  unique?: boolean;
  options?: string[]; // For select type
  relatedEntity?: string; // For relation type
  relatedField?: string;  // For relation type (e.g. unique field like email or id)
  min?: number;
  max?: number;
  default?: any;
}

export interface EntitySchema {
  name: string;
  label: string;
  fields: FieldSchema[];
}

export interface WorkflowAction {
  type: "calculate" | "notify";
  targetField?: string;
  formula?: string; // e.g. "baseAmount + tax"
  message?: string; // e.g. "Order {{orderNumber}} created!"
}

export interface WorkflowSchema {
  trigger: "onCreate" | "onUpdate";
  entity: string;
  actions: WorkflowAction[];
}

export interface AppConfig {
  name: string;
  description?: string;
  entities: EntitySchema[];
  workflows?: WorkflowSchema[];
}

// Evaluate simple algebraic math formulas safely
export function evaluateFormula(formula: string, record: Record<string, any>): number {
  let evaluated = formula;
  const variables = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  
  for (const variable of variables) {
    const val = record[variable] !== undefined ? Number(record[variable]) || 0 : 0;
    evaluated = evaluated.replace(new RegExp(`\\b${variable}\\b`, "g"), val.toString());
  }

  try {
    // Sanitize string: only allow digits, arithmetic operators, decimals, parentheses, and spaces
    if (!/^[0-9+\-*/().\s]+$/.test(evaluated)) {
      console.warn("Unsafe characters detected in formula evaluation:", evaluated);
      return 0;
    }
    // Safe evaluation using Function
    const result = new Function(`"use strict"; return (${evaluated})`)();
    return Number(result) || 0;
  } catch (error) {
    console.error("Failed to evaluate formula:", formula, evaluated, error);
    return 0;
  }
}

// String interpolation helper (replace {{variable}} with record value)
export function interpolateString(template: string, record: Record<string, any>): string {
  return template.replace(/\{\{([^{}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    return record[trimmedKey] !== undefined ? String(record[trimmedKey]) : "";
  });
}

// Validate fields, types, constraints, and relationships
export async function validateRecord(
  applicationId: string,
  entityName: string,
  data: Record<string, any>,
  appConfig: AppConfig,
  currentRecordId?: string
): Promise<{ isValid: boolean; errors: Record<string, string>; normalizedData: Record<string, any> }> {
  const errors: Record<string, string> = {};
  const normalizedData: Record<string, any> = {};

  const entity = appConfig.entities.find((e) => e.name === entityName);
  if (!entity) {
    return { isValid: false, errors: { _entity: `Entity '${entityName}' does not exist in app config.` }, normalizedData };
  }

  for (const field of entity.fields) {
    let rawVal = data[field.name];

    // Handle default values if missing
    if ((rawVal === undefined || rawVal === null || rawVal === "") && field.default !== undefined) {
      rawVal = field.default;
    }

    // Default missing bonus/stock (number fields in general) to 0 if expected in comp or specified
    if ((rawVal === undefined || rawVal === null || rawVal === "") && field.type === "number") {
      rawVal = 0;
    }

    // Validate required fields
    if (field.required && (rawVal === undefined || rawVal === null || rawVal === "")) {
      errors[field.name] = `${field.label} is required.`;
      continue;
    }

    // Skip empty non-required fields
    if (rawVal === undefined || rawVal === null || rawVal === "") {
      normalizedData[field.name] = null;
      continue;
    }

    // Type validation
    if (field.type === "number") {
      const numVal = Number(rawVal);
      if (isNaN(numVal)) {
        errors[field.name] = `${field.label} must be a valid number.`;
      } else {
        if (field.min !== undefined && numVal < field.min) {
          errors[field.name] = `${field.label} must be at least ${field.min}.`;
        } else if (field.max !== undefined && numVal > field.max) {
          errors[field.name] = `${field.label} cannot exceed ${field.max}.`;
        } else {
          normalizedData[field.name] = numVal;
        }
      }
    } else if (field.type === "boolean") {
      if (typeof rawVal === "boolean") {
        normalizedData[field.name] = rawVal;
      } else if (String(rawVal).toLowerCase() === "true" || rawVal === 1) {
        normalizedData[field.name] = true;
      } else if (String(rawVal).toLowerCase() === "false" || rawVal === 0) {
        normalizedData[field.name] = false;
      } else {
        errors[field.name] = `${field.label} must be a boolean.`;
      }
    } else if (field.type === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(rawVal))) {
        errors[field.name] = `${field.label} is not a valid email address.`;
      } else {
        normalizedData[field.name] = String(rawVal).toLowerCase().trim();
      }
    } else if (field.type === "select") {
      const options = field.options || [];
      if (!options.includes(String(rawVal))) {
        errors[field.name] = `${field.label} must be one of: ${options.join(", ")}`;
      } else {
        normalizedData[field.name] = String(rawVal);
      }
    } else if (field.type === "date") {
      const dateVal = new Date(rawVal);
      if (isNaN(dateVal.getTime())) {
        errors[field.name] = `${field.label} must be a valid date.`;
      } else {
        normalizedData[field.name] = dateVal.toISOString().split("T")[0]; // YYYY-MM-DD
      }
    } else if (field.type === "relation") {
      // Validate relationship: make sure referenced record exists
      const relatedEntity = field.relatedEntity;
      const relatedField = field.relatedField || "id";

      if (!relatedEntity) {
        errors[field.name] = `Relation config error: Target entity is undefined.`;
        continue;
      }

      // Fetch all records for the referenced entity in this application
      const matchingRecords = await prisma.record.findMany({
        where: { applicationId, entityName: relatedEntity },
      });

      const exists = matchingRecords.some((r) => {
        let parsedData;
        try {
          parsedData = JSON.parse(r.data);
        } catch {
          parsedData = {};
        }
        // Match standard ID or custom unique field e.g. email
        if (relatedField === "id") {
          return r.id === rawVal;
        }
        return String(parsedData[relatedField]).toLowerCase() === String(rawVal).toLowerCase();
      });

      if (!exists) {
        errors[field.name] = `Linked ${relatedEntity} (matching ${relatedField}='${rawVal}') does not exist.`;
      } else {
        normalizedData[field.name] = rawVal;
      }
    } else {
      // Standard text type
      normalizedData[field.name] = String(rawVal).trim();
    }

    // Unique validation
    if (field.unique && normalizedData[field.name] !== null && normalizedData[field.name] !== undefined) {
      // Find other records of same entity with same value
      const allRecords = await prisma.record.findMany({
        where: {
          applicationId,
          entityName,
          NOT: currentRecordId ? { id: currentRecordId } : undefined,
        },
      });

      const duplicate = allRecords.some((r) => {
        try {
          const parsed = JSON.parse(r.data);
          return String(parsed[field.name]).toLowerCase() === String(normalizedData[field.name]).toLowerCase();
        } catch {
          return false;
        }
      });

      if (duplicate) {
        errors[field.name] = `A record with this ${field.label} already exists. Must be unique.`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedData,
  };
}

// Execute triggers & workflows
export async function runWorkflows(
  applicationId: string,
  entityName: string,
  trigger: "onCreate" | "onUpdate",
  recordData: Record<string, any>,
  userId: string,
  appConfig: AppConfig
): Promise<Record<string, any>> {
  const updatedData = { ...recordData };
  const workflows = appConfig.workflows || [];
  
  const activeWorkflows = workflows.filter(
    (w) => w.entity === entityName && w.trigger === trigger
  );

  for (const wf of activeWorkflows) {
    for (const action of wf.actions) {
      if (action.type === "calculate" && action.targetField && action.formula) {
        // Run algebraic calculations
        const result = evaluateFormula(action.formula, updatedData);
        updatedData[action.targetField] = result;
      } else if (action.type === "notify" && action.message) {
        // Log in-app notification for the user
        const message = interpolateString(action.message, updatedData);
        await prisma.notification.create({
          data: {
            userId,
            title: `App Trigger: ${appConfig.name}`,
            message,
          },
        });
      }
    }
  }

  return updatedData;
}
