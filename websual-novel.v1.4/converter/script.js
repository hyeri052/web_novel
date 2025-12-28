// ===========================
// storydata 변환기 script.js (AFTER JSON + Ending SceneId 자동 보정 버전)
// ===========================

// ----- 헤더 매핑 -----
const headerMap = {
  game_info: {
    "제목(title)": "title",
    "부제(subtitle)": "subtitle",
    "주인공(me)": "me",
    "배경음악(backgroundMusic)": "backgroundMusic",
  },
  characters: {
    "캐릭터ID(id)": "id",
    "이름(name)": "name",
    "색상(color)": "color",
    "초기호감도(initialAffection)": "initialAffection",
    "최저호감도(minAffection)": "minAffection",
    "최고호감도(maxAffection)": "maxAffection",
    "이미지폴더(imageFolder)": "imageFolder",
  },
  places: {
    "장소ID(id)": "id",
    "장소이름(name)": "name",
    "배경이미지(image)": "image",
    "배경색상(color)": "color",
  },
  scenes: {
    "씬ID(id)": "id",
    "씬종류(type)": "type",
    "장소ID(place)": "place",
    "다음씬ID(nextSceneId)": "nextSceneId",
    "컷씬이미지(cutsceneImage)": "cutsceneImage",
    "엔딩호감도체크(checkAffection)": "checkAffection",
    "배경음악(backgroundMusic)": "backgroundMusic",
  },
  dialogues: {
    "씬ID(sceneId)": "sceneId",
    "대사순서(order)": "order",
    "강조캐릭터(activeCharacters)": "activeCharacters",
    "말하는캐릭터(speaker)": "speaker",
    "대사텍스트(text)": "text",
  },
  choices: {
    "씬ID(sceneId)": "sceneId",
    "선택지번호(choiceIndex)": "choiceIndex",
    "선택지텍스트(text)": "text",
    "반응강조캐릭터(reactionActiveCharacters)": "reactionActiveCharacters",
    "반응하는캐릭터(reactionSpeaker)": "reactionSpeaker",
    "반응텍스트(reactionText)": "reactionText",
    "표시캐릭터1(reactionChar_left)": "reactionChar_left",
    "표시캐릭터1표정(reactionEmotion_left)": "reactionEmotion_left",
    "표시캐릭터2(reactionChar_center)": "reactionChar_center",
    "표시캐릭터2표정(reactionEmotion_center)": "reactionEmotion_center",
    "표시캐릭터3(reactionChar_right)": "reactionChar_right",
    "표시캐릭터3표정(reactionEmotion_right)": "reactionEmotion_right",
    "다음씬ID(nextSceneId)": "nextSceneId",
  },
  scene_characters: {
    "씬ID(sceneId)": "sceneId",
    "씬대사번호(lineOrder)": "lineOrder",
    "캐릭터1(character_left)": "character_left",
    "캐릭터1표정(emotion_left)": "emotion_left",
    "캐릭터2(character_center)": "character_center",
    "캐릭터2표정(emotion_center)": "emotion_center",
    "캐릭터3(character_right)": "character_right",
    "캐릭터3표정(emotion_right)": "emotion_right",
    "컷씬(cutscene)": "cutscene",
  },
  ending: {
    // ✅ ending 시트에서 sceneId만 넣어도 보정/리네이밍 가능하도록 추가
    "씬ID(sceneId)": "sceneId",
    "캐릭터ID(characterId)": "characterId",
    "엔딩타입(endingType)": "endingType",
    "엔딩제목(title)": "title",
    "엔딩설명(message)": "message",
    "컷씬이미지(cutsceneImage)": "cutsceneImage",
  },
  ending_system: {
    "엔딩등급(rank)": "rank",
    "최소호감도(threshold)": "threshold",
  },
};

// ----- 시트 → JSON 공통 함수 -----
function sheetToJson(workbook, sheetName, map) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return raw.map((row, idx) => {
    const obj = { _rowNumber: idx + 2 };
    for (const k in row) {
      const internalKey = map?.[k] || k;
      obj[internalKey] = row[k];
    }
    return obj;
  });
}

