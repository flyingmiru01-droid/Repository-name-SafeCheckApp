import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import ImageViewing from "react-native-image-viewing";
import { addCase, getCases } from "./lib/cases";
import { uploadImageAsync } from "./lib/storage";

type Status = "PENDING" | "REVIEWING" | "VERIFIED" | "REJECTED";
type Severity = "LOW" | "MEDIUM" | "HIGH";
type Tab = "search" | "history" | "home" | "report";

type RecordItem = {
  id: string;
  name: string;
  plate: string;
  type: string;
  area: string;
  date: string;
  status: Status;
  evidence: string;
  note: string;
  severity: Severity;
  riskScore: number;
  aiSummary: string;
  profileImageUrl?: string;
  plateImageUrl?: string;
};

const STORAGE_KEY = "SAFE_CHECK_RECORDS_V4";
const HISTORY_KEY = "SAFE_CHECK_HISTORY_V3";

const demoRecords: RecordItem[] = [
  {
    id: "SC-051281",
    name: "測試",
    plate: "ABC1234",
    type: "危險駕駛",
    area: "未知地區",
    date: "2026/6/14",
    status: "PENDING",
    evidence: "未提供",
    note: "危險駕駛",
    severity: "MEDIUM",
    riskScore: 65,
    aiSummary: "AI 初步分析：事件類型包含危險行為。",
  },
];

function normalizePlate(text: string) {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, "").trim();
}

function maskName(name: string) {
  if (!name) return "未提供";
  if (name.includes("○")) return name;
  if (name.length <= 1) return name;
  return `${name[0]}○${name.slice(-1)}`;
}

function maskPlate(plate: string) {
  const clean = normalizePlate(plate);
  if (!clean) return "未提供";
  if (clean.length <= 3) return "***";
  return `${clean.slice(0, 3)}****`;
}

function calcRisk(type: string, note: string, severity: Severity) {
  let score = severity === "HIGH" ? 85 : severity === "LOW" ? 35 : 65;
  const text = `${type} ${note}`;
  if (text.includes("危險")) score += 5;
  if (text.includes("騷擾")) score += 8;
  if (text.includes("詐騙")) score += 8;
  return Math.max(0, Math.min(100, score));
}

function riskLabel(score: number) {
  if (score >= 75) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}

function generateAiRiskSummary(type: string, note: string, severity: Severity) {
  const text = `${type} ${note}`;
  const reasons: string[] = [];

  if (text.includes("危險")) reasons.push("事件類型包含危險行為");
  if (text.includes("騷擾")) reasons.push("事件類型包含騷擾疑慮");
  if (text.includes("詐騙")) reasons.push("事件類型包含詐騙疑慮");
  if (severity === "HIGH") reasons.push("嚴重程度標記為 HIGH");

  return reasons.length
    ? `AI 初步分析：${reasons.join("、")}。`
    : "AI 初步分析：目前僅保留安全提醒層級。";
}



function severityText(level: string) {
  switch ((level || "").trim()) {
    case "LOW":
      return "低風險";
    case "MEDIUM":
      return "中風險";
    case "HIGH":
      return "高風險";
    default:
      return level || "未知";
  }
}

