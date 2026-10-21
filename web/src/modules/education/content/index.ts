import { topic as anchors } from "./anchors";
import { topic as bearingBase } from "./bearing";
import { student as bearingStudent } from "./bearing_student";
import { topic as classification } from "./classification";
import { topic as earthPressureBase } from "./earth_pressure";
import { partA as epA } from "./ep_student_a";
import { partB as epB } from "./ep_student_b";
import { topic as liquefactionBase } from "./liquefaction";
import { student as liquefactionStudent } from "./liquefaction_student";
import { topic as sheetPile } from "./sheet_pile";
import { topic as slope } from "./slope";
import { topic as groundAnchors } from "./ground_anchors";
import { topic as anchoredWall } from "./anchored_wall";
import { topic as shearKey } from "./shear_key";
import { topic as slopingSurcharge } from "./sloping_surcharge";
import type { L, Topic } from "./types";

const earthPressure: Topic = { ...earthPressureBase, student: [...epA, ...epB] };

const bearing: Topic = { ...bearingBase, student: bearingStudent };

const liquefaction: Topic = { ...liquefactionBase, student: liquefactionStudent };

export const TOPICS: Topic[] = [classification, earthPressure, bearing, liquefaction, sheetPile, anchors, groundAnchors, anchoredWall, shearKey, slopingSurcharge, slope];

export const loc = (l: L, lang: string): string => (lang.startsWith("en") && l.en ? l.en : l.tr);
