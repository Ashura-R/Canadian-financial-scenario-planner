import { describe, it, expect } from 'vitest';
import { computeCPP, computeEI, computeTax } from '../taxEngine';
import { DEFAULT_ASSUMPTIONS, makeDefaultYear } from '../../store/defaults';

const ass = DEFAULT_ASSUMPTIONS;
const zeroCPP = { pensionableEarnings: 0, cppEmployee: 0, cpp2Employee: 0, cppSE: 0, cpp2SE: 0, cppSEEmployerHalfDed: 0, totalCPPForCredit: 0, totalCPPPaid: 0 };
const zeroEI = { eiEmployment: 0, eiSE: 0, totalEI: 0 };

describe('computeCPP', () => {
  it('zero income produces zero CPP', () => {
    const result = computeCPP(0, 0, ass.cpp);
    expect(result.totalCPPPaid).toBe(0);
  });

  it('income below basic exemption produces zero CPP', () => {
    const result = computeCPP(3000, 0, ass.cpp);
    expect(result.totalCPPPaid).toBe(0);
  });

  it('income between exemption and YMPE computes CPP1 correctly', () => {
    const result = computeCPP(50000, 0, ass.cpp);
    // pensionable = 50000 - basicExemption
    const expected = (50000 - ass.cpp.basicExemption) * ass.cpp.employeeRate;
    expect(result.cppEmployee).toBeCloseTo(expected, 2);
    expect(result.cpp2Employee).toBe(0); // below YMPE
  });

  it('income above YMPE computes both CPP1 and CPP2', () => {
    const income = ass.cpp.ympe + 1500; // e.g. YMPE + $1500
    const result = computeCPP(income, 0, ass.cpp);
    // CPP1: (YMPE - basicExemption) * rate
    const cpp1 = (ass.cpp.ympe - ass.cpp.basicExemption) * ass.cpp.employeeRate;
    expect(result.cppEmployee).toBeCloseTo(cpp1, 2);
    // CPP2: (income - YMPE) * cpp2Rate
    const cpp2 = 1500 * ass.cpp.cpp2Rate;
    expect(result.cpp2Employee).toBeCloseTo(cpp2, 2);
  });

  it('income above YAMPE caps CPP2', () => {
    const result = computeCPP(100000, 0, ass.cpp);
    // CPP2: (YAMPE - YMPE) * cpp2Rate
    const cpp2Max = (ass.cpp.yampe - ass.cpp.ympe) * ass.cpp.cpp2Rate;
    expect(result.cpp2Employee).toBeCloseTo(cpp2Max, 2);
  });

  it('self-employed pays both halves', () => {
    const result = computeCPP(0, 50000, ass.cpp);
    // SE pensionable = 50000 - basicExemption
    const seRate = ass.cpp.employeeRate * 2; // both halves
    expect(result.cppSE).toBeCloseTo((50000 - ass.cpp.basicExemption) * seRate, 2);
    expect(result.cppSEEmployerHalfDed).toBeCloseTo(result.cppSE * 0.5 + result.cpp2SE * 0.5, 2);
  });
});

describe('computeEI', () => {
  it('zero income produces zero EI', () => {
    const result = computeEI(0, 0, ass.ei);
    expect(result.totalEI).toBe(0);
  });

  it('below max insurable computes correctly', () => {
    const result = computeEI(50000, 0, ass.ei);
    expect(result.eiEmployment).toBeCloseTo(50000 * ass.ei.employeeRate, 2);
  });

  it('above max insurable caps EI', () => {
    const result = computeEI(100000, 0, ass.ei);
    expect(result.eiEmployment).toBeCloseTo(ass.ei.maxInsurableEarnings * ass.ei.employeeRate, 2);
  });

  it('self-employed EI is zero when not opted in', () => {
    const result = computeEI(0, 50000, { ...ass.ei, seOptIn: false });
    expect(result.eiSE).toBe(0);
  });

  it('self-employed EI works when opted in', () => {
    const result = computeEI(0, 50000, { ...ass.ei, seOptIn: true });
    expect(result.eiSE).toBeCloseTo(50000 * ass.ei.employeeRate, 2);
  });
});

