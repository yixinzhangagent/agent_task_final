export type PlddtTier = 'very_high' | 'confident' | 'low' | 'very_low';

export interface ResiduePlddt {
  residueNumber: number;
  aminoAcid: string;
  oneLetterCode: string;
  plddt: number;
  tier: PlddtTier;
  color: string;
  chain: string;
  x: number;
  y: number;
  z: number;
}

export interface PlddtSummary {
  meanPlddt: number;
  totalResidues: number;
  fractionVeryHigh: number;
  fractionConfident: number;
  fractionLow: number;
  fractionVeryLow: number;
  countVeryHigh: number;
  countConfident: number;
  countLow: number;
  countVeryLow: number;
  isHighlyDisordered: boolean;
  hasIsoformOrLengthWarning: boolean;
  warningMessage: string | null;
  orderedDomains: Array<{ start: number; end: number; meanPlddt: number }>;
  synthesisText: string;
}

export const AA_THREE_TO_ONE: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
  GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
  SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  SEC: 'U', PYL: 'O', UNK: 'X'
};

/**
 * Canonical 4-band AlphaFold pLDDT confidence classification and hex color scale.
 */
export function classifyPlddt(score: number): { tier: PlddtTier; color: string; labelZh: string } {
  if (score > 90) {
    return { tier: 'very_high', color: '#0053D6', labelZh: '极高 (>90)' };
  }
  if (score >= 70) {
    return { tier: 'confident', color: '#65CBF3', labelZh: '较高 (70-90)' };
  }
  if (score >= 50) {
    return { tier: 'low', color: '#FFDB13', labelZh: '较低 (50-70)' };
  }
  return { tier: 'very_low', color: '#FF7D45', labelZh: '极低 (<50 / 无序区)' };
}

/**
 * Determine whether an input string is a 4-character PDB ID or a UniProt accession.
 */
