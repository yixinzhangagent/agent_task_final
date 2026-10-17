import React, { useEffect, useRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import {
  RotateCcw,
  Play,
  Pause,
  Sun,
  Moon,
  Crosshair,
  Layers,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { LoadedStructureRecord } from '../utils/scienceApi';
import { ResiduePlddt } from '../utils/proteinAnalysis';

export type RenderStyleMode = 'cartoon' | 'stick' | 'sphere' | 'ligand';
export type ColorSchemeMode = 'plddt' | 'spectrum' | 'chain';

interface MolecularViewer3DProps {
  record: LoadedStructureRecord;
  selectedResidue: ResiduePlddt | null;
  onSelectResidue: (residue: ResiduePlddt) => void;
}

export const MolecularViewer3D: React.FC<MolecularViewer3DProps> = ({
  record,
  selectedResidue,
  onSelectResidue,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const residuesRef = useRef<ResiduePlddt[]>(record.residues);
  const onSelectRef = useRef(onSelectResidue);

  const [styleMode, setStyleMode] = useState<RenderStyleMode>('cartoon');
  const [colorMode, setColorMode] = useState<ColorSchemeMode>(
    record.source === 'alphafold' ? 'plddt' : 'spectrum'
  );
  const [isDarkCanvas, setIsDarkCanvas] = useState<boolean>(true);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [webglFallback, setWebglFallback] = useState<boolean>(false);

  useEffect(() => {
    residuesRef.current = record.residues;
    onSelectRef.current = onSelectResidue;
  }, [record.residues, onSelectResidue]);

  // Automatically default color mode based on data provenance
  useEffect(() => {
    setColorMode(record.source === 'alphafold' ? 'plddt' : 'spectrum');
  }, [record.entryId, record.source]);

  const applyViewerStyling = (
    viewer: any,
    currentStyle: RenderStyleMode,
    currentColor: ColorSchemeMode,
    focusedResidue: ResiduePlddt | null
  ) => {
    if (!viewer) return;
    try {
      viewer.removeAllShapes();
      viewer.removeAllLabels();

      const plddtColorFunc = (atom: any) => {
        const b = typeof atom.b === 'number' ? atom.b : 75;
        if (b > 90) return '#0053D6';
        if (b >= 70) return '#65CBF3';
        if (b >= 50) return '#FFDB13';
        return '#FF7D45';
      };

      const styleSpec: any = {};
      if (currentColor === 'plddt') {
        styleSpec.colorfunc = plddtColorFunc;
      } else if (currentColor === 'spectrum') {
        styleSpec.color = 'spectrum';
      } else {
        styleSpec.colorscheme = 'chainHetatm';
      }

      if (currentStyle === 'cartoon') {
        viewer.setStyle({}, { cartoon: styleSpec });
        // Always show bound non-water heteroatoms (ligands, DNA, ions) clearly
        viewer.setStyle(
          { hetflag: true, resn: ['HOH', 'WAT'], invert: true },
          {
            stick: { radius: 0.22, colorscheme: 'Jmol' },
            sphere: { scale: 0.28, colorscheme: 'Jmol' },
          }
        );
      } else if (currentStyle === 'stick') {
        viewer.setStyle({}, { stick: { radius: 0.18, ...styleSpec } });
      } else if (currentStyle === 'sphere') {
        viewer.setStyle({}, { sphere: { scale: 0.65, ...styleSpec } });
      } else if (currentStyle === 'ligand') {
        viewer.setStyle(
          {},
          { cartoon: { color: '#94A3B8', opacity: 0.78 } }
        );
        viewer.setStyle(
          { hetflag: true, resn: ['HOH', 'WAT'], invert: true },
          {
            stick: { radius: 0.28, colorscheme: 'Jmol' },
            sphere: { scale: 0.35, colorscheme: 'Jmol' },
          }
        );
        // Highlight key functional residues in crimson sticks
        const keyResNums = record.keySites.map((s) => s.residueNumber);
        if (keyResNums.length > 0) {
          viewer.setStyle(
            { resi: keyResNums },
            {
              cartoon: { color: '#94A3B8', opacity: 0.78 },
              stick: { radius: 0.26, color: '#DC2626' },
            }
          );
        }
      }

      if (focusedResidue) {
        viewer.addSphere({
          center: { x: focusedResidue.x, y: focusedResidue.y, z: focusedResidue.z },
          radius: 2.2,
          color: '#06B6D4',
          opacity: 0.65,
        });
        viewer.addStyle(
          { resi: focusedResidue.residueNumber },
          { stick: { radius: 0.3, color: '#06B6D4' } }
        );
        viewer.addLabel(
          `${focusedResidue.aminoAcid} ${focusedResidue.residueNumber} (B/pLDDT: ${focusedResidue.plddt})`,
          {
            position: { x: focusedResidue.x, y: focusedResidue.y, z: focusedResidue.z },
            backgroundColor: '#0F172A',
            fontColor: '#F8FAFC',
            fontSize: 12,
            backgroundOpacity: 0.85,
          }
        );
      }

      viewer.render();
    } catch {
      // Safe fallback in software/headless environments
    }
  };

  // Mount 3Dmol WebGL viewer once
  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const viewer = $3Dmol.createViewer(containerRef.current, {
        defaultcolors: $3Dmol.rasmolElementColors,
        backgroundColor: '#0F172A',
        antialias: !(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent)),
      });
      viewerRef.current = viewer;
    } catch {
      setWebglFallback(true);
    }

    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.spin(false);
          viewerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  // Load structure model whenever record changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !record.cifText) return;

    try {
      viewer.spin(false);
      setIsSpinning(false);
      viewer.clear();
      viewer.addModel(record.cifText, record.cifFormat);

      viewer.setClickable({}, true, (atom: any) => {
        if (!atom || typeof atom.resi !== 'number') return;
        const found = residuesRef.current.find((r) => r.residueNumber === atom.resi);
        if (found) {
          onSelectRef.current(found);
        } else {
          onSelectRef.current({
            residueNumber: atom.resi,
            aminoAcid: atom.resn || 'RES',
            oneLetterCode: 'X',
            plddt: typeof atom.b === 'number' ? Number(atom.b.toFixed(1)) : 80,
            tier: 'confident',
            color: '#65CBF3',
            chain: atom.chain || 'A',
            x: atom.x || 0,
            y: atom.y || 0,
            z: atom.z || 0,
          });
        }
      });

      const defaultColor = record.source === 'alphafold' ? 'plddt' : 'spectrum';
      applyViewerStyling(viewer, styleMode, defaultColor, null);
      viewer.zoomTo();
      viewer.render();
    } catch {
      setWebglFallback(true);
    }
  }, [record.entryId, record.cifText, record.cifFormat]);

  // Update styling or focused residue without tearing down model
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    applyViewerStyling(viewer, styleMode, colorMode, selectedResidue);
    if (selectedResidue) {
      try {
        viewer.zoomTo({ resi: selectedResidue.residueNumber }, 400);
        viewer.render();
      } catch {
        // ignore zoom errors
      }
    }
  }, [styleMode, colorMode, selectedResidue]);

  // Background color toggle
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    try {
      viewer.setBackgroundColor(isDarkCanvas ? '#0F172A' : '#F8FAFC');
      viewer.render();
    } catch {
      // ignore
    }
  }, [isDarkCanvas]);

  const handleToggleSpin = () => {
    const next = !isSpinning;
    setIsSpinning(next);
    if (viewerRef.current) {
      try {
        viewerRef.current.spin(next ? 'y' : false);
      } catch {
        // ignore
      }
    }
  };

  const handleResetCamera = () => {
    if (viewerRef.current) {
      try {
        viewerRef.current.zoomTo();
        viewerRef.current.render();
      } catch {
        // ignore
      }
    }
  };

  const handleZoom = (factor: number) => {
    if (viewerRef.current) {
      try {
        viewerRef.current.zoom(factor);
        viewerRef.current.render();
      } catch {
        // ignore
      }
    }
  };

  return (
    <section
      aria-label="3D 分子结构视口与渲染控制器"
      className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full">
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
            渲染样式
          </span>
          <div
            role="group"
            aria-label="三维结构渲染样式切换"
            className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg"
          >
            {(
              [
                { id: 'cartoon', label: '飘带 (Cartoon)' },
                { id: 'ligand', label: '活性口袋与配体' },
                { id: 'stick', label: '棍状 (Stick)' },
                { id: 'sphere', label: '球体 (Sphere)' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStyleMode(item.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  styleMode === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto max-w-full">
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
            着色编码
          </span>
          <div
            role="group"
            aria-label="分子结构着色编码切换"
            className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg"
          >
            {(
              [
                { id: 'plddt', label: 'pLDDT / B-因子' },
                { id: 'spectrum', label: 'N→C 彩虹谱' },
                { id: 'chain', label: '多肽链区分' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setColorMode(item.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  colorMode === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3D WebGL Stage */}
      <div className="relative w-full h-[460px] lg:h-[520px] select-none">
        <div
          ref={containerRef}
          data-testid="molecular-3d-canvas"
          data-entry-id={record.entryId}
          data-style-mode={styleMode}
          data-color-mode={colorMode}
          className={`w-full h-full cursor-crosshair ${
            isDarkCanvas ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'
          }`}
        />

        {/* SVG Structural Projection Overlay if headless software WebGL fallback activates */}
        {webglFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 pointer-events-none">
            <svg
              viewBox="-35 -35 70 70"
              className="w-64 h-64 opacity-90"
              aria-label="三维主链碳原子投影图"
            >
              <polyline
                fill="none"
                stroke="#06B6D4"
                strokeWidth="0.9"
                points={record.residues
                  .slice(0, 180)
                  .map((r) => `${r.x.toFixed(1)},${r.y.toFixed(1)}`)
                  .join(' ')}
              />
            </svg>
          </div>
        )}

        {/* Top Overlay Bar: Flex-wrapped so badge and camera buttons never overlap on mobile */}
        <div className="absolute top-3 inset-x-3 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs ${
              isDarkCanvas
                ? 'bg-slate-900/85 border-slate-700 text-slate-200'
                : 'bg-white/90 border-slate-200 text-slate-800'
            }`}
          >
            <div className="font-mono font-semibold flex items-center gap-2">
              <span>{record.entryId}</span>
              <span aria-hidden="true">·</span>
              <span>{record.gene}</span>
              <span aria-hidden="true">·</span>
              <span>{record.residues.length} 残基</span>
            </div>
            <div className="hidden sm:block text-[11px] opacity-80 mt-0.5">
              {record.source === 'alphafold'
                ? '数据来源：AlphaFold DB 预测模型 · B-因子列存储单残基 pLDDT (0-100)'
                : `数据来源：RCSB PDB 实验测定 (${record.experimentalMethod}${
                    record.resolution ? ` · ${record.resolution.toFixed(2)} Å` : ''
                  })`}
            </div>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => handleZoom(1.25)}
              aria-label="放大三维视图"
              title="放大视图"
              className="p-2 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(0.8)}
              aria-label="缩小三维视图"
              title="缩小视图"
              className="p-2 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToggleSpin}
              aria-label={isSpinning ? '停止旋转结构' : '自动旋转结构'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isSpinning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSpinning ? '停止旋转' : '自动旋转'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetCamera}
              aria-label="重置三维视角"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置视角</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDarkCanvas(!isDarkCanvas)}
              aria-label={isDarkCanvas ? '切换至浅色画布背景' : '切换至深色画布背景'}
              className="p-2 rounded-lg bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
            >
              {isDarkCanvas ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Focused Residue HUD */}
        {selectedResidue && (
          <div
            className={`absolute bottom-3 left-3 px-3.5 py-2.5 rounded-lg border text-xs ${
              isDarkCanvas
                ? 'bg-slate-900/90 border-cyan-500/50 text-slate-100'
                : 'bg-white/95 border-cyan-600/40 text-slate-900 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2 font-mono font-semibold">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                选中残基：{selectedResidue.aminoAcid} {selectedResidue.residueNumber} (链{' '}
                {selectedResidue.chain})
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {record.source === 'alphafold' ? 'pLDDT' : 'B-Factor'}:{' '}
                {selectedResidue.plddt.toFixed(1)}
              </span>
            </div>
            <div className="font-mono text-[11px] opacity-80 mt-0.5">
              三维坐标：(X: {selectedResidue.x.toFixed(2)} Å, Y: {selectedResidue.y.toFixed(2)} Å,
              Z: {selectedResidue.z.toFixed(2)} Å)
            </div>
          </div>
        )}
      </div>

      {/* Canonical 4-Band AlphaFold pLDDT Color Scale Legend */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>AlphaFold pLDDT 单残基置信度标准色阶 (存储于 mmCIF B-因子列)：</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-slate-700">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-xs bg-[#0053D6] inline-block" />
            <span>极高 (&gt;90)</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-xs bg-[#65CBF3] inline-block" />
            <span>较高 (70–90)</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-xs bg-[#FFDB13] inline-block" />
            <span>较低 (50–70)</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-xs bg-[#FF7D45] inline-block" />
            <span>极低 (&lt;50 / 无序区)</span>
          </span>
        </div>
      </div>
    </section>
  );
};
