import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPlddt,
  detectIdentifierType,
  extractResiduesFromStructureText,
  analyzePlddtDistribution,
  buildRcsbSearchPayload,
} from './proteinAnalysis.ts';

test('classifyPlddt maps scores to canonical 4-band AlphaFold colors', () => {
  assert.equal(classifyPlddt(95.4).tier, 'very_high');
  assert.equal(classifyPlddt(95.4).color, '#0053D6');

  assert.equal(classifyPlddt(82.0).tier, 'confident');
  assert.equal(classifyPlddt(82.0).color, '#65CBF3');

  assert.equal(classifyPlddt(58.2).tier, 'low');
  assert.equal(classifyPlddt(58.2).color, '#FFDB13');

  assert.equal(classifyPlddt(34.1).tier, 'very_low');
  assert.equal(classifyPlddt(34.1).color, '#FF7D45');
});

test('detectIdentifierType distinguishes PDB IDs, UniProt accessions, and invalid strings', () => {
  assert.deepEqual(detectIdentifierType('1tup'), { type: 'pdb', cleanId: '1TUP' });
  assert.deepEqual(detectIdentifierType('4HHB'), { type: 'pdb', cleanId: '4HHB' });
  assert.deepEqual(detectIdentifierType('p04637'), { type: 'uniprot', cleanId: 'P04637' });
  assert.deepEqual(detectIdentifierType('P38398'), { type: 'uniprot', cleanId: 'P38398' });
  assert.deepEqual(detectIdentifierType('   '), { type: 'invalid', cleanId: '' });
  assert.deepEqual(detectIdentifierType('NOT_VALID_ID'), { type: 'invalid', cleanId: 'NOT_VALID_ID' });
});

test('extractResiduesFromStructureText parses mmCIF and PDB CA atoms with B-factors', () => {
  const sampleMmcif = [
    'ATOM 1 N N . MET A 1 1 ? 10.000 20.000 30.000 1.00 42.50 ? 1 MET A N 1',
    'ATOM 2 C CA . MET A 1 1 ? 11.000 21.000 31.000 1.00 42.50 ? 1 MET A CA 1',
    'ATOM 3 C CA . GLU A 1 2 ? 14.200 22.100 33.400 1.00 93.20 ? 2 GLU A CA 1',
  ].join('\n');

  const residues = extractResiduesFromStructureText(sampleMmcif);
  assert.equal(residues.length, 2);
  assert.equal(residues[0].residueNumber, 1);
  assert.equal(residues[0].oneLetterCode, 'M');
  assert.equal(residues[0].plddt, 42.5);
  assert.equal(residues[0].tier, 'very_low');
  assert.equal(residues[1].residueNumber, 2);
  assert.equal(residues[1].oneLetterCode, 'E');
  assert.equal(residues[1].plddt, 93.2);
  assert.equal(residues[1].tier, 'very_high');
});

test('analyzePlddtDistribution computes domain boundaries and disorder warnings', () => {
  const mockResidues = [];
  // 1-20: disordered N-terminus (<50)
  for (let i = 1; i <= 20; i++) {
    mockResidues.push({
      residueNumber: i,
      aminoAcid: 'ALA',
      oneLetterCode: 'A',
      plddt: 38.0,
      tier: 'very_low' as const,
      color: '#FF7D45',
      chain: 'A',
      x: i,
      y: 0,
      z: 0,
    });
  }
  // 21-50: ordered core (>90)
  for (let i = 21; i <= 50; i++) {
    mockResidues.push({
      residueNumber: i,
      aminoAcid: 'VAL',
      oneLetterCode: 'V',
      plddt: 94.0,
      tier: 'very_high' as const,
      color: '#0053D6',
      chain: 'A',
      x: i,
      y: 0,
      z: 0,
    });
  }

  const summary = analyzePlddtDistribution(mockResidues, 'AF-P04637-F1');
  assert.equal(summary.totalResidues, 50);
  assert.equal(summary.countVeryLow, 20);
  assert.equal(summary.countVeryHigh, 30);
  assert.equal(summary.isHighlyDisordered, true);
  assert.equal(summary.orderedDomains.length, 1);
  assert.deepEqual(summary.orderedDomains[0], { start: 21, end: 50, meanPlddt: 94 });
  assert.ok(summary.synthesisText.includes('显式无序区警告'));
});

test('buildRcsbSearchPayload constructs valid RCSB Search v2 query with pagination', () => {
  const payload = buildRcsbSearchPayload({
    uniprotId: 'P04637',
    maxResolution: 2.5,
    experimentalMethod: 'X-RAY DIFFRACTION',
    rows: 10,
  });

  assert.equal(payload.return_type, 'entry');
  assert.equal(payload.request_options.paginate.rows, 10);
  assert.equal((payload.query as any).type, 'group');
  assert.equal((payload.query as any).nodes.length, 3);
});
