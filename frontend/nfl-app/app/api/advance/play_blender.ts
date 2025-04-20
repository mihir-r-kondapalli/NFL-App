// Helper function to convert CDF to PDF
function cdfToPdf(values: number[], cdf: number[]): Record<number, number> {
    const pdf: Record<number, number> = {};
    let prevCdf = 0;

    for (let i = 0; i < cdf.length; i++) {
        pdf[values[i]] = cdf[i] - prevCdf;
        prevCdf = cdf[i];
    }

    return pdf;
}

// Helper function to blend distributions using def_weight
export function blendDistributions(
    offenseValues: number[],
    offenseCdf: number[],
    defenseValues: number[],
    defenseCdf: number[],
    def_weight: number
    ): number {
    // Ensure inputs are arrays
    if (!Array.isArray(offenseValues)) offenseValues = [offenseValues];
    if (!Array.isArray(offenseCdf)) offenseCdf = [offenseCdf];
    if (!Array.isArray(defenseValues)) defenseValues = [defenseValues];
    if (!Array.isArray(defenseCdf)) defenseCdf = [defenseCdf];

    // Convert CDFs to PDFs
    const opdf = cdfToPdf(offenseValues, offenseCdf);
    const dpdf = cdfToPdf(defenseValues, defenseCdf);

    // Get all unique values from both distributions
    const allValues = Array.from(new Set([...Object.keys(opdf), ...Object.keys(dpdf)].map(Number))).sort((a, b) => a - b);

    // Blend the distributions using def_weight
    const probs: number[] = [];

    for (const v of allValues) {
        const po = opdf[v] || 0.0;
        const pd = dpdf[v] || 0.0;
        
        // Use def_weight directly for blending
        const wOff = 1 - def_weight;
        const wDef = def_weight;
        
        probs.push(wOff * po + wDef * pd);
    }

    // Normalize probabilities
    const probSum = probs.reduce((sum, prob) => sum + prob, 0);
    const normalizedProbs = probSum > 0 ? probs.map(p => p / probSum) : probs;

    // Calculate cumulative sum for CDF
    const cdf: number[] = [];
    let cumSum = 0;

    for (const prob of normalizedProbs) {
        cumSum += prob;
        cdf.push(Math.round(cumSum * 1000000) / 1000000); // Round to 6 decimal places
    }

    // Generate a random value from the blended distribution
    const randomValue = Math.random();

    for (let i = 0; i < cdf.length; i++) {
        if (randomValue <= cdf[i]) {
        return allValues[i];
        }
    }

    // Default to the last value if nothing matches
    return allValues[allValues.length - 1];
}