// ===========================
// ✅ 엔딩 입력 정상화(endingType/characterId를 sceneId에서도 추론)
// ===========================
function normalizeEndingMeta(row) {
  let type = (row.endingType || "").toString().trim().toLowerCase();
  let charIdRaw = (row.characterId || "").toString().trim();
  const sceneIdRaw = (row.sceneId || "").toString().trim();

  // 1) type + characterId가 정상적으로 있으면 그대로
  if (type && (charIdRaw || type === "duo" || charIdRaw === "common")) {
    // ✅ "common"은 캐릭터ID가 아니라 공통 엔딩 표시값
    if (String(charIdRaw).trim().toLowerCase() === "common") {
      return { type, characters: [], isCommon: true, sceneIdRaw };
    }

    const chars = String(charIdRaw)
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    return { type, characters: chars, isCommon: false, sceneIdRaw };
  }

  // 2) 후보 문자열: sceneId → characterId
  const candidate = sceneIdRaw || charIdRaw;
  const s = (candidate || "").trim();
  if (!s) return { type: "", characters: [], isCommon: false, sceneIdRaw };

  // prefix 제거 (ending_, end_)
  const cleaned = s.replace(/^(ending|end)[-_]/i, "");

  // 토큰 분해
  const tokens = cleaned
    .split(/[_-\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const typeWords = ["bad", "normal", "good", "best", "duo"];

  // common
  if (tokens.includes("common")) {
    const t = type || tokens.find((x) => typeWords.includes(x)) || "";
    return { type: t, characters: [], isCommon: true, sceneIdRaw };
  }

  // type
  const typeCand = type || tokens.find((x) => typeWords.includes(x)) || "";

  // characters
  const charTokens = tokens.filter((t) => !typeWords.includes(t));
  let chars = [];
  if (charTokens.length) {
    chars = charTokens
      .join(",")
      .split(/[,+/&]/)
      .map((c) => c.trim())
      .filter(Boolean);
  }

  return { type: typeCand, characters: chars, isCommon: false, sceneIdRaw };
}

// ===========================
// ✅ 엔딩 sceneId를 엔진이 요구하는 "정규 id"로 생성
// 규칙:
// - 공통(또는 characters 비어있음): `${type}_ending`
// - 단일 캐릭터: `${type}_ending_${char}`
// - 듀오(2명 이상): `${type}_ending_${a}_${b}`
// ===========================
function makeEndingSceneId(type, characters) {
  const t = (type || "").toString().trim().toLowerCase();
  const chars = (characters || []).map((c) => String(c).trim()).filter(Boolean);

  if (!t) return "";

  if (chars.length === 0) return `${t}_ending`;
  if (chars.length === 1) return `${t}_ending_${chars[0]}`;

  // duo or multi
  return `${t}_ending_${chars.join("_")}`;
}

// ===========================
// ✅ ending 시트 기반으로, "기존 sceneId" → "정규 id" 치환 맵 생성
// - row.sceneId(사용자가 ending 페이지에 입력한 값)를 oldId로 보고
// - oldId가 없으면, 구버전 관례('ending' / '{char}_ending')를 fallback으로 매핑
// ===========================
function buildEndingSceneIdRemap(endingRows) {
  const remap = {}; // oldId -> newId

  (endingRows || []).forEach((row) => {
    const meta = normalizeEndingMeta(row);
    if (!meta.type) return;

    const newId = makeEndingSceneId(meta.type, meta.characters);
    if (!newId) return;

    const oldId = (row.sceneId || "").toString().trim();

    // 1) 사용자가 ending 시트에 sceneId를 넣었다면, 그 값을 우선 oldId로 사용
    if (oldId) remap[oldId] = newId;

    // 2) fallback: 공통이면 'ending'도 같이 매핑(원하는 예: ending -> normal_ending)
    if (meta.characters.length === 0) {
      remap["ending"] = newId;
    }

    // 3) fallback: 단일 캐릭터면 '{char}_ending'도 같이 매핑(원하는 예: aa_ending -> best_ending_aa)
    if (meta.characters.length === 1) {
      const legacy = `${meta.characters[0]}_ending`;
      remap[legacy] = newId;
    }
  });

  return remap;
}

// ===========================
// ✅ 모든 참조에 sceneId remap 적용
// - scenes.id
// - scenes.nextSceneId
// - dialogues.sceneId
// - choices.sceneId
// - choices.nextSceneId (다음씬ID)
// - scene_characters.sceneId
// ===========================
function applySceneIdRemapToSheets(
  { scenesRows, dialoguesRows, choicesRows, sceneCharRows },
  remap
) {
  const mapId = (id) => {
    const key = (id || "").toString().trim();
    return remap[key] || id;
  };

  // scenes
  scenesRows.forEach((s) => {
    s.id = mapId(s.id);
    s.nextSceneId = mapId(s.nextSceneId);
  });

  // dialogues
  dialoguesRows.forEach((d) => {
    d.sceneId = mapId(d.sceneId);
  });

  // choices
  choicesRows.forEach((c) => {
    c.sceneId = mapId(c.sceneId);
    c.nextSceneId = mapId(c.nextSceneId);
  });

  // scene_characters
  sceneCharRows.forEach((r) => {
    r.sceneId = mapId(r.sceneId);
  });
}

// ----- 캐릭터 변환 -----
function buildCharacters(rows) {
  const result = {};

  rows.forEach((r) => {
    if (!r.id) return;

    const emotions = {};

    const defaultKey = "기본표정이미지(defaultImage)";
    if (r[defaultKey]) emotions.default = r[defaultKey];

    for (let i = 1; i <= 10; i++) {
      const name = r[`emotion${i}`];
      const img = r[`emotionImage${i}`];
      if (name && img) emotions[name.trim()] = img.trim();
    }

    if (!("default" in emotions)) emotions.default = "";

    result[r.id] = {
      id: r.id,
      name: r.name,
      color: r.color || "#ffffff",
      initialAffection: Number(r.initialAffection || 0),
      minAffection: Number(r.minAffection ?? -999),
      maxAffection: Number(r.maxAffection ?? 999),
      imageFolder: r.imageFolder || "",
      emotions,
    };
  });

  return result;
}

// ----- 장소 변환 -----
function buildPlaces(rows) {
  const result = {};
  rows.forEach((r) => {
    if (!r.id) return;
    result[r.id] = {
      id: r.id,
      name: r.name,
      image: r.image || "",
      color: r.color || "",
    };
  });
  return result;
}

// ----- lineOrder 해석 -----
function expandLineOrder(value) {
  if (value === null || value === undefined) return [];
  const str = String(value).trim();
  if (!str) return [];

  const rangeMatch = str.match(/^(\d+)\s*[-~]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (Number.isNaN(start) || Number.isNaN(end)) return [];
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const res = [];
    for (let i = s; i <= e; i++) res.push(i);
    return res;
  }

  if (/^\d+$/.test(str)) {
    const n = Number(str);
    if (Number.isNaN(n)) return [];
    return [n];
  }

  return [];
}

// ----- 씬/대사/선택지/캐릭터/컷씬 구성 -----
function buildScenes(sceneRows, dialogueRows, choiceRows, sceneCharRows) {
  const sceneMap = {};
  let lastPlace = "";

  const sceneOrder = [];
  sceneRows.forEach((s) => {
    if (!s.id) return;

    let place = s.place || "";
    if (!place) place = lastPlace;
    else lastPlace = place;

    sceneMap[s.id] = {
      id: s.id,
      type: s.type || "normal",
      place,
      nextSceneId: s.nextSceneId || "",
      cutsceneImage: s.cutsceneImage || "",
      checkAffection:
        s.checkAffection === true ||
        String(s.checkAffection).trim().toLowerCase() === "true",
      backgroundMusic: s.backgroundMusic || "",
    };

    sceneOrder.push(s.id);
  });

  const defaultNextMap = {};
  for (let i = 0; i < sceneOrder.length - 1; i++) {
    defaultNextMap[sceneOrder[i]] = sceneOrder[i + 1];
  }

  const dialoguesByScene = {};
  dialogueRows.forEach((d) => {
    if (!d.sceneId) return;
    if (!dialoguesByScene[d.sceneId]) dialoguesByScene[d.sceneId] = [];
    dialoguesByScene[d.sceneId].push({
      order: Number(d.order || 0),
      speaker: d.speaker || "narrator",
      text: d.text || "",
      activeCharacters: d.activeCharacters || "",
    });
  });

  const choicesByScene = {};
  choiceRows.forEach((c) => {
    if (!c.sceneId) return;
    if (!choicesByScene[c.sceneId]) choicesByScene[c.sceneId] = [];

    const choiceObj = {
      text: c.text,
      next: c.nextSceneId || null,
      index: Number(c.choiceIndex || 0),
    };

    // affectionChanges
    const aff = {};
    for (let i = 1; i <= 10; i++) {
      const charKey = c[`affectioncharacter${i}`];
      const valKey = c[`affectionValue${i}`];
      const charId = charKey ? String(charKey).trim() : "";
      const val = Number(valKey);
      if (charId && !Number.isNaN(val)) aff[charId] = val;
    }
    if (Object.keys(aff).length > 0) choiceObj.affectionChanges = aff;

    // reaction
    const reactionSpeaker = (c.reactionSpeaker || "").toString().trim();
    const reactionText = (c.reactionText || "").toString();

    if (reactionSpeaker || reactionText) {
      const reaction = {
        speaker: reactionSpeaker || "narrator",
        text: reactionText,
      };

      const reactionChars = [];
      const defs = [
        { pos: "left", ck: "reactionChar_left", ek: "reactionEmotion_left" },
        {
          pos: "center",
          ck: "reactionChar_center",
          ek: "reactionEmotion_center",
        },
        { pos: "right", ck: "reactionChar_right", ek: "reactionEmotion_right" },
      ];

      defs.forEach(({ pos, ck, ek }) => {
        const cid = c[ck];
        if (cid) {
          reactionChars.push({
            id: String(cid).trim(),
            emotion: (c[ek] || "default").toString().trim(),
            position: pos,
          });
        }
      });

      const activeIds = new Set();
      if (
        reactionSpeaker &&
        !["narrator", "me", "player"].includes(reactionSpeaker)
      ) {
        activeIds.add(reactionSpeaker);
      }
      if (c.reactionActiveCharacters) {
        String(c.reactionActiveCharacters)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .forEach((id) => activeIds.add(id));
      }

      if (reactionChars.length > 0) {
        reaction.characters = reactionChars.map((ch) =>
          activeIds.has(ch.id) ? { ...ch, active: true } : ch
        );
      }

      choiceObj.reaction = reaction;
    }

    choicesByScene[c.sceneId].push(choiceObj);
  });

  Object.values(choicesByScene).forEach((arr) =>
    arr.sort((a, b) => a.index - b.index)
  );

  const baseCharsByScene = {};
  const lineCharsByScene = {};
  const cutsceneLinesByScene = {};

  sceneCharRows.forEach((row) => {
    const sceneId = row.sceneId;
    if (!sceneId) return;

    const chars = [];
    const defs = [
      { pos: "left", ck: "character_left", ek: "emotion_left" },
      { pos: "center", ck: "character_center", ek: "emotion_center" },
      { pos: "right", ck: "character_right", ek: "emotion_right" },
    ];

    defs.forEach((d) => {
      const cid = row[d.ck];
      if (cid) {
        chars.push({
          id: cid,
          emotion: row[d.ek] || "default",
          position: d.pos,
        });
      }
    });

    const cutVal = row.cutscene;
    const isCutscene =
      cutVal === 1 ||
      cutVal === "1" ||
      String(cutVal).trim().toLowerCase() === "true";

    const orders = expandLineOrder(row.lineOrder);

    if (!orders.length) {
      baseCharsByScene[sceneId] = chars;
      if (isCutscene) {
        if (!cutsceneLinesByScene[sceneId]) cutsceneLinesByScene[sceneId] = {};
        cutsceneLinesByScene[sceneId].__all = true;
      }
      return;
    }

    if (!lineCharsByScene[sceneId]) lineCharsByScene[sceneId] = {};
    if (!cutsceneLinesByScene[sceneId]) cutsceneLinesByScene[sceneId] = {};

    orders.forEach((ord) => {
      lineCharsByScene[sceneId][ord] = chars;
      if (isCutscene) cutsceneLinesByScene[sceneId][ord] = true;
    });
  });

  const storyScenes = [];

  Object.values(sceneMap).forEach((scene) => {
    const base = { id: scene.id, type: scene.type };

    if (scene.place) base.place = scene.place;
    if (scene.cutsceneImage) base.cutsceneImage = scene.cutsceneImage;
    if (scene.checkAffection) base.checkAffection = true;
    if (scene.backgroundMusic) base.backgroundMusic = scene.backgroundMusic;

    const ds = dialoguesByScene[scene.id] || [];
    const lineMap = lineCharsByScene[scene.id] || {};
    const cutMap = cutsceneLinesByScene[scene.id] || {};
    const sceneCutAll = !!cutMap.__all;

    const hasBaseChars = Object.prototype.hasOwnProperty.call(
      baseCharsByScene,
      scene.id
    );
    const baseChars = hasBaseChars ? baseCharsByScene[scene.id] : null;

    const builtDialogues = ds.map((d) => {
      const dlg = { speaker: d.speaker, text: d.text };

      const hasOverride = Object.prototype.hasOwnProperty.call(
        lineMap,
        d.order
      );
      const overrideChars = hasOverride ? lineMap[d.order] : undefined;

      if (hasOverride) dlg.characters = overrideChars || [];
      else if (baseChars && baseChars.length) dlg.characters = baseChars;

      if (sceneCutAll || cutMap[d.order]) dlg.cutscene = true;

      const activeIds = new Set();
      if (d.speaker && !["narrator", "me", "player"].includes(d.speaker)) {
        activeIds.add(String(d.speaker).trim());
      }
      if (d.activeCharacters) {
        String(d.activeCharacters)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .forEach((id) => activeIds.add(id));
      }

      if (dlg.characters && dlg.characters.length) {
        dlg.characters = dlg.characters.map((ch) =>
          activeIds.has(ch.id) ? { ...ch, active: true } : ch
        );
      }

      return dlg;
    });

    base.dialogues = builtDialogues;

    if (scene.type === "choice") {
      base.choices = choicesByScene[scene.id] || [];
    }

    const rawNext = scene.nextSceneId;
    const explicitNext = rawNext == null ? "" : String(rawNext).trim();
    if (explicitNext) base.next = explicitNext;
    else if (defaultNextMap[scene.id]) base.next = defaultNextMap[scene.id];

    storyScenes.push(base);
  });

  return storyScenes;
}

// ----- ending_system + ending → endingConfig 구성 -----
// ✅ (중요) meta.characters 재선언 버그 제거 버전
function buildEndingConfig(endingSystemRows, endingConfigRows) {
  const thresholds = {};
  (endingSystemRows || []).forEach((row) => {
    const rank = (row.rank || "").toString().trim();
    const t = Number(row.threshold);
    if (rank && !Number.isNaN(t)) thresholds[rank] = t;
  });

  const common = {};
  const duo = [];
  const characterEndings = {};

  (endingConfigRows || []).forEach((row) => {
    const meta = normalizeEndingMeta(row);
    const type = meta.type;
    const characters = meta.characters;
    const isCommon = meta.isCommon;

    if (!type) return;

    if (isCommon || characters.length === 0) {
      common[type] = {
        title: row.title || "",
        message: row.message || "",
      };
      return;
    }

    if (type === "duo" || characters.length > 1) {
      duo.push({
        characters,
        title: row.title || "",
        message: row.message || "",
      });
      return;
    }

    const charId = characters[0];
    if (!characterEndings[charId]) characterEndings[charId] = {};
    characterEndings[charId][type] = {
      title: row.title || "",
      message: row.message || "",
    };
  });

  return { thresholds, common, duo, characterEndings };
}

// ----- AFTER(JSON) 출력 문자열 생성 -----
function buildStoryDataJsonText(
  gameInfo,
  characters,
  places,
  storyScenes,
  endingConfig
) {
  const storyData = { gameInfo, characters, places, storyScenes, endingConfig };
  return JSON.stringify(storyData, null, 2);
}

// ----- 실행 + 다운로드 버튼 연결 -----
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const convertBtn = document.getElementById("convertBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const output = document.getElementById("output");

  let latestJsonText = "";

  convertBtn.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("엑셀 파일을 먼저 선택해주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const workbook = XLSX.read(new Uint8Array(e.target.result), {
        type: "array",
      });

      // game_info
      const gameInfoRows = sheetToJson(
        workbook,
        "game_info",
        headerMap.game_info
      );
      const gi = gameInfoRows[0] || {};
      const gameInfo = {
        title: (gi.title || "").toString(),
        subtitle: (gi.subtitle || "").toString(),
        me: (gi.me || "").toString(),
        backgroundMusic: (gi.backgroundMusic || "").toString(),
      };

      // sheets
      const characters = buildCharacters(
        sheetToJson(workbook, "characters", headerMap.characters)
      );
      const places = buildPlaces(
        sheetToJson(workbook, "places", headerMap.places)
      );

      let scenesRows = sheetToJson(workbook, "scenes", headerMap.scenes);
      let dialoguesRows = sheetToJson(
        workbook,
        "dialogues",
        headerMap.dialogues
      );
      let choicesRows = sheetToJson(workbook, "choices", headerMap.choices);
      let sceneCharRows = sheetToJson(
        workbook,
        "scene_characters",
        headerMap.scene_characters
      );

      const endingSystemRows = sheetToJson(
        workbook,
        "ending_system",
        headerMap.ending_system
      );
      const endingConfigRows = sheetToJson(
        workbook,
        "ending",
        headerMap.ending
      );

      // ✅ 1) ending 시트 기반: old sceneId -> new sceneId 치환 맵 생성
      const endingSceneIdRemap = buildEndingSceneIdRemap(endingConfigRows);

      // ✅ 2) scenes/dialogues/choices/scene_characters/nextSceneId까지 전부 치환 적용
      applySceneIdRemapToSheets(
        { scenesRows, dialoguesRows, choicesRows, sceneCharRows },
        endingSceneIdRemap
      );

      // ✅ 3) storyScenes 생성(이미 치환된 id로 생성됨)
      const storyScenes = buildScenes(
        scenesRows,
        dialoguesRows,
        choicesRows,
        sceneCharRows
      );

      // endingConfig 생성(시트 입력이 불완전해도 normalize로 복구됨)
      const endingConfig = buildEndingConfig(
        endingSystemRows,
        endingConfigRows
      );

      latestJsonText = buildStoryDataJsonText(
        gameInfo,
        characters,
        places,
        storyScenes,
        endingConfig
      );

      output.value = latestJsonText;
      downloadBtn.disabled = !latestJsonText;

      alert("변환 완료!");
    };

    reader.readAsArrayBuffer(file);
  });

  downloadBtn.addEventListener("click", () => {
    if (!latestJsonText) return;

    const blob = new Blob([latestJsonText], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storyData.generated.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