function statusText(status: string) {
  switch ((status || "").trim()) {
    case "VERIFIED":
      return "已驗證";
    case "PENDING":
      return "待查證";
    default:
      return status || "未知";
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("search");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<RecordItem | null>(null);

  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<"plate" | "name">("plate");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const [reportName, setReportName] = useState("");
  const [reportPlate, setReportPlate] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportArea, setReportArea] = useState("");
  const [reportEvidence, setReportEvidence] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [reportProfileImage, setReportProfileImage] = useState("");
  const [reportPlateImage, setReportPlateImage] = useState("");

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ uri: string }[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const canViewFullDetail = selected?.status === "VERIFIED";

  useEffect(() => {
    loadRecords();
    loadHistory();
  }, []);

  async function loadRecords() {
    try {
      const cloudCases = await getCases();
      console.log("Firebase cases loaded", cloudCases.map((x: any) => ({
        id: x.id,
        plate: x.plate,
        status: x.status,
      })));

      if (cloudCases.length > 0) {
        const mapped = cloudCases.map((item: any) => ({
          id: item.id || item.firebaseId || `SC-${Date.now()}`,
          name: item.name || "未提供",
          plate: item.plate || "",
          type: item.type || "未分類",
          area: item.area || "未知地區",
          date: item.date || "未提供",
          status: (item.status || "PENDING").trim(),
          evidence: item.evidence || "未提供",
          note: item.note || "未填寫",
          severity: item.severity || "MEDIUM",
          riskScore: item.riskScore || 50,
          aiSummary: item.aiSummary || "尚無 AI 分析",
          profileImageUrl: item.profileImageUrl,
          plateImageUrl: item.plateImageUrl,
        })) as RecordItem[];

        setRecords(mapped);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        return;
      }
    } catch (e) {
      console.log("Firebase 讀取失敗，改用本機資料", e);
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (raw) {
      setRecords(JSON.parse(raw));
      return;
    }

    setRecords(demoRecords);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(demoRecords));
  }

  async function saveRecords(next: RecordItem[]) {
    setRecords(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function loadHistory() {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw) setSearchHistory(JSON.parse(raw));
  }

  async function saveSearchHistory(text: string) {
    const now = new Date().toLocaleString("zh-TW");
    const item = `${now}｜${searchType === "plate" ? "車號" : "姓名"}｜${text}`;
    const next = [item, ...searchHistory].slice(0, 20);
    setSearchHistory(next);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function clearSearchHistory() {
    setSearchHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  }

  function doSearch() {
    const clean = searchType === "plate" ? normalizePlate(keyword) : normalizeText(keyword);

    if (!clean) {
      Alert.alert("請輸入查詢內容", "請輸入車號或姓名。");
      return;
    }

    setHasSearched(true);
    saveSearchHistory(keyword);
  }

  const results = useMemo(() => {
    if (!hasSearched) return [];

    const key = searchType === "plate" ? normalizePlate(keyword) : normalizeText(keyword);

    return records
      .filter((item) => {
        const target =
          searchType === "plate"
            ? normalizePlate(item.plate)
            : normalizeText(item.name);

        return target.includes(key);
      })
      .sort((a, b) => {
        if (a.status === "VERIFIED" && b.status !== "VERIFIED") return -1;
        if (a.status !== "VERIFIED" && b.status === "VERIFIED") return 1;
        return b.riskScore - a.riskScore;
      });
  }, [hasSearched, keyword, records, searchType]);

  async function pickImage(kind: "profile" | "plate") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
    });

    if (result.canceled) return;

    const uri = result.assets[0]?.uri;
    if (!uri) return;

    if (kind === "profile") setReportProfileImage(uri);
    if (kind === "plate") setReportPlateImage(uri);
  }

  function openImage(uri: string) {
    setViewerImages([{ uri }]);
    setViewerIndex(0);
    setViewerVisible(true);
  }

  async function submitReport() {
    const plate = normalizePlate(reportPlate);

    if (!reportName.trim() || !plate || !reportType.trim()) {
      Alert.alert("資料不足", "請至少輸入姓名、車號、事件類型。");
      return;
    }

    let profileImageUrl = "";
    let plateImageUrl = "";

    try {
      if (reportProfileImage) {
        profileImageUrl = await uploadImageAsync(reportProfileImage, "profileImages");
      }

      if (reportPlateImage) {
        plateImageUrl = await uploadImageAsync(reportPlateImage, "plateImages");
      }
    } catch (e) {
      console.log("照片上傳失敗", e);
      Alert.alert("照片上傳失敗", "照片未成功上傳，但文字資料仍會建立。");
    }

    const score = calcRisk(reportType, reportNote, severity);

    const newRecord: RecordItem = {
      id: `SC-${Date.now().toString().slice(-6)}`,
      name: reportName.trim(),
      plate,
      type: reportType.trim(),
      area: reportArea.trim() || "未知地區",
      date: new Date().toLocaleDateString("zh-TW"),
      status: "PENDING",
      evidence: reportEvidence.trim() || "未提供",
      note: reportNote.trim() || "未填寫",
      severity,
      riskScore: score,
      aiSummary: generateAiRiskSummary(reportType, reportNote, severity),
      profileImageUrl: profileImageUrl || "",
      plateImageUrl: plateImageUrl || "",
    };

    try {
      await addCase(newRecord);
    } catch (e) {
      console.log("Firebase 寫入失敗，僅儲存在本機", e);
    }

    const next = [newRecord, ...records];
    await saveRecords(next);

    setReportName("");
    setReportPlate("");
    setReportType("");
    setReportArea("");
    setReportEvidence("");
    setReportNote("");
    setSeverity("MEDIUM");
    setReportProfileImage("");
    setReportPlateImage("");

    setKeyword(newRecord.plate);
    setSearchType("plate");
    setHasSearched(true);
    setTab("search");

    Alert.alert("資料已建立", "資料已加入本機查詢庫，狀態為待查證。");
  }

  function CaseCard({ item }: { item: RecordItem }) {
    const publicView = item.status !== "VERIFIED";

    return (
      <Pressable style={styles.recordCard} onPress={() => setSelected(item)}>
        <View style={styles.recordTop}>
          <Text style={styles.recordId}>{item.id}</Text>
          <View style={styles.riskBadge}>
            <Text style={styles.riskText}>{riskLabel(item.riskScore) === "HIGH" ? "高風險" : riskLabel(item.riskScore) === "MEDIUM" ? "中風險" : "低風險"}</Text>
          </View>
        </View>

        <Text style={styles.recordName}>{publicView ? maskName(item.name) : item.name}</Text>
        <Text style={styles.recordPlate}>
          車號：{publicView ? maskPlate(item.plate) : item.plate}
        </Text>

        <View style={styles.grid}>
          <Text style={styles.gridText}>狀態：{statusText(item.status)}</Text>
          <Text style={styles.gridText}>分數：{item.riskScore}</Text>
          <Text style={styles.gridText}>資料性質：安全提醒參考</Text>
        </View>

        <Text style={styles.tapHint}>點擊查看事件描述</Text>
      </Pressable>
    );
  }

  if (selected) {
    const plateGroup = records.filter(
      (item) => normalizePlate(item.plate) === normalizePlate(selected.plate)
    );

    const verifiedCount = plateGroup.filter((item) => item.status === "VERIFIED").length;
    const pendingCount = plateGroup.filter((item) => item.status === "PENDING").length;
    const avgRisk =
      plateGroup.reduce((sum, item) => sum + item.riskScore, 0) /
      Math.max(1, plateGroup.length);

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable style={styles.backBtn} onPress={() => setSelected(null)}>
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>

          <View style={styles.detailCard}>
            <Text style={styles.system}>DATA FILE</Text>
            <Text style={styles.recordId}>{selected.id}</Text>

            <Text style={styles.recordName}>
              {canViewFullDetail ? selected.name : maskName(selected.name)}
            </Text>

            <Text style={styles.recordPlate}>
              車號：{canViewFullDetail ? selected.plate : maskPlate(selected.plate)}
            </Text>

            <View style={styles.bigRisk}>
              <Text style={styles.bigRiskText}>
                {riskLabel(selected.riskScore) === "HIGH" ? "高風險" : riskLabel(selected.riskScore) === "MEDIUM" ? "中風險" : "低風險"} / 分數 {selected.riskScore}
              </Text>
            </View>

            {!canViewFullDetail && (
              <View style={styles.limitedBox}>
                <Text style={styles.limitedTitle}>公開摘要模式</Text>
                <Text style={styles.limitedText}>
                  本資料尚未完成驗證，僅顯示安全提醒與基本資訊。
                </Text>
              </View>
            )}

            <View style={styles.historyBox}>
              <Text style={styles.sectionTitle}>PLATE HISTORY</Text>
              <Text style={styles.detailLine}>案件數：{plateGroup.length}</Text>
              <Text style={styles.detailLine}>已驗證：{verifiedCount}</Text>
              <Text style={styles.detailLine}>待查證：{pendingCount}</Text>
              <Text style={styles.detailLine}>平均風險：{Math.round(avgRisk)}</Text>
            </View>

            <View style={styles.aiBox}>
              <Text style={styles.sectionTitle}>AI 風險分析</Text>
              <Text style={styles.aiText}>{selected.aiSummary}</Text>
            </View>

            {canViewFullDetail && (
              <>
                <Text style={styles.detailLine}>事件類型：{selected.type}</Text>
                <Text style={styles.detailLine}>事件地區：{selected.area}</Text>
                <Text style={styles.detailLine}>建檔日期：{selected.date}</Text>
                <Text style={styles.detailLine}>嚴重程度：{severityText(selected.severity)}</Text>
                <Text style={styles.detailLine}>審核狀態：{statusText(selected.status)}</Text>
                <Text style={styles.detailLine}>證據狀態：{selected.evidence}</Text>

                {selected.profileImageUrl ? (
                  <Pressable onPress={() => openImage(selected.profileImageUrl!)}>
                    <Image source={{ uri: selected.profileImageUrl }} style={styles.detailImage} />
                  </Pressable>
                ) : null}

                {selected.plateImageUrl ? (
                  <Pressable onPress={() => openImage(selected.plateImageUrl!)}>
                    <Image source={{ uri: selected.plateImageUrl }} style={styles.detailImage} />
                  </Pressable>
                ) : null}

                <View style={styles.noteBox}>
                  <Text style={styles.sectionTitle}>case_note:</Text>
                  <Text style={styles.note}>{selected.note}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.warning}>
            <Text style={styles.warningText}>
              本頁為安全建檔詳情，不代表司法認定、犯罪事實或前科紀錄。
            </Text>
          </View>
        </ScrollView>

        <ImageViewing
          images={viewerImages}
          imageIndex={viewerIndex}
          visible={viewerVisible}
          onRequestClose={() => setViewerVisible(false)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.system}>SAFE CHECK OS</Text>
          <Text style={styles.title}>SafeCheck</Text>
          <Text style={styles.subtitle}>Plate・Name Lookup System</Text>
        </View>

        {tab === "search" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>查詢系統</Text>

            <View style={styles.switchRow}>
              <Pressable
                style={[styles.switchBtn, searchType === "plate" && styles.switchActive]}
                onPress={() => setSearchType("plate")}
              >
                <Text style={styles.switchText}>車號查詢</Text>
              </Pressable>

              <Pressable
                style={[styles.switchBtn, searchType === "name" && styles.switchActive]}
                onPress={() => setSearchType("name")}
              >
                <Text style={styles.switchText}>姓名查詢</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              value={keyword}
              onChangeText={(text) => {
                setKeyword(text);
                setHasSearched(false);
              }}
              placeholder={searchType === "plate" ? "輸入車號，例如 ABC-1234 / abc1234" : "輸入姓名"}
              placeholderTextColor="#3F6F4E"
              autoCapitalize="characters"
            />

            <Pressable style={styles.button} onPress={doSearch}>
              <Text style={styles.buttonText}>START SEARCH</Text>
            </Pressable>

            <View style={styles.resultHeader}>
              <Text style={styles.resultLine}>QUERY：{keyword || "NULL"}</Text>
              <Text style={styles.resultLine}>
                NORMALIZED：{searchType === "plate" ? normalizePlate(keyword) || "NULL" : normalizeText(keyword) || "NULL"}
              </Text>
              <Text style={styles.resultLine}>MATCH：{hasSearched ? results.length : "LOCKED"}</Text>
            </View>

            {hasSearched && results.length === 0 && (
              <Text style={styles.emptyText}>查無資料。</Text>
            )}

            {hasSearched && results.map((item) => <CaseCard key={item.id} item={item} />)}
          </View>
        )}

        {tab === "history" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>查詢紀錄</Text>

            {searchHistory.length === 0 && (
              <Text style={styles.emptyText}>目前沒有查詢紀錄。</Text>
            )}

            {searchHistory.map((item, index) => {
              const parts = item.split("｜");
              return (
                <View key={`${item}-${index}`} style={styles.alertRow}>
                  <Text style={styles.alertMain}>{parts[1]}：{parts[2]}</Text>
                  <Text style={styles.alertSub}>{parts[0]}｜只保存查詢紀錄</Text>
                </View>
              );
            })}

            <Pressable style={styles.dangerButton} onPress={clearSearchHistory}>
              <Text style={styles.dangerText}>CLEAR SEARCH HISTORY</Text>
            </Pressable>
          </View>
        )}

        {tab === "home" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>系統狀態</Text>
            <Text style={styles.line}>DATABASE STATUS : LOCAL</Text>
            <Text style={styles.line}>AI 風險分析系統：運作中</Text>
            <Text style={styles.line}>SEARCH NODE : TAIWAN</Text>
            <Text style={styles.line}>RECORDS : {records.length}</Text>
            <Text style={styles.homeHint}>
              手機端不提供管理員審核。待查證 / 已驗證 請由電腦端資料庫管理。
            </Text>
          </View>
        )}

        {tab === "report" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>建立安全資料</Text>

            <Text style={styles.label}>NAME</Text>
            <TextInput style={styles.input} value={reportName} onChangeText={setReportName} placeholder="姓名" placeholderTextColor="#3F6F4E" />

            <Text style={styles.label}>PLATE NUMBER</Text>
            <TextInput style={styles.input} value={reportPlate} onChangeText={(v) => setReportPlate(v.toUpperCase())} placeholder="ABC-1234" placeholderTextColor="#3F6F4E" autoCapitalize="characters" />
            <Text style={styles.previewText}>標準化車號：{reportPlate ? normalizePlate(reportPlate) : "尚未輸入"}</Text>

            <Text style={styles.label}>TYPE</Text>
            <TextInput style={styles.input} value={reportType} onChangeText={setReportType} placeholder="例如 危險駕駛 / 騷擾 / 詐騙" placeholderTextColor="#3F6F4E" />

            <Text style={styles.label}>AREA</Text>
            <TextInput style={styles.input} value={reportArea} onChangeText={setReportArea} placeholder="地區" placeholderTextColor="#3F6F4E" />

            <Text style={styles.label}>風險程度</Text>
            <View style={styles.switchRow}>
              {(["LOW", "MEDIUM", "HIGH"] as Severity[]).map((s) => (
                <Pressable key={s} style={[styles.switchBtn, severity === s && styles.switchActive]} onPress={() => setSeverity(s)}>
                  <Text style={styles.switchText}>{severityText(s)}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.secondaryButton} onPress={() => pickImage("profile")}>
              <Text style={styles.secondaryText}>上傳人物照片</Text>
            </Pressable>
            {reportProfileImage ? <Image source={{ uri: reportProfileImage }} style={styles.previewImage} /> : null}

            <Pressable style={styles.secondaryButton} onPress={() => pickImage("plate")}>
              <Text style={styles.secondaryText}>上傳車牌照片</Text>
            </Pressable>
            {reportPlateImage ? <Image source={{ uri: reportPlateImage }} style={styles.previewImage} /> : null}

            <Text style={styles.label}>證據資料</Text>
            <TextInput style={styles.input} value={reportEvidence} onChangeText={setReportEvidence} placeholder="例如 照片1張 / 截圖2張" placeholderTextColor="#3F6F4E" />

            <Text style={styles.label}>事件描述</Text>
            <TextInput style={[styles.input, styles.textarea]} value={reportNote} onChangeText={setReportNote} placeholder="描述事件經過" placeholderTextColor="#3F6F4E" multiline />

            <Pressable style={styles.button} onPress={submitReport}>
              <Text style={styles.buttonText}>建立紀錄</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.warning}>
          <Text style={styles.warningText}>
            本平台資料僅供安全提醒參考，不代表司法認定、犯罪事實或前科紀錄。
          </Text>
        </View>

        <View style={styles.bottomNav}>
          {(["search", "history", "home", "report"] as Tab[]).map((t) => (
            <Pressable key={t} style={styles.navItem} onPress={() => setTab(t)}>
              <Text style={[styles.navText, tab === t && styles.navActive]}>
                {t === "search" ? "查詢" : t === "history" ? "紀錄" : t === "home" ? "狀態" : "建檔"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.footer}>3AM TECH STUDIO®</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020403" },
  container: { padding: 18, paddingBottom: 46 },
  header: { borderWidth: 1, borderColor: "#19FF7A", borderRadius: 18, padding: 18, marginBottom: 14, backgroundColor: "#06130B" },
  system: { color: "#19FF7A", fontSize: 11, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: "#E9FFF1", fontSize: 42, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "#79FFB2", fontSize: 13, marginTop: 6 },
  card: { backgroundColor: "#06130B", borderWidth: 1, borderColor: "#137C3B", borderRadius: 18, padding: 16, marginBottom: 14 },
  cardTitle: { color: "#19FF7A", fontSize: 20, fontWeight: "900", marginBottom: 14, letterSpacing: 1 },
  line: { color: "#79FFB2", fontWeight: "800", marginBottom: 8 },
  label: { color: "#19FF7A", fontWeight: "900", marginBottom: 8, letterSpacing: 1 },
  input: { borderWidth: 1, borderColor: "#137C3B", borderRadius: 12, color: "#E9FFF1", padding: 13, marginBottom: 12, backgroundColor: "#030A06", fontWeight: "800" },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  button: { backgroundColor: "#19FF7A", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4, marginBottom: 14 },
  buttonText: { color: "#001F0D", fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  secondaryButton: { borderWidth: 1, borderColor: "#19FF7A", borderRadius: 12, paddingVertical: 13, alignItems: "center", marginBottom: 12 },
  secondaryText: { color: "#19FF7A", fontWeight: "900" },
  switchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  switchBtn: { flex: 1, borderWidth: 1, borderColor: "#137C3B", borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  switchActive: { backgroundColor: "#19FF7A" },
  switchText: { color: "#E9FFF1", fontWeight: "900", fontSize: 12 },
  resultHeader: { borderWidth: 1, borderColor: "#137C3B", borderRadius: 12, padding: 12, marginBottom: 12 },
  resultLine: { color: "#79FFB2", fontWeight: "800", fontSize: 12, marginBottom: 4 },
  recordCard: { backgroundColor: "#041008", borderWidth: 1, borderColor: "#19FF7A", borderRadius: 18, padding: 16, marginBottom: 12 },
  recordTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  recordId: { color: "#79FFB2", fontWeight: "900" },
  riskBadge: { borderWidth: 1, borderColor: "#FFD166", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  riskText: { color: "#FFD166", fontWeight: "900", fontSize: 12 },
  recordName: { color: "#E9FFF1", fontSize: 24, fontWeight: "900", marginBottom: 4 },
  recordPlate: { color: "#19FF7A", fontSize: 17, fontWeight: "900", marginBottom: 12 },
  grid: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#137C3B", paddingVertical: 10, gap: 5 },
  gridText: { color: "#79FFB2", fontWeight: "800" },
  tapHint: { color: "#3F6F4E", fontWeight: "900", marginTop: 12, fontSize: 11 },
  detailCard: { backgroundColor: "#041008", borderWidth: 1, borderColor: "#19FF7A", borderRadius: 20, padding: 18, marginBottom: 14 },
  detailLine: { color: "#C8FFD9", fontWeight: "800", marginBottom: 10 },
  bigRisk: { borderWidth: 1, borderColor: "#FFD166", borderRadius: 16, padding: 14, marginVertical: 14, alignItems: "center" },
  bigRiskText: { color: "#FFD166", fontSize: 16, fontWeight: "900" },
  backBtn: { marginBottom: 14 },
  backText: { color: "#19FF7A", fontWeight: "900", fontSize: 16 },
  limitedBox: { backgroundColor: "#201600", borderWidth: 1, borderColor: "#FFD166", borderRadius: 16, padding: 14, marginVertical: 14 },
  limitedTitle: { color: "#FFD166", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  limitedText: { color: "#FFF0B8", fontWeight: "800", lineHeight: 22, marginTop: 8 },
  historyBox: { borderWidth: 1, borderColor: "#FFD166", borderRadius: 16, padding: 14, marginVertical: 14 },
  sectionTitle: { color: "#19FF7A", fontSize: 16, fontWeight: "900", marginBottom: 10, letterSpacing: 1 },
  aiBox: { borderWidth: 1, borderColor: "#19FF7A", borderRadius: 16, padding: 14, marginVertical: 14 },
  aiText: { color: "#C8FFD9", fontWeight: "800", lineHeight: 22 },
  noteBox: { borderWidth: 1, borderColor: "#137C3B", borderRadius: 14, padding: 12, marginVertical: 12 },
  note: { color: "#C8FFD9", marginTop: 8, lineHeight: 21 },
  warning: { backgroundColor: "#161000", borderWidth: 1, borderColor: "#FFD166", borderRadius: 14, padding: 14, marginTop: 4, marginBottom: 14 },
  warningText: { color: "#FFD166", fontSize: 12, lineHeight: 20, fontWeight: "700" },
  bottomNav: { flexDirection: "row", backgroundColor: "#06130B", borderWidth: 1, borderColor: "#137C3B", borderRadius: 18, padding: 8, marginTop: 14 },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 8 },
  navText: { color: "#3F6F4E", fontWeight: "900", fontSize: 12 },
  navActive: { color: "#19FF7A" },
  homeHint: { color: "#79FFB2", marginTop: 14, lineHeight: 22, fontWeight: "800" },
  emptyText: { color: "#79FFB2", fontWeight: "800", marginVertical: 12 },
  alertRow: { borderBottomWidth: 1, borderBottomColor: "#102C19", paddingVertical: 12 },
  alertMain: { color: "#E9FFF1", fontWeight: "900", fontSize: 14 },
  alertSub: { color: "#79FFB2", fontSize: 12, marginTop: 4 },
  dangerButton: { borderWidth: 1, borderColor: "#FF4D6D", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  dangerText: { color: "#FF4D6D", fontWeight: "900" },
  previewText: { color: "#3F6F4E", fontSize: 12, fontWeight: "800", marginTop: -6, marginBottom: 12 },
  previewImage: { width: "100%", height: 180, borderRadius: 14, borderWidth: 1, borderColor: "#19FF7A", marginBottom: 14, backgroundColor: "#000" },
  detailImage: { width: "100%", height: 220, borderRadius: 14, borderWidth: 1, borderColor: "#19FF7A", marginBottom: 14, backgroundColor: "#000" },
  footer: { color: "#3F6F4E", textAlign: "center", marginTop: 22, fontWeight: "900", letterSpacing: 1 },
});
