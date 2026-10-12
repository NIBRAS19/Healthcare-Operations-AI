// AI is behind this adapter so providers are replaceable. Rules enforced here and nowhere else:
//  - documents are untrusted input, never instructions
//  - never fabricate a value; a field without source evidence is "Not detected"
//  - no diagnosis, treatment or coverage decisions
import { config } from "../config.js";

export async function extractFields({ requiredFields }) {
  if (!config.aiEnabled || config.aiProvider === "none") {
    // Manual-fallback mode: everything stays "Not detected" until a person enters it.
    return { provider: "none", type: "Unclassified", language: "Unknown", fields: requiredFields.map((label) => ({ label, value: "", conf: "Not detected", page: null, snippet: "" })) };
  }
  // Implement your OCR/LLM provider here. Return { provider, type, language, fields:[{label,value,conf,page,snippet}] }.
  // Validate output: drop any field whose snippet can't be found in the OCR text.
  throw new Error(`AI provider "${config.aiProvider}" is not implemented`);
}

// Deterministic administrative summary built only from evidence-backed fields (no free-text generation).
export function buildSummary({ caseRef, workflow, facts, missing }) {
  const found = facts.length ? facts.map((f) => `${f.label}: ${f.value}`).join("; ") : "No evidence-backed facts were found";
  const text = `${workflow} for ${caseRef}. Found in supplied documents: ${found}.` + (missing.length ? ` Not detected in the supplied documents: ${missing.join(", ")}.` : "");
  return { text, generator: config.aiEnabled ? `${config.aiProvider}` : "rule-based-v1" };
}
