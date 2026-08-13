import { VideoProject } from '../types';

export interface ScoreBreakdown {
  score: number; // 5–95, computed from real project data
  feedback: string[];
}

/**
 * Deterministic, data-driven virality estimate. Replaces the old hardcoded
 * "99" that was shown after every analysis regardless of the actual content.
 * The score is derived only from measurable properties of the project:
 * caption coverage & hook timing, description/title quality, music, and
 * duration. It is an estimate, never presented as a real platform metric.
 */
export function computeViralityScore(project: VideoProject): ScoreBreakdown {
  let score = 30; // neutral baseline
  const feedback: string[] = [];

  const subs = Array.isArray(project.subtitles) ? project.subtitles : [];
  const duration = Math.max(1, project.duration || project.originalDuration || 30);

  // Caption coverage: captions are the #1 retention driver for short-form.
  if (subs.length === 0) {
    feedback.push('No captions yet — adding subtitles is the single biggest retention win.');
  } else {
    const coverage = subs.length / Math.max(1, duration / 2.5);
    score += Math.min(25, Math.round(coverage * 10));
    const firstStart = Math.min(...subs.map((s) => Number(s.start) || 0));
    if (firstStart <= 1.5) {
      score += 15;
      feedback.push('Strong hook: first caption lands inside the first 1.5s.');
    } else {
      feedback.push('Hook is late — start the first caption within 1.5 seconds.');
    }
  }

  // Pattern-interrupt language
  const hookWords = subs.filter((s) => /[?!]|stop|wait|secret|watch|never|how to/i.test(s.text));
  if (hookWords.length >= 2) {
    score += 10;
  } else {
    feedback.push('Add pattern-interrupt words (STOP, WAIT, SECRET) to early captions.');
  }

  // Description quality
  const description = (project.description || '').trim();
  if (description.length >= 40) {
    score += 8;
  } else {
    feedback.push('Short description — add context, hashtags and a call to action.');
  }

  // Title quality
  const title = (project.title || '').trim();
  if (title.length >= 10 && title.length <= 60) {
    score += 5;
  } else {
    feedback.push('Title should be 10–60 characters for a clean, clickable hook.');
  }

  // Music
  if (project.selectedMusicTrackId && project.selectedMusicTrackId !== 'none') {
    score += 7;
  } else {
    feedback.push('Add background music — silent videos underperform.');
  }

  // Duration sweet spot
  if (duration >= 12 && duration <= 75) {
    score += 10;
  } else {
    feedback.push('Ideal short-form length is 12–75 seconds.');
  }

  // Styling present
  if (subs.length > 0 && project.captionStyle) {
    score += 5;
  }

  score = Math.max(5, Math.min(95, score));
  if (feedback.length === 0) {
    feedback.push('Solid fundamentals — now A/B test variants of the hook.');
  }
  return { score, feedback };
}
