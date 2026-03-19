"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  addDoc,
  doc,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CongestionLevel } from "@/lib/types";

const CATEGORIES = ["맛집", "카페", "쇼핑", "공원", "벚꽃", "관광", "팝업"];
const CONGESTION_OPT = [
  { value: 1, label: "😊 여유" },
  { value: 2, label: "😐 보통" },
  { value: 3, label: "😵 붐빔" },
];

interface Spot {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  naverLink: string;
  imageUrl: string;
  tags: string[];
  congestion_level: number;
  baseCongestion: number;
  report_count: number;
  priorityScore: number;
  isVisible: boolean;
  adminMemo: string;
  region: string;
}

const EMPTY_FORM = {
  name: "",
  category: "맛집",
  description: "",
  address: "",
  lat: "",
  lng: "",
  naverLink: "",
  imageUrl: "",
  tags: "",
  baseCongestion: "2",
  priorityScore: "0",
  isVisible: true,
  adminMemo: "",
  region: "",
};

export default function AdminPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("전체");
  const [filterVisible, setFilterVisible] = useState<"all" | "visible" | "hidden">("all");
  const [sortBy, setSortBy] = useState<"name" | "priority" | "reports">("name");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const csvRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadSpots(); }, []);

  async function loadSpots() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "hotspots"), orderBy("name")));
    setSpots(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? "",
          category: data.category ?? "",
          description: data.description ?? "",
          address: data.address ?? "",
          lat: data.lat ?? 0,
          lng: data.lng ?? 0,
          naverLink: data.naverLink ?? "",
          imageUrl: data.imageUrl ?? "",
          tags: data.tags ?? [],
          congestion_level: data.congestion_level ?? 2,
          baseCongestion: data.baseCongestion ?? data.congestion_level ?? 2,
          report_count: data.report_count ?? 0,
          priorityScore: data.priorityScore ?? 0,
          isVisible: data.isVisible ?? true,
          adminMemo: data.adminMemo ?? "",
          region: data.region ?? "",
        };
      })
    );
    setLoading(false);
  }

  // 단일 필드 업데이트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateField = async (id: string, field: string, value: any) => {
    setSaving(id);
    setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    await updateDoc(doc(db, "hotspots", id), { [field]: value } as any);
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 1200);
  };

  // 비활성화 (삭제 대신)
  const toggleVisible = async (id: string, current: boolean) => {
    const msg = current ? "비활성화할까요? (지도에서 숨김)" : "다시 노출할까요?";
    if (!window.confirm(msg)) return;
    await updateField(id, "isVisible", !current);
  };

  // 폼 열기 (추가 or 수정)
  const openForm = (spot?: Spot) => {
    if (spot) {
      setEditingId(spot.id);
      setForm({
        name: spot.name,
        category: spot.category,
        description: spot.description,
        address: spot.address,
        lat: String(spot.lat),
        lng: String(spot.lng),
        naverLink: spot.naverLink,
        imageUrl: spot.imageUrl,
        tags: spot.tags.join(", "),
        baseCongestion: String(spot.baseCongestion),
        priorityScore: String(spot.priorityScore),
        isVisible: spot.isVisible,
        adminMemo: spot.adminMemo,
        region: spot.region,
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert("장소명을 입력해주세요.");
    if (!form.lat || !form.lng) return alert("위도/경도를 입력해주세요.");

    setSubmitting(true);
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docData: Record<string, any> = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      address: form.address.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      naverLink: form.naverLink.trim(),
      imageUrl: form.imageUrl.trim(),
      tags,
      baseCongestion: parseInt(form.baseCongestion) as CongestionLevel,
      priorityScore: parseInt(form.priorityScore) || 0,
      isVisible: form.isVisible,
      adminMemo: form.adminMemo.trim(),
      region: form.region.trim(),
      last_updated: Timestamp.now(),
    };

    if (editingId) {
      await updateDoc(doc(db, "hotspots", editingId), docData);
    } else {
      docData.congestion_level = parseInt(form.baseCongestion);
      docData.report_count = 0;
      docData.is_toss_place = false;
      docData.source = "manual";
      await addDoc(collection(db, "hotspots"), docData);
    }

    await loadSpots();
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    setSubmitting(false);
  };

  // CSV 업로드
  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return alert("CSV에 데이터가 없어요.");

    const headers = lines[0].split(",").map((h) => h.trim());
    const nameIdx = headers.indexOf("name");
    const catIdx = headers.indexOf("category");
    const latIdx = headers.indexOf("lat");
    const lngIdx = headers.indexOf("lng");

    if (nameIdx === -1 || latIdx === -1 || lngIdx === -1) {
      return alert("CSV에 name, lat, lng 컬럼이 필요해요.");
    }

    const getVal = (row: string[], idx: number) => (idx >= 0 ? row[idx]?.trim() ?? "" : "");
    let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      if (!cols[nameIdx] || !cols[latIdx]) continue;

      const tags = getVal(cols, headers.indexOf("tags"))
        .split("|")
        .filter(Boolean);

      await addDoc(collection(db, "hotspots"), {
        name: cols[nameIdx],
        category: getVal(cols, catIdx) || "맛집",
        address: getVal(cols, headers.indexOf("address")),
        lat: parseFloat(cols[latIdx]),
        lng: parseFloat(cols[lngIdx]),
        naverLink: getVal(cols, headers.indexOf("naverLink")),
        description: getVal(cols, headers.indexOf("description")),
        imageUrl: getVal(cols, headers.indexOf("imageUrl")),
        tags,
        baseCongestion: parseInt(getVal(cols, headers.indexOf("baseCongestion"))) || 2,
        congestion_level: parseInt(getVal(cols, headers.indexOf("baseCongestion"))) || 2,
        priorityScore: parseInt(getVal(cols, headers.indexOf("priorityScore"))) || 0,
        isVisible: getVal(cols, headers.indexOf("isVisible")) !== "false",
        adminMemo: "",
        report_count: 0,
        is_toss_place: false,
        last_updated: Timestamp.now(),
        source: "csv",
      });
      count++;
    }

    alert(`${count}개 장소 업로드 완료!`);
    if (csvRef.current) csvRef.current.value = "";
    await loadSpots();
  };

  // 필터 + 정렬
  const filtered = spots
    .filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));
      const matchCat = filterCat === "전체" || s.category === filterCat;
      const matchVisible =
        filterVisible === "all" ||
        (filterVisible === "visible" && s.isVisible) ||
        (filterVisible === "hidden" && !s.isVisible);
      return matchSearch && matchCat && matchVisible;
    })
    .sort((a, b) => {
      if (sortBy === "priority") return b.priorityScore - a.priorityScore;
      if (sortBy === "reports") return b.report_count - a.report_count;
      return a.name.localeCompare(b.name, "ko");
    });

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
  const labelCls = "block text-xs font-bold text-gray-500 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="text-2xl font-black text-gray-900">눅업 CMS</h1>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer">
              📄 CSV 업로드
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            </label>
            <button
              onClick={() => openForm()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {showForm && !editingId ? "✕ 닫기" : "+ 장소 추가"}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          총 {spots.length}개 · 노출 {spots.filter((s) => s.isVisible).length}개 · 숨김 {spots.filter((s) => !s.isVisible).length}개
        </p>

        {/* ── 추가/수정 폼 ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-5">
            <h2 className="text-sm font-black text-gray-800 mb-4">
              {editingId ? "장소 수정" : "새 장소 추가"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelCls}>장소명 *</label>
                <input className={inputCls} placeholder="스타벅스 강남점" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>카테고리 *</label>
                <select className={`${inputCls} bg-white`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>기본 혼잡도</label>
                <select className={`${inputCls} bg-white`} value={form.baseCongestion} onChange={(e) => setForm({ ...form, baseCongestion: e.target.value })}>
                  {CONGESTION_OPT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>위도 *</label>
                <input type="number" step="0.0001" className={inputCls} placeholder="37.4979" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>경도 *</label>
                <input type="number" step="0.0001" className={inputCls} placeholder="127.0276" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>우선순위 점수</label>
                <input type="number" className={inputCls} placeholder="0" value={form.priorityScore} onChange={(e) => setForm({ ...form, priorityScore: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={labelCls}>주소</label>
                <input className={inputCls} placeholder="서울특별시 강남구 테헤란로 123" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={labelCls}>대표 설명 한 줄</label>
                <input className={inputCls} placeholder="분위기 좋은 루프탑 카페" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>네이버 지도 링크</label>
                <input className={inputCls} placeholder="https://naver.me/..." value={form.naverLink} onChange={(e) => setForm({ ...form, naverLink: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>대표 이미지 URL</label>
                <input className={inputCls} placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>태그 (쉼표 구분)</label>
                <input className={inputCls} placeholder="벚꽃명소, 데이트, 주차가능" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={labelCls}>운영자 메모</label>
                <input className={inputCls} placeholder="내부 참고용 메모" value={form.adminMemo} onChange={(e) => setForm({ ...form, adminMemo: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 col-span-2 md:col-span-3">
                <input type="checkbox" id="isVisible" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="isVisible" className="text-sm font-bold text-gray-700">지도에 노출</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl">
                취소
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl">
                {submitting ? "저장 중..." : editingId ? "수정 완료" : "저장"}
              </button>
            </div>
          </div>
        )}

        {/* ── 필터 바 ── */}
        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <input
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="이름 / 주소 / 태그 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1.5 flex-wrap">
            {["전체", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  filterCat === c ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            value={filterVisible}
            onChange={(e) => setFilterVisible(e.target.value as typeof filterVisible)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold bg-white"
          >
            <option value="all">전체 상태</option>
            <option value="visible">노출만</option>
            <option value="hidden">숨김만</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold bg-white"
          >
            <option value="name">이름순</option>
            <option value="priority">우선순위순</option>
            <option value="reports">제보순</option>
          </select>
        </div>

        {/* ── 테이블 ── */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-8">#</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500">장소명</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-20">카테고리</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-20">기본 혼잡도</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-16">제보수</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-14">노출</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-16">우선순위</th>
                  <th className="text-left px-3 py-3 font-bold text-gray-500 w-14">상태</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${!s.isVisible ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5 text-gray-300 text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-gray-900">{s.name}</div>
                      {s.address && <div className="text-[11px] text-gray-400 truncate max-w-[240px]">{s.address}</div>}
                      {s.tags.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {s.tags.map((t) => (
                            <span key={t} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={s.category}
                        onChange={(e) => updateField(s.id, "category", e.target.value)}
                        className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs font-bold bg-white w-full"
                        disabled={saving === s.id}
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={s.baseCongestion}
                        onChange={(e) => updateField(s.id, "baseCongestion", Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-1.5 py-1 text-xs font-bold bg-white w-full"
                        disabled={saving === s.id}
                      >
                        {CONGESTION_OPT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{s.report_count}명</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.isVisible ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                        {s.isVisible ? "노출" : "숨김"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={s.priorityScore}
                        onChange={(e) => updateField(s.id, "priorityScore", Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-14 text-center"
                        disabled={saving === s.id}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {saving === s.id ? (
                        <span className="text-xs text-blue-500">저장중</span>
                      ) : saved === s.id ? (
                        <span className="text-xs text-green-500 font-bold">✓</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openForm(s)}
                          className="px-2 py-1 text-[10px] font-bold text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-lg"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => toggleVisible(s.id, s.isVisible)}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg ${
                            s.isVisible
                              ? "text-red-500 bg-red-50 hover:bg-red-100"
                              : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                          }`}
                        >
                          {s.isVisible ? "숨김" : "복구"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">검색 결과 없음</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
