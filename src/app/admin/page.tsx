"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const CATEGORIES = ["맛집", "카페", "쇼핑", "공원", "벚꽃", "관광", "팝업"];

interface Spot {
  id: string;
  name: string;
  category: string;
  description?: string;
  congestion_level: number;
  report_count: number;
  region?: string;
  lat?: number;
  lng?: number;
}

const EMPTY_FORM = {
  name: "",
  category: "맛집",
  description: "",
  lat: "",
  lng: "",
  congestion_level: "2",
  region: "",
};

export default function AdminPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("전체");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  // 삭제
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadSpots();
  }, []);

  async function loadSpots() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "hotspots"), orderBy("name")));
    setSpots(
      snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name ?? "",
        category: d.data().category ?? "",
        description: d.data().description ?? "",
        congestion_level: d.data().congestion_level ?? 2,
        report_count: d.data().report_count ?? 0,
        region: d.data().region ?? "",
        lat: d.data().lat,
        lng: d.data().lng,
      }))
    );
    setLoading(false);
  }

  const updateCategory = async (id: string, newCat: string) => {
    setSaving(id);
    setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, category: newCat } : s)));
    await updateDoc(doc(db, "hotspots", id), { category: newCat });
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
  };

  const updateCongestion = async (id: string, level: number) => {
    setSaving(id);
    setSpots((prev) => prev.map((s) => (s.id === id ? { ...s, congestion_level: level } : s)));
    await updateDoc(doc(db, "hotspots", id), { congestion_level: level });
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`"${name}"을(를) 삭제할까요?`)) return;
    setDeleting(id);
    await deleteDoc(doc(db, "hotspots", id));
    setSpots((prev) => prev.filter((s) => s.id !== id));
    setDeleting(null);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return alert("장소명을 입력해주세요.");
    if (!form.lat || !form.lng) return alert("위도/경도를 입력해주세요.");

    setAdding(true);
    const docData = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      congestion_level: parseInt(form.congestion_level),
      report_count: 0,
      is_toss_place: false,
      last_updated: Timestamp.now(),
      region: form.region.trim(),
      source: "manual",
    };

    const ref = await addDoc(collection(db, "hotspots"), docData);
    setSpots((prev) =>
      [...prev, { id: ref.id, ...docData }].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    );
    setForm(EMPTY_FORM);
    setShowForm(false);
    setAdding(false);
  };

  const filtered = spots.filter((s) => {
    const matchSearch = s.name.includes(search) || (s.description ?? "").includes(search);
    const matchCat = filterCat === "전체" || s.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black text-gray-900">🛠 Hotspot 관리자</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {showForm ? "✕ 닫기" : "+ 장소 추가"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">총 {spots.length}개 · 카테고리/혼잡도 직접 수정</p>

        {/* ── 장소 추가 폼 ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-5">
            <h2 className="text-sm font-black text-gray-800 mb-4">새 장소 추가</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-bold text-gray-500 mb-1">장소명 *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="예) 스타벅스 강남점"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">카테고리 *</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">위도 * (예: 37.4979)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="37.4979"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">경도 * (예: 127.0276)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="127.0276"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">혼잡도</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  value={form.congestion_level}
                  onChange={(e) => setForm({ ...form, congestion_level: e.target.value })}
                >
                  <option value="1">😊 여유</option>
                  <option value="2">😐 보통</option>
                  <option value="3">😵 붐빔</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">지역 (예: 강남구)</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="선택 입력"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 mb-1">주소/설명</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="도로명 주소 또는 간단한 설명"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setForm(EMPTY_FORM); setShowForm(false); }}
                className="px-4 py-2 text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={adding}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl transition-colors"
              >
                {adding ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}

        {/* ── 필터 ── */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            {["전체", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  filterCat === c
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 w-8">#</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-500">장소명</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 w-32">카테고리</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 w-28">혼잡도</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 w-16">제보수</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-500 w-20">상태</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-gray-300 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{s.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={s.category}
                        onChange={(e) => updateCategory(s.id, e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"
                        disabled={saving === s.id}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={s.congestion_level}
                        onChange={(e) => updateCongestion(s.id, Number(e.target.value))}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"
                        disabled={saving === s.id}
                      >
                        <option value={1}>😊 여유</option>
                        <option value={2}>😐 보통</option>
                        <option value={3}>😵 붐빔</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.report_count}명</td>
                    <td className="px-4 py-3">
                      {saving === s.id ? (
                        <span className="text-xs text-blue-500">저장중...</span>
                      ) : saved === s.id ? (
                        <span className="text-xs text-green-500 font-bold">✓ 저장</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        disabled={deleting === s.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="삭제"
                      >
                        {deleting === s.id ? (
                          <span className="text-[10px]">...</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        )}
                      </button>
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
