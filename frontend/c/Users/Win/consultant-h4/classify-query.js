"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/assistant/classify-query.ts
var classify_query_exports = {};
__export(classify_query_exports, {
  classifyQuery: () => classifyQuery
});
module.exports = __toCommonJS(classify_query_exports);
var RULES = [
  {
    kind: "growth_strategy",
    phrases: [
      "grow my business",
      "grow my revenue",
      "grow",
      "business growth",
      "how do i grow",
      "scaling strategy",
      "growth strategy",
      "growth plan",
      "revenue growth",
      "increase revenue"
    ]
  },
  {
    kind: "digital_transformation",
    phrases: [
      "digitise",
      "digitize",
      "digital transformation",
      "go online",
      "online presence",
      "digital strategy",
      "modernise",
      "modernize",
      "adopt technology",
      "automate"
    ]
  },
  {
    kind: "finance",
    phrases: [
      "raise capital",
      "raise funding",
      "capital",
      "finance",
      "financial plan",
      "working capital",
      "cash flow",
      "cashflow",
      "funding",
      "loan options",
      "money"
    ]
  },
  {
    kind: "gst",
    phrases: [
      "gst",
      "goods and services tax",
      "tax registration",
      "gst registration",
      "gst return",
      "gstr",
      "input tax credit",
      "itc"
    ]
  },
  {
    kind: "government_schemes",
    phrases: [
      "government scheme",
      "govt scheme",
      "pmegp",
      "cgtmse",
      "mudra",
      "udyam",
      "subsidy",
      "msme scheme",
      "scheme",
      "startup india"
    ]
  },
  {
    kind: "marketing",
    phrases: [
      "marketing",
      "customer acquisition",
      "lead generation",
      "branding",
      "social media",
      "seo",
      "sem",
      "advertising",
      "campaign"
    ]
  },
  {
    kind: "operations",
    phrases: [
      "operations",
      "inventory",
      "supply chain",
      "ops",
      "processes",
      "sop",
      "logistics",
      "warehouse"
    ]
  },
  {
    kind: "hiring",
    phrases: [
      "hiring",
      "first hire",
      "new hire",
      "recruit",
      "talent",
      "candidate",
      "interview",
      "salary",
      "compensation",
      "team",
      "employee"
    ]
  },
  {
    kind: "compliance",
    phrases: [
      "compliance",
      "regulatory",
      "roc filing",
      "annual return",
      "legal",
      "licence",
      "license",
      "kyc",
      "aml",
      "msme registration"
    ]
  },
  {
    kind: "risk",
    phrases: [
      "risk",
      "risks",
      "threats",
      "risk register",
      "risk management",
      "insurance",
      "fire insurance",
      "cybersecurity risk",
      "operational risk"
    ]
  },
  {
    kind: "scaling",
    phrases: [
      "scale",
      "scaling",
      "expand",
      "expansion",
      "new geography",
      "new market",
      "international",
      "global expansion"
    ]
  },
  {
    kind: "decision_hire",
    phrases: [
      "should i hire",
      "hire someone",
      "first hire",
      "do i need to hire",
      "is it time to hire"
    ]
  },
  {
    kind: "decision_expand",
    phrases: [
      "should i expand",
      "expand my business",
      "open new branch",
      "new geography",
      "should i go global",
      "should i scale"
    ]
  },
  {
    kind: "decision_loan",
    phrases: [
      "should i apply for a loan",
      "should i take a loan",
      "apply for loan",
      "take a loan",
      "borrow money",
      "should i borrow"
    ]
  },
  {
    kind: "action_plan",
    phrases: [
      "action plan",
      "weekly plan",
      "monthly plan",
      "step by step",
      "step-by-step plan",
      "how do i implement",
      "implementation plan"
    ]
  },
  {
    kind: "improve_business",
    phrases: [
      "improve my business",
      "how can i improve",
      "what should i work on",
      "what can i do better",
      "how to improve",
      "improvement"
    ]
  },
  {
    kind: "low_score",
    phrases: [
      "why is my score low",
      "low score",
      "score is low",
      "why low",
      "raise my score",
      "boost my score",
      "increase my score",
      "score is down"
    ]
  },
  {
    kind: "what_first",
    phrases: [
      "what should i do first",
      "where do i start",
      "what to do first",
      "first step",
      "first action",
      "starting point",
      "first thing",
      "next step"
    ]
  },
  {
    kind: "export_opportunities",
    phrases: [
      "export opportunity",
      "export opportunities",
      "export readiness",
      "international",
      "going global",
      "overseas",
      "export market",
      "export"
    ]
  },
  {
    kind: "business_dna",
    phrases: [
      "business dna",
      "my dna",
      "dna match",
      "archetype",
      "what kind of business am i",
      "explain my business",
      "what is my business"
    ]
  },
  {
    kind: "explain_roadmap",
    phrases: [
      "explain roadmap",
      "explain the roadmap",
      "what is the roadmap",
      "tell me about the roadmap",
      "roadmap plan",
      "explain your plan"
    ]
  },
  {
    kind: "explain_recommendations",
    phrases: [
      "explain recommendations",
      "explain the recommendations",
      "what are the recommendations",
      "recommendations explain",
      "tell me about the recommendations"
    ]
  },
  {
    kind: "explain_insights",
    phrases: [
      "explain insights",
      "explain the insights",
      "what are the insights",
      "insights explain",
      "tell me about the insights"
    ]
  },
  {
    kind: "explain_rules",
    phrases: [
      "explain rules",
      "explain the rules",
      "what are the rules",
      "rule firings",
      "active rules",
      "tell me about the rules"
    ]
  },
  {
    kind: "general_overview",
    phrases: [
      "overview",
      "summary",
      "status",
      "give me the big picture",
      "how is my business doing",
      "how is everything",
      "status update"
    ]
  }
];
function classifyQuery(prompt) {
  const text = prompt.trim().toLowerCase();
  if (text.length === 0) return "fallback";
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (text.includes(phrase)) {
        return rule.kind;
      }
    }
  }
  return "fallback";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  classifyQuery
});
