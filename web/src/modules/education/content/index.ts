import { topic as anchors } from "./anchors";
import { topic as bearing } from "./bearing";
import { topic as classification } from "./classification";
import { topic as earthPressure } from "./earth_pressure";
import { topic as liquefaction } from "./liquefaction";
import { topic as sheetPile } from "./sheet_pile";
import { topic as slope } from "./slope";
import type { L, Topic } from "./types";

export const TOPICS: Topic[] = [classification, earthPressure, bearing, liquefaction, sheetPile, anchors, slope];

export const loc = (l: L, lang: string): string => (lang.startsWith("en") && l.en ? l.en : l.tr);