export function detectIdentifierType(rawInput: string): {
  type: 'pdb' | 'uniprot' | 'invalid';
  cleanId: string;
} {
  const cleaned = rawInput.trim().toUpperCase();
  if (!cleaned) {
    return { type: 'invalid', cleanId: '' };
  }
  // Standard PDB ID: 4 alphanumeric characters starting with a digit (e.g. 1TUP, 4HHB, 6VXX)
  if (/^[0-9][A-Z0-9]{3}$/.test(cleaned)) {
    return { type: 'pdb', cleanId: cleaned };
  }
  // Standard UniProtKB accession (6 or 10 alphanumeric characters, e.g. P04637, P38398, P00533, Q9Y6K9)
  if (/^[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/.test(cleaned)) {
    return { type: 'uniprot', cleanId: cleaned };
  }
  return { type: 'invalid', cleanId: cleaned };
}

/**
 * Extract per-residue C-alpha coordinates and B-factor / pLDDT values from mmCIF or PDB text.
 */
export function extractResiduesFromStructureText(structureText: string): ResiduePlddt[] {
  const lines = structureText.split(/\r?\n/);
  const residueMap = new Map<number, ResiduePlddt>();

  for (const line of lines) {
    if (!line.startsWith('ATOM ')) continue;

    // Try standard PDB fixed-column format first if line length fits PDB ATOM record
    const trimmed = line.trim();
    const tokens = trimmed.split(/\s+/);

    // Check if mmCIF style ATOM line (usually has > 14 whitespace-separated columns with atom name CA)
    // Example mmCIF: ATOM 1 N N . MET A 1 1 ? 12.345 23.456 34.567 1.00 38.45 ? 1 MET A N 1
    if (tokens.length >= 15 && (tokens[3] === 'CA' || tokens[2] === 'CA')) {
      const isMmcif = tokens[4] === '.' || tokens[4] === '?' || tokens.length >= 18;
      if (isMmcif && tokens[3] === 'CA') {
        const resName = tokens[5];
        const chainId = tokens[6];
        const seqId = parseInt(tokens[8], 10);
        const x = parseFloat(tokens[10]);
        const y = parseFloat(tokens[11]);
        const z = parseFloat(tokens[12]);
        const bFactor = parseFloat(tokens[14]);

        if (!Number.isNaN(seqId) && !Number.isNaN(bFactor) && !residueMap.has(seqId)) {
          const { tier, color } = classifyPlddt(bFactor);
          residueMap.set(seqId, {
            residueNumber: seqId,
            aminoAcid: resName,
            oneLetterCode: AA_THREE_TO_ONE[resName] || 'X',
            plddt: Number(bFactor.toFixed(2)),
            tier,
            color,
            chain: chainId,
            x: Number.isNaN(x) ? 0 : x,
            y: Number.isNaN(y) ? 0 : y,
            z: Number.isNaN(z) ? 0 : z,
          });
        }
        continue;
      }
    }

    // Fallback to PDB column slicing if atom name is CA
    const atomName = line.slice(12, 16).trim();
    if (atomName === 'CA') {
      const resName = line.slice(17, 20).trim();
      const chainId = line.slice(21, 22).trim() || 'A';
      const seqId = parseInt(line.slice(22, 26).trim(), 10);
      const x = parseFloat(line.slice(30, 38).trim());
      const y = parseFloat(line.slice(38, 46).trim());
      const z = parseFloat(line.slice(46, 54).trim());
      const bFactor = parseFloat(line.slice(60, 66).trim());

      if (!Number.isNaN(seqId) && !Number.isNaN(bFactor) && !residueMap.has(seqId)) {
        const { tier, color } = classifyPlddt(bFactor);
        residueMap.set(seqId, {
          residueNumber: seqId,
          aminoAcid: resName,
          oneLetterCode: AA_THREE_TO_ONE[resName] || 'X',
          plddt: Number(bFactor.toFixed(2)),
          tier,
          color,
          chain: chainId,
          x: Number.isNaN(x) ? 0 : x,
          y: Number.isNaN(y) ? 0 : y,
          z: Number.isNaN(z) ? 0 : z,
        });
      }
    }
  }

  return Array.from(residueMap.values()).sort((a, b) => a.residueNumber - b.residueNumber);
}

/**
 * Analyze per-residue pLDDT scores to compute confidence distribution, ordered domains,
 * disorder warnings, and isoform/length warnings per AlphaFold DB analysis guidelines.
 */
export function analyzePlddtDistribution(
  residues: ResiduePlddt[],
  entryId = 'AF-UNKNOWN-F1'
): PlddtSummary {
  const total = residues.length;
  if (total === 0) {
    return {
      meanPlddt: 0,
      totalResidues: 0,
      fractionVeryHigh: 0,
      fractionConfident: 0,
      fractionLow: 0,
      fractionVeryLow: 0,
      countVeryHigh: 0,
      countConfident: 0,
      countLow: 0,
      countVeryLow: 0,
      isHighlyDisordered: false,
      hasIsoformOrLengthWarning: false,
      warningMessage: null,
      orderedDomains: [],
      synthesisText: '暂无残基置信度数据。',
    };
  }

  let sum = 0;
  let countVeryHigh = 0;
  let countConfident = 0;
  let countLow = 0;
  let countVeryLow = 0;

  for (const r of residues) {
    sum += r.plddt;
    if (r.tier === 'very_high') countVeryHigh++;
    else if (r.tier === 'confident') countConfident++;
    else if (r.tier === 'low') countLow++;
    else countVeryLow++;
  }

  const meanPlddt = Number((sum / total).toFixed(1));
  const fractionVeryHigh = Number((countVeryHigh / total).toFixed(3));
  const fractionConfident = Number((countConfident / total).toFixed(3));
  const fractionLow = Number((countLow / total).toFixed(3));
  const fractionVeryLow = Number((countVeryLow / total).toFixed(3));

  // Detect contiguous ordered segments (pLDDT >= 70 for at least 15 residues, allowing brief <=3 residue dips)
  const orderedDomains: Array<{ start: number; end: number; meanPlddt: number }> = [];
  let currentStart: number | null = null;
  let currentEnd: number | null = null;
  let currentScores: number[] = [];
  let dipCount = 0;

  for (const r of residues) {
    if (r.plddt >= 70) {
      if (currentStart === null) {
        currentStart = r.residueNumber;
      }
      currentEnd = r.residueNumber;
      currentScores.push(r.plddt);
      dipCount = 0;
    } else if (currentStart !== null) {
      dipCount++;
      if (dipCount <= 3) {
        currentScores.push(r.plddt);
        currentEnd = r.residueNumber;
      } else {
        if (currentEnd !== null && currentEnd - currentStart + 1 >= 15) {
          const avg = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
          orderedDomains.push({
            start: currentStart,
            end: currentEnd - dipCount + 1,
            meanPlddt: Number(avg.toFixed(1)),
          });
        }
        currentStart = null;
        currentEnd = null;
        currentScores = [];
        dipCount = 0;
      }
    }
  }
  if (currentStart !== null && currentEnd !== null && currentEnd - currentStart + 1 >= 15) {
    const avg = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
    orderedDomains.push({
      start: currentStart,
      end: currentEnd,
      meanPlddt: Number(avg.toFixed(1)),
    });
  }

  const isHighlyDisordered = fractionVeryLow >= 0.25 || meanPlddt < 65;
  const isNonCanonicalFragment = !entryId.endsWith('-F1') && entryId.includes('-F');
  const isVeryLarge = total > 2700;
  const hasIsoformOrLengthWarning = isNonCanonicalFragment || isVeryLarge;

  let warningMessage: string | null = null;
  if (hasIsoformOrLengthWarning) {
    warningMessage = isVeryLarge
      ? `长度与分片提示：该蛋白质长度超过 2,700 个氨基酸（当前 ${total} AA），AlphaFold 采用重叠分片模型进行预测。`
      : `异构体与分片提示：当前条目 (${entryId}) 并非首个标准全长分片 (-F1)，解释结构边界时请核对 UniProt 残基跨度。`;
  }

  const domainText =
    orderedDomains.length > 0
      ? `识别到 ${orderedDomains.length} 个高置信度刚性折叠域（${orderedDomains
          .map((d) => `AA ${d.start}–${d.end}, 均值 ${d.meanPlddt}`)
          .join('；')}）`
      : '未检测到连续的刚性高置信度结构域';

  const synthesisText = `全局平均 pLDDT 为 ${meanPlddt}（极高置信度占 ${(fractionVeryHigh * 100).toFixed(
    1
  )}%，极低置信度/无序区占 ${(fractionVeryLow * 100).toFixed(
    1
  )}%）。${domainText}。${
    isHighlyDisordered
      ? '显式无序区警告：该结构包含显著比例的天然无序区 (pLDDT < 50)，代表构象高度动态的柔性片段而非固定静态折叠。切勿将全长模型直接用于刚性分子对接或全长 Foldseek 结构比对；下游结构分析应严格限制在上述高置信度结构域残基边界内。'
      : '整体主链拓扑与核心侧链构象高度可靠，适合直接开展活性口袋分析、突变位点评估及结构同源检索。'
  }`;

  return {
    meanPlddt,
    totalResidues: total,
    fractionVeryHigh,
    fractionConfident,
    fractionLow,
    fractionVeryLow,
    countVeryHigh,
    countConfident,
    countLow,
    countVeryLow,
    isHighlyDisordered,
    hasIsoformOrLengthWarning,
    warningMessage,
    orderedDomains,
    synthesisText,
  };
}

/**
 * Build an RCSB PDB Search v2 API JSON query payload with pagination.
 */
export function buildRcsbSearchPayload(options: {
  uniprotId?: string;
  keyword?: string;
  maxResolution?: number;
  experimentalMethod?: string;
  rows?: number;
}) {
  const nodes: any[] = [];

  if (options.uniprotId) {
    nodes.push({
      type: 'terminal',
      service: 'text',
      parameters: {
        attribute: 'rcsb_polymer_entity_container_identifiers.uniprot_ids',
        operator: 'in',
        value: [options.uniprotId.trim().toUpperCase()],
      },
    });
  }

  if (options.keyword) {
    nodes.push({
      type: 'terminal',
      service: 'text',
      parameters: {
        attribute: 'struct.title',
        operator: 'contains_words',
        value: options.keyword.trim(),
      },
    });
  }

  if (typeof options.maxResolution === 'number' && options.maxResolution > 0) {
    nodes.push({
      type: 'terminal',
      service: 'text',
      parameters: {
        attribute: 'rcsb_entry_info.resolution_combined',
        operator: 'less_or_equal',
        value: options.maxResolution,
      },
    });
  }

  if (options.experimentalMethod && options.experimentalMethod !== 'ALL') {
    nodes.push({
      type: 'terminal',
      service: 'text',
      parameters: {
        attribute: 'exptl.method',
        operator: 'exact_match',
        value: options.experimentalMethod,
      },
    });
  }

  return {
    query:
      nodes.length === 1
        ? nodes[0]
        : {
            type: 'group',
            logical_operator: 'and',
            nodes,
          },
    return_type: 'entry',
    request_options: {
      paginate: {
        start: 0,
        rows: options.rows ?? 12,
      },
    },
  };
}
