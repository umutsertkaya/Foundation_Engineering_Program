import { topic as anchorsBase } from "./anchors";
import { student as anchorsStudent } from "./anchors_student";
import { topic as bearingBase } from "./bearing";
import { student as bearingStudent } from "./bearing_student";
import { topic as classificationBase } from "./classification";
import { student as classificationStudent } from "./classification_student";
import { topic as earthPressureBase } from "./earth_pressure";
import { partA as epA } from "./ep_student_a";
import { partB as epB } from "./ep_student_b";
import { topic as liquefactionBase } from "./liquefaction";
import { student as liquefactionStudent } from "./liquefaction_student";
import { topic as sheetPileBase } from "./sheet_pile";
import { student as sheetPileStudent } from "./sheet_pile_student";
import { topic as slopeBase } from "./slope";
import { student as slopeStudent } from "./slope_student";
import { topic as groundAnchorsBase } from "./ground_anchors";
import { student as groundAnchorsStudent } from "./ground_anchors_student";
import { topic as anchoredWallBase } from "./anchored_wall";
import { student as anchoredWallStudent } from "./anchored_wall_student";
import { topic as shearKeyBase } from "./shear_key";
import { student as shearKeyStudent } from "./shear_key_student";
import { topic as slopingSurchargeBase } from "./sloping_surcharge";
import { student as slopingSurchargeStudent } from "./sloping_surcharge_student";
import type { L, Topic } from "./types";

const earthPressure: Topic = { ...earthPressureBase, student: [...epA, ...epB] };

const bearing: Topic = { ...bearingBase, student: bearingStudent };

const liquefaction: Topic = { ...liquefactionBase, student: liquefactionStudent };

const classification: Topic = { ...classificationBase, student: classificationStudent };
const slope: Topic = { ...slopeBase, student: slopeStudent };
const slopingSurcharge: Topic = { ...slopingSurchargeBase, student: slopingSurchargeStudent };
const sheetPile: Topic = { ...sheetPileBase, student: sheetPileStudent };
const anchors: Topic = { ...anchorsBase, student: anchorsStudent };
const shearKey: Topic = { ...shearKeyBase, student: shearKeyStudent };
const groundAnchors: Topic = { ...groundAnchorsBase, student: groundAnchorsStudent };
const anchoredWall: Topic = { ...anchoredWallBase, student: anchoredWallStudent };

export const TOPICS: Topic[] = [classification, earthPressure, bearing, liquefaction, sheetPile, anchors, groundAnchors, anchoredWall, shearKey, slopingSurcharge, slope];

export const loc = (l: L, lang: string): string => (lang.startsWith("en") && l.en ? l.en : l.tr);
