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

// features/assistant/format-numbers.ts
var format_numbers_exports = {};
__export(format_numbers_exports, {
  formatRoi: () => formatRoi,
  formatScoreGain: () => formatScoreGain
});
module.exports = __toCommonJS(format_numbers_exports);
function formatScoreGain(value) {
  if (value === null || value === void 0 || Number.isNaN(value)) {
    return "\u2014";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${Math.round(value)} pts`;
}
function formatRoi(value) {
  if (value === null || value === void 0 || Number.isNaN(value)) {
    return "\u2014";
  }
  const abs = Math.abs(value);
  let scaled = value;
  let suffix = "";
  if (abs >= 1e7) {
    scaled = value / 1e7;
    suffix = " Cr";
  } else if (abs >= 1e5) {
    scaled = value / 1e5;
    suffix = " L";
  } else if (abs >= 1e3) {
    scaled = value / 1e3;
    suffix = "k";
  }
  const fixed = abs >= 100 ? scaled.toFixed(0) : scaled.toFixed(1);
  return `\u20B9${fixed}${suffix}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  formatRoi,
  formatScoreGain
});