describe('computeTax', () => {
  const startYear = ass.startYear;

  function taxAtIncome(income: number) {
    const yd = { ...makeDefaultYear(startYear), employmentIncome: income };
    const cpp = computeCPP(income, 0, ass.cpp);
    const ei = computeEI(income, 0, ass.ei);
    return computeTax(yd, ass, cpp, ei);
  }

  it('zero income produces zero tax', () => {
    const result = taxAtIncome(0);
    expect(result.totalIncomeTax).toBe(0);
    expect(result.netTaxableIncome).toBe(0);
  });

  it('income at BPA level produces zero or minimal tax', () => {
    const result = taxAtIncome(ass.federalBPA);
    // At federal BPA, federal tax should be near zero (credits wipe it out)
    expect(result.federalTaxPayable).toBeLessThanOrEqual(0.01);
  });

  it('$50K income produces reasonable tax', () => {
    const result = taxAtIncome(50000);
    expect(result.totalIncomeTax).toBeGreaterThan(0);
    expect(result.totalIncomeTax).toBeLessThan(20000);
    expect(result.marginalCombinedRate).toBeGreaterThan(0);
  });

  it('$100K income produces higher tax than $50K', () => {
    const r50 = taxAtIncome(50000);
    const r100 = taxAtIncome(100000);
    expect(r100.totalIncomeTax).toBeGreaterThan(r50.totalIncomeTax);
    expect(r100.marginalCombinedRate).toBeGreaterThan(r50.marginalCombinedRate);
  });

  it('$200K income has higher marginal rate', () => {
    const r100 = taxAtIncome(100000);
    const r200 = taxAtIncome(200000);
    expect(r200.marginalCombinedRate).toBeGreaterThan(r100.marginalCombinedRate);
  });

  it('$400K income reaches top bracket', () => {
    const result = taxAtIncome(400000);
    // Top federal bracket is 33%, top Ontario is 13.16%
    expect(result.marginalFederalRate).toBeCloseTo(0.33, 2);
    expect(result.marginalProvincialRate).toBeCloseTo(0.1316, 2);
  });

  it('dividend gross-up and credit (eligible)', () => {
    const yd = { ...makeDefaultYear(startYear), eligibleDividends: 50000 };
    const result = computeTax(yd, ass, zeroCPP, zeroEI);
    // Grossed up: 50000 * 1.38 = 69000
    expect(result.grossedUpEligibleDiv).toBeCloseTo(69000, 2);
    // Federal credit on grossed-up amount
    expect(result.detail.fedEligibleDivCredit).toBeCloseTo(69000 * 0.150198, 2);
  });

  it('dividend gross-up and credit (non-eligible)', () => {
    const yd = { ...makeDefaultYear(startYear), nonEligibleDividends: 50000 };
    const result = computeTax(yd, ass, zeroCPP, zeroEI);
    // Grossed up: 50000 * 1.15 = 57500
    expect(result.grossedUpNonEligibleDiv).toBeCloseTo(57500, 2);
    expect(result.detail.fedNonEligibleDivCredit).toBeCloseTo(57500 * 0.090301, 2);
  });

  it('capital gains inclusion rate', () => {
    const yd = { ...makeDefaultYear(startYear), capitalGainsRealized: 100000 };
    const result = computeTax(yd, ass, zeroCPP, zeroEI);
    // Default 50% inclusion
    expect(result.taxableCapitalGains).toBe(50000);
  });

  it('RRSP deduction reduces taxable income', () => {
    const ydBase = { ...makeDefaultYear(startYear), employmentIncome: 100000 };
    const ydRRSP = { ...ydBase, rrspContribution: 10000, rrspDeductionClaimed: 10000 };
    const cpp = computeCPP(100000, 0, ass.cpp);
    const ei = computeEI(100000, 0, ass.ei);

    const rBase = computeTax(ydBase, ass, cpp, ei);
    const rRRSP = computeTax(ydRRSP, ass, cpp, ei);

    expect(rRRSP.netTaxableIncome).toBeCloseTo(rBase.netTaxableIncome - 10000, 2);
    expect(rRRSP.totalIncomeTax).toBeLessThan(rBase.totalIncomeTax);
  });
});
