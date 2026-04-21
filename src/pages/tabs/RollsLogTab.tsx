import type { DiceRollLog } from "../../types";
import { Dice6, Clock3 } from "lucide-react";

interface Props {
  logs: DiceRollLog[];
}

export function RollsLogTab({ logs }: Props) {
  const sortedLogs = [...logs].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">Dice Roll Logs</h3>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {sortedLogs.length} total
        </span>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-gray-200 text-center text-gray-400">
          <Dice6 className="mx-auto mb-3" size={28} />
          <p className="font-semibold">No dice rolled yet</p>
          <p className="text-sm mt-1">Rolls from Stats, Combat, and Free Roll will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLogs.map((log) => (
            <div key={log.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{log.purpose}</p>
                  <p className="text-xs text-gray-500 mt-1">{log.notation}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slayer-orange leading-none">{log.total}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Total</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                <Clock3 size={12} />
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
