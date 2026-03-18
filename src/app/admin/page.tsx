"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const CATEGORIES = ["맛집", "카페", "쇼핑", "공원", "벚꽃", "관광"];

interface Spot {
  id: string;
  name: string;
  category: string;
  description?: string;
  congestion_level: number;
  report_count: number;
  region?: string;
}

export default function AdminPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("전체");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
        }))
      );
      setLoading(false);
    })();
  }, []);

  const updateCategory = async (id: string, newCat: string) => {
    setSaving(id);
    setSpots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, category: newCat } : s))
    );
    await updateDoc(doc(db, "hotspots", id), { category: newCat });
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
  };

  const updateCongestion = async (id: string, level: number) => {
    setSaving(id);
    setSpots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, congestion_level: level } : s))
    );
    await updateDoc(doc(db, "hotspots", id), { congestion_level: level });
    setSaving(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
  };

  const filtered = spots.filter((s) => {
    const matchSearch = s.name.includes(search) || (s.description ?? "").includes(search);
    const matchCat = filterCat === "전체" || s.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black text-gray-900 mb-1">🛠 Hotspot 관리자</h1>
        <p className="text-sm text-gray-500 mb-6">총 {spots.length}개 · 카테고리/혼잡도 직접 수정</p>

        {/* 필터 */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
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
                  <th className="text-left px-4 py-3 font-bold text-gray-500 w-16">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-gray-300 text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{s.description}</div>
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
