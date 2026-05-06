/**
 * src/services/correlator.service.js
 * Scores each recent GitHub deploy against the Sentry error to find
 * the most likely culprit. This is the core algorithm of RootSignal.
 *
 * Scoring formula (max 100 points):
 *   - Time proximity (60 pts): deploys closer to the error score higher
 *   - File overlap  (40 pts): deploys that touched files in the stack trace score higher
 *
 * Input:  Array of deploy objects + stack trace files + error timestamp
 * Output: The highest scoring deploy as the hypothesis, with score + confidence
 */

/**
 * scoreByTimeProximity
 * Scores a deploy based on how close it was to the error.
 * A deploy 1 minute before the error scores 60, one 2 hours before scores 0.
 *
 * @param {Date} deployTimestamp
 * @param {Date} errorTimestamp
 * @param {number} windowMinutes
 * @returns {number} Score between 0 and 60
 */
function scoreByTimeProximity(deployTimestamp, errorTimestamp, windowMinutes = 120) {
  const diffMs = errorTimestamp.getTime() - deployTimestamp.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes < 0) return 0;
  if (diffMinutes > windowMinutes) return 0;

  const score = 60 * (1 - diffMinutes / windowMinutes);
  return Math.round(score * 10) / 10;
}

/**
 * scoreByFileOverlap
 * Scores a deploy based on how many files it touched that also
 * appear in the Sentry stack trace.
 *
 * @param {string[]} deployFiles
 * @param {string[]} stackFiles
 * @returns {number} Score between 0 and 40
 */
function scoreByFileOverlap(deployFiles, stackFiles) {
  if (!deployFiles.length || !stackFiles.length) return 0;

  const normalise = (f) =>
    f.replace(/^\.\//, "").replace(/^src\//, "").toLowerCase();

  const normalisedDeploy = deployFiles.map(normalise);
  const normalisedStack = stackFiles.map(normalise);

  let matches = 0;
  for (const stackFile of normalisedStack) {
    for (const deployFile of normalisedDeploy) {
      if (deployFile.includes(stackFile) || stackFile.includes(deployFile)) {
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  const matchRatio = matches / normalisedStack.length;
  const score = 40 * matchRatio;
  return Math.round(score * 10) / 10;
}

/**
 * getConfidenceLevel
 * Converts a numeric score into a confidence label.
 *
 * @param {number} score
 * @returns {"high"|"medium"|"low"}
 */
function getConfidenceLevel(score) {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * scoreDeploys
 * Main export. Scores all recent deploys and returns the highest
 * scoring one as the hypothesis.
 *
 * @param {Array}    deploys
 * @param {string[]} stackFiles
 * @param {Date}     errorTimestamp
 * @returns {{ hypothesis: object|null, scores: Array, confidence: string }}
 */
export function scoreDeploys(deploys, stackFiles, errorTimestamp) {
  if (!deploys || deploys.length === 0) {
    console.log("[correlator] No deploys to score — cannot generate hypothesis");
    return { hypothesis: null, scores: [], confidence: "low" };
  }

  const scored = deploys.map((deploy) => {
    const timeScore = scoreByTimeProximity(deploy.timestamp, errorTimestamp);
    const fileScore = scoreByFileOverlap(deploy.filesChanged ?? [], stackFiles);
    const totalScore = timeScore + fileScore;

    return {
      ...deploy,
      timeScore,
      fileScore,
      totalScore,
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const hypothesis = scored[0];
  const confidence = getConfidenceLevel(hypothesis.totalScore);

  console.log(
    `[correlator] Hypothesis: ${hypothesis.shortSha} by ${hypothesis.author}` +
    ` — score: ${hypothesis.totalScore}` +
    ` (time: ${hypothesis.timeScore}, file: ${hypothesis.fileScore})` +
    ` — confidence: ${confidence}`
  );

  return {
    hypothesis,
    scores: scored,
    confidence,
  };
}