/**
 * Field presets: one click fills in sensible search keywords (and title
 * exclusions) for a whole profession, so someone who isn't technical — a nurse,
 * a teacher, an accountant — gets relevant results without knowing what to type.
 * Pure data, safe to import from the client form.
 */
export interface FieldPreset {
  id: string;
  label: string;
  keywords: string[];
  /** Titles to drop even when a keyword matches (seniority/noise). */
  exclude?: string[];
}

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: "legal",
    label: "Legal",
    keywords: ["paralegal", "legal assistant", "legal counsel", "solicitor", "compliance", "legal", "contracts"],
    exclude: ["partner", "head of legal"],
  },
  {
    id: "software",
    label: "Software / Engineering",
    keywords: ["software engineer", "developer", "full stack", "backend", "frontend", "embedded", "devops"],
  },
  {
    id: "data",
    label: "Data & Analytics",
    keywords: ["data analyst", "data scientist", "data engineer", "analytics", "business intelligence", "machine learning"],
  },
  {
    id: "healthcare",
    label: "Healthcare & Nursing",
    keywords: ["nurse", "registered nurse", "healthcare assistant", "care worker", "clinical", "midwife", "paramedic"],
  },
  {
    id: "finance",
    label: "Finance & Accounting",
    keywords: ["accountant", "finance", "financial analyst", "bookkeeper", "audit", "accounts payable", "tax"],
  },
  {
    id: "marketing",
    label: "Marketing & Comms",
    keywords: ["marketing", "content", "social media", "seo", "brand", "communications", "copywriter"],
  },
  {
    id: "sales",
    label: "Sales & Business Dev",
    keywords: ["sales", "account executive", "business development", "account manager", "sales representative"],
  },
  {
    id: "support",
    label: "Customer Support",
    keywords: ["customer support", "customer service", "customer success", "help desk", "support specialist"],
  },
  {
    id: "hr",
    label: "Human Resources",
    keywords: ["human resources", "hr", "recruiter", "talent acquisition", "people operations", "hr advisor"],
  },
  {
    id: "education",
    label: "Teaching & Education",
    keywords: ["teacher", "teaching assistant", "tutor", "lecturer", "education", "learning support"],
  },
  {
    id: "admin",
    label: "Admin & Office",
    keywords: ["administrator", "administrative assistant", "office manager", "receptionist", "executive assistant", "coordinator"],
  },
  {
    id: "design",
    label: "Design (UX / Graphic)",
    keywords: ["ux designer", "ui designer", "product designer", "graphic designer", "designer", "design"],
  },
  {
    id: "product",
    label: "Product Management",
    keywords: ["product manager", "product owner", "product management", "associate product manager"],
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    keywords: ["operations", "logistics", "supply chain", "operations manager", "warehouse", "procurement"],
  },
  {
    id: "hospitality",
    label: "Retail & Hospitality",
    keywords: ["retail", "store manager", "hospitality", "barista", "waiter", "chef", "customer assistant"],
  },
  {
    id: "engineering",
    label: "Engineering (non-software)",
    keywords: ["mechanical engineer", "electrical engineer", "civil engineer", "process engineer", "manufacturing engineer"],
  },
  {
    id: "science",
    label: "Science & Research",
    keywords: ["research scientist", "research assistant", "laboratory", "biologist", "chemist", "researcher"],
  },
  {
    id: "project",
    label: "Project & Programme",
    keywords: ["project manager", "programme manager", "project coordinator", "scrum master", "delivery manager"],
  },
];

export function findPreset(id: string): FieldPreset | undefined {
  return FIELD_PRESETS.find((p) => p.id === id);
}
