import React, { useState } from 'react';
import { ResiduePlddt, classifyPlddt } from '../utils/proteinAnalysis';
import { LoadedStructureRecord } from '../utils/scienceApi';

interface SequenceTrackProps {
  record: LoadedStructureRecord;
  selectedResidue: ResiduePlddt | null;
  onSelectResidue: (residue: ResiduePlddt) => void;
}

export const SequenceTrack: React.FC<SequenceTrackProps> = ({
  record,
  selectedResidue,
  onSelectResidue,
}) => {
  const [filterTier, setFilterTier] = useState<'all' | 'very_high' | 'disordered'>('all');

  const residues = record.residues;
  const filteredResidues =
    filterTier === 'all'
      ? residues
      : filterTier === 'very_high'
      ? residues.filter((r) => r.tier === 'very_high')
      : residues.filter((r) => r.tier === 'very_low' || r.tier === 'low');

  return (
    <div className="space-y-4">
      {/* Header & Interactive Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            氨基酸一级序列与单残基 pLDDT 映射轨 (共 {residues.length} AA)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            点击任意氨基酸残基或上方结构域轨迹，3D 摄像机将自动聚焦至对应的空间原子坐标。
          </p>
        </div>

        <div
          role="group"
          aria-label="按置信度筛选序列残基"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
        >
          {(
            [
              { id: 'all', label: `全部残基 (${residues.length})` },
              {
                id: 'very_high',
                label: `高置信度核心 (${record.summary.countVeryHigh})`,
              },
              {
                id: 'disordered',
                label: `低置信/无序区 (${
                  record.summary.countLow + record.summary.countVeryLow
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTier(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterTier === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1D pLDDT Profile Bar Chart */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-1.5">
          <span>N-端 (AA 1)</span>
          <span>1D 单残基置信度剖面图 (点击柱条聚焦 3D 位点)</span>
          <span>C-端 (AA {residues[residues.length - 1]?.residueNumber || residues.length})</span>
        </div>
        <div className="h-16 w-full flex items-end gap-[1px] overflow-hidden bg-white border border-slate-200 p-1 rounded-xs">
          {residues
            .filter((_, idx) => idx % Math.max(1, Math.floor(residues.length / 120)) === 0)
            .map((r) => {
              const isSelected = selectedResidue?.residueNumber === r.residueNumber;
              return (
                <button
                  key={r.residueNumber}
                  type="button"
                  onClick={() => onSelectResidue(r)}
                  title={`${r.aminoAcid} ${r.residueNumber} · pLDDT: ${r.plddt}`}
                  aria-label={`聚焦残基 ${r.aminoAcid} ${r.residueNumber}`}
                  style={{
                    height: `${Math.max(15, Math.min(100, r.plddt))}%`,
                    backgroundColor: isSelected ? '#0F172A' : r.color,
                  }}
                  className="flex-1 min-w-[2px] transition-opacity hover:opacity-75 cursor-pointer"
                />
              );
            })}
        </div>
      </div>

      {/* Interactive Residue Sequence Matrix */}
      <div className="max-h-60 overflow-y-auto p-3 bg-white border border-slate-200 rounded-lg">
        <div className="flex flex-wrap gap-1">
          {filteredResidues.map((r) => {
            const isSelected = selectedResidue?.residueNumber === r.residueNumber;
            const textColor =
              r.tier === 'very_high' ? 'text-white' : 'text-slate-900';

            return (
              <button
                key={r.residueNumber}
                type="button"
                onClick={() => onSelectResidue(r)}
                title={`${r.aminoAcid} ${r.residueNumber} (${r.oneLetterCode}) | pLDDT: ${r.plddt}`}
                aria-label={`残基 ${r.oneLetterCode}${r.residueNumber} 置信度 ${r.plddt}`}
                style={{ backgroundColor: r.color }}
                className={`w-7 h-7 flex flex-col items-center justify-center rounded-xs font-mono text-[11px] leading-none transition-transform cursor-pointer ${textColor} ${
                  isSelected
                    ? 'ring-2 ring-slate-950 scale-110 z-10 font-bold'
                    : 'hover:opacity-85'
                }`}
              >
                <span className="font-semibold">{r.oneLetterCode}</span>
                <span className="text-[8px] opacity-85">{r.residueNumber}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedResidue && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div>
            <span className="font-semibold text-slate-900">
              当前焦点：{selectedResidue.aminoAcid} {selectedResidue.residueNumber} (
              {selectedResidue.oneLetterCode})
            </span>
            <span className="mx-2 text-slate-400">·</span>
            <span className="text-slate-700">
              置信度分级：{classifyPlddt(selectedResidue.plddt).labelZh}
            </span>
          </div>
          <div className="text-slate-600">
            pLDDT / B-Factor: <strong className="text-slate-900">{selectedResidue.plddt}</strong>
          </div>
        </div>
      )}
    </div>
  );
};
