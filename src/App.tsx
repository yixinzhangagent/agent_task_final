import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  Sparkles,
  FileCode2,
  Compass,
  Filter,
} from 'lucide-react';
import { PRESET_TARGETS, LoadedStructureRecord, loadStructureRecord } from './utils/scienceApi';
import { ResiduePlddt, detectIdentifierType } from './utils/proteinAnalysis';
import { MolecularViewer3D } from './components/MolecularViewer3D';
import { SequenceTrack } from './components/SequenceTrack';
import { PaeMatrixViewer } from './components/PaeMatrixViewer';

export default function App() {
  const [record, setRecord] = useState<LoadedStructureRecord>(() => {
    // Synchronously initialize with deterministic TP53 record so initial paint is immediate, then hydrate live
    const initialPreset = PRESET_TARGETS[0];
    const fallbackPdb = `HEADER    ALPHAFOLD PREDICTION P04637 (TP53)\nATOM      1  CA  MET A   1     -14.200   4.100 -80.000  1.00 38.40           C\nATOM      2  CA  ARG A 175      11.400  -6.200  -8.400  1.00 94.80           C\nATOM      3  CA  ARG A 248      14.800   3.500  18.200  1.00 96.10           C\nATOM      4  CA  ARG A 273       8.900  12.100  27.400  1.00 95.20           C\nEND`;
    return {
      source: 'alphafold',
      entryId: 'AF-P04637-F1',
      uniprotId: 'P04637',
      pdbId: '1TUP',
      gene: 'TP53',
      titleZh: initialPreset.nameZh,
      titleEn: initialPreset.nameEn,
      organism: initialPreset.organism,
      experimentalMethod: 'AlphaFold Monomer v2.0 Prediction',
      resolution: null,
      releaseDate: '2025-11-01',
      cifText: fallbackPdb,
      cifFormat: 'pdb',
      cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif',
      paeImageUrl:
        'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v6.png',
      paeDocUrl:
        'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v6.json',
      residues: [],
      summary: {
        meanPlddt: 75.6,
        totalResidues: 393,
        fractionVeryHigh: 0.51,
        fractionConfident: 0.14,
        fractionLow: 0.09,
        fractionVeryLow: 0.26,
        countVeryHigh: 200,
        countConfident: 55,
        countLow: 36,
        countVeryLow: 102,
        isHighlyDisordered: true,
        hasIsoformOrLengthWarning: false,
        warningMessage: null,
        orderedDomains: [
          { start: 94, end: 292, meanPlddt: 94.2 },
          { start: 325, end: 356, meanPlddt: 85.4 },
        ],
        synthesisText:
          '全局平均 pLDDT 为 75.6（极高置信度占 51.0%，极低置信度/无序区占 26.0%）。识别到 2 个高置信度刚性折叠域（AA 94–292, 均值 94.2；AA 325–356, 均值 85.4）。显式无序区警告：该结构包含显著比例的天然无序区 (pLDDT < 50)，代表构象高度动态的柔性片段而非固定静态折叠。切勿将全长模型直接用于刚性分子对接或全长 Foldseek 结构比对；下游结构分析应严格限制在上述高置信度结构域残基边界内。',
      },
      keySites: initialPreset.keySites,
      relatedPdbEntries: [
        {
          rcsb_id: '1TUP',
          title: 'TUMOR SUPPRESSOR P53 COMPLEXED WITH DNA',
          method: 'X-RAY DIFFRACTION',
          resolution: 2.2,
          year: 1995,
          pmid: '7824959',
        },
        {
          rcsb_id: '2OCJ',
          title: 'CRYSTAL STRUCTURE OF HUMAN P53 CORE DOMAIN',
          method: 'X-RAY DIFFRACTION',
          resolution: 2.05,
          year: 2007,
          pmid: '17317671',
        },
      ],
      usedQueryExplanation:
        'RCSB Search v2 检索条件：精确匹配 UniProt 登录号 "P04637"，组合分辨率 ≤ 3.0 Å，分页返回前 8 条实验测定记录并经由 RCSB Data GraphQL 批量获取元数据。',
    };
  });

  const [searchInput, setSearchInput] = useState<string>('P04637');
  const [searchSource, setSearchSource] = useState<'auto' | 'alphafold' | 'pdb'>('auto');
  const [maxResolution, setMaxResolution] = useState<number>(2.5);
  const [experimentalMethod, setExperimentalMethod] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sequence' | 'pae' | 'sites'>('overview');
  const [selectedResidue, setSelectedResidue] = useState<ResiduePlddt | null>(null);

  // Hydrate initial full structure on mount
  React.useEffect(() => {
    handleLoadTarget('P04637', 'alphafold', 2.5, 'ALL');
  }, []);

  const handleLoadTarget = async (
    identifier: string,
    forcedSource?: 'alphafold' | 'pdb',
    resFilter = maxResolution,
    methodFilter = experimentalMethod
  ) => {
    setErrorMsg(null);
    const detected = detectIdentifierType(identifier);
    if (detected.type === 'invalid') {
      setErrorMsg(
        '请输入有效的 UniProt 登录号（如 P04637、P00533、P38398）或 4 位 RCSB PDB 编号（如 1TUP、4HHB）。'
      );
      return;
    }

    setLoading(true);
    try {
      const targetSource =
        forcedSource || ( detected.type === 'pdb' ? 'pdb' : 'alphafold' );
      const loaded = await loadStructureRecord(
        detected.cleanId,
        targetSource,
        resFilter,
        methodFilter
      );
      setRecord(loaded);
      setSearchInput(detected.cleanId);
      setSelectedResidue(null);
    } catch (err: any) {
      setErrorMsg(err?.message || '检索结构数据时发生异常，请核对标识符后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const forced = searchSource === 'auto' ? undefined : searchSource;
    handleLoadTarget(searchInput, forced, maxResolution, experimentalMethod);
  };

  const handleFocusKeySite = (residueNum: number) => {
    const match = record.residues.find((r) => r.residueNumber === residueNum);
    if (match) {
      setSelectedResidue(match);
    } else if (record.residues.length > 0) {
      setSelectedResidue(record.residues[0]);
    }
  };

  const handleDownloadCif = () => {
    const blob = new Blob([record.cifText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.entryId}.${record.cifFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          StructBio Workbench
        </a>

        <nav
          aria-label="主导航"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#workbench"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            三维结构工作台
          </a>
          <a
            href="#confidence-synthesis"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            置信度与无序区判读
          </a>
          <a
            href="#rcsb-explorer"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            PDB 实验结构对标
          </a>
          <a
            href="#architecture-guide"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            方法学规范
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadCif}
            className="px-4 py-2 text-xs font-medium text-white bg-[#1A73E8] rounded-lg hover:bg-[#1557B0] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            导出坐标文件 (.{record.cifFormat})
          </button>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-6">
        {/* Top Quick-Try Example Selector & Search Bar */}
        <section
          aria-label="生物分子快速示例与标识符检索"
          className="bg-white border border-slate-200 rounded-xl p-4 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                蛋白质三维结构与 AlphaFold 置信度分析工作台
              </h1>
              <p className="text-xs text-slate-600">
                实时连接 AlphaFold DB (_v6 mmCIF / PAE) 与 RCSB PDB Search v2 / GraphQL API，严格区分实验测定结构与计算预测模型。
              </p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-wrap items-center gap-2">
              <label htmlFor="identifier-search" className="sr-only">
                输入 UniProt ID 或 PDB ID
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="identifier-search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="输入 UniProt (P04637) 或 PDB (1TUP)"
                  className="pl-9 pr-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 w-56"
                />
              </div>

              <label htmlFor="source-select" className="sr-only">
                选择数据源
              </label>
              <select
                id="source-select"
                value={searchSource}
                onChange={(e) => setSearchSource(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="auto">自动识别数据源</option>
                <option value="alphafold">AlphaFold DB 预测模型</option>
                <option value="pdb">RCSB PDB 实验结构</option>
              </select>

              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {loading ? '正在加载...' : '加载结构'}
              </button>
            </form>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick-Try Example Bar */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
              预设标准靶标快速切换：
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_TARGETS.map((preset) => {
                const isActive =
                  (preset.defaultSource === 'alphafold' &&
                    record.source === 'alphafold' &&
                    record.uniprotId === preset.uniprotId) ||
                  (preset.defaultSource === 'pdb' &&
                    record.source === 'pdb' &&
                    record.pdbId === preset.pdbId);

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      handleLoadTarget(
                        preset.defaultSource === 'pdb' ? preset.pdbId : preset.uniprotId,
                        preset.defaultSource
                      )
                    }
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono font-semibold">{preset.gene}</span>
                    <span className="mx-1.5 text-slate-400">·</span>
                    <span className="font-mono">
                      {preset.defaultSource === 'pdb'
                        ? `PDB:${preset.pdbId}`
                        : `AF:${preset.uniprotId}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Dual-Pane Structural Workbench Layout */}
        <div id="workbench" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Pane (7 cols ~58%): Interactive 3Dmol.js WebGL Viewport */}
          <div className="lg:col-span-7 space-y-4">
            <MolecularViewer3D
              record={record}
              selectedResidue={selectedResidue}
              onSelectResidue={(res) => setSelectedResidue(res)}
            />

            {/* AlphaFold Structural & Disorder Synthesis Banner */}
            <section
              id="confidence-synthesis"
              aria-label="结构置信度与天然无序区综合评估"
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1A73E8] shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    结构折叠置信度 (pLDDT) 与结构域耦合综合判读
                  </h2>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {record.source === 'alphafold'
                    ? '[Predicted by model · AlphaFold DB]'
                    : '[Experimentally determined · RCSB PDB]'}
                </div>
              </div>

              {record.summary.hasIsoformOrLengthWarning && record.summary.warningMessage && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{record.summary.warningMessage}</span>
                </div>
              )}

              {record.summary.isHighlyDisordered && record.source === 'alphafold' && (
                <div className="p-3 rounded-lg bg-amber-50/90 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-amber-950">
                      天然无序蛋白区域 (IDPR) 与下游分析边界警告
                    </div>
                    <p className="leading-relaxed text-amber-900">
                      当前模型存在较高比例的极低置信度区段 (pLDDT &lt; 50 占{' '}
                      {(record.summary.fractionVeryLow * 100).toFixed(1)}%
                      )。这些区域代表生理状态下构象动态可变的天然无序区，而非固定空间折叠。建议不要直接采用全长坐标开展全蛋白分子对接或全长
                      Foldseek 搜索；请将下游结构分析严格限制在已识别的高置信度结构域边界（
                      {record.summary.orderedDomains
                        .map((d) => `AA ${d.start}–${d.end}`)
                        .join('、') || '核心折叠域'}
                      ）内。
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-700 leading-relaxed">
                {record.summary.synthesisText}
              </p>

              {/* 4-Band Quantitative Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">极高置信度 (&gt;90)</div>
                  <div className="text-lg font-mono font-bold text-[#0053D6] mt-0.5">
                    {(record.summary.fractionVeryHigh * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {record.summary.countVeryHigh} AA
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">较高置信度 (70–90)</div>
                  <div className="text-lg font-mono font-bold text-[#0284C7] mt-0.5">
                    {(record.summary.fractionConfident * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {record.summary.countConfident} AA
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">较低置信度 (50–70)</div>
                  <div className="text-lg font-mono font-bold text-[#B45309] mt-0.5">
                    {(record.summary.fractionLow * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {record.summary.countLow} AA
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-500">极低 / 无序区 (&lt;50)</div>
                  <div className="text-lg font-mono font-bold text-[#DC2626] mt-0.5">
                    {(record.summary.fractionVeryLow * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {record.summary.countVeryLow} AA
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right Pane (5 cols ~42%): Synchronized Data Inspector */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            {/* Inspector Header */}
            <div className="p-4 border-b border-slate-200 space-y-2 bg-slate-50">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-mono">
                <span>
                  {record.source === 'alphafold'
                    ? '预测模型记录 · Predicted by model'
                    : '实验测定记录 · Experimentally determined'}
                </span>
                <span>更新日期: {record.releaseDate}</span>
              </div>

              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {record.titleZh}
              </h2>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 font-mono">
                <span>基因: {record.gene}</span>
                <span aria-hidden="true">·</span>
                <span>UniProt: {record.uniprotId}</span>
                <span aria-hidden="true">·</span>
                <span>代表性 PDB: {record.pdbId}</span>
                <span aria-hidden="true">·</span>
                <span>{record.organism}</span>
              </div>

              {/* Outbound Authority Links */}
              <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-medium text-[#1A73E8]">
                <a
                  href={`https://www.uniprot.org/uniprotkb/${record.uniprotId}/entry`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <span>UniProtKB 权威档案</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://alphafold.ebi.ac.uk/entry/${record.uniprotId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <span>AlphaFold DB 记录</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://www.rcsb.org/structure/${record.pdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <span>RCSB PDB ({record.pdbId})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Inspector Navigation Tabs */}
            <div
              role="tablist"
              aria-label="结构数据检查器分页"
              className="flex items-center border-b border-slate-200 bg-white px-4 pt-2 gap-2 overflow-x-auto"
            >
              {(
                [
                  { id: 'overview', label: '结构概览与功能域' },
                  { id: 'sequence', label: '序列与残基映射' },
                  { id: 'pae', label: 'PAE 误差矩阵' },
                  { id: 'sites', label: `致病突变与位点 (${record.keySites.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? 'border-[#1A73E8] text-[#1A73E8]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content Area */}
            <div className="p-4 flex-1 space-y-4">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500">全局均值 pLDDT / B-因子</div>
                      <div className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
                        {record.summary.meanPlddt}
                        <span className="text-xs font-normal text-slate-500 ml-1">/ 100</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500">实验分辨率 / 测定方法</div>
                      <div className="text-sm font-mono font-semibold text-slate-900 mt-1">
                        {record.resolution
                          ? `${record.resolution.toFixed(2)} Å (${record.experimentalMethod})`
                          : 'AI 全原子预测 (mmCIF v6)'}
                      </div>
                    </div>
                  </div>

                  {/* Rigid Domain Boundaries */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-900">
                      高置信度折叠结构域边界 (点击一键聚焦三维核心域)
                    </h3>
                    {record.summary.orderedDomains.length > 0 ? (
                      <div className="space-y-2">
                        {record.summary.orderedDomains.map((dom, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs font-semibold text-slate-900">
                                刚性结构域 #{idx + 1} · 残基范围 AA {dom.start}–{dom.end}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                跨度 {dom.end - dom.start + 1} AA · 域内平均 pLDDT: {dom.meanPlddt}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFocusKeySite(dom.start)}
                              className="px-2.5 py-1 text-xs font-medium text-[#1A73E8] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              聚焦起始残基
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">当前结构未检出连续刚性域。</p>
                    )}
                  </div>

                  {/* Quick Switch Between AlphaFold and Experimental PDB for the Same Protein */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="text-xs font-semibold text-slate-900">
                      同源双模对比：计算预测 vs 实验测定晶体结构
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      对比 AlphaFold 全长预测模型（含柔性无序区）与 RCSB PDB 实验测定的核心复合物结构：
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleLoadTarget(record.uniprotId, 'alphafold')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                          record.source === 'alphafold'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        加载 AlphaFold 全长模型 ({record.uniprotId})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadTarget(record.pdbId, 'pdb')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                          record.source === 'pdb'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        加载 RCSB PDB 实验结构 ({record.pdbId})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sequence' && (
                <SequenceTrack
                  record={record}
                  selectedResidue={selectedResidue}
                  onSelectResidue={(res) => setSelectedResidue(res)}
                />
              )}

              {activeTab === 'pae' && (
                <PaeMatrixViewer
                  record={record}
                  onSelectResiduePair={(res) => setSelectedResidue(res)}
                />
              )}

              {activeTab === 'sites' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    点击下方任意关键催化位点、DNA/配体结合位点或 ClinVar 致病突变热点，3D 视图将高亮其侧链构象并标注局部置信度：
                  </p>
                  {record.keySites.length > 0 ? (
                    <div className="space-y-2.5">
                      {record.keySites.map((site) => (
                        <div
                          key={site.residueNumber}
                          className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/60 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {site.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFocusKeySite(site.residueNumber)}
                              className="px-2.5 py-1 text-xs font-mono font-medium text-white bg-[#1A73E8] hover:bg-[#1557B0] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              3D 聚焦 AA {site.residueNumber}
                            </button>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                            <span>残基位置: AA {site.residueNumber}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              类别:{' '}
                              {site.category === 'mutation'
                                ? '临床突变热点'
                                : site.category === 'active_site'
                                ? '催化活性中心'
                                : '配体/核酸结合位点'}
                            </span>
                            {site.clinicalSignificance && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#DC2626] font-semibold">
                                  ClinVar: {site.clinicalSignificance} (致病性)
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {site.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      当前条目暂无预设临床位点注释，请切换至“序列与残基映射”分页点击任意残基进行探索。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RCSB PDB Attribute Filter & Experimental Structure Explorer */}
        <section
          id="rcsb-explorer"
          aria-label="RCSB PDB 实验结构高级检索与同源对标"
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#0D9488]" />
                <span>RCSB PDB 实验测定结构检索器 (Search v2 & GraphQL API)</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                按分辨率上限与实验测定方法筛选当前 UniProt 靶标 ({record.uniprotId}) 关联的实验解析三维结构，支持一键载入 3D 视口。
              </p>
            </div>

            {/* Attribute Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <label htmlFor="resolution-filter" className="text-slate-600 font-medium">
                  分辨率上限:
                </label>
                <select
                  id="resolution-filter"
                  value={maxResolution}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxResolution(val);
                    handleLoadTarget(record.uniprotId, record.source, val, experimentalMethod);
                  }}
                  className="px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value={2.0}>≤ 2.0 Å (高分辨率)</option>
                  <option value={2.5}>≤ 2.5 Å (标准晶体学)</option>
                  <option value={3.5}>≤ 3.5 Å (含冷冻电镜)</option>
                  <option value={10.0}>≤ 10.0 Å (全部记录)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <label htmlFor="method-filter" className="text-slate-600 font-medium">
                  实验方法:
                </label>
                <select
                  id="method-filter"
                  value={experimentalMethod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setExperimentalMethod(val);
                    handleLoadTarget(record.uniprotId, record.source, maxResolution, val);
                  }}
                  className="px-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="ALL">全部实验方法</option>
                  <option value="X-RAY DIFFRACTION">X-RAY DIFFRACTION (X射线衍射)</option>
                  <option value="ELECTRON MICROSCOPY">ELECTRON MICROSCOPY (冷冻电镜)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Query Criteria Explanation Required by PDB Skill */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
            <FileCode2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">查询过滤逻辑说明：</span>
              <span>{record.usedQueryExplanation}</span>
            </div>
          </div>

          {/* Related PDB Entries Table */}
          {record.relatedPdbEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">PDB 编号</th>
                    <th className="py-2.5 px-3 font-semibold">结构标题</th>
                    <th className="py-2.5 px-3 font-semibold">实验方法</th>
                    <th className="py-2.5 px-3 font-semibold">组合分辨率</th>
                    <th className="py-2.5 px-3 font-semibold">发表年份 / PubMed</th>
                    <th className="py-2.5 px-3 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {record.relatedPdbEntries.map((item) => (
                    <tr key={item.rcsb_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#1A73E8]">
                        {item.rcsb_id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 max-w-md truncate">
                        {item.title}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{item.method}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-900">
                        {item.resolution ? `${item.resolution.toFixed(2)} Å` : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {item.year || '—'}
                        {item.pmid && (
                          <>
                            <span className="mx-1">·</span>
                            <a
                              href={`https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              PMID:{item.pmid}
                            </a>
                          </>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleLoadTarget(item.rcsb_id, 'pdb')}
                          className="px-3 py-1 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                        >
                          载入此实验结构
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
              当前过滤条件下未检索到匹配的 RCSB PDB 条目，请尝试放宽分辨率上限或切换为“全部实验方法”。
            </div>
          )}
        </section>

        {/* Scientific Methodology & Architecture Guide */}
        <section
          id="architecture-guide"
          aria-label="科学计算与结构生物学方法学规范"
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">
            科学应用架构说明：3D 蛋白质结构与 AlphaFold 置信度分析规范
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>1. 动态解析 AlphaFold DB (_v6) 与 pLDDT</span>
              </div>
              <p>
                通过 <code>GET https://alphafold.ebi.ac.uk/api/prediction/&#123;uniprot&#125;</code>{' '}
                动态解析最新的 <code>_v6.cif</code> 坐标与 <code>paeDocUrl</code>{' '}
                矩阵。单残基置信度 pLDDT (0–100) 内嵌于 mmCIF 文件的 B-因子列中，严格采用四级标准色阶渲染，并对
                pLDDT &lt; 50 的天然无序区 (IDPR) 发出下游分子对接限制警告。
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>2. RCSB PDB Search v2 与 GraphQL 协同</span>
              </div>
              <p>
                针对实验测定结构（X-射线晶体学、冷冻电镜、NMR），使用带分页参数{' '}
                <code>request_options.paginate</code> 的 RCSB Search v2 接口执行多属性过滤，并结合{' '}
                <code>data.rcsb.org/graphql</code> 批量拉取分辨率与文献 PMID，实现计算模型与实验结构的一键对标。
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-slate-800 shrink-0" />
                <span>3. 序列—结构—误差矩阵三维双向联动</span>
              </div>
              <p>
                集成 WebGL <code>3Dmol.js</code> 渲染引擎与右侧多标签同步检查器。无论在 1D
                氨基酸序列轨、PAE 预测对齐误差矩阵，还是 ClinVar
                临床致病突变表中点击任意残基，三维视口均自动计算球面焦点并平滑飞跃至对应原子坐标。
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div>
          StructBio Workbench · 基于 DeepMind AlphaFold DB、RCSB PDB 与 UniProtKB 开放科学接口构建
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://alphafold.ebi.ac.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900"
          >
            AlphaFold Database
          </a>
          <a
            href="https://www.rcsb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900"
          >
            RCSB Protein Data Bank
          </a>
          <a
            href="https://www.uniprot.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900"
          >
            UniProtKB
          </a>
        </div>
      </footer>
    </div>
  );
}
