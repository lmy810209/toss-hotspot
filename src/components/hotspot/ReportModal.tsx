"use client";

import { Hotspot } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { checkProximity } from "@/lib/toss-sdk";
import { AlertCircle, CheckCircle2, MapPin, Users, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface ReportModalProps {
  hotspot: Hotspot | null;
  onClose: () => void;
  onReport: (id: string, level: 1 | 2 | 3) => void;
}

export default function ReportModal({ hotspot, onClose, onReport }: ReportModalProps) {
  const [canReport, setCanReport] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (hotspot) {
      setIsChecking(true);
      checkProximity({ lat: hotspot.lat, lng: hotspot.lng })
        .then(setCanReport)
        .finally(() => setIsChecking(false));
    }
  }, [hotspot]);

  if (!hotspot) return null;

  return (
    <Sheet open={!!hotspot} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[32px] p-6 sm:max-w-md mx-auto h-[auto] max-h-[90vh]">
        <SheetHeader className="text-left">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded mb-2 inline-block">
                {hotspot.category}
              </span>
              <SheetTitle className="text-2xl font-bold">{hotspot.name}</SheetTitle>
            </div>
          </div>
          <SheetDescription className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {hotspot.description || "이 위치의 실시간 혼잡도를 확인하고 제보하세요."}
          </SheetDescription>
        </SheetHeader>

        <div className="my-6 grid grid-cols-2 gap-4">
          <div className="bg-secondary/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
            <Users className="w-5 h-5 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">최근 제보</span>
            <span className="text-sm font-bold">{hotspot.report_count}명</span>
          </div>
          <div className="bg-secondary/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
            <Clock className="w-5 h-5 text-primary mb-2" />
            <span className="text-xs text-muted-foreground">업데이트</span>
            <span className="text-sm font-bold">
              {formatDistanceToNow(hotspot.last_updated, { addSuffix: true, locale: ko })}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-lg">실시간 제보하기</h4>
          {!canReport && !isChecking ? (
            <div className="bg-orange-50 text-orange-700 p-4 rounded-2xl flex gap-3 text-sm border border-orange-100">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>장소 100m 이내에 있어야 제보할 수 있어요. 현재 위치를 확인해주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                disabled={!canReport || isChecking}
                onClick={() => onReport(hotspot.id, 1)}
                className="h-20 flex-col gap-1 rounded-2xl border-2 hover:border-[#22c55e] hover:bg-green-50 transition-all"
              >
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                <span className="font-bold">여유로워요</span>
              </Button>
              <Button
                variant="outline"
                disabled={!canReport || isChecking}
                onClick={() => onReport(hotspot.id, 2)}
                className="h-20 flex-col gap-1 rounded-2xl border-2 hover:border-[#f59e0b] hover:bg-yellow-50 transition-all"
              >
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <span className="font-bold">보통이에요</span>
              </Button>
              <Button
                variant="outline"
                disabled={!canReport || isChecking}
                onClick={() => onReport(hotspot.id, 3)}
                className="h-20 flex-col gap-1 rounded-2xl border-2 hover:border-[#ef4444] hover:bg-red-50 transition-all"
              >
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <span className="font-bold">줄이 길어요</span>
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="mt-8">
          {canReport && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-3 rounded-xl w-full justify-center font-medium">
              <CheckCircle2 className="w-4 h-4" />
              제보하면 토스 포인트를 받을 수 있어요
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
